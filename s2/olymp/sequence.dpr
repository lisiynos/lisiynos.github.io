{$APPTYPE CONSOLE}
var 
  i,k,period : integer;
  a,b,c,d,x : int64;
  v : array [0..999999] of integer; { �� ����� ������� ���� ��� ��������, -1 - ��� �� ���� }
begin
  Assign(Input,'sequence.in'); Reset(Input);
  Assign(Output,'sequence.out'); ReWrite(Output);
  { ������ ������� ������ }
  read(a, b, c, d, k);
  { ������� }
  for i:=low(v) to high(v) do v[i] := -1; { �� ������ �������� �� ���� }
  x := a; v[x] := 0;
  i := 1;
  while i<=k do begin
    x := (((b*x) mod c)+x+d) mod 1000000;
    if v[x]<>-1 then begin { ����� ������� ��� ��� => �� ����� ������ ������������������ }
      period := i-v[x];
      k := i + (k-i) mod period;
    end;
    v[x] := i;
    inc(i);    
  end;
  { ����� ������ }
  writeln(x);
end.