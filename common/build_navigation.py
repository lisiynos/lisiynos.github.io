"""Build the navigation data, the algorithm catalogue, the start page and the visualization slots of the course.

Run it after changing lesson pages, session plans or the algorithm list below:
    python common/build_navigation.py

It writes:
    navigation.json  order of lessons in each session, previous/next links, algorithms and their pages
    algorithms.html  the algorithm catalogue (generated: do not edit by hand)
    index.html       the start page with the sessions (generated: do not edit by hand)
and adds to the lesson pages:
    id attributes on the headings the catalogue links to
    <div class="viz" data-viz="..."></div> placeholders for the animations in js/viz.js
The script is idempotent: a second run changes nothing. It needs no third-party packages.
"""
import html
import json
import pathlib
import posixpath
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SESSIONS = ["s1", "s2", "s3", "s4", "s5", "s6"]
HEADING = re.compile(r"<(h[1-3])(\s[^>]*)?>(.*?)</\1>", re.S | re.I)
TAGS = re.compile(r"<[^>]+>")
ID_ATTR = re.compile(r'\sid="([^"]+)"')

# Each algorithm: the pages and the heading (regular expression) of the section that teaches it.
ALGORITHMS = [
    {"id": "bubble", "name": "Сортировка пузырьком", "category": "Сортировки", "complexity": "O(n²)",
     "pages": [("s1/sort.html", "Пузырьком")]},
    {"id": "selection", "name": "Сортировка выбором", "category": "Сортировки", "complexity": "O(n²)",
     "pages": [("s1/sort.html", "Сортировка выбором")]},
    {"id": "counting", "name": "Сортировка подсчётом", "category": "Сортировки", "complexity": "O(n + k)",
     "pages": [("s1/sort.html", "Сортировка подсчётом")]},
    {"id": "quick", "name": "Быстрая сортировка (QuickSort)", "category": "Сортировки", "complexity": "O(n log n)",
     "pages": [("s1/sort.html", "Быстрая сортировка")]},
    {"id": "merge", "name": "Сортировка слиянием (MergeSort)", "category": "Сортировки", "complexity": "O(n log n)",
     "pages": [("s1/sort.html", "слиянием")]},
    {"id": "heap", "name": "Пирамидальная сортировка (HeapSort)", "category": "Сортировки", "complexity": "O(n log n)",
     "pages": [("s1/sort.html", "HeapSort")]},
    {"id": "binsearch", "name": "Двоичный поиск", "category": "Поиск", "complexity": "O(log n)",
     "pages": [("s1/binsearch.html", "Двоичный")]},
    {"id": "stack-queue", "name": "Стек и очередь на массиве", "category": "Структуры данных", "complexity": "O(1) на операцию",
     "pages": [("s1/data_structures.html", "Реализация Стека и Очереди")]},
    {"id": "kmp", "name": "Поиск подстроки: алгоритм КМП", "category": "Строки", "complexity": "O(n + m)",
     "pages": [("s4/strings.html", "Кнута-Морриса-Пратта"), ("s6/strings.html", "Кнута-Морриса-Пратта")]},
    {"id": "hash", "name": "Полиномиальный хеш строки", "category": "Строки", "complexity": "O(n)",
     "pages": [("s3/strings_hash.html", "Полиномиальные хеши")]},
    {"id": "dfs", "name": "Поиск в глубину (DFS)", "category": "Графы", "complexity": "O(V + E)",
     "pages": [("s1/graph_alg_py.html", "Поиск в глубину"), ("s1/graph_alg.html", "Поиск в глубину")]},
    {"id": "bfs", "name": "Поиск в ширину (BFS)", "category": "Графы", "complexity": "O(V + E)",
     "pages": [("s1/graph_alg_py.html", "Поиск в ширину"), ("s1/graph_alg.html", "Поиск в ширину")]},
    {"id": "topo", "name": "Топологическая сортировка", "category": "Графы", "complexity": "O(V + E)",
     "pages": [("s1/graph_alg_py.html", "Топологическая сортировка"), ("s1/graph_alg.html", "Топологическая сортировка")]},
    {"id": "euler", "name": "Эйлеров цикл", "category": "Графы", "complexity": "O(E)",
     "pages": [("s1/graph_alg_py.html", "Поиск эйлерова цикла"), ("s1/graph_alg.html", "Поиск эйлерова цикла")]},
    {"id": "dijkstra", "name": "Алгоритм Дейкстры", "category": "Графы", "complexity": "O((V + E) log V)",
     "pages": [("s1/graph_alg_py.html", "Алгоритм Дейкстры"), ("s1/graph_alg.html", "Алгоритм Дейкстры")]},
    {"id": "floyd", "name": "Алгоритм Флойда–Уоршелла", "category": "Графы", "complexity": "O(V³)",
     "pages": [("s1/graph_alg_py.html", "Алгоритм Флойда")]},
    {"id": "prim", "name": "Алгоритм Прима (минимальное остовное дерево)", "category": "Графы", "complexity": "O(E log V)",
     "pages": [("s1/graph_alg_py.html", "Алгоритм Прима")]},
    {"id": "kuhn", "name": "Максимальное паросочетание (алгоритм Куна)", "category": "Графы", "complexity": "O(V·E)",
     "pages": [("s5/bipartite_matching.html", "Максимальное паросочетание")]},
    {"id": "dsu", "name": "Система непересекающихся множеств (DSU)", "category": "Графы", "complexity": "почти O(1)",
     "pages": [("s4/dsu.html", "Система непересекающихся")]},
    {"id": "tree-walks", "name": "Обходы бинарного дерева", "category": "Структуры данных", "complexity": "O(n)",
     "pages": [("s6/trees.html", "Обходы бинарного дерева")]},
    {"id": "lca", "name": "Наименьший общий предок", "category": "Структуры данных", "complexity": "O(h)",
     "pages": [("s6/trees.html", "Наименьший общий предок")]},
    {"id": "treap", "name": "Декартово дерево (treap)", "category": "Структуры данных", "complexity": "O(log n)",
     "pages": [("s5/treap.html", "Декартово дерево")]},
    {"id": "segtree", "name": "Дерево отрезков", "category": "Структуры данных", "complexity": "O(log n)",
     "pages": [("s5/segments_tree.html", "Дерево отрезков"), ("s6/segment_tree_modification.html", "Дерево отрезков")]},
    {"id": "sqrt", "name": "Корневая оптимизация (sqrt-декомпозиция)", "category": "Структуры данных", "complexity": "O(√n)",
     "pages": [("s3/segments_tree.html", "Корневая оптимизация")]},
    {"id": "fenwick", "name": "Дерево Фенвика", "category": "Структуры данных", "complexity": "O(log n)",
     "pages": [("s6/fenwick_tree.html", "Дерево Фенвика")]},
    {"id": "rand-heap", "name": "Рандомизированная куча", "category": "Структуры данных", "complexity": "O(log n)",
     "pages": [("s6/rand_heap.html", "Рандомизированная куча")]},
    {"id": "bst", "name": "Дерево двоичного поиска", "category": "Структуры данных", "complexity": "O(h)",
     "pages": [("s6/rand_heap.html", "Дерево двоичного поиска")]},
    {"id": "dp-basics", "name": "Простейшие задачи динамического программирования", "category": "Динамическое программирование",
     "complexity": "O(n)", "pages": [("s1/dynamic_problems.html", "Числа Фибоначчи")]},
    {"id": "recursion", "name": "Рекурсия", "category": "Рекурсия и перебор", "complexity": "—",
     "pages": [("s1/recurs.html", "Простейшая рекурсия")]},
    {"id": "euclid", "name": "Алгоритм Евклида (НОД)", "category": "Числа", "complexity": "O(log n)",
     "pages": [("s1/integers.html", "Алгоритм Евклида для нахождения НОД"), ("s3/recursion.html", "Наибольший общий делитель")]},
    {"id": "sieve", "name": "Решето Эратосфена", "category": "Числа", "complexity": "O(n log log n)",
     "pages": [("s1/integers.html", "Решето")]},
    {"id": "fft", "name": "Быстрое умножение длинных чисел (FFT)", "category": "Числа", "complexity": "O(n log n)",
     "pages": [("s1/long_ar.html", "Быстрое умножение длинных чисел: FFT")]},
    {"id": "combinatorics", "name": "Комбинаторика: перестановки, размещения, сочетания", "category": "Комбинаторика",
     "complexity": "—", "pages": [("s2/comb.html", "Число сочетаний")]},
    {"id": "hanoi", "name": "Ханойские башни", "category": "Рекурсия и перебор", "complexity": "O(2ⁿ)",
     "pages": [("s3/recursion.html", "Ханойские башни")]},
    {"id": "backtracking", "name": "Перебор с возвратом (backtracking)", "category": "Рекурсия и перебор",
     "complexity": "зависит от задачи", "pages": [("s2/backtracking.html", "Перебор с возвратом")]},
    {"id": "monte-carlo", "name": "Метод Монте-Карло", "category": "Рандомизированные алгоритмы", "complexity": "—",
     "pages": [("s2/monte_carlo.html", "метод Монте-Карло")]},
    {"id": "graham", "name": "Выпуклая оболочка: алгоритм Грэхема", "category": "Геометрия", "complexity": "O(n log n)",
     "pages": [("s6/geom.html", "Алгоритм Грэхема")]},
    {"id": "jarvis", "name": "Выпуклая оболочка: алгоритм Джарвиса", "category": "Геометрия", "complexity": "O(n·h)",
     "pages": [("s6/geom.html", "Алгоритм Джарвиса")]},
    {"id": "point-in-polygon", "name": "Принадлежность точки многоугольнику", "category": "Геометрия",
     "complexity": "O(n)", "pages": [("s6/geom.html", "Принадлежность точки")]},
]

