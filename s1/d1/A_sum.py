﻿# ~*~ utf-8 ~*~
# Решение задачи "A+B" с вводом из файла **sum.in**
# и выводом в файл **sum.out**
import sys
sys.stdin = open("sum.in") # Закомментируйте эту строку для ввода с клавиатуры
sys.stdout = open("sum.out", "w") # Закомментрируйте эту строку для вывода на экран
A, B = int(input()), int(input()) # Вводим 2 целых A и B (они в разных строках)
print (A + B)