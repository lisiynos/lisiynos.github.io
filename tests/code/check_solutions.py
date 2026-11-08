"""Run every solution of the tasks on the tests of its task and compare the verdicts with the expected ones.

Usage: python3 tests/code/check_solutions.py [--workdir DIR] [--tasks-dir DIR] [TASK ...]

Without TASK arguments every folder of tasks/ with a task.json is checked. A task folder holds:
  task.json   {"title": "A+B", "input": "sum.in", "output": "sum.out", "time_limit": 2,
               "compare": "tokens", "solutions": {"sum_wa.pas": {"expect": "WA"}}}
              input and output are the files the solution reads and writes in its working folder, or
              "stdin" and "stdout" (the default); time_limit is in seconds per test (default 2);
              compare is "tokens" (default: the whitespace-separated tokens must match), "exact"
              (the text must match after trailing whitespace on each line and at the end is removed)
              or "numbers" (the token lists have the same length, two numbers are equal when
              |a - b| <= tolerance * max(1, |a|, |b|), tolerance 1e-6 unless task.json sets it, and
              the other tokens must be equal as text; the numbers are compared exactly, as rationals,
              so a number of any length or size is fine);
              checker names a Python program of the task folder that judges instead of compare: it is
              run as python3 -I checker input output answer (absolute paths) in the folder of the test
              with the time limit of a test, exit code 0 is OK, 1 is WA, 2 is PE, and the first
              non-empty line of its standard output is the message; it must not print to standard
              error (see ERROR below);
              solutions gives, for single solution files (which must exist), their own input, output
              and expect: the verdict the solution must get, OK for every solution without one.
  tests/      the pairs NN (input) and NN.a (expected answer), NN a number of any width, run in
              numeric order.
  solutions   every file .py, .cpp, .c, .pas, .java or .rs directly in the folder, except the checker.

Every solution is built in its own folder <number>_<name> under --workdir (a temporary folder by
default), C and C++ with -O2, and run on the tests until one fails, each test in a clean folder.
Verdicts:
  OK   every test passed
  WA   wrong answer
  PE   presentation error: the output differs from the answer as text but not as numbers (see
       below), or the output file was not written
  RE   exit code other than 0
  TL   longer than time_limit
  CE   the build failed
The PE rule: the token lists differ as strings but are equal after every token that is a number is
replaced by its exact value, so "3" against "3.0" or "100" against "1e2" is PE, "3" against
"a + b = 3" is WA, and extra blank lines are not an error at all, because the comparison by tokens
ignores whitespace. A number is a token of the form [+-]digits[.digits][e[+-]digits], ".5" or "5.";
"inf", "nan", "1_000" and digits of other scripts are text, which must match as text. With compare
"exact" or "numbers" there is no PE of this kind.

A solution passes when its verdict (for a failure: the verdict of its first failing test) equals
the expected one. The exit code is 1 when a solution does not pass or a task folder is broken (no
tests, an input without its .a file, bad task.json). A checker that exits with another code, prints
anything to standard error (a traceback, a SyntaxError report, a warning) or runs past the time limit
has failed, which is an ERROR of the task: the verdict of the solution is ERROR, which no solution is
expected to get, so it counts as a failure. On GitHub Actions (GITHUB_STEP_SUMMARY set)
the results are also appended to the step summary as a table, and every failure gets an ::error
annotation.
"""
import argparse
import fractions
import html
import json
import os
import pathlib
import re
import shutil
import sys
import tempfile
from typing import NamedTuple

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # the checker lies beside this script
from check_code_blocks import COMPILERS, ROOT, SUFFIX, build, first_line, run

LANGUAGE = {suffix: language for language, suffix in SUFFIX.items()}
VERDICTS = ("OK", "WA", "PE", "RE", "TL", "CE")
CHECKER_VERDICTS = {0: "OK", 1: "WA", 2: "PE"}  # by the exit code of a checker; any other is an ERROR of the task
DEFAULTS = {"input": "stdin", "output": "stdout", "time_limit": 2, "compare": "tokens", "tolerance": 1e-6,
            "checker": None, "solutions": {}}
FLAGS = ["-O2"]  # C and C++ solutions, the languages of COMPILERS, are compiled optimised, as a judge does


def is_number(value):
    """A JSON number; JSON true and false are int in Python and are not accepted."""
    return isinstance(value, (int, float)) and not isinstance(value, bool)


