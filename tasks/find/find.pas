{$APPTYPE CONSOLE}

uses SysUtils;

procedure swap(var a, b: int64);
var t: int64;
begin
  t := a; a := b; b := t;
end;

var
  n, i, j, m, k, ans, l, r: integer;
  a: array [1..1000000] of int64;

procedure qsort(l, r: integer);
var
  i, j: integer;
  m: int64;
begin
  i := l;
  j := r;
  m := a[random(r - l + 1) + l];
  while i <= j do begin
    while a[i] < m do inc(i);
    while a[j] > m do dec(j);
    if i <= j then begin
      swap(a[i], a[j]);
      inc(i);
      dec(j);
    end;
  end;
  if i < r then qsort(i, r);
  if l < j then qsort(l, j);
end;

begin
  assign(input, 'find.in'); reset(input);
  assign(output, 'find.out'); rewrite(output);

  read(n, l);
  for i := 1 to n do
    read(a[i]);

  qsort(1, n);

  for j := 1 to l do begin
    read(k);
    l := 1;
    r := n + 1;
    While r - l > 1 do begin
      m := (r + l) div 2;
      if k >= a[m] then l := m else r := m;
    end;
    if k = a[l] then writeln('YES') else writeln('NO');
  end;
end.
