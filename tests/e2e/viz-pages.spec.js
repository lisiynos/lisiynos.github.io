const { test, expect } = require('@playwright/test');

// The visualizations of the sorting, binary search and graph pages (js/viz.js), with their default inputs.
const PAGES = ['/s1/long_ar.html', '/s1/sort.html', '/s1/binsearch.html', '/s1/graph_alg.html', '/s1/graph_alg_py.html'];

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

for (const urlPath of PAGES) {
  test(`every visualization on ${urlPath} starts without errors`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(urlPath);
    const slots = await page.locator('.viz[data-viz]').count();
    expect(slots).toBeGreaterThan(0);
    await expect(page.locator('.viz[data-viz] .viz-player')).toHaveCount(slots);
    expect(errors).toEqual([]);
  });
}

test('bubble sort and selection sort end with the sorted numbers', async ({ page }) => {
  await page.goto('/s1/sort.html');
  const section = page.locator('.viz[data-viz="sort"]');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Готово: 1, 2, 3, 5, 7, 8, 9');
  await section.locator('select').selectOption('selection');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Готово: 1, 2, 3, 5, 7, 8, 9');
});

test('binary search finds 11 in the default array', async ({ page }) => {
  await page.goto('/s1/binsearch.html');
  const section = page.locator('.viz[data-viz="binsearch"]');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Нашли: a[5] = 11');
});

test('breadth-first search from vertex 0 visits all seven vertices in order', async ({ page }) => {
  await page.goto('/s1/graph_alg.html');
  const section = page.locator('.viz[data-viz="graph"]');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Порядок обхода в ширину: 0 → 1 → 2 → 3 → 4 → 5 → 6');
});
