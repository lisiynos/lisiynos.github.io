#include <vector>
#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <algorithm>

struct point {
  int x, y;
  point () {}
  point (int a, int b): x(a), y(b) {}
  point operator - (point a) {
    return point(x - a.x, y - a.y);
  }
};

point p0, p1, p2;

// Ориентированная площадь 
int vp(point a, point b) {
  return a.x*b.y - a.y*b.x;
}

// Расстояние между точками
int dist(point p1, point p2) {
  return (p2-p1).x * (p2-p1).x + (p2-p1).y*(p2-p1).y;
}

// Сравнение точек для сортировки
bool l(point p1, point p2) {
	return vp(p1 - p0, p2 - p0) > 0 || (vp(p1 - p0, p2 - p0) == 0 && dist(p0, p2) < dist(p0, p1));
}

point p[200]; // Точки 

using namespace std;

int main() {
	freopen("convex.in", "r", stdin);
	freopen("convex.out", "w", stdout);
	int n, i, min_ind = 0;
	cin >> n; // Количество точек
	for (i=0; i<n; i++) // Координаты точек
		cin >> p[i].x >> p[i].y;
	// Ищем самую левую точку
	for (i=0; i<n; i++) {
		if(p[i].x < p[min_ind].x)
			min_ind = i;
		else
			if(p[i].x == p[min_ind].x) // А из "самых левых"
				if(p[i].y < p[min_ind].y) // Самую нижнюю
					min_ind = i;
	}
	p0 = p[min_ind];
	sort(p, p + n, l); // Сортируем точки по углу относительно p0
	vector <point> ob;
	for (i=0; i<n; i++) {
		while (ob.size() >= 2 && vp(ob[ob.size() - 1] - ob[ob.size() - 2], p[i] - ob[ob.size() - 1]) <= 0)
			ob.pop_back();
		ob.push_back(p[i]);
	}
	// Вывод выпуклой оболочки 
	cout << ob.size() << endl; // Количество точек
	for (int i = ob.size() - 1; i >= 0; --i) {
		printf("%d %d\n", ob[i].x, ob[i].y); // Координаты очередной точки
	}
	return 0;
}
