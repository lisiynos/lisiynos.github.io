import math, re

with open('gcd.in') as fi: # Открываем входной файл для чтения
  a, b = [int(i) for i in re.match(r'(\d+)\s(\d+)', fi.read()).groups()]

with open('gcd.out', 'w') as fo: # Открываем выходной файл для записи
  fo.write(str(math.gcd(a,b)))
