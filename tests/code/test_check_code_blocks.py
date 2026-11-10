"""Tests of the shared build step and the runner of check_code_blocks.py.

Run with: python3 -m unittest discover -s tests/code -v
A test of a compiled language is skipped when its compiler is not installed.
"""
import pathlib
import re
import shutil
import sys
import tempfile
import unittest
from unittest import mock

import check_code_blocks

HELLO = {
    "python": 'print("Hello")\n',
    "cpp": '#include <iostream>\nint main() { std::cout << "Hello\\n"; }\n',
    "c": '#include <stdio.h>\nint main(void) { puts("Hello"); return 0; }\n',
    "rust": 'fn main() { println!("Hello"); }\n',
    "pascal": "begin\n  writeln('Hello');\nend.\n",
    "java": 'public class Hello {\n    public static void main(String[] args) { System.out.println("Hello"); }\n}\n',
}
COMPILER = {"python": "python3", "cpp": "g++", "c": "gcc", "rust": "rustc", "pascal": "fpc", "java": "javac"}
JAVA_IN_PACKAGE = ('package demo;\n'
                   'class Hello {\n'
                   '    public static void main(String[] args) { System.out.println("Hello"); }\n'
                   '}\n')
PASCAL_PROCEDURE = "procedure Hello;\nbegin\n  writeln('Hello');\nend;\n"
PASCAL_UNIT = ("unit Greeting;\n"
               "interface\n"
               "procedure Hello;\n"
               "implementation\n"
               "procedure Hello;\n"
               "begin\n"
               "  writeln('Hello');\n"
               "end;\n"
               "end.\n")
DELPHI_PAS = ("{$APPTYPE CONSOLE}\n"
              "function Square(x: Int64): Int64;\n"
              "begin\n"
              "  Result := x * x;\n"
              "end;\n"
              "begin\n"
              "  writeln(Square(3000000000));\n"
              "end.\n")
INTEGER_SUM_PAS = "var n: Integer;\nbegin\n  n := 30000;\n  n := n + n;\n  writeln(n);\nend.\n"  # -5536 in mode tp
BROKEN_DELPHI_PAS = "function F: Integer;\nbegin\n  Result := undefined_name;\nend;\nbegin\n  writeln(F);\nend.\n"
PASCAL_USES_UNIT = "uses Greeting;\nbegin\n  Hello;\nend.\n"
PASCAL_READS_FILE = ("var n: longint; f: text;\n"
                     "begin\n"
                     "  assign(f, 'input.txt'); reset(f); Readln(f, n);\n"
                     "  writeln(n);\n"
                     "end.\n")
ENDLESS_PY = "while True:\n    pass\n"
INPUT_THEN_ENDLESS_PY = "try:\n    n = int(input())\nexcept EOFError:\n    n = 0\n" + ENDLESS_PY
# A lesson page with a block that loads a solution file (data-src) and an ordinary block after it.
PAGE_WITH_LOADED_BLOCK = ('<pre class="sh_python" data-src="../tasks/aplusb/sum.py">'
                          '<a href="../tasks/aplusb/sum.py">sum.py</a></pre>\n'
                          '<pre class="sh_python">print(1 + 2)\n</pre>\n')


def installed(language):
    return shutil.which(COMPILER[language]) is not None


class BlocksCase(unittest.TestCase):
    def test_block_with_data_src_is_skipped_but_counted(self):
        root = pathlib.Path(tempfile.mkdtemp(prefix="blocks-test-"))
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        (root / "page.html").write_text(PAGE_WITH_LOADED_BLOCK, encoding="utf-8")
        with mock.patch.object(check_code_blocks, "ROOT", root):
            self.assertEqual(list(check_code_blocks.blocks_of("page.html")), [(2, "python", "print(1 + 2)\n")])


