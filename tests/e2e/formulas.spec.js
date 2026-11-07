const { test, expect } = require('@playwright/test');
const { listPages, readPage } = require('./helpers');
const { KNOWN_FORMULA_ISSUES } = require('./known-issues');

// MathJax replaces $...$ and \(...\) with rendered output. Delimiters left in the visible text mean it did not run.
const RAW_FORMULA = /\$[^$\n]{1,300}\$|\\\([^\n]{1,300}?\\\)/g;

async function rawFormulasLeft(page) {
  const text = await page.evaluate(() => {
    const root = document.querySelector('#content') || document.body;
    const copy = root.cloneNode(true);
    copy.querySelectorAll('pre, code, script, style, textarea').forEach((element) => element.remove());
    return copy.textContent;
  });
  return text.match(RAW_FORMULA) || [];
}

const MATHJAX_PAGES = listPages().filter((urlPath) => readPage(urlPath).includes('MathJax'));

for (const urlPath of MATHJAX_PAGES) {
  test(`formulas render: ${urlPath}`, async ({ page }) => {
    await page.goto(urlPath);
    const known = KNOWN_FORMULA_ISSUES[urlPath] || [];
    await expect
      .poll(async () => (await rawFormulasLeft(page)).filter((formula) => !known.includes(formula)), {
        message: 'raw $...$ text left after MathJax ran',
        timeout: 30_000,
      })
      .toEqual([]);
    const left = await rawFormulasLeft(page);
    expect(known.filter((formula) => !left.includes(formula)), 'known formula issues that no longer occur').toEqual([]);
  });
}