CATEGORY_ORDER = ["Сортировки", "Поиск", "Структуры данных", "Графы", "Строки", "Динамическое программирование",
                  "Числа", "Комбинаторика", "Рекурсия и перебор", "Геометрия", "Рандомизированные алгоритмы"]

# Animations of js/viz.js: the placeholder goes right before the first heading matching the pattern.
# A page that already has the placeholder is left alone.
VIZ = [
    ("s1/sort.html", "Сортировка подсчётом", "sort"),
    ("s1/binsearch.html", "Реализация на Delphi", "binsearch"),
    ("s1/graph_alg_py.html", "Обход вершин графа", "graph"),
    ("s1/graph_alg.html", "Обход вершин графа", "graph"),
    ("s1/long_ar.html", "Оценка времени и точности", "fft"),
]


def normalize(fragment):
    """Heading text as a reader sees it: no tags, no entities, single spaces."""
    return " ".join(html.unescape(TAGS.sub("", fragment)).split())


def strip_tex(text):
    """Plain text for the catalogue: the formulas of a heading are dropped, the words stay."""
    return " ".join(re.sub(r"\$[^$]*\$", "", text).split())


def find_heading(text, pattern):
    """The first heading matching the pattern. A section (h2, h3) wins over the page title (h1)."""
    matching = []
    for match in HEADING.finditer(text):
        title = normalize(match.group(3))
        if re.search(pattern, title):
            matching.append((match, title))
    sections = [found for found in matching if found[0].group(1).lower() != "h1"]
    chosen = (sections or matching)
    if not chosen:
        raise SystemExit(f"heading not found: {pattern!r}")
    return chosen[0]