RULES = {"title": (lambda value: isinstance(value, str), "a string"),
         "input": (lambda value: isinstance(value, str) and value != "", 'a file name or "stdin"'),
         "output": (lambda value: isinstance(value, str) and value != "", 'a file name or "stdout"'),
         "time_limit": (lambda value: is_number(value) and value > 0, "a positive number"),
         "compare": (lambda value: value in ("tokens", "exact", "numbers"), '"tokens", "exact" or "numbers"'),
         "tolerance": (lambda value: is_number(value) and value >= 0, "a number not below 0"),
         "checker": (lambda value: isinstance(value, str) and value.endswith(".py"), "the name of a .py file"),
         "solutions": (lambda value: isinstance(value, dict), "an object {solution file: {input, output, expect}}")}
SOLUTION_RULES = {"input": RULES["input"], "output": RULES["output"],
                  "expect": (lambda value: value in VERDICTS, "one of " + ", ".join(VERDICTS))}
ERROR_PATTERN = "Error|error|panic|Segmentation|exception"
NUMBER = re.compile(r"[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?")  # a token that is a number (not inf, nan, 1_000)
PREVIEW = 80  # characters of the answer and of the output shown in a WA or PE message
COLUMNS = ("Задача", "Решение", "Тестов", "Вердикт", "Ожидалось", "Подробности")


class Task(NamedTuple):
    name: str
    title: str
    input: str
    output: str
    time_limit: float
    compare: str
    tolerance: float
    checker: pathlib.Path | None  # the program that judges the output; None: compare it with the answer
    overrides: dict  # the "solutions" of task.json: the own input, output and expect of single solution files
    tests: list  # the input files NN in numeric order; the answer of each lies beside it as NN.a
    solutions: list


class Result(NamedTuple):
    task: str
    title: str
    solution: str  # "" for a broken task
    expected: str  # "" for a broken task
    total: int
    verdict: str  # a verdict, or ERROR for a broken task or a failed checker
    passed: int
    test: str  # the number of the failing test, "" otherwise
    message: str

    @property
    def as_expected(self):
        return self.verdict == self.expected


def load_task(folder):
    """The task in the folder; a ValueError or OSError says what is wrong with a broken folder."""
    settings = load_settings(folder)
    tests = load_tests(folder / "tests")
    checker = folder / settings["checker"] if settings["checker"] else None
    if checker and not checker.is_file():
        raise ValueError(f"task.json: the checker {checker.name} is not in the task folder")
    solutions = sorted(path for path in folder.iterdir()
                       if path.is_file() and path.suffix in LANGUAGE and path != checker)
    stray = sorted(set(settings["solutions"]) - {path.name for path in solutions})
    if stray:
        what = "is not a solution file" if (folder / stray[0]).is_file() else "is not in the task folder"
        raise ValueError(f"task.json: solutions names {stray[0]}, which {what}")
    return Task(folder.name, settings["title"], settings["input"], settings["output"], settings["time_limit"],
                settings["compare"], settings["tolerance"], checker, settings["solutions"], tests, solutions)


def load_settings(folder):
    """task.json with the defaults filled in; a ValueError names the first thing wrong with it."""
    try:
        settings = json.loads((folder / "task.json").read_text(encoding="utf-8"))
    except ValueError as error:
        raise ValueError(f"task.json: {error}") from None
    validate(settings, RULES, "task.json")
    for name, overrides in settings.get("solutions", {}).items():
        validate(overrides, SOLUTION_RULES, f"task.json: solutions {name}")
    if "tolerance" in settings and settings.get("compare") != "numbers":
        raise ValueError('task.json: tolerance needs compare "numbers"')
    if "checker" in settings and "compare" in settings:
        raise ValueError("task.json: checker and compare exclude each other")
    return {"title": folder.name, **DEFAULTS, **settings}


def validate(settings, rules, where):
    """A ValueError names the first key of settings that the rules do not know or whose value is not valid."""
    if not isinstance(settings, dict):
        raise ValueError(f"{where}: not an object")
    unknown = sorted(set(settings) - set(rules))
    if unknown:
        raise ValueError(f"{where}: unknown keys {', '.join(unknown)}")
    for key, value in settings.items():
        valid, description = rules[key]
        if not valid(value):
            raise ValueError(f"{where}: {key} must be {description}")


def load_tests(folder):
    """The input files NN of the tests folder in numeric order, each with its answer NN.a beside it."""
    entries = folder.iterdir() if folder.is_dir() else []
    inputs = [path for path in entries if path.is_file() and re.fullmatch(r"[0-9]+", path.name)]
    if not inputs:
        raise ValueError("no tests")
    tests = sorted(inputs, key=lambda path: int(path.name))
    for test in tests:
        if not answer_of(test).is_file():
            raise ValueError(f"test {test.name} has no answer {answer_of(test).name}")
    return tests


def answer_of(test):
    return test.with_name(test.name + ".a")


