const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// Not site pages: tooling, generator and Sphinx templates (with ${...} placeholders), vendored code, the tests.
const SKIPPED_DIRS = new Set(['.git', '.idea', 'node_modules', 'test-results', 'playwright-report', 'tests', 'common', '_templates', 'FlashPascal', 'plastex']);

// Every HTML page of the site as a URL path, for example "/s1/binsearch.html".
function listPages(dir = ROOT) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : listPages(fullPath);
    if (!/\.html?$/i.test(entry.name)) return [];
    return ['/' + path.relative(ROOT, fullPath).split(path.sep).join('/')];
  });
}

function readPage(urlPath) {
  return fs.readFileSync(path.join(ROOT, urlPath), 'utf8');
}

module.exports = { listPages, readPage };
