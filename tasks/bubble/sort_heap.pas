{$APPTYPE CONSOLE}

uses SysUtils;

var
  N : integer; { Размер кучи }
  A : array [1..1000000] of int64;
  size : Integer;

{ Обмен местами элементов с индексами i и j }
procedure Swap( i,j : integer );
var T : int64;
begin
  T := A[i];
  A[i] := A[j];
  A[j] := T;
end;

procedure Heapify( i:integer );
var r,l : integer;
begin
  l := i*2; { Левый потомок }
  r := i*2+1; { Правый потомок }
  if l <= N then
    if A[l] > A[i] then begin
      Swap(l,i);
      Heapify(l);
    end;
  if r <= N then
    if A[r] > A[i] then begin
      Swap(r,i);
      Heapify(r);
    end;
end;

{ Построение кучи }
procedure BuildHeap;
var i: integer;
begin
  for i := N downto 1 do
    Heapify(i);
end;

{ Сортировка кучей }
procedure HeapSort;
begin
  BuildHeap;
  size := N;
  while N > 1 do begin
    Swap(N,1);  { Меняем местами максимальный элемент и элемент в конце кучи }
    Dec(N);     { Уменьшаем кучу }
    Heapify(1); { Восстанавливаем основное свойство кучи }
  end;
end;

var i : integer;
begin
  Assign(Input, 'heapsort.in'); Reset(Input);
  Assign(Output, 'heapsort.out'); Rewrite(Output);
  { Чтение исходных данных }
  Read(N);
  for i := 1 to N do
    Read(A[i]);
  { Вызов сортировки }
  HeapSort;
  { Запись отсортированного массива }
  for i := 1 to size do
    Write(A[i],' ');
end.
