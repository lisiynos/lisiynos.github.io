{$APPTYPE CONSOLE}

uses SysUtils;

var 
  x, b : longint;
  s : string; { ��������� �������������� }
begin
  Write('������� �����: '); Readln(x);
  Write('������� ��������� ������� ���������: '); Readln(b);  
  s := '';
  while x > 0 do begin
    s := IntToStr(x mod b) + s; { ����������� ��������� ����� � ����� }
    x := x div b; { ����� �� ��������� ������� ��������� }
  end;
  if s = '' then s := '0';
  writeln('���������: ',s);
end.