def check_task(folder, workdir):
    """Yield the result of every solution of the task, or one ERROR result when the folder is broken."""
    try:
        task = load_task(folder)
    except (OSError, ValueError) as error:
        yield Result(task=folder.name, title=folder.name, solution="", expected="", total=0, verdict="ERROR",
                     passed=0, test="", message=str(error))
        return
    for number, source in enumerate(task.solutions, start=1):
        directory = clean_folder(workdir / task.name / f"{number}_{re.sub(r'\W+', '_', source.name)}")
        yield check_solution(task, source, directory)


def check_solution(task, source, directory):
    """Build the solution in the empty directory and run it on the tests until one fails."""
    settings = {"input": task.input, "output": task.output, "expect": "OK", **task.overrides.get(source.name, {})}
    own = task._replace(input=settings["input"], output=settings["output"])  # the task as this solution sees it
    copy = directory / source.name
    shutil.copyfile(source, copy)
    language = LANGUAGE[source.suffix]
    command, message = build(language, copy, directory, FLAGS if language in COMPILERS else ())
    judged = ("CE", 0, "", message) if command is None else run_tests(own, command, directory)
    return Result(task.name, task.title, source.name, settings["expect"], len(task.tests), *judged)


def run_tests(task, command, directory):
    """Run the tests in order until one fails: (verdict, tests passed, failing test, message)."""
    for passed, test in enumerate(task.tests):
        verdict, message = run_test(task, command, test, clean_folder(directory / f"test_{test.name}"))
        if verdict != "OK":
            return verdict, passed, test.name, message
    return "OK", len(task.tests), "", ""


def run_test(task, command, test, folder):
    """The verdict of the program that command starts on one test, run in the empty folder, and a message."""
    if task.input == "stdin":
        stdin = test.read_bytes()
    else:
        shutil.copyfile(test, folder / task.input)
        stdin = b""
    outcome = run(command, folder, timeout=task.time_limit, stdin=stdin)
    if outcome.code is None:
        return "TL", f"longer than {task.time_limit:g} s"
    if outcome.code != 0:
        return "RE", first_line(outcome.stderr, ERROR_PATTERN) or f"exit code {outcome.code}"
    output = output_file(task, outcome, folder)
    if output is None:
        return "PE", f"нет выходного файла {task.output}"
    if task.checker:
        return run_checker(task, test, output, folder)
    return judge(task, read_text(answer_of(test)), read_text(output))


def output_file(task, outcome, folder):
    """The file with what the program wrote: the output file of the task in the folder, or its standard
    output saved there as "stdout"; None when the output file is missing."""
    path = folder / task.output
    if task.output == "stdout":
        path.write_text(outcome.stdout, encoding="utf-8")
    return path if path.is_file() else None


def run_checker(task, test, output, folder):
    """The verdict of the checker on the output of the test, with the first line of its standard output as the
    message. A checker must not print to standard error: anything there (a traceback, a SyntaxError report, a
    warning), like an exit code it has no verdict for or the time limit, means the checker failed: ERROR, with
    the first error line of its standard error (or its first line), else the line it printed, else the exit
    code as the message."""
    paths = (task.checker, test, output, answer_of(test))
    command = [sys.executable, "-I", *(str(path.resolve()) for path in paths)]
    outcome = run(command, folder, timeout=task.time_limit)
    if outcome.stderr.strip() or outcome.code not in CHECKER_VERDICTS:
        why = first_line(outcome.stderr, ERROR_PATTERN) or first_line(outcome.stdout) or f"exit code {outcome.code}"
        return "ERROR", "checker failed: " + why
    return CHECKER_VERDICTS[outcome.code], first_line(outcome.stdout)


def judge(task, answer, output):
    """OK, or the verdict of compare() with a preview of the answer and the output as the message."""
    verdict = compare(answer, output, task.compare, task.tolerance)
    if verdict == "OK":
        return "OK", ""
    return verdict, f'answer "{first_line(answer)[:PREVIEW]}", output "{first_line(output)[:PREVIEW]}"'


def compare(answer, output, mode, tolerance=DEFAULTS["tolerance"]):
    """OK, WA or PE for the output against the answer; the PE rule is in the module docstring."""
    if mode == "exact":
        return "OK" if trimmed(answer) == trimmed(output) else "WA"
    if mode == "numbers":
        exact_tolerance = fractions.Fraction(str(tolerance))  # the decimal written in task.json, not its float
        return "OK" if close_tokens(answer.split(), output.split(), exact_tolerance) else "WA"
    if answer.split() == output.split():
        return "OK"
    if [as_number(token) for token in answer.split()] == [as_number(token) for token in output.split()]:
        return "PE"
    return "WA"


