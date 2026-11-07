const { test, expect } = require('@playwright/test');
const { listPages, readPage } = require('./helpers');

// Rules every page follows. They are checked on the source, so they hold on any server.
// Libraries that were retired or are out of date.
const OUTDATED = /mathjax\/2\.7|MathJax\.Hub|jquery\/1\/|jquery\/1\.4|jquery-1\.11|jquery-migrate-1\.2|highlight\.js\/8\./;

for (const urlPath of listPages()) {
  test(`page follows the site rules: ${urlPath}`, () => {
    const html = readPage(urlPath);
    // Fragments inserted into other pages, and empty files, have no <head> and are not checked.
    test.skip(!/<head\b/i.test(html), 'not a full page');

    expect(html, 'viewport meta tag for phones').toMatch(/<meta[^>]*name\s*=\s*["']?viewport/i);
    expect(html, 'shared site.js and site.css').toContain('js/site.js');
    expect(html, 'shared site.css').toContain('style/site.css');

    const images = html.match(/<img\b[^>]*>/gi) || [];
    expect(images.filter((tag) => !/\bloading\s*=/i.test(tag)), 'images without loading="lazy"').toEqual([]);

    expect(html.match(OUTDATED) || [], 'outdated library references').toEqual([]);
  });
}
