const { test, expect } = require('@playwright/test');

// A phone screen is 390 px wide. A table of a lesson must not widen the page beyond it.
test.use({ viewport: { width: 390, height: 844 } });

test('the complexity table of s1/alg.html fits a phone without sideways scrolling', async ({ page }) => {
  await page.goto('/s1/alg.html');
  await expect(page.locator('table.complexity-table')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
