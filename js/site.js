// Progressive enhancements shared by every page: site search, copy buttons on code blocks,
// heading anchors, a table of contents for long lessons, navigation through the course and a back-to-top button.
// The pages stay readable without this script.
(function () {
  'use strict';

  const SITE_ROOT = new URL('../', document.currentScript.src);
  const SEARCH_INDEX_URL = new URL('search-index.json', SITE_ROOT);
  const content = document.querySelector('#content') || document.body;

  function normalize(text) {
    return text.toLowerCase().replace(/ё/g, 'е');
  }

  function slugify(text) {
    return normalize(text).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
  }

  function uniqueId(base, usedIds) {
    let id = base;
    for (let number = 2; usedIds.has(id); number += 1) id = `${base}-${number}`;
    usedIds.add(id);
    return id;
  }

  // Heading text without the anchor link that addHeadingAnchors() adds.
  function headingText(heading) {
    return [...heading.childNodes]
      .filter((node) => !(node.nodeType === Node.ELEMENT_NODE && node.classList.contains('anchor')))
      .map((node) => node.textContent)
      .join('')
      .trim();
  }

  // Code blocks are looked up on the whole page: some old pages close #content early.
  function addCopyButtons() {
    document.querySelectorAll('pre').forEach((pre) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block';
      pre.replaceWith(wrapper);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-code';
      button.textContent = 'Копировать';
      button.addEventListener('click', () => copyCode(pre.textContent, button));
      wrapper.append(pre, button);
    });
  }

  async function copyCode(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers and non-secure pages: copy through a temporary textarea.
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    button.textContent = 'Скопировано';
    setTimeout(() => {
      button.textContent = 'Копировать';
    }, 1500);
  }

  function addHeadingAnchors() {
    const usedIds = new Set([...document.querySelectorAll('[id]')].map((element) => element.id));
    content.querySelectorAll('h2, h3, h4').forEach((heading) => {
      if (!heading.id) heading.id = uniqueId(slugify(heading.textContent), usedIds);
      const anchor = document.createElement('a');
      anchor.className = 'anchor';
      anchor.href = `#${heading.id}`;
      anchor.setAttribute('aria-label', 'Ссылка на раздел');
      anchor.textContent = '#';
      heading.append(anchor);
    });
  }

  function addTableOfContents() {
    const headings = [...content.querySelectorAll('h2, h3')];
    if (headings.length < 3) return;

    const topList = document.createElement('ol');
    let currentTopItem = null;
    headings.forEach((heading) => {
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = headingText(heading);
      const item = document.createElement('li');
      item.append(link);

      // h3 entries nest under the preceding h2; without an h2 they stay at the top level.
      if (heading.tagName === 'H3' && currentTopItem) {
        let subList = currentTopItem.querySelector(':scope > ol');
        if (!subList) {
          subList = document.createElement('ol');
          currentTopItem.append(subList);
        }
        subList.append(item);
      } else {
        topList.append(item);
        if (heading.tagName === 'H2') currentTopItem = item;
      }
    });

    const nav = document.createElement('nav');
    nav.className = 'toc';
    nav.setAttribute('aria-label', 'Содержание страницы');
    nav.innerHTML = '<details open><summary>Содержание</summary></details>';
    nav.querySelector('details').append(topList);

    const h1 = content.querySelector('h1');
    if (h1) h1.after(nav);
    else content.prepend(nav);
  }

  // Navigation from navigation.json (made by common/build_navigation.py): the trail through the session, links
  // to the previous and the next lesson, and the algorithms that the page explains. Without the file: nothing.
  async function loadNavigation() {
    try {
      const response = await fetch(new URL('navigation.json', SITE_ROOT));
      return await response.json();
    } catch {
      return null;
    }
  }

  function linkTo(href, text) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = text;
    return link;
  }

  function addTrail(navigation, lesson) {
    const session = navigation.sessions[lesson.session];
    const trail = document.createElement('nav');
    trail.className = 'site-trail';
    trail.setAttribute('aria-label', 'Путь к странице');
    trail.append(
      linkTo(new URL('index.html', SITE_ROOT).href, 'Курс'), ' › ',
      linkTo(new URL(`${lesson.session}/index.html`, SITE_ROOT).href, session.title), ' › ',
      document.createTextNode(lesson.title),
    );
    content.prepend(trail);
  }

  function addPager(navigation, lesson) {
    const pager = document.createElement('nav');
    pager.className = 'site-pager';
    pager.setAttribute('aria-label', 'Соседние уроки');
    const neighbours = [
      [lesson.prev, (title) => `← ${title}`, 'pager-prev'],
      [lesson.next, (title) => `${title} →`, 'pager-next'],
    ];
    for (const [path, label, className] of neighbours) {
      if (!path) continue;
      const link = linkTo(new URL(path, SITE_ROOT).href, label(navigation.pages[path].title));
      link.className = className;
      pager.append(link);
    }
    if (pager.children.length) content.append(pager);
  }

  function addPageAlgorithms(navigation, path) {
    const ids = navigation.byPage[path];
    if (!ids) return;
    const box = document.createElement('details');
    box.className = 'page-algorithms';
    box.open = true;
    box.innerHTML = '<summary>Алгоритмы на этой странице</summary>';
    const list = document.createElement('ul');
    for (const algorithm of navigation.algorithms.filter((item) => ids.includes(item.id))) {
      const place = algorithm.pages.find((item) => item.path === path);
      const item = document.createElement('li');
      const complexity = document.createElement('span');
      complexity.className = 'complexity';
      complexity.textContent = algorithm.complexity;
      item.append(linkTo(`#${place.anchor}`, algorithm.name), ' ', complexity);
      list.append(item);
    }
    box.append(list, linkTo(new URL('algorithms.html', SITE_ROOT).href, 'Все алгоритмы курса'));
    const after = content.querySelector('.toc') || content.querySelector('h1');
    if (after) after.after(box);
    else content.prepend(box);
  }

  async function addNavigation() {
    const navigation = await loadNavigation();
    if (!navigation) return;
    const path = decodeURIComponent(location.pathname.slice(SITE_ROOT.pathname.length));
    const lesson = navigation.pages[path];
    if (lesson) {
      addTrail(navigation, lesson);
      addPager(navigation, lesson);
    }
    addPageAlgorithms(navigation, path);
  }

  function addBackToTop() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'to-top';
    button.textContent = '↑';
    button.setAttribute('aria-label', 'Наверх');
    button.hidden = true;
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
      button.hidden = window.scrollY < 600;
    }, { passive: true });
    document.body.append(button);
  }

  let indexRequest = null;
  function loadSearchIndex() {
    indexRequest ??= fetch(SEARCH_INDEX_URL)
      .then((response) => response.json())
      .catch(() => []);
    return indexRequest;
  }

  // Every word of the query must appear in the title, a heading or a tag; title and tag matches rank higher.
  function searchEntries(entries, query) {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return entries
      .map((entry) => {
        const title = normalize(entry.title);
        const tags = (entry.tags || []).map(normalize);
        const headings = (entry.headings || []).map(normalize);
        const everything = [title, ...tags, ...headings].join(' ');
        if (!words.every((word) => everything.includes(word))) return null;
        const score = words.reduce((sum, word) => sum + (title.includes(word) ? 3 : 0) + (tags.some((tag) => tag.includes(word)) ? 2 : 0), 0);
        return { entry, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'ru'))
      .slice(0, 15)
      .map((match) => match.entry);
  }

  function addSearch() {
    const form = document.createElement('form');
    form.className = 'site-search';
    form.setAttribute('role', 'search');
    form.innerHTML = '<input type="search" placeholder="Поиск по сайту ( / )" aria-label="Поиск по сайту" autocomplete="off">' +
      '<ul class="site-search-results" hidden></ul>';
    document.body.append(form);

    const input = form.querySelector('input');
    const results = form.querySelector('.site-search-results');

    function showResults(entries) {
      const query = input.value.trim();
      const matches = query ? searchEntries(entries, query) : [];
      results.replaceChildren(...matches.map((entry) => {
        const link = document.createElement('a');
        link.href = new URL(entry.url, SITE_ROOT).href;
        link.textContent = entry.title;
        const item = document.createElement('li');
        item.append(link);
        return item;
      }));
      if (query && !matches.length) {
        const empty = document.createElement('li');
        empty.textContent = 'Ничего не найдено';
        results.append(empty);
      }
      results.hidden = !query;
    }

    input.addEventListener('focus', () => loadSearchIndex());
    input.addEventListener('input', () => loadSearchIndex().then(showResults));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        input.value = '';
        showResults([]);
        input.blur();
      }
    });
    form.addEventListener('submit', (event) => event.preventDefault());

    document.addEventListener('keydown', (event) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        input.focus();
      }
    });
  }

  // A tag on a lesson links to its section of the tag index, tags.html, with the tag in the query string.
  function linkTags() {
    document.querySelectorAll('ul.tags a').forEach((link) => {
      const url = new URL('tags.html', SITE_ROOT);
      url.searchParams.set('tag', link.textContent.trim());
      link.href = url.href;
    });
  }

  // On the tag index, the section named in the query string is marked and scrolled into view.
  function highlightTag() {
    const tag = new URLSearchParams(location.search).get('tag');
    const section = [...document.querySelectorAll('section[data-tag]')].find((element) => element.dataset.tag === tag);
    if (!section) return;
    section.classList.add('tag-selected');
    section.scrollIntoView();
  }

  addCopyButtons();
  addHeadingAnchors();
  addTableOfContents();
  // Rust examples are written as <pre><code class="language-rust">. SHJS has no Rust, so highlight.js is
  // loaded only on pages that contain such a block.
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function highlightRust() {
    const blocks = document.querySelectorAll('code.language-rust');
    if (!blocks.length) return;
    const base = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/';
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `${base}styles/github.min.css`;
    document.head.append(style);
    loadScript(`${base}highlight.min.js`)
      .then(() => loadScript(`${base}languages/rust.min.js`))
      .then(() => blocks.forEach((block) => window.hljs.highlightElement(block)))
      .catch(() => {});
  }

  addBackToTop();
  addNavigation();
  addSearch();
  linkTags();
  highlightTag();
  highlightRust();
})();
