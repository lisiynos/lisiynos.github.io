"""Compile and run every code sample of the site and report the ones that do not work.

Usage: python3 tests/code/check_code_blocks.py [--workdir DIR] [--jobs N] [PAGE ...]

Without PAGE arguments all lesson pages are checked. Languages: Python (sh_python), C++ (sh_cpp),
C (sh_c), Rust (language-rust), Pascal (sh_pascal), Java (sh_java). Other blocks (pseudocode, BASIC)
are counted but not checked.

Each block is compiled and run in its own directory under --workdir, outside the repository. A C or
C++ block may include, and a Pascal block may use, a file of the page's folder or of its asset folder
(s6/olymp/ for s6/olymp.html), such as testlib.h or testlib.pas.
A program is a block with main(); a block without main() is a fragment and is only compiled. A Pascal
block is a program when it starts with program or ends with end., which a comment may follow on the
same line (a unit is a fragment).
Statuses:
  PASS      compiled and ran with exit code 0
  COMPILE   the compiler or the Python parser rejects the code
  RUN       the program failed at run time (exception, non-zero exit code)
  INPUT     the program reads a data file or standard input that the checker does not have, so its
            run-time failure, or its time limit (a read of nothing may loop forever), says nothing
            about the code
  TIMEOUT   the program ran longer than the limit and reads no input
  FRAGMENT  no main(): compiled as a unit only; FRAGMENT_OK / FRAGMENT_FAIL say whether it compiled
The exit code is 1 if there are COMPILE, RUN or TIMEOUT failures.

The compile commands live here once: build() turns a source file into the command that runs the
program, and run() runs a command. check_solutions.py judges the solutions of tasks/ with both.
"""
import argparse
import concurrent.futures
import html
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from typing import NamedTuple

ROOT = pathlib.Path(__file__).resolve().parents[2]
SKIPPED_DIRS = {".git", ".idea", "node_modules", "test-results", "playwright-report", "tests", "common",
                "_templates", "FlashPascal", "plastex", "highlight"}
PRE = re.compile(r"<pre(?P<attrs>[^>]*)>(?P<body>.*?)</pre>", re.S | re.I)
TAG = re.compile(r"</?[A-Za-z][^>]*>|<!--.*?-->", re.S)  # only what a browser reads as a tag
CLASS_LANG = {"sh_python": "python", "sh_cpp": "cpp", "sh_c": "c", "sh_pascal": "pascal", "sh_java": "java"}
SUFFIX = {"python": ".py", "cpp": ".cpp", "c": ".c", "rust": ".rs", "pascal": ".pas", "java": ".java"}
COMPILERS = {"cpp": ["g++", "-std=c++17"], "c": ["gcc", "-std=c11"]}  # the compiler of C++ and of C with its standard
RUSTC = ["rustc", "--edition", "2021"]
TIMEOUT = 10


def lesson_pages():
    for path in sorted(ROOT.rglob("*.htm*")):
        if not SKIPPED_DIRS.intersection(path.relative_to(ROOT).parts[:-1]):
            yield path.relative_to(ROOT).as_posix()


def blocks_of(page):
    """Yield (number, language, code) for every <pre> block of the page.

    A block with data-src holds only a link to a solution file in tasks/, which check_solutions.py runs on
    its tests, so it is skipped here; it still counts in the numbering of the blocks.
    """
    text = (ROOT / page).read_text(encoding="utf-8", errors="replace")
    for number, match in enumerate(PRE.finditer(text), start=1):
        if re.search(r"\bdata-src\s*=", match.group("attrs")):
            continue
        body = match.group("body")
        classes = re.findall(r'class="([^"]*)"', match.group("attrs"))
        language = next((CLASS_LANG[name] for name in classes[0].split() if name in CLASS_LANG), None) if classes else None
        if "language-rust" in body:
            language = "rust"
        if language is None:
            continue
        code = html.unescape(TAG.sub("", body)).strip("\n") + "\n"
        yield number, language, code


class Outcome(NamedTuple):
    """What a command did: its exit code (None after a timeout), its standard output and its standard error."""
    code: int | None
    stdout: str
    stderr: str

    @property
    def output(self):
        return (self.stdout + self.stderr).strip()


