"""Tests of check_solutions.py on small A+B tasks made in a temporary folder.

Run with: python3 -m unittest discover -s tests/code -v
A test of a compiled language is skipped when its compiler is not installed.
"""
import contextlib
import io
import json
import os
import pathlib
import shutil
import tempfile
import time
import unittest
from unittest import mock

import check_solutions

TESTS = {"01": ("1 2\n", "3\n"), "02": ("10 20\n", "30\n"), "03": ("-5 5\n", "0\n")}
FILES = {"input": "sum.in", "output": "sum.out"}
STREAMS = {"input": "stdin", "output": "stdout"}

SUM_FILES_PY = "a, b = map(int, open('sum.in').read().split())\nopen('sum.out', 'w').write(f'{a + b}\\n')\n"
SUM_STDIN_PY = "a, b = map(int, input().split())\nprint(a + b)\n"
NO_OUTPUT_FILE_PY = "a, b = map(int, open('sum.in').read().split())\nprint(a + b)\n"
STDIN_TO_FILE_PY = "a, b = map(int, input().split())\nopen('sum.out', 'w').write(f'{a + b}\\n')\n"
WRONG_ON_02_PY = "a, b = map(int, input().split())\nprint(a + b if a == 1 else a - b)\n"
WRONG_ON_02_FILES_PY = ("a, b = map(int, open('sum.in').read().split())\n"
                        "open('sum.out', 'w').write(f'{a + b if a == 1 else a - b}\\n')\n")
FLOAT_PY = "a, b = map(int, input().split())\nprint(float(a + b))\n"
NEAR_PY = "a, b = map(int, input().split())\nprint(a + b + 1e-4)\n"
WORDY_PY = "a, b = map(int, input().split())\nprint('a + b =', a + b)\n"
ENDLESS_PY = "while True:\n    pass\n"
CRASH_PY = "print(1 // 0)\n"
BROKEN_PY = "print(\n"
SUM_FILES_CPP = ('#include <fstream>\n'
                 '#ifndef __OPTIMIZE__\n#error "built without -O2"\n#endif\n'
                 'int main() { std::ifstream in("sum.in"); std::ofstream out("sum.out");\n'
                 '  long long a, b; in >> a >> b; out << a + b << "\\n"; }\n')
# A checker: the sum of the input against the output, OK (exit 0) or WA (exit 1); exit 3 when run not as specified.
CHECKER_PY = ("import os, sys\n"
              "given, output, answer = sys.argv[1:]\n"
              "if not sys.flags.isolated or not all(map(os.path.isabs, sys.argv[1:])):\n"
              "    print('not run as python3 -I with absolute paths')\n"
              "    sys.exit(3)\n"
              "a, b = map(int, open(given).read().split())\n"
              "if open(output).read().split() != [str(a + b)]:\n"
              "    print(f'wrong: expected {a + b}')\n"
              "    sys.exit(1)\n"
              "print('ok')\n")
CHECKER_PE_PY = "import sys\nprint('spaces')\nsys.exit(2)\n"
CHECKER_EXIT_3_PY = "import sys\nprint('boom')\nsys.exit(3)\n"
CHECKER_SILENT_EXIT_3_PY = "import sys\nsys.exit(3)\n"
CHECKER_WA_PY = "import sys\nprint('wrong')\nsys.exit(1)\n"
CHECKER_WARNING_PY = "import sys\nprint('ok')\nprint('deprecated', file=sys.stderr)\n"  # a checker must not print to stderr
SUM_FILES_PAS = ("var a, b: longint; f, g: text;\n"
                 "begin\n"
                 "  assign(f, 'sum.in'); reset(f); readln(f, a, b); close(f);\n"
                 "  assign(g, 'sum.out'); rewrite(g); writeln(g, a + b); close(g);\n"
                 "end.\n")
SUM_STDIN_JAVA = ("package aplusb;\n"
                  "import java.util.Scanner;\n"
                  "public class Sum {\n"
                  "    public static void main(String[] args) {\n"
                  "        Scanner in = new Scanner(System.in);\n"
                  "        System.out.println(in.nextLong() + in.nextLong());\n"
                  "    }\n"
                  "}\n")


