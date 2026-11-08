{$APPTYPE CONSOLE} 

var
  N : Integer; { Количество элементов в массиве }
  A : array [1..5000] of Integer; { Сортируемый массив }
  i : Integer; { Переменная цикла }
  temp : Integer; { Переменная для обмена местами двух элементов в массиве }
  Changes : Boolean; { Есть ли изменения? }
begin
  { Ввод исходного массива из файла }
  Assign(Input, 'bubble.in'); Reset(Input);
  Read(N); { Читаем количество элементов в массиве } 
  for i:=1 to N do Read(A[i]); { Читаем сам массив }
  { Сортировка }
  repeat
    Changes := false; { Пока изменений нет :) }
    for i:=1 to N-1 do { Пробегаем по массиву сравнивая соседние элементы }
      if A[i]>A[i+1] then begin { Если больший элемент слева, а должен быть справа }
        temp := A[i]; { Меняем элементы местами при помощи временной переменной temp }
        A[i] := A[i+1];
        A[i+1] := temp;
        Changes := true; { Изменения произошли! }
      end;
  until not Changes; { Заканчиваем когда нет изменений (значит, все элементы уже по-порядку) }
  { Вывод отсортированного массива в файл }
  Assign(Output, 'bubble.out'); Rewrite(Output);
  for i:=1 to N-1 do Write(A[i],' ');
  Writeln(A[N])
end.
