{$APPTYPE CONSOLE}

uses SysUtils;

var
  N,s : string; { �������� ������ }
  L,i,t : integer;
begin
  Assign(Input,'wordrot.in'); Reset(Input);
  Assign(Output,'wordrot.out'); Reset(Output);
  { ������ �������� ������ }
  readln(N); readln(s);
  { ��������� N mod L, L - ����� ������ s }
  L := length(s);
  t := 0; 
  for i:=1 to length(N) do 
    t := (t*10 + StrToInt(N[i])) mod L;
  { ������� ���������� ����� }
  for i:=L-t+1 to L do
    write (s[i]);
  for i:=1 to L-t do
    write (s[i]);
end.