"""Check the tags of the lessons against common/tags.json and write tags.html, the index of the tags.

Run it after changing a tag, the vocabulary or a lesson's <ul class="tags">:  python common/build_tags.py
Needs beautifulsoup4 and lxml (through search_index.py).
"""
import collections
import html
import sys

import search_index
import tag_vocabulary
from build_navigation import page

ROOT = search_index.ROOT


def check_vocabulary(entries):
    owner = {}
    for entry in entries:
        for name in [entry["label"], *entry["aliases"]]:
            if owner.setdefault(name.casefold(), entry["label"]) != entry["label"]:
                raise SystemExit(f"{name!r} names two tags")


def tags_page(lessons):
    body = ["<h1>Теги</h1>",
            "<p>Темы курса и страницы, где они разобраны. Тег на странице открывает этот список с выбранной темой. "
            "Файл создан скриптом common/build_tags.py, не редактируйте его вручную.</p>"]
    for label in sorted(lessons, key=str.casefold):
        body.append(f'<section data-tag="{html.escape(label)}">')
        body.append(f"<h2>{html.escape(label)}</h2>")
        body.append("<ul>")
        body += [f'<li><a href="{lesson["url"]}">{html.escape(lesson["title"])}</a></li>'
                 for lesson in sorted(lessons[label], key=lambda lesson: lesson["title"])]
        body.append("</ul>")
        body.append("</section>")
    return page("Теги", body)


def main():
    entries = tag_vocabulary.load()
    check_vocabulary(entries)
    labels = {entry["label"] for entry in entries}
    lessons = collections.defaultdict(list)
    unknown = set()
    for path in search_index.site_pages():
        lesson = search_index.page_entry(path)
        for tag in set(lesson["tags"]):
            if tag in labels:
                lessons[tag].append(lesson)
            else:
                unknown.add(tag)
    if unknown:
        sys.exit(f"tags missing from common/tags.json: {sorted(unknown)}")
    (ROOT / "tags.html").write_text(tags_page(lessons), encoding="utf-8")
    pages = {lesson["url"] for group in lessons.values() for lesson in group}
    print(f"{len(lessons)} tags on {len(pages)} pages -> tags.html")


if __name__ == "__main__":
    main()
