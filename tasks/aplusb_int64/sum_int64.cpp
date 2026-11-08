#include <stdio.h>
#include <iostream>

using namespace std;

int main(){
  freopen("sum.in", "r", stdin); // Ввод из файла вместо клавиатуры
  freopen("sum.out", "w", stdout); // Вывод в файл вместо экрана
  long long a,b; // 64-битное целое со знаком
  cin >> a >> b;
  cout << (a+b);
  return 0; // Выход с кодом 0
}
