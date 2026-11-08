var A : array [1..1000000] of Integer; { Сортируемый массив }  

procedure QuickSort( left,right : Integer );
var i,j : Integer; m,temp: Integer;
begin
  i := left;
  j := right;
  m := A[(left + right) div 2]; { Медиана }
  m := A[random(right-left+1) + left]; { Рандомизированный вариант QuickSort }
  { При выборе разделяющего элемента случайным образом практически невозможно попасть на худший случай }
  repeat
    while A[i] < m do inc(i);
    while m < A[j] do dec(j);
    if i<=j then begin 
      { Меняем A[i] и A[j] местами }
      temp := A[i]; 
      A[i] := A[j];
      A[j] := temp;
      inc(i); dec(j);
    end;
  until i>j;
  if left < j then QuickSort(left,j); { Сортировка левого куска }
  if i < right then QuickSort(i,right); { Сортировка правого куска }
end;

var
  N : Integer; { Количество элементов в массиве }
  i : Integer; { Переменная цикла }
begin
  { Ввод исходного массива из файла }
  Assign(Input, 'bubble.in'); Reset(Input);
  Read(N); { Читаем количество элементов в массиве }
  for i:=1 to N do Read(A[i]); { Читаем сам массив }
  { Сортировка элементов с 1 по N }
  QuickSort(1, N);
  { Вывод отсортированного массива в файл }
  Assign(Output, 'bubble.out'); Rewrite(Output);
  for i:=1 to N-1 do Write(A[i],' ');
  Writeln(A[N]);
end.
