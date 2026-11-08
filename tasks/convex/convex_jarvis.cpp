#include <cstdlib>
#include <iostream>
#include <vector>
#include <cmath>
#include <cstdio>
#include <assert.h>

using namespace std;

const int MaxN = 105;
const double eps = 1e-10;

struct Point {
    long long x, y;
    Point() {
        x = 0;
        y = 0;
    }
};


int used[MaxN];
vector <Point> ans;
Point a[MaxN];

long long dist(Point a, Point b) {
    return (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
}

long long vec(Point a, Point b, Point c) {
    return (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
}

long long scul(Point a, Point b, Point c) {
    return (b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y);
}

int main() {
    freopen("convex.in", "r", stdin);
    freopen("convex.out", "w", stdout);
    long long i = 0, j = 0, n = 0, x1 = 0, y1 = 0, v = 0, v1 = 0, d;
    double fi = 0, curfi = 0;
    Point p;

    for (i = 0; i < MaxN; i++) {
        used[i] = 0;
    }

    cin >> n;

    for (i = 1; i <= n; i++) {
        cin >> a[i].x >> a[i].y;
    }

    x1 = 100500;
    y1 = 100500;

    for (i = 1; i <= n; i++) {
        if (a[i].y < y1) {
            y1 = a[i].y;
            x1 = a[i].x;
            v = i;
        } else {
            if ((a[i].y == y1) && (a[i].x < x1)) {
                y1 = a[i].y;
                x1 = a[i].x;
                v = i;
            }
        }
    }

    //cout << v << endl;
    used[v] = 1;
    x1 = 100500;
    fi = 0;
    p.x = x1;
    p.y = y1;
    d = -1;

    for (i = 1; i <= n; i++) {
        if(used[i] == 0) {
            curfi = abs(atan2(vec(a[v], p, a[i]), scul(a[v], p, a[i])));

            if (curfi > fi) {
                fi = curfi;
                v1 = i;
                d = dist(a[v], a[i]);
            } else {
                if ((abs(curfi - fi) <= eps) && (dist(a[v], a[i]) > d)) {
                    fi = curfi;
                    v1 = i;
                    d = dist(a[v], a[i]);
                }
            }
        }
    }

    //used[v1] = 1;
    //cout << v1 << endl;
    ans.push_back(a[v1]);
    ans.push_back(a[v]);

    while(1) {//
        fi = -1;
        v = -1;
        d = -1;

        for (i = 1; i <= n; i++) {
            if (used[i] == 0) {
                int ind = ans.size() - 1;
                assert( ind >= 1 );
                curfi = abs(atan2(vec(ans[ind], ans[ind - 1], a[i]), scul(ans[ind], ans[ind - 1], a[i])));

                // cout << "curfi = " << curfi*180/M_PI << " fi = " << fi*180/M_PI << endl;
                //d = -1;
                if (curfi > fi + eps) {
                    fi = curfi;
                    v = i;
                    d = dist(ans[ind], a[i]);
                    // cout << " new min " << v << " dist = " << d << endl;
                } else {
                    if ((abs(fi - curfi) <= eps) && (d < dist(a[i], ans[ind]))) {
                        // cout << 11 << endl;
                        fi = curfi;
                        v = i;
                        d = dist(ans[ind], a[i]);
                        // cout << " old min " << v << " dist = " << d << endl;
                    }
                }
            }
        }

        // cout << "add(" << v << ") " << a[v].x << " " << a[v].y << endl;
        used[v] = 1;
        ans.push_back(a[v]);

        if ((ans[ans.size() - 1].x == ans[0].x) && (ans[ans.size() - 1].y == ans[0].y)) {
            break;
        }
    }

    cout << ans.size() - 1 << endl;

    for (i = ans.size() - 1; i > 0; i--) {
        cout << ans[i].x << ' ' << ans[i].y << endl;
    }
}
