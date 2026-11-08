const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { listPages, readPage } = require('./helpers');

// Solution blocks: <pre class="sh_python" data-src="../tasks/aplusb_long/sum.py"> with a link to the file inside.
// loadSolutions() in js/site.js replaces the link by the text of the file once the page has loaded, so a lesson
// shows the very file that tests/code/check_solutions.py runs on the tests. The browser part runs on the fixture
// page tests/e2e/fixtures/solutions.html; its Python runs load Pyodide from jsDelivr on the first run, hence the
// long timeout, as in python.spec.js.
const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = '/tests/e2e/fixtures/solutions.html';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const SOLUTIONS_DIR = path.join(FIXTURES_DIR, 'solutions');

const SOLUTION_BLOCK = /<pre\b[^>]*\bdata-src=["']([^"']+)["'][^>]*>([\s\S]*?)<\/pre>/gi;
const LINK = /<a\b[^>]*\bhref=["']([^"']+)["']/gi;

test.setTimeout(120_000);

// The text of a fixture file as the block shows it: one trailing newline removed.
function solutionText(name) {
  return fs.readFileSync(path.join(SOLUTIONS_DIR, name), 'utf8').replace(/\n$/, '');
}

// The wrapper that addCopyButtons() puts around a block, with its buttons and the Python panel.
function codeBlock(page, selector) {
  return page.locator('.code-block', { has: page.locator(selector) });
}

// The text highlighted by SHJS in one pass, as innerHTML: a second pass would nest or repeat the spans.
function highlightedOnce(page, text, language) {
  return page.evaluate(([code, lang]) => {
    const pre = document.createElement('pre');
    pre.textContent = code;
    window.sh_highlightElement(pre, window.sh_languages[lang]);
    return pre.innerHTML;
  }, [text, language]);
}

// The first click on «Запустить» of a program that reads input or opens a file only shows the input box, so the
// reader fills it before the run (python.spec.js tests this); the next click runs the program.
async function showInput(wrapper) {
  await wrapper.locator('.run-code').click();
  await expect(wrapper.locator('.python-run')).toBeVisible();
}

test('every solution block of the site points to a file under tasks/ and links to it', () => {
  const problems = [];
  for (const urlPath of listPages()) {
    const dir = path.posix.dirname(urlPath);
    for (const [, src, content] of readPage(urlPath).matchAll(SOLUTION_BLOCK)) {
      const target = path.posix.join(dir, src);
      if (!target.startsWith('/tasks/')) problems.push(`${urlPath}: ${src} is not under tasks/`);
      if (!fs.existsSync(path.join(ROOT, target))) problems.push(`${urlPath}: ${src} does not exist`);
      const links = [...content.matchAll(LINK)].map(([, href]) => path.posix.join(dir, href));
      if (!links.includes(target)) problems.push(`${urlPath}: no fallback link to ${src}`);
    }
  }
  expect(problems).toEqual([]);
});

for (const [name, language] of [['sum.py', 'python'], ['sum.pas', 'pascal']]) {
  test(`a block with data-src shows ${name}, highlighted once`, async ({ page }) => {
    await page.goto(FIXTURE);
    const block = page.locator(`pre[data-src="solutions/${name}"]`);
    const text = solutionText(name);
    await expect(block).toHaveText(text);
    expect(await block.evaluate((pre) => pre.textContent)).toBe(text);
    await expect(block).toHaveClass(/sh_sourceCode/);
    expect(await block.locator('span').count()).toBeGreaterThan(0);
    expect(await block.innerHTML()).toBe(await highlightedOnce(page, text, language));
  });
}

test('a file that arrives before the load event is highlighted exactly once', async ({ page }) => {
  // The picture holds the load event back for 1.5 s, so the files arrive long before it. The text must wait for
  // the event: put in earlier, it would be highlighted by showSolution() and once more by sh_highlightDocument()
  // from <body onLoad>.
  const picture = fs.readFileSync(path.join(FIXTURES_DIR, 'slow.png'));
  await page.route('**/slow.png', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ contentType: 'image/png', body: picture });
  });
  await page.goto(FIXTURE);
  const timing = await page.evaluate(() => {
    const [navigation] = performance.getEntriesByType('navigation');
    const [file] = performance.getEntriesByName(new URL('solutions/sum.py', location.href).href);
    return { fileArrived: file?.responseEnd, loadEvent: navigation.loadEventStart };
  });
  expect(timing.fileArrived).toBeLessThan(timing.loadEvent);
  const block = page.locator('pre[data-src="solutions/sum.py"]');
  const text = solutionText('sum.py');
  await expect(block).toHaveText(text);
  expect(await block.innerHTML()).toBe(await highlightedOnce(page, text, 'python'));
  const spans = await block.locator('span').count();
  expect(spans).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(await block.locator('span').count()).toBe(spans);
});

