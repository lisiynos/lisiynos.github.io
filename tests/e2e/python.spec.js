const { test, expect } = require('@playwright/test');

// The «Запустить» button of a Python block runs the program in the browser (Pyodide, in a worker). The first run
// loads the interpreter from jsDelivr, so the tests allow a long time. Each test replaces the code of the first
// Python block of the lesson with its own program.
const LESSON = '/s1/python.html';

test.setTimeout(120_000);

async function setCode(page, code) {
  await page.locator('pre.sh_python').first().evaluate((pre, text) => {
    pre.textContent = text;
  }, code);
}

test('a Python block shows the output of its program', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, 'print(sum(i * i for i in range(10)))');
  await page.locator('.run-code').first().click();
  await expect(page.locator('.python-output').first()).toContainText('285');
});

test('a program that reads input shows the input box on the first click and runs on the second', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, "name = input()\nprint('Привет, ' + name)\ninput()");
  const run = page.locator('.run-code').first();
  const panel = page.locator('.python-run').first();
  const output = page.locator('.python-output').first();
  await expect(panel).toBeHidden();
  await run.click();
  await expect(panel).toBeVisible();
  await expect(page.locator('.python-input').first()).toBeFocused();
  // Nothing ran: a run disables «Запустить» and shows «Остановить» at once.
  expect(await run.isEnabled()).toBe(true);
  expect(await page.locator('.python-stop').first().isHidden()).toBe(true);
  expect(await output.textContent()).toBe('');
  await page.locator('.python-input').first().fill('Мир');
  await run.click();
  await expect(output).toContainText('Привет, Мир');
  // input() past the last line of the box reports the end of the input.
  await expect(output).toContainText('EOFError');
});

test('an error of the program is shown in the output', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, 'print(1 / 0)');
  await page.locator('.run-code').first().click();
  const error = page.locator('.python-output .python-error').first();
  // The traceback is the text of the error node: its file name "<exec>" is shown as characters, not read as a tag.
  await expect(error).toContainText('Traceback (most recent call last)');
  await expect(error).toContainText('File "<exec>"');
  await expect(error).toContainText('ZeroDivisionError');
  await expect(error.locator('*')).toHaveCount(0);
});

test('every run starts with an empty namespace', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, 'x = 5\nprint("готово")');
  await page.locator('.run-code').first().click();
  await expect(page.locator('.python-output').first()).toContainText('готово');
  await setCode(page, 'print(x)');
  await page.locator('.run-code').first().click();
  await expect(page.locator('.python-output').first()).toContainText('NameError');
});

test('the program runs as __main__, so its main block runs', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, "if __name__ == '__main__': print('главный')");
  await page.locator('.run-code').first().click();
  await expect(page.locator('.python-output').first()).toContainText('главный');
});

test('Остановить ends a program that does not finish', async ({ page }) => {
  await page.goto(LESSON);
  // The program prints a line every 50 ms: a worker that survived «Остановить» would go on adding lines.
  await setCode(page, "import time\nwhile True:\n    print('тик', flush=True)\n    time.sleep(0.05)");
  await page.locator('.run-code').first().click();
  const output = page.locator('.python-output').first();
  await expect(output).toContainText('тик');
  await page.locator('.python-stop').first().click();
  await expect(output).toContainText('[остановлено]');
  await expect(page.locator('.run-code').first()).toBeEnabled();
  const stopped = await output.textContent();
  expect(stopped).toMatch(/\[остановлено\]$/);
  await page.waitForTimeout(300);
  expect(await output.textContent()).toBe(stopped);
  // The next run starts a new worker, so a program still runs after the stop, and only its own output is shown.
  await setCode(page, 'print(2 + 2)');
  await page.locator('.run-code').first().click();
  await expect(output).toHaveText('4');
});

test('while a program runs, Запустить is disabled and Остановить is shown', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, "print('готово')");
  await page.locator('.run-code').first().click();
  await expect(page.locator('.run-code').first()).toBeDisabled();
  await expect(page.locator('.python-stop').first()).toBeVisible();
  await expect(page.locator('.python-output').first()).toContainText('готово');
  await expect(page.locator('.run-code').first()).toBeEnabled();
  await expect(page.locator('.python-stop').first()).toBeHidden();
});

