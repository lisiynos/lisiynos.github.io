const { test, expect } = require('@playwright/test');

// The pictures of the lesson on bipartite graphs and matchings (s5/bipartite_matching.html).
const LESSON = '/s5/bipartite_matching.html';
const COLORING = '.viz[data-viz="bipartite"]';
const MATCHING = '.viz[data-viz="matching"]';

// Collects the JavaScript errors of the page; the test fails if the pictures raise any.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

// Moves the player to its last frame, where the result is shown.
async function playToEnd(section) {
  const next = section.getByRole('button', { name: 'вперёд' });
  while (await next.isEnabled()) await next.click();
}

test('both pictures of the lesson start without errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  await expect(page.locator(`${COLORING} .viz-player`)).toHaveCount(1);
  await expect(page.locator(`${MATCHING} .viz-player`)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the cycle with a tail is bipartite, the triangle is not', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(COLORING);
  await section.locator('select').selectOption('cycle');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Граф двудольный: доли {0, 2, 4} и {1, 3, 5}');
  await section.locator('select').selectOption('triangle');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Раскраски в два цвета нет: граф не двудольный');
  expect(errors).toEqual([]);
});

test('Kuhn\'s algorithm on the example finds a matching of size 3', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(MATCHING);
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Размер максимального паросочетания: 3');
  expect(errors).toEqual([]);
});