def close_tokens(expected, actual, tolerance):
    """Whether the token lists match one to one: numbers within the tolerance, the other tokens as text."""
    return len(expected) == len(actual) and all(close(a, b, tolerance) for a, b in zip(expected, actual))


def close(expected, actual, tolerance):
    a, b = as_number(expected), as_number(actual)
    if isinstance(a, str) or isinstance(b, str):
        return expected == actual
    return abs(a - b) <= tolerance * max(1, abs(a), abs(b))  # within tolerance, absolute or relative


def trimmed(text):
    """The lines of the text without trailing whitespace on each line and at the end."""
    return [line.rstrip() for line in text.rstrip().splitlines()]


def as_number(token):
    """The exact value (a Fraction) of a token that is written as a number, else the token itself."""
    return fractions.Fraction(token) if NUMBER.fullmatch(token) else token


def read_text(path):
    return path.read_text(encoding="utf-8", errors="replace")


def clean_folder(path):
    """An empty folder at path: a previous run with the same --workdir leaves nothing behind."""
    shutil.rmtree(path, ignore_errors=True)
    path.mkdir(parents=True)
    return path


def details(result):
    """The failing test and its message, the build error or the reason a task is broken; "" when all passed."""
    if result.test:
        return f"test {result.test}: {result.message}"
    return result.message


def describe(result):
    """The line of a result on standard output."""
    if not result.solution:  # a broken task
        return f"{result.task}: ERROR: {result.message}"
    line = f"{result.task}/{result.solution}: {result.verdict} ({result.passed}/{result.total} tests)"
    if details(result):
        line += ", " + details(result)
    if not result.as_expected:
        return line + f"; expected {result.expected}"
    return line + ("; as expected" if result.expected != "OK" else "")


def report_to_github(results):
    """Append the table to the step summary and print an ::error annotation per failure; nothing outside Actions."""
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary:
        return
    with open(summary, "a", encoding="utf-8") as file:
        file.write(markdown_report(results))
    for result in results:
        if not result.as_expected:
            print(annotation(result))


def markdown_report(results):
    failed = sum(not result.as_expected for result in results)
    lines = ["## Проверка решений", "", "| " + " | ".join(COLUMNS) + " |", "|" + "---|" * len(COLUMNS)]
    lines += [table_row(result) for result in results]
    lines += ["", f"Решений: {len(results)}, как ожидалось: {len(results) - failed}, расхождений: {failed}.", ""]
    return "\n".join(lines)


def table_row(result):
    if not result.solution:  # a broken task
        cells = (result.title, "—", "—", "ERROR", "—", result.message)
    else:
        cells = (result.title, result.solution, f"{result.passed}/{result.total}", result.verdict, result.expected,
                 details(result))
    return "| " + " | ".join(cell(text) for text in cells) + " |"


def cell(text):
    return html.escape(text, quote=False).replace("|", "\\|")


def annotation(result):
    """The ::error workflow command on the file of a failing solution (task.json for a broken task)."""
    path = f"tasks/{result.task}/{result.solution or 'task.json'}"
    title = f"{result.task}: {result.verdict}" + (f" on test {result.test}" if result.test else "")
    parts = [details(result)]
    if result.expected:
        parts.append(f"expected {result.expected}")
    message = "; ".join(part for part in parts if part)
    return f"::error file={escape_property(path)},title={escape_property(title)}::{escape_data(message)}"


def escape_data(text):
    """A workflow command message: GitHub reads a raw % or line break as part of the command syntax."""
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def escape_property(text):
    return escape_data(text).replace(":", "%3A").replace(",", "%2C")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("tasks", nargs="*", help="tasks to check (default: every folder with a task.json)")
    parser.add_argument("--workdir", default=None, help="directory for the built solutions (default: a temporary one)")
    parser.add_argument("--tasks-dir", default=ROOT / "tasks", type=pathlib.Path,
                        help="the folder of the tasks (default: tasks/ of the repository)")
    args = parser.parse_args(argv)
    if not args.tasks_dir.is_dir():
        parser.error(f"no such folder: {args.tasks_dir}")
    workdir = pathlib.Path(args.workdir or tempfile.mkdtemp(prefix="solutions-")).resolve()
    names = args.tasks or sorted(path.name for path in args.tasks_dir.iterdir() if (path / "task.json").is_file())
    results = []
    for name in names:
        for result in check_task(args.tasks_dir / name, workdir):
            print(describe(result), flush=True)
            results.append(result)
    failed = [result for result in results if not result.as_expected]
    print(f"{len(results)} solutions, {len(results) - len(failed)} as expected, {len(failed)} not")
    report_to_github(results)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