class BuildCase(unittest.TestCase):
    def setUp(self):
        self.root = pathlib.Path(tempfile.mkdtemp(prefix="build-test-"))
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)

    def build(self, language, code, file_name, flags=()):
        """Build the code written to file_name in its own folder: (command, message, folder)."""
        directory = self.root / language
        directory.mkdir()
        source = directory / file_name
        source.write_text(code, encoding="utf-8")
        command, message = check_code_blocks.build(language, source, directory, flags)
        return command, message, directory

    def assert_prints_hello(self, command, directory):
        outcome = check_code_blocks.run(command, directory)
        self.assertEqual((outcome.code, outcome.stdout.strip()), (0, "Hello"))

    def test_every_language_builds_and_runs_hello(self):
        for language, code in HELLO.items():
            with self.subTest(language=language):
                if not installed(language):
                    self.skipTest(f"{COMPILER[language]} is not installed")
                command, message, directory = self.build(language, code, "hello" + check_code_blocks.SUFFIX[language])
                self.assertIsNotNone(command, message)
                self.assertEqual(message, "")
                self.assert_prints_hello(command, directory)

    @unittest.skipUnless(installed("cpp"), "g++ is not installed")
    def test_cpp_compile_error_returns_no_command_and_the_error_line(self):
        command, message, _ = self.build("cpp", "int main() { return undefined_name; }\n", "broken.cpp")
        self.assertIsNone(command)
        self.assertIn("error", message)
        self.assertIn("undefined_name", message)

    def test_python_syntax_error_is_a_build_failure(self):
        command, message, _ = self.build("python", "print(\n", "broken.py")
        self.assertIsNone(command)
        self.assertRegex(message, r"^line \d+: ")

    @unittest.skipUnless(installed("java"), "javac is not installed")
    def test_java_class_without_public_in_a_package_runs_under_its_qualified_name(self):
        command, message, directory = self.build("java", JAVA_IN_PACKAGE, "program.java")
        self.assertIsNotNone(command, message)
        self.assertEqual(command, ["java", "-cp", str(directory), "demo.Hello"])
        self.assert_prints_hello(command, directory)

    def test_build_fails_with_a_message_when_the_compiler_is_missing(self):
        with mock.patch.dict(check_code_blocks.COMPILERS, {"cpp": ["no-such-compiler-xyz"]}):
            command, message, _ = self.build("cpp", HELLO["cpp"], "hello.cpp")
        self.assertIsNone(command)
        self.assertIn("not found", message)

    @unittest.skipUnless(installed("pascal"), "fpc is not installed")
    def test_pascal_program_with_int64_and_result_builds_and_runs(self):
        command, message, directory = self.build("pascal", DELPHI_PAS, "square.pas")
        self.assertIsNotNone(command, message)
        outcome = check_code_blocks.run(command, directory)
        self.assertEqual((outcome.code, outcome.stdout.strip()), (0, "9000000000000000000"))

    @unittest.skipUnless(installed("pascal"), "fpc is not installed")
    def test_pascal_integer_is_32_bit_because_mode_delphi_is_tried_first(self):
        command, message, directory = self.build("pascal", INTEGER_SUM_PAS, "sum.pas")
        self.assertIsNotNone(command, message)
        outcome = check_code_blocks.run(command, directory)
        self.assertEqual((outcome.code, outcome.stdout.strip()), (0, "60000"))

    @unittest.skipUnless(installed("pascal"), "fpc is not installed")
    def test_pascal_build_failure_reports_the_error_of_mode_delphi(self):
        command, message, _ = self.build("pascal", BROKEN_DELPHI_PAS, "broken.pas")
        self.assertIsNone(command)
        self.assertIn("undefined_name", message)
        self.assertNotIn("Result", message)  # the error of mode tp, which has no Result

    @unittest.skipUnless(installed("pascal"), "fpc is not installed")
    def test_pascal_program_finds_a_unit_in_a_folder_of_the_flags_and_leaves_that_folder_clean(self):
        units = self.root / "units"
        units.mkdir()
        (units / "greeting.pas").write_text(PASCAL_UNIT, encoding="utf-8")
        command, message, directory = self.build("pascal", PASCAL_USES_UNIT, "block.pas", ["-Fu" + str(units)])
        self.assertIsNotNone(command, message)
        self.assert_prints_hello(command, directory)
        self.assertEqual([path.name for path in units.iterdir()], ["greeting.pas"])  # the compiled unit lands in directory