class SolutionsCase(unittest.TestCase):
    def setUp(self):
        self.root = pathlib.Path(tempfile.mkdtemp(prefix="solutions-test-"))
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self.tasks_dir = self.root / "tasks"
        self.workdir = self.root / "work"

    def make_task(self, name, solutions, settings=STREAMS, tests=TESTS):
        """A task folder: task.json, tests/NN with NN.a, and the solution files."""
        folder = self.tasks_dir / name
        (folder / "tests").mkdir(parents=True)
        (folder / "task.json").write_text(json.dumps({"title": name.upper(), **settings}), encoding="utf-8")
        for number, (given, answer) in tests.items():
            (folder / "tests" / number).write_text(given)
            (folder / "tests" / f"{number}.a").write_text(answer)
        for file_name, code in solutions.items():
            (folder / file_name).write_text(code, encoding="utf-8")
        return folder

    def results_of(self, name, solutions, **task):
        folder = self.make_task(name, solutions, **task)
        return list(check_solutions.check_task(folder, self.workdir))

    def solve(self, code, file_name="sol.py", **task):
        """The result of one solution of an A+B task."""
        return self.results_of("aplusb", {file_name: code}, **task)[0]

    def run_main(self, *args):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = check_solutions.main(["--tasks-dir", str(self.tasks_dir), "--workdir", str(self.workdir), *args])
        return code, output.getvalue()

    def test_python_solution_with_input_and_output_files_is_ok(self):
        result = self.solve(SUM_FILES_PY, settings=FILES)
        self.assertEqual((result.verdict, result.passed, result.total, result.as_expected), ("OK", 3, 3, True))

    def test_python_solution_with_stdin_and_stdout_is_ok(self):
        result = self.solve(SUM_STDIN_PY, settings=STREAMS)
        self.assertEqual((result.verdict, result.passed, result.total), ("OK", 3, 3))

    def test_wrong_solution_gets_wa_on_its_test_and_runs_no_further(self):
        marker = self.root / "runs"
        code = f"open({str(marker)!r}, 'a').write('run\\n')\n" + WRONG_ON_02_PY
        result = self.solve(code)
        self.assertEqual((result.verdict, result.test, result.passed, result.total), ("WA", "02", 1, 3))
        self.assertIn('"30"', result.message)
        self.assertIn('"-10"', result.message)
        self.assertEqual(marker.read_text().count("run"), 2)

    def test_number_in_another_form_is_pe_and_text_is_wa(self):
        results = self.results_of("aplusb", {"float.py": FLOAT_PY, "wordy.py": WORDY_PY})
        verdicts = {result.solution: (result.verdict, result.test) for result in results}
        self.assertEqual(verdicts, {"float.py": ("PE", "01"), "wordy.py": ("WA", "01")})

    def test_endless_loop_gets_tl_within_the_time_limit(self):
        started = time.monotonic()
        result = self.solve(ENDLESS_PY, settings={**STREAMS, "time_limit": 1})
        self.assertEqual((result.verdict, result.test, result.passed), ("TL", "01", 0))
        self.assertLess(time.monotonic() - started, 3)

    def test_crash_gets_re_with_the_error_line(self):
        result = self.solve(CRASH_PY)
        self.assertEqual((result.verdict, result.test), ("RE", "01"))
        self.assertIn("ZeroDivisionError", result.message)

    def test_missing_output_file_is_pe(self):
        result = self.solve(NO_OUTPUT_FILE_PY, settings=FILES)
        self.assertEqual((result.verdict, result.test, result.message), ("PE", "01", "нет выходного файла sum.out"))

    def test_crash_without_output_file_is_re_not_pe(self):
        result = self.solve(CRASH_PY, settings=FILES)
        self.assertEqual((result.verdict, result.test), ("RE", "01"))

    def test_syntax_error_gets_ce_without_running_tests(self):
        result = self.solve(BROKEN_PY)
        self.assertEqual((result.verdict, result.passed, result.total, result.test), ("CE", 0, 3, ""))
        self.assertRegex(result.message, r"^line \d+: ")

    @unittest.skipUnless(shutil.which("g++"), "g++ is not installed")
    def test_cpp_solution_is_ok(self):
        result = self.solve(SUM_FILES_CPP, file_name="sum.cpp", settings=FILES)
        self.assertEqual((result.verdict, result.passed), ("OK", 3), result.message)

    @unittest.skipUnless(shutil.which("fpc"), "fpc is not installed")
    def test_pascal_solution_is_ok(self):
        result = self.solve(SUM_FILES_PAS, file_name="sum.pas", settings=FILES)
        self.assertEqual((result.verdict, result.passed), ("OK", 3), result.message)

    @unittest.skipUnless(shutil.which("javac"), "javac is not installed")
    def test_java_solution_in_a_package_is_ok(self):
        result = self.solve(SUM_STDIN_JAVA, file_name="sum.java", settings=STREAMS)
        self.assertEqual((result.verdict, result.passed), ("OK", 3), result.message)

    def test_expected_wa_passes_a_wrong_solution_and_fails_a_right_one(self):
        results = self.results_of("aplusb", {"right.py": SUM_STDIN_PY, "wrong.py": WRONG_ON_02_PY},
                                  settings={**STREAMS, "solutions": {"right.py": {"expect": "WA"},
                                                                     "wrong.py": {"expect": "WA"}}})
        outcome = {result.solution: (result.verdict, result.expected, result.as_expected) for result in results}
        self.assertEqual(outcome, {"right.py": ("OK", "WA", False), "wrong.py": ("WA", "WA", True)})

    def test_solution_settings_override_the_input_and_output_of_the_task(self):
        results = self.results_of("aplusb", {"files.py": SUM_FILES_PY, "streams.py": SUM_STDIN_PY},
                                  settings={**STREAMS, "solutions": {"files.py": FILES}})
        outcome = {result.solution: (result.verdict, result.expected) for result in results}
        self.assertEqual(outcome, {"files.py": ("OK", "OK"), "streams.py": ("OK", "OK")})

    def test_solution_settings_may_override_one_key_or_none(self):
        solutions = {"stdin.py": STDIN_TO_FILE_PY, "stdout.py": NO_OUTPUT_FILE_PY, "files.py": SUM_FILES_PY}
        overrides = {"stdin.py": {"input": "stdin"}, "stdout.py": {"output": "stdout"}, "files.py": {}}
        results = self.results_of("aplusb", solutions, settings={**FILES, "solutions": overrides})
        outcome = {result.solution: (result.verdict, result.expected) for result in results}
        self.assertEqual(outcome, {name: ("OK", "OK") for name in solutions})

    def test_build_folders_are_numbered_so_that_names_alike_in_word_characters_do_not_share_one(self):
        results = self.results_of("aplusb", {"sum-wa.py": WRONG_ON_02_PY, "sum_wa.py": SUM_STDIN_PY})
        self.assertEqual([(result.solution, result.verdict) for result in results],
                         [("sum-wa.py", "WA"), ("sum_wa.py", "OK")])
        folders = sorted(path.name for path in (self.workdir / "aplusb").iterdir())
        self.assertEqual(folders, ["1_sum_wa_py", "2_sum_wa_py"])
        self.assertTrue((self.workdir / "aplusb" / "1_sum_wa_py" / "sum-wa.py").is_file())

    def test_compare_numbers_accepts_numbers_within_the_tolerance(self):
        results = self.results_of("aplusb", {"float.py": FLOAT_PY, "near.py": NEAR_PY},
                                  settings={**STREAMS, "compare": "numbers"})
        verdicts = {result.solution: (result.verdict, result.test) for result in results}
        self.assertEqual(verdicts, {"float.py": ("OK", ""), "near.py": ("WA", "01")})
        results = self.results_of("tolerant", {"near.py": NEAR_PY},
                                  settings={**STREAMS, "compare": "numbers", "tolerance": 1e-3})
        self.assertEqual(results[0].verdict, "OK")

    def test_checker_judges_the_output_and_is_not_a_solution(self):
        cases = {"streams": (STREAMS, SUM_STDIN_PY, WRONG_ON_02_PY),
                 "files": (FILES, SUM_FILES_PY, WRONG_ON_02_FILES_PY)}
        for name, (settings, right, wrong) in cases.items():
            with self.subTest(settings=name):
                results = self.results_of(name, {"sol.py": right, "wrong.py": wrong, "check.py": CHECKER_PY},
                                          settings={**settings, "checker": "check.py"})
                outcome = {result.solution: (result.verdict, result.test, result.message) for result in results}
                self.assertEqual(outcome, {"sol.py": ("OK", "", ""), "wrong.py": ("WA", "02", "wrong: expected 30")})

    def test_checker_exit_code_two_is_pe_with_its_message(self):
        results = self.results_of("aplusb", {"sol.py": SUM_STDIN_PY, "check.py": CHECKER_PE_PY},
                                  settings={**STREAMS, "checker": "check.py"})
        self.assertEqual((results[0].verdict, results[0].test, results[0].message), ("PE", "01", "spaces"))

    def test_checker_message_on_standard_output_with_exit_code_one_is_wa(self):
        results = self.results_of("aplusb", {"sol.py": SUM_STDIN_PY, "check.py": CHECKER_WA_PY},
                                  settings={**STREAMS, "checker": "check.py"})
        self.assertEqual((results[0].verdict, results[0].test, results[0].message), ("WA", "01", "wrong"))

    def test_checker_failure_is_an_error_of_the_task(self):
        checkers = {"exit 3": (CHECKER_EXIT_3_PY, "boom"), "silent exit 3": (CHECKER_SILENT_EXIT_3_PY, "exit code 3"),
                    "crash": (CRASH_PY, "ZeroDivisionError"), "endless": (ENDLESS_PY, "time limit"),
                    "syntax": (BROKEN_PY, "SyntaxError"), "warning": (CHECKER_WARNING_PY, "deprecated")}
        # The name of a case is also the task folder, so a name with "error" in it would match ERROR_PATTERN.
        for name, (checker, word) in checkers.items():
            with self.subTest(checker=name):
                results = self.results_of(name.replace(" ", "_"), {"sol.py": SUM_STDIN_PY, "check.py": checker},
                                          settings={**STREAMS, "checker": "check.py", "time_limit": 1})
                result = results[0]
                self.assertEqual((result.solution, result.verdict, result.test, result.as_expected),
                                 ("sol.py", "ERROR", "01", False))
                self.assertIn(word, result.message)

    def test_main_counts_a_checker_failure_as_a_failure(self):
        self.make_task("aplusb", {"sol.py": SUM_STDIN_PY, "check.py": CHECKER_EXIT_3_PY},
                       settings={**STREAMS, "checker": "check.py"})
        code, output = self.run_main()
        self.assertEqual(code, 1)
        self.assertIn("aplusb/sol.py: ERROR (0/3 tests), test 01: checker failed: boom; expected OK", output)

    def test_only_solution_files_are_checked(self):
        folder = self.make_task("aplusb", {"sol.py": SUM_STDIN_PY, "README.txt": "notes", "data.in": "1 2"})
        (folder / "tests" / "extra.py").write_text(CRASH_PY)
        results = list(check_solutions.check_task(folder, self.workdir))
        self.assertEqual([result.solution for result in results], ["sol.py"])

    def test_task_without_tests_is_an_error(self):
        results = self.results_of("empty", {"sol.py": SUM_STDIN_PY}, tests={})
        self.assertEqual([(result.verdict, result.as_expected) for result in results], [("ERROR", False)])
        self.assertIn("no tests", results[0].message)

    def test_test_without_answer_file_is_an_error(self):
        folder = self.make_task("aplusb", {"sol.py": SUM_STDIN_PY})
        (folder / "tests" / "02.a").unlink()
        results = list(check_solutions.check_task(folder, self.workdir))
        self.assertEqual(results[0].verdict, "ERROR")
        self.assertIn("02.a", results[0].message)

    def test_bad_task_json_is_an_error(self):
        cases = {"syntax": ("{", "task.json"),
                 "keys": ('{"input": "stdin", "output": "stdout", "timelimit": 5}', "timelimit"),
                 "old expect map": ('{"expect": {"sol.py": "WA"}}', "expect"),
                 "verdict": ('{"solutions": {"sol.py": {"expect": "FAIL"}}}', "expect"),
                 "solution not an object": ('{"solutions": {"sol.py": "WA"}}', "sol.py"),
                 "solution key": ('{"solutions": {"sol.py": {"time_limit": 5}}}', "time_limit"),
                 "solution missing": ('{"solutions": {"nothere.py": {"expect": "WA"}}}', "nothere.py"),
                 "tolerance without numbers": ('{"tolerance": 0.1}', "tolerance"),
                 "tolerance with exact": ('{"compare": "exact", "tolerance": 0.1}', "tolerance"),
                 "negative tolerance": ('{"compare": "numbers", "tolerance": -1}', "tolerance"),
                 "boolean tolerance": ('{"compare": "numbers", "tolerance": true}', "tolerance"),
                 "boolean time limit": ('{"time_limit": true}', "time_limit"),
                 "checker with compare": ('{"checker": "check.py", "compare": "exact"}', "checker"),
                 "checker missing": ('{"checker": "nothere.py"}', "nothere.py"),
                 "checker not python": ('{"checker": "check.cpp"}', "checker")}
        for name, (text, word) in cases.items():
            with self.subTest(name=name):
                folder = self.make_task(name.replace(" ", "_"), {"sol.py": SUM_STDIN_PY, "check.py": CHECKER_PY})
                (folder / "task.json").write_text(text, encoding="utf-8")
                results = list(check_solutions.check_task(folder, self.workdir))
                self.assertEqual(results[0].verdict, "ERROR", results[0].message)
                self.assertIn("task.json", results[0].message)
                self.assertIn(word, results[0].message)

    def test_solutions_key_that_is_not_a_solution_file_is_told_apart_from_a_missing_one(self):
        cases = {"check.py": "is not a solution file", "notes.txt": "is not a solution file",
                 "nothere.py": "is not in the task folder"}
        for name, words in cases.items():
            with self.subTest(name=name):
                folder = self.make_task(name.replace(".", "_"),
                                        {"sol.py": SUM_STDIN_PY, "check.py": CHECKER_PY, "notes.txt": "notes"},
                                        settings={**STREAMS, "checker": "check.py", "solutions": {name: {"expect": "WA"}}})
                results = list(check_solutions.check_task(folder, self.workdir))
                self.assertEqual(results[0].verdict, "ERROR")
                self.assertIn("task.json", results[0].message)
                self.assertIn(f"{name}, which {words}", results[0].message)

    def test_main_reports_to_github_and_exits_with_one_on_a_failure(self):
        self.make_task("good", {"sol.py": SUM_STDIN_PY})
        self.make_task("bad", {"sol.py": WRONG_ON_02_PY})
        summary = self.root / "summary.md"
        with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(summary)}):
            code, output = self.run_main()
        self.assertEqual(code, 1)
        self.assertIn("good/sol.py: OK (3/3 tests)", output)
        self.assertIn("bad/sol.py: WA (1/3 tests)", output)
        self.assertIn("2 solutions, 1 as expected, 1 not", output)
        self.assertIn("::error file=tasks/bad/sol.py,title=bad%3A WA on test 02::", output)
        self.assertNotIn("::error file=tasks/good", output)
        table = summary.read_text(encoding="utf-8")
        self.assertIn("| Задача | Решение | Тестов | Вердикт | Ожидалось | Подробности |", table)
        self.assertIn("| GOOD | sol.py | 3/3 | OK | OK |  |", table)
        self.assertIn("| BAD | sol.py | 1/3 | WA | OK | test 02: ", table)

    def test_main_exits_with_zero_and_prints_nothing_extra_when_everything_passes(self):
        self.make_task("good", {"sol.py": SUM_STDIN_PY})
        with mock.patch.dict(os.environ):
            os.environ.pop("GITHUB_STEP_SUMMARY", None)
            code, output = self.run_main()
        self.assertEqual(code, 0)
        self.assertNotIn("::error", output)
        self.assertIn("1 solutions, 1 as expected, 0 not", output)

    def test_main_checks_only_the_named_tasks(self):
        self.make_task("good", {"sol.py": SUM_STDIN_PY})
        self.make_task("bad", {"sol.py": WRONG_ON_02_PY})
        code, output = self.run_main("good")
        self.assertEqual(code, 0)
        self.assertNotIn("bad/", output)

    def test_main_counts_a_broken_task_as_a_failure(self):
        self.make_task("empty", {"sol.py": SUM_STDIN_PY}, tests={})
        code, output = self.run_main()
        self.assertEqual(code, 1)
        self.assertIn("empty: ERROR", output)


