"""Compile and run every code sample of the site and report the ones that do not work.

Usage: python3 tests/code/check_code_blocks.py [--workdir DIR] [--jobs N] [PAGE ...]

Without PAGE arguments all lesson pages are checked. Languages: Python (sh_python), C++ (sh_cpp),
C (sh_c), Rust (language-rust), Pascal (sh_pascal), Java (sh_java). Other blocks (pseudocode, BASIC)
are counted but not checked.

Each block is compiled and run in its own directory under --workdir, outside the repository.
A program is a block with main(); a block without main() is a fragment and is only compiled.
Statuses:
  PASS      compiled and ran with exit code 0
  COMPILE   the compiler or the Python parser rejects the code
  RUN       the program failed at run time (exception, non-zero exit code)
  INPUT     the program reads a data file or standard input that the checker does not have
  TIMEOUT   the program ran longer than the limit
  FRAGMENT  no main(): compiled as a unit only; FRAGMENT_OK / FRAGMENT_FAIL say whether it compiled
The exit code is 1 if there are COMPILE or RUN failures.
"""
import argparse
import concurrent.futures
import html
import json
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
SKIPPED_DIRS = {".git", ".idea", "node_modules", "test-results", "playwright-report", "tests", "common",
                "_templates", "FlashPascal", "plastex", "highlight"}
PRE = re.compile(r"<pre(?P<attrs>[^>]*)>(?P<body>.*?)</pre>", re.S | re.I)
TAG = re.compile(r"</?[A-Za-z][^>]*>|<!--.*?-->", re.S)  # only what a browser reads as a tag
CLASS_LANG = {"sh_python": "python", "sh_cpp": "cpp", "sh_c": "c", "sh_pascal": "pascal", "sh_java": "java"}
TIMEOUT = 10


def lesson_pages():
    for path in sorted(ROOT.rglob("*.htm*")):
        if not SKIPPED_DIRS.intersection(path.relative_to(ROOT).parts[:-1]):
            yield path.relative_to(ROOT).as_posix()


def blocks_of(page):
    """Yield (number, language, code) for every <pre> block of the page."""
    text = (ROOT / page).read_text(encoding="utf-8", errors="replace")
    for number, match in enumerate(PRE.finditer(text), start=1):
        body = match.group("body")
        classes = re.findall(r'class="([^"]*)"', match.group("attrs"))
        language = next((CLASS_LANG[name] for name in classes[0].split() if name in CLASS_LANG), None) if classes else None
        if "language-rust" in body:
            language = "rust"
        if language is None:
            continue
        code = html.unescape(TAG.sub("", body)).strip("\n") + "\n"
        yield number, language, code


def run(command, cwd):
    try:
        result = subprocess.run(command, cwd=cwd, stdin=subprocess.DEVNULL, capture_output=True,
                                timeout=TIMEOUT, text=True, errors="replace")
    except subprocess.TimeoutExpired:
        return None, "time limit"
    return result.returncode, (result.stdout + result.stderr).strip()


def first_line(text, prefer=None):
    lines = [line for line in text.splitlines() if line.strip()]
    if prefer:
        lines = [line for line in lines if re.search(prefer, line)] or lines
    return lines[0][:220] if lines else ""


def has_main(language, code):
    patterns = {"python": r"__name__", "cpp": r"\bmain\s*\(", "c": r"\bmain\s*\(", "rust": r"\bfn\s+main\s*\(",
                "pascal": r"^\s*program\b|\bbegin\b.*\bend\.", "java": r"static\s+void\s+main\s*\("}
    return re.search(patterns[language], code, re.I | re.M) is not None


def check_python(code, directory):
    try:
        compile(code, "block.py", "exec")
    except SyntaxError as error:
        return "COMPILE", f"line {error.lineno}: {error.msg}"
    source = directory / "block.py"
    source.write_text(code, encoding="utf-8")
    return classify_run([sys.executable, "-X", "utf8", str(source)], directory)


def classify_run(command, directory):
    code, output = run(command, directory)
    if code is None:
        return "TIMEOUT", ""
    if code == 0:
        return "PASS", ""
    if re.search(r"FileNotFoundError|EOFError|No such file", output):
        return "INPUT", first_line(output, "Error|error")
    return "RUN", first_line(output, "Error|error|panic|Segmentation|exception")