def slug(title, used):
    base = re.sub(r"[^\w]+", "-", title.lower()).strip("-")[:60].rstrip("-") or "section"
    candidate, number = base, 2
    while candidate in used:
        candidate, number = f"{base}-{number}", number + 1
    used.add(candidate)
    return candidate


def add_viz_slots(text, slots):
    for pattern, name in slots:
        if f'data-viz="{name}"' in text:
            continue
        match, _ = find_heading(text, pattern)
        text = text[:match.start()] + f'<div class="viz" data-viz="{name}"></div>\n' + text[match.start():]
    return text


def add_anchor(text, pattern):
    """Make sure the heading matching the pattern has an id. Return the new text, the id and the heading text."""
    match, title = find_heading(text, pattern)
    attributes = match.group(2) or ""
    existing = ID_ATTR.search(attributes)
    if existing:
        return text, existing.group(1), title
    used = set(ID_ATTR.findall(text))
    anchor = slug(title, used)
    opening = text[match.start():match.start(3)]
    new_opening = f'<{match.group(1)}{attributes} id="{anchor}">'
    return text[:match.start()] + new_opening + text[match.start() + len(opening):], anchor, title


def plan_pages(session):
    """Lessons of one session in the order of its plan table, without duplicates."""
    index = ROOT / session / "index.html"
    plan = re.search(r'<table id="plan".*?</table>', index.read_text(encoding="utf-8"), re.S)
    pages = []
    for href in re.findall(r'href="([^"#]+)"', plan.group(0) if plan else ""):
        target = posixpath.normpath(posixpath.join(session, href))
        if target.endswith((".html", ".htm")) and (ROOT / target).exists() and target not in pages:
            pages.append(target)
    return pages


def page_title(rel):
    text = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
    for match in HEADING.finditer(text):
        if match.group(1).lower() == "h1":
            return normalize(match.group(3))
    title = re.search(r"<title>(.*?)</title>", text, re.S | re.I)
    return normalize(title.group(1)) if title else rel


def build_navigation():
    navigation = {"sessions": {}, "pages": {}, "algorithms": [], "byPage": {}}
    for session in SESSIONS:
        pages = plan_pages(session)
        if not pages:
            continue
        navigation["sessions"][session] = {"title": page_title(f"{session}/index.html"), "pages": pages}
        for position, page in enumerate(pages):
            navigation["pages"].setdefault(page, {
                "session": session, "index": position, "title": page_title(page),
                "prev": pages[position - 1] if position else None,
                "next": pages[position + 1] if position + 1 < len(pages) else None,
            })
    return navigation