class CompareCase(unittest.TestCase):
    def test_tokens_ignore_whitespace(self):
        self.assertEqual(check_solutions.compare("1 2\n3\n", "1\n2 3", "tokens"), "OK")
        self.assertEqual(check_solutions.compare("3\n", "\n\n3\n\n", "tokens"), "OK")

    def test_tokens_that_are_equal_numbers_in_another_form_are_pe(self):
        self.assertEqual(check_solutions.compare("3\n", "3.0\n", "tokens"), "PE")
        self.assertEqual(check_solutions.compare("100\n", "1e2\n", "tokens"), "PE")
        self.assertEqual(check_solutions.compare("0\n", "-0\n", "tokens"), "PE")
        self.assertEqual(check_solutions.compare("0.5 5\n", ".5 5.\n", "tokens"), "PE")

    def test_tokens_that_only_look_like_numbers_are_text(self):
        self.assertEqual(check_solutions.compare("1000\n", "1_000\n", "tokens"), "WA")
        self.assertEqual(check_solutions.compare("1\n", "１\n", "tokens"), "WA")  # a fullwidth digit
        self.assertEqual(check_solutions.compare("1000\n", "1_000\n", "numbers"), "WA")
        self.assertEqual(check_solutions.compare("inf\n", "inf\n", "numbers"), "OK")
        self.assertEqual(check_solutions.compare("nan\n", "nan\n", "numbers"), "OK")
        self.assertEqual(check_solutions.compare("inf\n", "Infinity\n", "numbers"), "WA")

    def test_numbers_are_compared_exactly_however_long(self):
        big, bigger = str(10**400), str(10**400 + 1)
        self.assertEqual(check_solutions.compare(big + "\n", big + "\n", "numbers"), "OK")
        self.assertEqual(check_solutions.compare(big + "\n", bigger + "\n", "numbers"), "OK")  # within 1e-6 relative
        self.assertEqual(check_solutions.compare(big + "\n", bigger + "\n", "numbers", tolerance=0), "WA")
        self.assertEqual(check_solutions.compare("0.1\n", "0.10000000000000001\n", "numbers", tolerance=0), "WA")
        self.assertEqual(check_solutions.compare(big + "\n", big + ".0\n", "tokens"), "PE")

    def test_different_tokens_are_wa(self):
        self.assertEqual(check_solutions.compare("3\n", "a + b = 3\n", "tokens"), "WA")
        self.assertEqual(check_solutions.compare("12345678901234567890\n", "12345678901234567891\n", "tokens"), "WA")
        self.assertEqual(check_solutions.compare("1 2\n", "1\n", "tokens"), "WA")

    def test_exact_compares_the_text_without_trailing_whitespace(self):
        self.assertEqual(check_solutions.compare("1 2\n3\n", "1 2  \r\n3\n\n", "exact"), "OK")
        self.assertEqual(check_solutions.compare("1 2\n3\n", "1 2 3\n", "exact"), "WA")
        self.assertEqual(check_solutions.compare("3\n", "3.0\n", "exact"), "WA")

    def test_numbers_are_equal_within_the_absolute_or_the_relative_tolerance(self):
        self.assertEqual(check_solutions.compare("3\n", "3.0\n", "numbers"), "OK")
        self.assertEqual(check_solutions.compare("1.0 2\n", "1.0000001 2\n", "numbers"), "OK")
        self.assertEqual(check_solutions.compare("1000000000\n", "1000000001\n", "numbers"), "OK")
        self.assertEqual(check_solutions.compare("1\n", "1.05\n", "numbers", tolerance=0.1), "OK")
        self.assertEqual(check_solutions.compare("1\n", "1.05\n", "numbers", tolerance=0), "WA")

    def test_numbers_apart_or_lists_of_another_length_or_other_text_are_wa(self):
        self.assertEqual(check_solutions.compare("1\n", "1.001\n", "numbers"), "WA")
        self.assertEqual(check_solutions.compare("1 2\n", "1\n", "numbers"), "WA")
        self.assertEqual(check_solutions.compare("abc 1\n", "abd 1\n", "numbers"), "WA")
        self.assertEqual(check_solutions.compare("abc\n", "1\n", "numbers"), "WA")
        self.assertEqual(check_solutions.compare("YES 1\n", "yes 1\n", "numbers"), "WA")


if __name__ == "__main__":
    unittest.main()