def check_cpp_like(code, directory, compiler, flags, main_name):
    source = directory / ("block.cpp" if compiler == "g++" else "block.c")
    source.write_text(code, encoding="utf-8")
    if not has_main("cpp" if compiler == "g++" else "c", code):
        status, output = run([compiler, *flags, "-fsyntax-only", source.name], directory)
        return ("FRAGMENT_OK" if status == 0 else "FRAGMENT_FAIL"), first_line(output, "error")
    status, output = run([compiler, *flags, source.name, "-o", "block_bin"], directory)
    if status != 0:
        return "COMPILE", first_line(output, "error")
    return classify_run([str(directory / "block_bin")], directory)


def check_rust(code, directory):
    source = directory / "block.rs"
    source.write_text(code, encoding="utf-8")
    flags = ["rustc", "--edition", "2021", "-O"]
    if not has_main("rust", code):
        status, output = run(["rustc", "--edition", "2021", "--crate-type", "lib", "--emit=metadata",
                              "-o", "block.rmeta", source.name], directory)
        return ("FRAGMENT_OK" if status == 0 else "FRAGMENT_FAIL"), first_line(output, "error")
    status, output = run(flags + [source.name, "-o", "block_bin"], directory)
    if status != 0:
        return "COMPILE", first_line(output, "error")
    return classify_run([str(directory / "block_bin")], directory)


def check_pascal(code, directory):
    source = directory / "block.pas"
    source.write_text(code, encoding="latin-1", errors="replace")
    if not has_main("pascal", code):
        return "FRAGMENT", ""
    for mode in ("-Mtp", "-Mdelphi"):
        status, output = run(["fpc", mode, "-o" + str(directory / "block_bin"), source.name], directory)
        if status == 0:
            return classify_run([str(directory / "block_bin")], directory)
    return "COMPILE", first_line(output, "Error")


def check_java(code, directory):
    match = re.search(r"public\s+class\s+(\w+)", code)
    name = match.group(1) if match else "Main"
    (directory / f"{name}.java").write_text(code, encoding="utf-8")
    if not has_main("java", code):
        return "FRAGMENT", ""
    status, output = run(["javac", f"{name}.java"], directory)
    if status != 0:
        return "COMPILE", first_line(output, "error")
    return classify_run(["java", "-cp", str(directory), name], directory)


CHECKERS = {"python": lambda code, d: check_python(code, d),
            "cpp": lambda code, d: check_cpp_like(code, d, "g++", ["-std=c++17"], "main"),
            "c": lambda code, d: check_cpp_like(code, d, "gcc", ["-std=c11"], "main"),
            "rust": check_rust, "pascal": check_pascal, "java": check_java}


def check_block(job):
    page, number, language, code, workdir = job
    directory = workdir / (re.sub(r"\W+", "_", page) + f"_{number}")
    directory.mkdir(parents=True, exist_ok=True)
    status, message = CHECKERS[language](code, directory)
    return {"page": page, "block": number, "language": language, "status": status, "message": message}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pages", nargs="*", help="pages to check (default: all lesson pages)")
    parser.add_argument("--workdir", default=None, help="directory for the compiled programs")
    parser.add_argument("--jobs", type=int, default=6, help="blocks checked in parallel")
    parser.add_argument("--report", default=None, help="write the results as JSON to this file")
    parser.add_argument("--root", default=None, help="check the pages under this directory instead of the repository")
    args = parser.parse_args()
    global ROOT
    if args.root:
        ROOT = pathlib.Path(args.root).resolve()
    workdir = pathlib.Path(args.workdir or tempfile.mkdtemp(prefix="codecheck-")).resolve()
    workdir.mkdir(parents=True, exist_ok=True)
    pages = args.pages or list(lesson_pages())
    jobs = [(page, number, language, code, workdir) for page in pages for number, language, code in blocks_of(page)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        results = list(pool.map(check_block, jobs))
    counts = {}
    for result in results:
        counts.setdefault(result["language"], {}).setdefault(result["status"], 0)
        counts[result["language"]][result["status"]] += 1
    for language in sorted(counts):
        print(language, dict(sorted(counts[language].items())))
    failures = [r for r in results if r["status"] in ("COMPILE", "RUN", "TIMEOUT")]
    print(f"blocks checked: {len(results)}; failures: {len(failures)}; workdir: {workdir}")
    for r in failures:
        print(f"  {r['status']:8} {r['language']:7} {r['page']} #{r['block']}: {r['message']}")
    if args.report:
        pathlib.Path(args.report).write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
