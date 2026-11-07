const { test, expect } = require('@playwright/test');
const { listPages, readPage } = require('./helpers');
const { KNOWN_PAGE_ISSUES } = require('./known-issues');

// A hard-coded http:// address in a tag the browser loads. Plain links (<a href>) may stay http.
const HTTP_RESOURCE = /<(?:script|link|img|iframe|source|embed|object)\b[^>]*?\b(?:src|href|data)\s*=\s*["']?http:\/\/[^\s"'>]*/gi;

// Local runs use http://127.0.0.1, where a script that takes its protocol from the page is fine.
const LOCAL_HTTP = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/;

for (const urlPath of listPages()) {
  test(`loads without errors: ${urlPath}`, async ({ page, baseURL }) => {
    const problems = (readPage(urlPath).match(HTTP_RESOURCE) || []).map((tag) => `hard-coded http: ${tag}`);

    // The deployed https site blocks every http:// request, so the browser's requests are checked there only.
    const checkMixedContent = baseURL.startsWith('https://');
    const isInsecure = (url) => checkMixedContent && url.startsWith('http://') && !LOCAL_HTTP.test(url);
    page.on('request', (request) => {
      if (isInsecure(request.url())) problems.push(`http request: ${request.url()}`);
    });
    page.on('requestfailed', (request) => {
      if (isInsecure(request.url())) problems.push(`http request: ${request.url()}`);
      else if (request.url().startsWith(baseURL)) problems.push(`request failed: ${request.url()}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().startsWith(baseURL)) {
        problems.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('pageerror', (error) => problems.push(`js: ${error.message}`));

    const response = await page.goto(urlPath);
    expect(response.status(), 'page status').toBeLessThan(400);
    // Scripts may still send requests after the load event, for example an XMLHttpRequest made from onLoad.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const found = [...new Set(problems)];
    const known = KNOWN_PAGE_ISSUES[urlPath] || [];
    const unexpected = found.filter((problem) => !known.some((text) => problem.includes(text)));
    const stale = known.filter((text) => !found.some((problem) => problem.includes(text)));
    expect(unexpected, 'new problems on this page').toEqual([]);
    expect(stale, 'known issues that no longer occur: remove them from known-issues.js').toEqual([]);
  });
}