test('the output is text: HTML printed by a program is shown as characters', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, `print('<img src=x onerror="window.__xss=1">')`);
  await page.locator('.run-code').first().click();
  const output = page.locator('.python-output').first();
  await expect(output).toContainText('<img src=x onerror="window.__xss=1">');
  await expect(page.locator('.run-code').first()).toBeEnabled();
  await expect(output.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('text written to stderr is shown as characters, not as HTML', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, "import sys\nsys.stderr.write('<b>x</b>')");
  await page.locator('.run-code').first().click();
  const output = page.locator('.python-output').first();
  await expect(output.locator('.python-error')).toHaveText(['<b>x</b>']);
  await expect(output.locator('b')).toHaveCount(0);
});

test('output without a final newline is shown, and nothing of it leaks into the next run', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, "print('abc', end='')");
  await page.locator('.run-code').first().click();
  const output = page.locator('.python-output').first();
  await expect(output).toHaveText('abc');
  await expect(page.locator('.run-code').first()).toBeEnabled();
  await setCode(page, "print('готово')");
  await page.locator('.run-code').first().click();
  await expect(output).toHaveText('готово');
});

test('the name of an output file starts on its own line after output without a final newline', async ({ page }) => {
  await page.goto(LESSON);
  await setCode(page, "print('x', end='')\nopen('out.txt', 'w').write('y')");
  const run = page.locator('.run-code').first();
  await run.click(); // the program opens a file, so the first click only shows the input box
  await run.click();
  // A regular expression: with a string, toHaveText would fold the newlines into spaces.
  await expect(page.locator('.python-output').first()).toHaveText(/^x\n--- out\.txt ---\ny$/);
});

test('an error in JavaScript called by the program ends the run as a failure of the program', async ({ page }) => {
  await page.goto(LESSON);
  // The timer throws while the program waits, so the uncaught error reaches the page during the run.
  const program = [
    'import asyncio, js',
    "print('после', flush=True)",
    `js.eval("setTimeout(() => { throw new Error('boom') }, 0)")`,
    'await asyncio.sleep(5)',
  ];
  await setCode(page, program.join('\n'));
  await page.locator('.run-code').first().click();
  const output = page.locator('.python-output').first();
  await expect(output).toContainText('после');
  await expect(output.locator('.python-error')).toContainText(/Программа завершилась с ошибкой: .*boom/);
  await expect(output).not.toContainText('Обычно причина в сети');
  await expect(page.locator('.run-code').first()).toBeEnabled();
  await expect(page.locator('.python-stop').first()).toBeHidden();
  // The next run starts a new worker.
  await setCode(page, 'print(2 + 2)');
  await page.locator('.run-code').first().click();
  await expect(output).toHaveText('4');
});

test('a browser that cannot start the worker says so, and the buttons stay as they were', async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = function () {
      throw new Error('Worker is not allowed');
    };
  });
  await page.goto(LESSON);
  await setCode(page, 'print(1)');
  await page.locator('.run-code').first().click();
  await expect(page.locator('.python-output .python-error').first()).toContainText('Не удалось запустить Python');
  await expect(page.locator('.run-code').first()).toBeEnabled();
  await expect(page.locator('.python-stop').first()).toBeHidden();
});

test('a failed download of Pyodide is reported, and the next run works', async ({ page }) => {
  await page.route('**/python_stdlib.zip', (route) => route.abort());
  await page.goto(LESSON);
  await setCode(page, "print('готово')");
  await page.locator('.run-code').first().click();
  const output = page.locator('.python-output').first();
  await expect(output.locator('.python-error')).toContainText('Обычно причина в сети');
  await expect(output).not.toContainText('[object Object]');
  await expect(page.locator('.run-code').first()).toBeEnabled();
  await page.unroute('**/python_stdlib.zip');
  await page.locator('.run-code').first().click();
  await expect(output).toContainText('готово');
});

test('a failed download of the worker script is reported, and the next run works', async ({ page }) => {
  await page.route('**/pyodide.mjs', (route) => route.abort());
  await page.goto(LESSON);
  await setCode(page, "print('готово')");
  await page.locator('.run-code').first().click();
  const output = page.locator('.python-output').first();
  await expect(output.locator('.python-error')).toContainText('Не удалось запустить Python');
  await expect(page.locator('.run-code').first()).toBeEnabled();
  await page.unroute('**/pyodide.mjs');
  await page.locator('.run-code').first().click();
  await expect(output).toContainText('готово');
});