class HasMainCase(unittest.TestCase):
    def test_pascal_program_with_begin_and_end_on_different_lines_is_a_program(self):
        self.assertTrue(check_code_blocks.has_main("pascal", "begin\n  writeln('Hello');\nend.\n"))
        self.assertTrue(check_code_blocks.has_main("pascal", "program Hello;\nbegin\nend.\n"))

    def test_pascal_procedure_alone_and_unit_are_fragments(self):
        self.assertFalse(check_code_blocks.has_main("pascal", PASCAL_PROCEDURE))
        self.assertFalse(check_code_blocks.has_main("pascal", PASCAL_UNIT))

    def test_pascal_program_may_end_with_a_comment_after_end(self):
        for comment in ("{ the end }", "(* the end *)", "// the end"):
            with self.subTest(comment=comment):
                self.assertTrue(check_code_blocks.has_main("pascal", f"begin\nend. {comment}\n"))


class CheckBlockCase(unittest.TestCase):
    def setUp(self):
        self.workdir = pathlib.Path(tempfile.mkdtemp(prefix="block-test-"))
        self.addCleanup(shutil.rmtree, self.workdir, ignore_errors=True)

    def status_of(self, language, code):
        return check_code_blocks.check_block(("page.html", 1, language, code, self.workdir))["status"]

    @unittest.skipUnless(installed("pascal"), "fpc is not installed")
    def test_pascal_program_that_fails_on_a_readln_in_any_spelling_is_input(self):
        self.assertEqual(self.status_of("pascal", PASCAL_READS_FILE), "INPUT")

    def test_timeout_of_a_program_that_reads_input_is_input(self):
        with mock.patch.object(check_code_blocks, "TIMEOUT", 0.5):
            self.assertEqual(self.status_of("python", INPUT_THEN_ENDLESS_PY), "INPUT")
            self.assertEqual(self.status_of("python", ENDLESS_PY), "TIMEOUT")


class RunCase(unittest.TestCase):
    def test_run_feeds_stdin_and_keeps_the_streams_apart(self):
        program = "import sys; print(sys.stdin.read().upper(), end=''); print('warning', file=sys.stderr)"
        outcome = check_code_blocks.run([sys.executable, "-c", program], tempfile.gettempdir(), stdin=b"abc\n")
        self.assertEqual((outcome.code, outcome.stdout, outcome.stderr), (0, "ABC\n", "warning\n"))
        self.assertEqual(outcome.output, "ABC\nwarning")

    def test_run_reports_a_timeout_as_no_exit_code(self):
        outcome = check_code_blocks.run([sys.executable, "-c", "while True: pass"], tempfile.gettempdir(), timeout=0.5)
        self.assertEqual((outcome.code, outcome.output), (None, "time limit"))

    def test_run_reports_a_missing_command_instead_of_raising(self):
        outcome = check_code_blocks.run(["no-such-command-xyz"], tempfile.gettempdir())
        self.assertEqual(outcome.code, 127)
        self.assertIn("not found", outcome.stderr)


class InputPatternCase(unittest.TestCase):
    def test_a_testlib_checker_reads_the_files_of_its_command_line(self):
        for language in ("cpp", "c"):
            self.assertTrue(re.search(check_code_blocks.READS_INPUT[language], "registerTestlibCmd(argc, argv);"))
            self.assertFalse(re.search(check_code_blocks.READS_INPUT[language], 'puts("Hello");'))


if __name__ == "__main__":
    unittest.main()
