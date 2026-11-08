#include <stdio.h>
#define s "aplusb"

int main() {
  freopen(s".in","r",stdin); // Стандартный поток ввода из входного файла
  freopen(s".out","w",stdout); // Стандартный поток вывода в выходной файл
  long long a,b;
  scanf("%lld%lld",&a,&b);
  printf("%lld",a+b);
  return 0;
}
