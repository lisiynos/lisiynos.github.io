import sys
sys.stdin = open('floyd.in')
sys.stdout = open('floyd.out', 'w')

# Считываем входные данные
n = int(input()) # n - количество вершин
a = []
for i in range(n): # пробегаем n строк
   a.append([int(x) for x in input().split()])

for i in range(n):
   for j in range(n):
      if a[i][j] == -1:
         a[i][j] = float('inf')

for k in range(n): 
   for i in range(n):
      for j in range(n):
         if a[i][k] + a[k][j] < a[i][j]:
            a[i][j] = a[i][k] + a[k][j]
            
max = 0
for i in range(n):
   for j in range(n):
      if a[i][j] != float('inf') and a[i][j] > max: # недостижимые пары (inf) не учитываем
         max = a[i][j]
print(max)
