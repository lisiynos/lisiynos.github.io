const { test, expect } = require('@playwright/test');

// The interactive long arithmetic and the FFT picture on the lesson about long numbers (js/viz.js).
const LESSON = '/s1/long_ar.html';
const LONG = '.viz[data-viz="longarith"]';
const FFT = '.viz[data-viz="fft"]';

// Collects the JavaScript errors of the page; the test fails if the visualizations raise any.
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

test('addition shows the steps and gives the sum', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(LONG);
  await section.locator('input').nth(0).fill('99999999');
  await section.locator('input').nth(1).fill('1');
  await expect(section.locator('.viz-counter')).toContainText('из');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Результат: 100000000');
  expect(errors).toEqual([]);
});

test('multiplication shows the column rows and gives the product', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(LONG);
  await section.locator('select').selectOption('mul');
  await section.locator('input').nth(0).fill('1234');
  await section.locator('input').nth(1).fill('5678');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Результат: 7006652');
  expect(errors).toEqual([]);
});

test('division shows the trial quotient blocks and checks the result', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(LONG);
  await section.locator('select').selectOption('div');
  await section.locator('input').nth(0).fill('7006652');
  await section.locator('input').nth(1).fill('1234');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Частное 5678, остаток 0');
  expect(errors).toEqual([]);
});

test('division by zero and bad input are reported, not run', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(LONG);
  await section.locator('select').selectOption('div');
  await section.locator('input').nth(1).fill('0');
  await expect(section.locator('.viz-error')).toContainText('На ноль делить нельзя');
  await section.locator('input').nth(1).fill('12a');
  await expect(section.locator('.viz-error')).toContainText('Введите неотрицательные целые числа');
  expect(errors).toEqual([]);
});

test('the arithmetic of the picture agrees with BigInt', async ({ page }) => {
  await page.goto(LESSON);
  const mismatches = await page.evaluate(() => {
    const V = window.VizLongArithmetic;
    const last = (frames) => frames[frames.length - 1];
    const pairs = [['0', '0'], ['0', '7'], ['9999', '9999'], ['10000', '1'], ['99999999', '1'],
      ['12345678901234567890', '98765432109876543210'], ['9'.repeat(40), '9'.repeat(20)], ['1' + '0'.repeat(39), '3']];
    const bad = [];
    for (const [x, y] of pairs) {
      const a = V.toBlocks(x);
      const b = V.toBlocks(y);
      if (V.toText(last(V.addFrames(a, b)).result) !== (BigInt(x) + BigInt(y)).toString()) bad.push(`add ${x} ${y}`);
      if (V.toText(last(V.mulFrames(a, b)).res) !== (BigInt(x) * BigInt(y)).toString()) bad.push(`mul ${x} ${y}`);
      if (BigInt(y) !== 0n) {
        const division = last(V.divFrames(a, b));
        if (V.toText(division.q) !== (BigInt(x) / BigInt(y)).toString()) bad.push(`div ${x} ${y}`);
        if (V.toText(division.rem) !== (BigInt(x) % BigInt(y)).toString()) bad.push(`rem ${x} ${y}`);
      }
    }
    return bad;
  });
  expect(mismatches).toEqual([]);
});

test('the FFT picture multiplies 1234 by 5678', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(FFT);
  await section.locator('input').nth(0).fill('1234');
  await section.locator('input').nth(1).fill('5678');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Результат: 7006652');
  expect(errors).toEqual([]);
});