test('an ordinary block is highlighted exactly once', async ({ page }) => {
  await page.goto(FIXTURE);
  const inline = page.locator('pre.sh_python:not([data-src])');
  await expect(inline).toHaveClass(/sh_sourceCode/);
  expect(await inline.locator('span').count()).toBeGreaterThan(0);
  const highlighted = await highlightedOnce(page, await inline.evaluate((pre) => pre.textContent), 'python');
  expect(await inline.innerHTML()).toBe(highlighted);
  // The loader has done its work when the loaded block shows its file; nothing may change after that.
  await expect(page.locator('pre[data-src="solutions/sum.py"]')).toHaveText(solutionText('sum.py'));
  await page.waitForTimeout(500);
  expect(await inline.innerHTML()).toBe(highlighted);
});

test('a block whose file is missing keeps its link, and the page has no JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(FIXTURE);
  const block = page.locator('pre[data-src="solutions/missing.py"]');
  await expect(block).toHaveClass(/solution-missing/);
  await expect(block.locator('a[href="solutions/missing.py"]')).toHaveText('missing.py');
  await expect(page.locator('pre[data-src="solutions/sum.py"]')).toHaveText(solutionText('sum.py'));
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('the copy button copies the loaded text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(FIXTURE);
  const wrapper = codeBlock(page, 'pre[data-src="solutions/sum.py"]');
  await expect(wrapper.locator('pre[data-src]')).toHaveText(solutionText('sum.py'));
  await wrapper.locator('.copy-code').click();
  await expect(wrapper.locator('.copy-code')).toHaveText('Скопировано');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(solutionText('sum.py'));
});

test('Запустить runs the loaded program with its input and output files', async ({ page }) => {
  await page.goto(FIXTURE);
  const wrapper = codeBlock(page, 'pre[data-src="solutions/sum.py"]');
  await expect(wrapper.locator('pre[data-src]')).toHaveText(solutionText('sum.py'));
  // The input box is the content of sum.in.
  await showInput(wrapper);
  await wrapper.locator('.python-input').fill('2\n3');
  await wrapper.locator('.run-code').click();
  const output = wrapper.locator('.python-output');
  await expect(output).toHaveText('--- sum.out ---\n5');
  // The files of a run are removed after it: the second run sees neither the old input nor the old output.
  await wrapper.locator('.python-input').fill('10\n35');
  await wrapper.locator('.run-code').click();
  await expect(output).toHaveText('--- sum.out ---\n45');
});

test('a file that the program reads holds the text of the input box', async ({ page }) => {
  await page.goto(FIXTURE);
  const wrapper = codeBlock(page, 'pre.sh_python:not([data-src])');
  await showInput(wrapper);
  await wrapper.locator('.python-input').fill('первая строка\nвторая строка');
  await wrapper.locator('.run-code').click();
  await expect(wrapper.locator('.python-output')).toHaveText('первая строка\nвторая строка');
});

test('a file that the program did not close is shown too', async ({ page }) => {
  await page.goto(FIXTURE);
  const wrapper = codeBlock(page, 'pre.sh_python:not([data-src])');
  // The function keeps the namespace in a reference cycle, so the file is closed only when the worker collects
  // the objects of the run; without that the text would never reach the file.
  await wrapper.locator('pre.sh_python').evaluate((pre) => {
    pre.textContent = "def helper():\n    pass\n\nf = open('late.out', 'w')\nf.write('без close')";
  });
  await showInput(wrapper);
  await wrapper.locator('.run-code').click();
  await expect(wrapper.locator('.python-output')).toHaveText('--- late.out ---\nбез close');
});

test('the files of a run do not stay for the next run', async ({ page }) => {
  await page.goto(FIXTURE);
  const sum = codeBlock(page, 'pre[data-src="solutions/sum.py"]');
  await expect(sum.locator('pre[data-src]')).toHaveText(solutionText('sum.py'));
  await showInput(sum);
  await sum.locator('.run-code').click();
  await expect(sum.locator('.python-output')).toContainText('--- sum.out ---');
  await expect(sum.locator('.run-code')).toBeEnabled();
  // The check names the files without open(), so the worker makes none of them for this run, and the program
  // reads nothing, so the first click runs it.
  const check = codeBlock(page, 'pre.sh_python:not([data-src])');
  await check.locator('pre.sh_python').evaluate((pre) => {
    pre.textContent = "import os\nprint([name for name in ('sum.in', 'sum.out', 'data.in') if os.path.exists(name)])";
  });
  await check.locator('.run-code').click();
  await expect(check.locator('.python-output')).toHaveText('[]');
});