def run(command, cwd, timeout=TIMEOUT, stdin=b""):
    """Run the command in cwd with the bytes stdin on its standard input, for at most timeout seconds."""
    try:
        result = subprocess.run(command, cwd=cwd, input=stdin, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return Outcome(None, "", "time limit")
    except FileNotFoundError:
        return Outcome(127, "", f"{command[0]}: command not found")
    return Outcome(result.returncode, decoded(result.stdout), decoded(result.stderr))


def decoded(data):
    return data.decode("utf-8", errors="replace")


def first_line(text, prefer=None):
    lines = [line for line in text.splitlines() if line.strip()]
    if prefer:
        lines = [line for line in lines if re.search(prefer, line)] or lines
    return lines[0][:220] if lines else ""


PROGRAM_PATTERN = {"python": r"__name__", "cpp": r"\bmain\s*\(", "c": r"\bmain\s*\(", "rust": r"\bfn\s+main\s*\(",
                   "pascal": r"^\s*program\b|\bend\.\s*(\{[^}]*\}|\(\*(?s:.*?)\*\)|//.*)?\s*\Z",  # a comment may follow end.
                   "java": r"static\s+void\s+main\s*\("}


def has_main(language, code):
    """Whether the block is a whole program. A Pascal block is one when it starts with program or ends
    with end., and is not a unit."""
    if language == "pascal" and re.match(r"\s*unit\b", code, re.I):
        return False
    return re.search(PROGRAM_PATTERN[language], code, re.I | re.M) is not None


def build(language, source, directory, flags=()):
    """Compile the program in the file source, which lies in directory, and say how to run it.

    Returns (command, "") where command runs the program: the interpreter with the file for Python,
    java with the class path and the qualified class name for Java, the binary in directory for the
    rest. Returns (None, message) with the first error line when the build fails. Python is only
    checked with compile(); Pascal is tried in the modes -Mdelphi and then -Mtp; a Java file is
    compiled under the name of its class (copied to <Class>.java when it is named otherwise); C, C++
    and Pascal get the extra compiler options flags, such as the include or unit paths of the page.
    """
    return BUILDERS[language](source, directory, list(flags))


def build_python(source):
    try:
        compile(source.read_bytes(), source.name, "exec")
    except SyntaxError as error:
        return None, f"line {error.lineno}: {error.msg}"
    return [sys.executable, "-X", "utf8", str(source)], ""


def build_native(command, source, directory):
    """Compile with command (the compiler and its options) into a binary next to the source."""
    binary = directory / (source.stem + "_bin")
    outcome = run([*command, source.name, "-o", str(binary)], directory)
    if outcome.code != 0:
        return None, first_line(outcome.output, "error")
    return [str(binary)], ""


def build_pascal(source, directory, flags=()):
    """fpc in mode delphi, which the course assumes (a 32-bit Integer, Int64, Result), else in mode tp;
    a failure reports the error of mode delphi. The units the program uses are compiled into directory
    (-FU), not beside their source."""
    binary = directory / (source.stem + "_bin")

    def compile_in(mode):
        return run(["fpc", mode, *flags, "-FU" + str(directory), "-o" + str(binary), source.name], directory)

    delphi = compile_in("-Mdelphi")
    if delphi.code != 0 and compile_in("-Mtp").code != 0:
        return None, first_line(delphi.output, "Fatal|Error")
    return [str(binary)], ""


def build_java(source, directory):
    # javac wants the file named after the public class, or the first class when none is public;
    # a package prefixes the name of the class that is run.
    code = source.read_text(encoding="utf-8", errors="replace")
    match = re.search(r"public\s+class\s+(\w+)", code) or re.search(r"\bclass\s+(\w+)", code)
    name = match.group(1) if match else "Main"
    package = re.search(r"^\s*package\s+([\w.]+)\s*;", code, re.M)
    target = directory / f"{name}.java"
    if target != source:
        shutil.copyfile(source, target)
    outcome = run(["javac", "-d", str(directory), target.name], directory)
    if outcome.code != 0:
        return None, first_line(outcome.output, "error")
    qualified = f"{package.group(1)}.{name}" if package else name
    return ["java", "-cp", str(directory), qualified], ""


BUILDERS = {"python": lambda source, directory, flags: build_python(source),
            "cpp": lambda source, directory, flags: build_native([*COMPILERS["cpp"], *flags], source, directory),
            "c": lambda source, directory, flags: build_native([*COMPILERS["c"], *flags], source, directory),
            "rust": lambda source, directory, flags: build_native([*RUSTC, "-O"], source, directory),
            "pascal": lambda source, directory, flags: build_pascal(source, directory, flags),
            "java": lambda source, directory, flags: build_java(source, directory)}


def write_block(language, code, directory, encoding="utf-8"):
    """Write the code of a block to block.<suffix> in directory and return the path."""
    source = directory / ("block" + SUFFIX[language])
    source.write_text(code, encoding=encoding, errors="replace")
    return source


def build_and_run(language, source, directory, flags=()):
    command, message = build(language, source, directory, flags)
    if command is None:
        return "COMPILE", message
    return classify_run(command, directory)


def classify_run(command, directory):
    outcome = run(command, directory, timeout=TIMEOUT)  # read here, so that a test may lower the module's limit
    if outcome.code is None:
        return "TIMEOUT", ""
    if outcome.code == 0:
        return "PASS", ""
    if re.search(r"FileNotFoundError|EOFError|No such file", outcome.output):
        return "INPUT", first_line(outcome.output, "Error|error")
    return "RUN", first_line(outcome.output, "Error|error|panic|Segmentation|exception")


def check_python(code, directory):
    return build_and_run("python", write_block("python", code, directory), directory)


def check_cpp_like(code, directory, language, flags):
    source = write_block(language, code, directory)
    if not has_main(language, code):
        outcome = run([*COMPILERS[language], *flags, "-fsyntax-only", source.name], directory)
        return ("FRAGMENT_OK" if outcome.code == 0 else "FRAGMENT_FAIL"), first_line(outcome.output, "error")
    return build_and_run(language, source, directory, flags)


def check_rust(code, directory):
    source = write_block("rust", code, directory)
    if not has_main("rust", code):
        outcome = run([*RUSTC, "--crate-type", "lib", "--emit=metadata", "-o", "block.rmeta", source.name], directory)
        return ("FRAGMENT_OK" if outcome.code == 0 else "FRAGMENT_FAIL"), first_line(outcome.output, "error")
    return build_and_run("rust", source, directory)


def check_pascal(code, directory, flags=()):
    source = write_block("pascal", code, directory, encoding="latin-1")
    if not has_main("pascal", code):
        return "FRAGMENT", ""
    return build_and_run("pascal", source, directory, flags)


def check_java(code, directory):
    if not has_main("java", code):
        return "FRAGMENT", ""
    return build_and_run("java", write_block("java", code, directory), directory)


def folder_flags(page, option):
    """The option (-I of gcc, -Fu of fpc) with the page's folder and with its asset folder (s6/olymp/ for
    s6/olymp.html), where files such as testlib.h and testlib.pas live."""
    path = ROOT / page
    return [option + str(folder) for folder in (path.parent, path.with_suffix(""))]


CHECKERS = {"python": lambda code, d, page: check_python(code, d),
            "cpp": lambda code, d, page: check_cpp_like(code, d, "cpp", folder_flags(page, "-I")),
            "c": lambda code, d, page: check_cpp_like(code, d, "c", folder_flags(page, "-I")),
            "rust": lambda code, d, page: check_rust(code, d),
            "pascal": lambda code, d, page: check_pascal(code, d, folder_flags(page, "-Fu")),
            "java": lambda code, d, page: check_java(code, d)}

# A program that reads standard input gets nothing from the checker, so its run-time failure or time limit is
# INPUT, not RUN or TIMEOUT. Pascal is case-insensitive (Readln, ReadLn), the other languages are not.
READS_INPUT = {"python": r"\binput\s*\(|sys\.stdin", "rust": r"\bstdin\s*\(", "java": r"System\.in\b",
               "pascal": r"(?i)\bread(ln)?\b", "cpp": r"\bcin\b|\b(scanf|getline|getchar|gets|getc|fread)\s*\(",
               "c": r"\b(scanf|getline|getchar|gets|getc|fread)\s*\("}


def check_block(job):
    page, number, language, code, workdir = job
    directory = workdir / (re.sub(r"\W+", "_", page) + f"_{number}")
    directory.mkdir(parents=True, exist_ok=True)
    status, message = CHECKERS[language](code, directory, page)
    if status in ("RUN", "TIMEOUT") and re.search(READS_INPUT[language], code):
        status = "INPUT"
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
