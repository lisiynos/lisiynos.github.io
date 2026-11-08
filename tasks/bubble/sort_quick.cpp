#include <stdio.h>
#include <iostream>

using namespace std;

// Сортируемый массив
int A[1000000];

// Случайное целое число в заданном диапазоне
int rand(int low, int high){
  return rand() % (high - low + 1) + low;
}

// Поменять местами 2 элемента массива i-ый и j-ый
void swap(int i, int j){
  int temp = A[i];
  A[i] = A[j];
  A[j] = temp;
}

// Быстрая сортировка от элемента left до элемента right
void qsort(int left, int right){
  // Массивы из 1-ого элемента сортировать незачем
  if(left >= right) return;
  int l = left, r = right; // Левая и правая границы
  // Выбираем разделяющий элемент - может быть любым, 
  // но выбор случайного элемента устойчив к худшим случаям
  int m = A[rand(left,right)]; 
  do {
    while(A[l] < m) l++; // Двигаем левую границу
    while(A[r] > m) r--; // Двигаем правую границу
    if(l <= r){ swap(l,r); l++; r--; } // Меняем элементы местами	
  } while (l <= r);	
  qsort(left,r); // Сортируем левую половину массива
  qsort(l,right); // Сортируем правую половину массива
}

int main(){
  freopen("qsort.in","r",stdin);
  freopen("qsort.out","w",stdout);
  // Ввод исходных данных 
  int N;
  cin >> N;
  for(int i=0;i<N;i++) cin >> A[i];
  // Сортировка
  qsort(0,N-1);
  // Вывод отсортированного массива
  for(int i=0;i<N;i++) cout << A[i] << " ";
  // Код возврата
  return 0;
}
