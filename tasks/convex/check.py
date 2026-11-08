"""Checker of the convex hull task, run as: python3 -I check.py input output answer

The output and the answer are k and then k vertices, two integers each. The output is OK when it lists
the vertices of the answer as the same cycle, from any starting vertex, in either direction; WA
otherwise; PE when it does not have the form k and then k pairs of integers.
"""
import sys

OK, WA, PE = 0, 1, 2


def read_points(path):
    """The pairs of integers after the leading count in the file, or None when the file is not of that form."""
    try:
        numbers = [int(token) for token in open(path, encoding="utf-8", errors="replace").read().split()]
    except ValueError:
        return None
    if not numbers or numbers[0] < 1 or len(numbers) != 1 + 2 * numbers[0]:
        return None
    return list(zip(numbers[1::2], numbers[2::2]))


def same_cycle(hull, answer):
    """Whether the hull lists the vertices of the answer in the same cyclic order, in either direction."""
    if len(hull) != len(answer):
        return False
    rotations = [hull[i:] + hull[:i] for i in range(len(hull))]
    return answer in rotations or answer[::-1] in rotations


def main():
    input_path, output_path, answer_path = sys.argv[1:4]
    points = read_points(input_path)
    answer = read_points(answer_path)
    hull = read_points(output_path)
    if hull is None:
        print("PE: expected k and then k pairs of integers")
        return PE
    if same_cycle(hull, answer):
        print("OK")
        return OK
    foreign = [point for point in hull if point not in points]
    if foreign:
        print(f"WA: {foreign[0][0]} {foreign[0][1]} is not a point of the input")
    elif sorted(hull) == sorted(answer):
        print("WA: the vertices are right but not in the order of a cycle")
    else:
        print(f"WA: {len(hull)} vertices, expected {len(answer)}")
    return WA


if __name__ == "__main__":
    sys.exit(main())
