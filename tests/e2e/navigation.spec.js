const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

// The navigation of the course: the start page, the trail and the neighbouring lessons, the catalogue of
// algorithms. The data comes from navigation.json and algorithms.html, made by common/build_navigation.py.
const ROOT = path.resolve(__dirname, '..', '..');
const navigation = JSON.parse(fs.readFileSync(path.join(ROOT, 'navigation.json'), 'utf8'));
const LESSONS = Object.keys(navigation.pages);

test('the start page links every session and the catalogue', async ({ page }) => {
  await page.goto('/');
  for (const session of Object.keys(navigation.sessions)) {
    await expect(page.locator(`a[href="${session}/index.html"]`)).toHaveCount(1);
  }
  await expect(page.locator('a[href="algorithms.html"]')).toHaveCount(1);
});

test('the sessions of the start page exist in the navigation data', async () => {
  expect(Object.keys(navigation.sessions).length).toBeGreaterThanOrEqual(6);
  for (const lessons of Object.values(navigation.sessions)) {
    expect(lessons.pages.length).toBeGreaterThan(0);
  }
});

for (const lesson of LESSONS) {
  test(`${lesson} has a trail through its session and links to its neighbours`, async ({ page, request }) => {
    await page.goto(`/${lesson}`);
    await expect(page.locator('.site-trail')).toHaveCount(1);
    const { prev, next } = navigation.pages[lesson];
    for (const target of [prev, next].filter(Boolean)) {
      const response = await request.get(`/${target}`);
      expect(response.status(), `neighbour ${target}`).toBe(200);
    }
    await expect(page.locator('.site-pager a.pager-prev')).toHaveCount(prev ? 1 : 0);
    await expect(page.locator('.site-pager a.pager-next')).toHaveCount(next ? 1 : 0);
  });
}

// Pages that explain algorithms get a box that links to the sections.
const PAGES_WITH_ALGORITHMS = Object.keys(navigation.byPage);

for (const lesson of PAGES_WITH_ALGORITHMS) {
  test(`the algorithm links of ${lesson} point to sections that exist`, async ({ page }) => {
    await page.goto(`/${lesson}`);
    const links = page.locator('.page-algorithms li a[href^="#"]');
    const count = await links.count();
    expect(count).toBe(navigation.byPage[lesson].length);
    for (const href of await links.evaluateAll((elements) => elements.map((element) => element.getAttribute('href')))) {
      // An attribute selector: some ids start with a digit, which a #id selector cannot use.
      await expect(page.locator(`[id="${href.slice(1)}"]`), `section ${href}`).toHaveCount(1);
    }
  });
}

test('every link of the catalogue opens a section that exists', async ({ request }) => {
  const response = await request.get('/algorithms.html');
  expect(response.ok()).toBeTruthy();
  const catalogue = await response.text();
  const links = [...catalogue.matchAll(/href="([^"#]+)#([^"]+)"/g)];
  expect(links.length).toBeGreaterThan(0);
  for (const [, target, anchor] of links) {
    const lesson = await request.get(`/${target}`);
    expect(lesson.ok(), `page ${target}`).toBeTruthy();
    expect(await lesson.text(), `section ${target}#${anchor}`).toContain(`id="${anchor}"`);
  }
});
