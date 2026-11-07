const { test, expect } = require('@playwright/test');
const { listPages } = require('./helpers');

// A long lesson with several headings, a code block and formulas.
const LESSON = '/s1/binsearch.html';

test('search finds a lesson by its title', async ({ page }) => {
  await page.goto(LESSON);
  await page.locator('.site-search input').fill('бинарный');
  await expect(page.locator('.site-search-results a').first()).toContainText('Двоичный');
});

test('search reports when nothing matches', async ({ page }) => {
  await page.goto(LESSON);
  await page.locator('.site-search input').fill('zzzqqq');
  await expect(page.locator('.site-search-results')).toContainText('Ничего не найдено');
});

test('every code block has a copy button', async ({ page }) => {
  await page.goto(LESSON);
  const blocks = await page.locator('pre').count();
  expect(blocks).toBeGreaterThan(0);
  await expect(page.locator('.code-block .copy-code')).toHaveCount(blocks);
});

test('the table of contents links to headings that exist', async ({ page }) => {
  await page.goto(LESSON);
  const links = page.locator('.toc a');
  expect(await links.count()).toBeGreaterThanOrEqual(3);
  const targets = await links.evaluateAll((elements) => elements.map((element) => element.getAttribute('href')));
  for (const target of targets) {
    await expect(page.locator(target)).toHaveCount(1);
  }
});

test('headings have anchor links', async ({ page }) => {
  await page.goto(LESSON);
  const headings = await page.locator('#content h2, #content h3').count();
  expect(headings).toBeGreaterThan(0);
  await expect(page.locator('#content h2 .anchor, #content h3 .anchor')).toHaveCount(headings);
});

test('the search index lists every site page and nothing else', async ({ request }) => {
  const response = await request.get('/search-index.json');
  expect(response.ok()).toBeTruthy();
  const index = await response.json();
  const indexed = index.map((entry) => `/${entry.url}`);
  const pages = listPages();
  expect(pages.filter((urlPath) => !indexed.includes(urlPath)), 'pages missing from search-index.json').toEqual([]);
  expect(indexed.filter((urlPath) => !pages.includes(urlPath)), 'stale entries: run python common/search_index.py').toEqual([]);
});
