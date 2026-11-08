#include <stdio.h>
#include <assert.h>
#include <math.h>
#include <string.h>
#include <vector>
#include <algorithm>

#define MaxN 5000

using namespace std;

int a[MaxN + 3];
int n;

int main() {
  freopen("bubble.in", "rt", stdin); // Открываем входной файл
  freopen("bubble.out", "wt", stdout); // Открываем выходной файл
  // Чтение исходных данных
  scanf("%d", &n); // Чтение количества элементов 
  int i;
  for(i = 0; i < n; i++) scanf ("%d", &a[i]); 
  // Вызов процедуры сортировки
  sort(a, a + n);
  // Вывод отсортированного массива в файл
  for(i = 0; i < n - 1; i++)
    printf("%d ", a[i]);
  printf("%d\n", a[n - 1]);
  return 0;
}
