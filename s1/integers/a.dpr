{$APPTYPE CONSOLE}
var 
  N : int64;
  i : longint;
begin
  Assign(Input,'factor.in'); Reset(Input);
  Assign(Output,'factor.out'); Rewrite(Output);
  Read(N);
  Write(N,' =');
  for i:=2 to trunc(sqrt(N)) do { ���������� ��� ����� �� ����� �� N }
    while N mod i = 0 do begin { ���� N ������� �� i }
      write(' ',i); { ������� ��������� i }
      N := N div i; { ����� �� i }
      if N <> 1 then write(' *'); { ���� ��� ����� ���������, �� ������� ���� ��������� }
    end;
  if N<>1 then write(' ',N); { ���������� ��������� }
end.