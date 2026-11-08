const { test, expect } = require('@playwright/test');
const { listPages, readPage } = require('./helpers');

// A lesson with a tag from common/tags.json.
const LESSON = '/s1/binsearch.html';

test('a tag on a lesson opens its section of the tag index', async ({ page }) => {
  await page.goto(LESSON);
  const link = page.locator('ul.tags a').first();
  const label = (await link.textContent()).trim();
  const target = new URL(await link.getAttribute('href'));
  expect(target.pathname).toBe('/tags.html');
  expect(target.searchParams.get('tag')).toBe(label);
  await page.goto(target.href);
  await expect(page.locator(`section[data-tag="${label}"]`)).toHaveCount(1);
  await expect(page.locator('.tag-selected')).toHaveCount(1);
});

test('a search for an alias of a tag finds the lessons with that tag', async ({ page }) => {
  await page.goto(LESSON);
  await page.locator('.site-search input').fill('binary search');
  await expect(page.locator('.site-search-results')).toContainText('Двоичный');
});

test('every tag used on a lesson has a section in the tag index', async ({ request }) => {
  const index = await (await request.get('/tags.html')).text();
  for (const urlPath of listPages()) {
    for (const block of readPage(urlPath).matchAll(/<ul class="tags">([\s\S]*?)<\/ul>/g)) {
      for (const link of block[1].matchAll(/<a[^>]*>([^<]*)<\/a>/g)) {
        expect(index, `${urlPath}: ${link[1]}`).toContain(`data-tag="${link[1].trim()}"`);
      }
    }
  }
});
