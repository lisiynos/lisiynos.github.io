const { test, expect } = require('@playwright/test');

// The FFT picture on the lesson about long numbers: the numbers as polynomials and the complex plane.
const LESSON = '/s1/long_ar.html';
const FFT = '.viz[data-viz="fft"]';

// Collects the JavaScript errors of the page; the test fails if the picture raises any.
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

test('the numbers are shown as polynomials at x = 10', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(FFT);
  await expect(section.locator('.viz-formula').nth(0)).toContainText('A(x) = 4 + 3 · x + 2 · x');
  await expect(section.locator('.viz-formula').nth(0)).toContainText('A(10) = 1234');
  await expect(section.locator('.viz-formula').nth(1)).toContainText('B(10) = 5678');
  expect(errors).toEqual([]);
});

test('the values are drawn on the complex plane during the transform', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(FFT);
  await section.getByRole('button', { name: 'вперёд' }).click();
  await expect(section.locator('svg.viz-plane')).toHaveCount(1);
  await expect(section.locator('svg.viz-plane .viz-point')).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the product polynomial evaluates to 7006652', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(FFT);
  await playToEnd(section);
  await expect(section.locator('.viz-formula').last()).toContainText('C(10) = 7006652');
  await expect(section.locator('.viz-caption')).toContainText('Результат: 7006652');
  expect(errors).toEqual([]);
});
