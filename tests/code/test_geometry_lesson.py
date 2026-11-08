"""Check the actual Python programs published in the geometry lesson.

Run with: python3 -m unittest discover -s tests/code -p test_geometry_lesson.py -v
The independent references use fractions, winding number and Jarvis's march.
"""

from fractions import Fraction
from html.parser import HTMLParser
from pathlib import Path
import random
import unittest


LESSON = Path(__file__).resolve().parents[2] / "s4" / "geom.html"
L_POLYGON = [(0, 0), (5, 0), (5, 2), (2, 2), (2, 5), (0, 5)]
RECTANGLE = [(0, 0), (4, 0), (4, 3), (0, 3)]


class PythonBlocks(HTMLParser):
    """Read Python pre elements just as the browser decodes their text."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.parts = None

    def handle_starttag(self, tag, attrs):
        if tag == "pre" and "sh_python" in dict(attrs).get("class", "").split():
            self.parts = []

    def handle_data(self, data):
        if self.parts is not None:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "pre" and self.parts is not None:
            self.blocks.append("".join(self.parts))
            self.parts = None


def lesson_namespaces():
    parser = PythonBlocks()
    parser.feed(LESSON.read_text(encoding="utf-8"))
    namespaces = []
    for number, source in enumerate(parser.blocks, start=1):
        namespace = {"__name__": "geometry_lesson_test"}
        exec(compile(source, f"{LESSON}:python-block-{number}", "exec"), namespace)
        namespaces.append(namespace)
    return namespaces


def determinant(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def reference_on_segment(a, b, point):
    if determinant(a, b, point) != 0:
        return False
    return all(min(a[axis], b[axis]) <= point[axis] <= max(a[axis], b[axis])
               for axis in (0, 1))


def rational_segments_intersect(a, b, c, d):
    """Solve a + t*(b-a) = c + u*(d-c) with exact rational parameters."""
    first = (b[0] - a[0], b[1] - a[1])
    second = (d[0] - c[0], d[1] - c[1])
    offset = (c[0] - a[0], c[1] - a[1])
    denominator = first[0] * second[1] - first[1] * second[0]
    if denominator == 0:
        return any((reference_on_segment(a, b, c), reference_on_segment(a, b, d),
                    reference_on_segment(c, d, a), reference_on_segment(c, d, b)))
    first_parameter = Fraction(offset[0] * second[1] - offset[1] * second[0], denominator)
    second_parameter = Fraction(offset[0] * first[1] - offset[1] * first[0], denominator)
    return 0 <= first_parameter <= 1 and 0 <= second_parameter <= 1


def winding_location(polygon, point):
    winding = 0
    for index, a in enumerate(polygon):
        b = polygon[(index + 1) % len(polygon)]
        if reference_on_segment(a, b, point):
            return "BOUNDARY"
        turn = determinant(a, b, point)
        if a[1] <= point[1] < b[1] and turn > 0:
            winding += 1
        if b[1] <= point[1] < a[1] and turn < 0:
            winding -= 1
    return "INSIDE" if winding else "OUTSIDE"


def squared_distance(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2


def jarvis_hull(points):
    """Choose one supporting edge per step, keeping the farthest collinear point."""
    points = sorted(set(points))
    if len(points) <= 1:
        return points
    hull = []
    current = points[0]
    while True:
        hull.append(current)
        candidate = next(point for point in points if point != current)
        for point in points:
            turn = determinant(current, candidate, point)
            farther = squared_distance(current, point) > squared_distance(current, candidate)
            if turn < 0 or (turn == 0 and farther):
                candidate = point
        current = candidate
        if current == points[0]:
            return hull


class GeometryLessonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.namespaces = lesson_namespaces()

    def lesson_function(self, name):
        functions = [namespace[name] for namespace in self.namespaces if callable(namespace.get(name))]
        self.assertTrue(functions, f"The lesson must define {name} in a Python block")
        return functions[0]

    def test_required_functions_exist(self):
        for name in ("orientation", "polygon_double_area", "segments_intersect",
                     "point_location", "convex_hull"):
            with self.subTest(name=name):
                self.lesson_function(name)

    def test_orientation_sign_degeneracies_and_large_coordinates(self):
        orientation = self.lesson_function("orientation")
        cases = [
            ((0, 0), (4, 0), (1, 3), 1),
            ((0, 0), (4, 0), (1, -3), -1),
            ((0, 0), (4, 0), (8, 0), 0),
            ((2, 2), (2, 2), (-3, 9), 0),
            ((-10**9, -10**9), (10**9, -10**9), (-10**9, 10**9), 1),
        ]
        for a, b, c, expected in cases:
            with self.subTest(points=(a, b, c)):
                self.assertEqual(orientation(a, b, c), expected)
                self.assertEqual(orientation(a, c, b), -expected)

    def test_polygon_double_area(self):
        area = self.lesson_function("polygon_double_area")
        cases = [([], 0), ([(1, 2)], 0), ([(1, 2), (4, 9)], 0),
                 (RECTANGLE, 24), ([(0, 0), (1, 0), (0, 1)], 1),
                 (L_POLYGON, 32), ([(0, 0), (1, 1), (2, 2)], 0)]
        for polygon, expected in cases:
            with self.subTest(polygon=polygon):
                self.assertEqual(area(polygon), expected)
                self.assertEqual(area(polygon[::-1]), expected)

    def test_segment_intersection_degenerate_and_boundary_cases(self):
        intersects = self.lesson_function("segments_intersect")
        cases = [
            (((0, 0), (4, 4), (0, 4), (4, 0)), True),
            (((0, 0), (4, 0), (4, 0), (4, 5)), True),
            (((0, 0), (4, 0), (2, 0), (6, 0)), True),
            (((0, 0), (1, 0), (2, 0), (3, 0)), False),
            (((0, 0), (4, 0), (0, 1), (4, 1)), False),
            (((1, 1), (1, 1), (0, 0), (2, 2)), True),
            (((1, 2), (1, 2), (0, 0), (2, 2)), False),
            (((1, 1), (1, 1), (1, 1), (1, 1)), True),
            (((1, 1), (1, 1), (2, 2), (2, 2)), False),
            (((-10**9, -10**9), (10**9, 10**9),
              (-10**9, 10**9), (10**9, -10**9)), True),
        ]
        for (a, b, c, d), expected in cases:
            with self.subTest(segments=(a, b, c, d)):
                self.assertEqual(intersects(a, b, c, d), expected)
                self.assertEqual(intersects(d, c, b, a), expected)

    def test_segment_intersection_against_rational_reference(self):
        intersects = self.lesson_function("segments_intersect")
        randomizer = random.Random(1949)
        for _ in range(1500):
            points = [(randomizer.randrange(-5, 6), randomizer.randrange(-5, 6))
                      for _ in range(4)]
            with self.subTest(points=points):
                self.assertEqual(intersects(*points), rational_segments_intersect(*points))

    def test_point_location_concave_boundary_and_order(self):
        location = self.lesson_function("point_location")
        cases = [((1, 3), "INSIDE"), ((3, 3), "OUTSIDE"), ((2, 3), "BOUNDARY"),
                 ((2, 2), "BOUNDARY"), ((0, 0), "BOUNDARY"), ((5, 1), "BOUNDARY"),
                 ((1, 2), "INSIDE"), ((3, 2), "BOUNDARY"), ((6, 2), "OUTSIDE"),
                 ((-1, 0), "OUTSIDE"), ((1, 5), "BOUNDARY")]
        for polygon in (L_POLYGON, L_POLYGON[::-1], L_POLYGON + [L_POLYGON[0]]):
            for point, expected in cases:
                with self.subTest(polygon=polygon, point=point):
                    self.assertEqual(location(polygon, point), expected)

    def test_point_location_degenerate_contours(self):
        location = self.lesson_function("point_location")
        cases = [([], (0, 0), "OUTSIDE"), ([(1, 2)], (1, 2), "BOUNDARY"),
                 ([(1, 2)], (1, 3), "OUTSIDE"), ([(0, 0), (4, 0)], (2, 0), "BOUNDARY"),
                 ([(0, 0), (4, 0)], (5, 0), "OUTSIDE"),
                 ([(0, 0), (4, 0)], (2, 1), "OUTSIDE"),
                 ([(0, 0), (1, 1), (3, 3), (2, 2)], (2, 2), "BOUNDARY"),
                 ([(0, 0), (1, 1), (3, 3)], (4, 4), "OUTSIDE"),
                 ([(0, 0), (0, 0), (0, 0)], (0, 0), "BOUNDARY")]
        for polygon, point, expected in cases:
            with self.subTest(polygon=polygon, point=point):
                self.assertEqual(location(polygon, point), expected)

    def test_point_location_against_winding_reference(self):
        location = self.lesson_function("point_location")
        randomizer = random.Random(1776)
        polygons = []
        for _ in range(70):
            cloud = [(randomizer.randrange(-10, 11), randomizer.randrange(-10, 11))
                     for _ in range(12)]
            offset = (randomizer.randrange(-5, 6), randomizer.randrange(-5, 6))
            concave = [(x + offset[0], y + offset[1]) for x, y in L_POLYGON]
            polygons.extend((jarvis_hull(cloud), concave))
        for polygon in polygons:
            for _ in range(20):
                point = (randomizer.randrange(-12, 13), randomizer.randrange(-12, 13))
                expected = winding_location(polygon, point)
                with self.subTest(polygon=polygon, point=point):
                    self.assertEqual(location(polygon, point), expected)
                    self.assertEqual(location(polygon[::-1], point), expected)

    def test_point_location_large_coordinates(self):
        location = self.lesson_function("point_location")
        polygon = [(-10**9, -10**9), (10**9, -10**9), (10**9, 10**9), (-10**9, 10**9)]
        for point, expected in [((0, 0), "INSIDE"), ((10**9, 0), "BOUNDARY"),
                                ((-10**9, -10**9), "BOUNDARY")]:
            with self.subTest(point=point):
                self.assertEqual(location(polygon, point), expected)

    def test_convex_hull_contract_and_degenerate_inputs(self):
        hull = self.lesson_function("convex_hull")
        cases = [([], []), ([(1, 2), (1, 2)], [(1, 2)]),
                 ([(3, 4), (1, 2), (3, 4)], [(1, 2), (3, 4)]),
                 ([(2, 2), (0, 0), (1, 1), (3, 3), (1, 1)], [(0, 0), (3, 3)]),
                 ([(0, 3), (0, 1), (0, -1), (0, 3)], [(0, -1), (0, 3)]),
                 (RECTANGLE + [(2, 1), (2, 2), (1, 0), (0, 0)], RECTANGLE)]
        for points, expected in cases:
            original = list(points)
            with self.subTest(points=points):
                self.assertEqual(hull(points), expected)
                self.assertEqual(hull(points[::-1]), expected)
                self.assertEqual(points, original, "The example must not reorder its input")

    def test_convex_hull_against_jarvis_reference(self):
        hull = self.lesson_function("convex_hull")
        randomizer = random.Random(1984)
        for _ in range(500):
            points = [(randomizer.randrange(-5, 6), randomizer.randrange(-5, 6))
                      for _ in range(randomizer.randrange(25))]
            expected = jarvis_hull(points)
            with self.subTest(points=points):
                self.assertEqual(hull(points), expected)

    def test_convex_hull_large_coordinates(self):
        hull = self.lesson_function("convex_hull")
        corners = [(-10**9, -10**9), (10**9, -10**9), (10**9, 10**9), (-10**9, 10**9)]
        self.assertEqual(hull(corners[::-1] + [(0, 0), (10**9, 0)]), corners)


if __name__ == "__main__":
    unittest.main()