def process_pages(algorithms):
    """Add placeholders and heading ids. Return (anchor, heading text) for every (algorithm id, page) pair."""
    slots, wanted = {}, {}
    for rel, pattern, name in VIZ:
        slots.setdefault(rel, []).append((pattern, name))
    for algorithm in algorithms:
        for rel, pattern in algorithm["pages"]:
            wanted.setdefault(rel, []).append((algorithm["id"], pattern))
    sections = {}
    for rel in sorted(set(slots) | set(wanted)):
        path = ROOT / rel
        text = add_viz_slots(path.read_text(encoding="utf-8"), slots.get(rel, []))
        for algorithm_id, pattern in wanted.get(rel, []):
            text, anchor, title = add_anchor(text, pattern)
            sections[(algorithm_id, rel)] = (anchor, title)
        path.write_text(text, encoding="utf-8")
    return sections


def page(title, body):
    """A complete page with the site's stylesheets and script. body is a list of HTML lines."""
    return "\n".join([
        "<!DOCTYPE html>", '<html lang="ru">', "<head>",
        '    <meta charset="utf-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1">',
        f"    <title>{html.escape(title)}</title>",
        '    <link rel="stylesheet" type="text/css" href="style/style.css">',
        '    <link rel="stylesheet" type="text/css" href="style/site.css">',
        '    <script src="js/site.js" defer></script>',
        "</head>", "<body>", '<div id="content">', *body, "</div>", "</body>", "</html>", "",
    ])


def build_catalogue(navigation):
    unknown = {a["category"] for a in navigation["algorithms"]} - set(CATEGORY_ORDER)
    if unknown:
        raise SystemExit(f"categories missing from CATEGORY_ORDER: {sorted(unknown)}")
    body = ["<h1>Каталог алгоритмов</h1>",
            "<p>Все алгоритмы курса и разделы, где они разобраны. Ссылка открывает нужный раздел страницы. "
            "Файл создан скриптом common/build_navigation.py, не редактируйте его вручную.</p>"]
    for category in CATEGORY_ORDER:
        items = [a for a in navigation["algorithms"] if a["category"] == category]
        if not items:
            continue
        body.append(f"<h2>{html.escape(category)}</h2>")
        body.append('<ul class="catalog">')
        for algorithm in items:
            body.append(f'<li id="{algorithm["id"]}"><strong>{html.escape(algorithm["name"])}</strong> '
                        f'<span class="complexity">{html.escape(algorithm["complexity"])}</span>')
            places = "; ".join(f'<a href="{place["path"]}#{place["anchor"]}">{html.escape(place["section"])}</a>'
                               for place in algorithm["pages"])
            body.append(f"<br>Где разобран: {places}</li>")
        body.append("</ul>")
    (ROOT / "algorithms.html").write_text(page("Каталог алгоритмов", body), encoding="utf-8")


def build_start_page(navigation):
    body = ["<h1>Математические основы программирования</h1>",
            "<p>Курс по алгоритмам и структурам данных. Выберите сессию или откройте каталог алгоритмов, "
            "в котором указано, где каждый алгоритм разобран.</p>",
            "<h2>Сессии</h2>", '<ol class="sessions">']
    for session, info in navigation["sessions"].items():
        body.append(f'<li><a href="{session}/index.html">{html.escape(info["title"])}</a></li>')
    body += ["</ol>", "<h2>Справочники</h2>", "<ul>",
             '<li><a href="algorithms.html">Каталог алгоритмов</a></li>',
             '<li><a href="about/about.html">О курсе</a></li>', "</ul>"]
    (ROOT / "index.html").write_text(page("Математические основы программирования", body), encoding="utf-8")


def main():
    navigation = build_navigation()
    sections = process_pages(ALGORITHMS)
    for algorithm in ALGORITHMS:
        places = []
        for rel, _ in algorithm["pages"]:
            anchor, section = sections[(algorithm["id"], rel)]
            places.append({"path": rel, "anchor": anchor, "title": page_title(rel), "section": strip_tex(section)})
            navigation["byPage"].setdefault(rel, []).append(algorithm["id"])
        navigation["algorithms"].append({**{k: algorithm[k] for k in ("id", "name", "category", "complexity")},
                                         "pages": places})
    (ROOT / "navigation.json").write_text(json.dumps(navigation, ensure_ascii=False, indent=1), encoding="utf-8")
    build_catalogue(navigation)
    build_start_page(navigation)
    print(f"{len(navigation['algorithms'])} algorithms, {len(navigation['pages'])} lessons in sessions; "
          f"navigation.json, algorithms.html and index.html written")


if __name__ == "__main__":
    sys.exit(main())
