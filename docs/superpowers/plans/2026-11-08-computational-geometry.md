# Computational geometry lecture implementation plan

> For agentic workers: execute the independent code, SVG and interactive tasks in parallel, then review their integration before committing only this task's files.

**Goal:** Expand `s4/geom.html` into a coherent Russian planar computational geometry lecture, preserving its address, title, tag and existing algorithm sections.

**Architecture:** Hand-written HTML, four standalone SVG figures, and one orientation mount in the existing static `js/viz.js`. Programs remain complete independent Python, C++17 and Rust examples. No new runtime dependency is required.

**Tech stack:** HTML, MathJax 4.1.3, existing SHJS/highlight.js, vanilla JavaScript/SVG, Playwright, Python standard library, g++ and rustc.

## 1. Lecture and existing examples

- Add points/vectors, squared distance, dot/cross products, point-on-segment, numeric bounds, worked examples, complexity table and exercises with answers.
- Preserve the headings `Ориентация тройки точек`, `Площадь простого многоугольника (формула шнурка)` and `Пересечение двух отрезков` and their complete programs.
- Clarify that the existing intersection helper checks a bounding box after collinearity has been established.
- Make the Python shoelace implementation use an index loop without list copies; call the 4-by-3 example a rectangle.
- Put language programs in native details elements while retaining their language heading paragraphs and code classes.

## 2. New complete programs and mathematical checks

- Prepare Python/C++/Rust `point_location(polygon, point)` returning `INSIDE`, `BOUNDARY` or `OUTSIDE`; test the boundary before ray crossings and use a half-open vertical interval.
- Prepare Python/C++/Rust `convex_hull(points)` using Andrew's monotone chain: unique sorted points, remove cross <= 0, output only extreme vertices CCW without a repeated first vertex.
- Use integer coordinates with absolute value at most 10^9 for predicates; the existing 64-bit shoelace examples separately require `2*n*M*M < 2^63`.
- Point-location demo polygon: `(0,0),(5,0),(5,2),(2,2),(2,5),(0,5)`; queries `(1,3)` inside, `(3,3)` outside, `(2,3)` boundary.
- Hull demo: rectangle corners `(0,0),(4,0),(4,3),(0,3)` plus `(2,1),(2,2),(1,0)` and duplicates; expected hull is the four corners.
- Add standard-library tests that extract the lecture's Python blocks; compare segment intersection with a rational reference, point location with winding number, and Andrew with Jarvis on seeded small random inputs.
- Run every complete C++ program with `g++ -std=c++17 -Wall -Wextra -Werror -O2`; run every Rust program with `rustc --edition 2021 -D warnings -O` through mise; verify demo output and cross-language random harnesses.

## 3. Exact SVG figures

- Create `s4/geom/polygon-area.svg`, `segment-intersections.svg`, `point-in-polygon.svg` and `convex-hull.svg`.
- Use the white/olive/blue/gold/green site palette, visible point labels, correct coordinates, accessible title/description and no external resources.
- The rectangle area is 12 (signed double area 24); the other figures use the demo data above and explicitly distinguish touching, overlap and boundary cases.

## 4. Interactive orientation

- Add `orientation` to `MOUNTS` in `js/viz.js`, reusing existing form and SVG styles.
- Fix O=(0,0), A=(4,0); let the reader change integer B coordinates in x=-1..6, y=-2..3 and choose left/right/on-segment/outside examples.
- Draw the real coordinate axes with SVG y inverted; show cross=4*B_y, orientation and full point-on-segment result.
- Add `tests/e2e/viz-geometry.spec.js` first, show the missing mount failure, then implement and verify left/right/zero, collinear-outside, bad input and mobile sizing.

## 5. Discoverability and verification

- Add catalogue records for orientation, point-on-segment, polygon area, segment intersection and Andrew; extend the existing point-in-polygon record.
- Regenerate with `python3 common/build_navigation.py`, `python3 common/build_tags.py`, `python3 common/search_index.py`; inspect generated diffs for unrelated concurrent changes.
- Run targeted page/policy/formula/navigation and new visualization tests; inspect desktop 1440px and mobile 390px screenshots, figure originals and contents links.
- Commit and push only this lecture's files on master; verify the GitHub Pages deployment and the live page.

## Validation record

- All 15 complete programs extracted from the final HTML passed the code-block checker; all five C++ and five Rust programs also compiled and ran with the strict flags above.
- The 12 standard-library geometry tests passed, including independent rational, winding-number and Jarvis references. Cross-language harnesses checked 8,007 point-location and 2,005 hull cases.
- Targeted page, formula and policy checks passed (3 tests); navigation and orientation checks passed (90 tests).
- Desktop (1440px) and phone (390px) browser checks confirmed four correctly sized SVGs, working original-image links and expandable programs/answers without horizontal page overflow. Screenshots were reviewed in two passes.
- Read-only specification and code reviews found no remaining blockers. The generated session-6 navigation adjustment matches the existing tracked session plan and corrects stale generated links.
