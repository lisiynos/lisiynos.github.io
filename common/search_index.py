"""Write search-index.json at the site root: the title, headings and tags of every lesson page.

The tags of a page are its labels from common/tags.json and their aliases, so an alias finds the page.
Run it after adding, renaming or retitling pages or changing a tag:  python common/search_index.py
Needs beautifulsoup4 and lxml.
"""
import json
import pathlib

from bs4 import BeautifulSoup

import tag_vocabulary

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX_FILE = ROOT / "search-index.json"
# Keep in sync with SKIPPED_DIRS in tests/e2e/helpers.js: these folders are not site pages.
SKIPPED_DIRS = {".git", ".idea", "node_modules", "test-results", "playwright-report", "tests", "common", "_templates", "FlashPascal", "plastex"}
MAX_HEADINGS = 40


def site_pages():
    for path in sorted(ROOT.rglob("*.htm*")):
        if not SKIPPED_DIRS.intersection(path.relative_to(ROOT).parts[:-1]):
            yield path


def page_entry(path):
    soup = BeautifulSoup(path.read_bytes(), "lxml")
    content = soup.find(id="content") or soup.body or soup
    title_tag = content.find("h1") or soup.title
    title = title_tag.get_text(" ", strip=True) if title_tag else ""
    headings = [heading.get_text(" ", strip=True) for heading in content.find_all(["h2", "h3"])]
    tags = [link.get_text(strip=True) for link in soup.select("ul.tags a")]
    return {
        "url": path.relative_to(ROOT).as_posix(),
        "title": title or path.stem,
        "headings": [heading for heading in headings if heading][:MAX_HEADINGS],
        "tags": [tag for tag in tags if tag],
    }


def main():
    aliases = {entry["label"]: entry["aliases"] for entry in tag_vocabulary.load()}
    entries = [page_entry(path) for path in site_pages()]
    for entry in entries:
        entry["tags"] = [name for tag in entry["tags"] for name in (tag, *aliases.get(tag, []))]
    INDEX_FILE.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(entries)} pages -> {INDEX_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
