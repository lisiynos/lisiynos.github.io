{$APPTYPE CONSOLE}
var 
  i,k : integer;
  a,b,c,d,x : int64;
begin
  Assign(Input, 'sequence.in'); Reset(Input);
  Assign(Output, 'sequence.out'); ReWrite(Output);
  { ������ ������� ������ }
  read(a, b, c, d, k);
  { ������� }
  x := a;
  for i:=1 to k do
    x := (((b*x) mod c)+x+d) mod 1000000;
  { ����� ������ }
  writeln(x);
end.