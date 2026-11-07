const { test, expect } = require('@playwright/test');
const { listPages, readPage } = require('./helpers');

// Session plan pages: /s1/index.html ... /s6/index.html, each with the #plan table built by common/gen.py.
const SESSION_PLANS = listPages().filter((urlPath) => /^\/s\d\/index\.html$/.test(urlPath) && readPage(urlPath).includes('id="plan"'));

// Columns: [in-person theory, in-person practice, in-person total, remote theory, remote practice, remote total].
async function planRows(page) {
  return page.locator('#plan tbody tr').evaluateAll((rows) =>
    rows.map((row) => ({
      isChapter: row.classList.contains('chapter'),
      isTotal: row.textContent.includes('Всего часов'),
      values: [...row.querySelectorAll('td.hours')].map((cell) => Number(cell.textContent.replace(/ /g, '').trim() || 0)),
    })),
  );
}

for (const urlPath of SESSION_PLANS) {
  test(`plan links resolve: ${urlPath}`, async ({ page, request }) => {
    await page.goto(urlPath);
    const hrefs = await page.locator('#plan a[href]').evaluateAll((links) => [...new Set(links.map((link) => link.href))]);
    const broken = [];
    for (const href of hrefs) {
      const response = await request.get(href);
      if (response.status() !== 200) broken.push(`${response.status()} ${href}`);
    }
    expect(broken).toEqual([]);
  });

  test(`plan totals add up: ${urlPath}`, async ({ page }) => {
    await page.goto(urlPath);
    const rows = await planRows(page);
    const totalRow = rows.find((row) => row.isTotal);
    const dataRows = rows.filter((row) => !row.isChapter && row.values.length === 6);

    expect(totalRow, 'the "Всего часов" row').toBeDefined();
    const columnSums = totalRow.values.map((_, column) => dataRows.reduce((sum, row) => sum + row.values[column], 0));
    expect(totalRow.values, 'totals row against the sum of the lesson rows').toEqual(columnSums);

    for (const row of dataRows) {
      expect([row.values[0] + row.values[1], row.values[3] + row.values[4]], 'theory + practice = total').toEqual([row.values[2], row.values[5]]);
    }
  });
}
