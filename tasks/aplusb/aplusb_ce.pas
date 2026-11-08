{$APPTYPE CONSOLE}
var A,B : Int64;
begin
  ЯВНО НЕВЕРНАЯ СТРОКА!!!
  Assign(Input,'aplusb.in'); Reset(Input);
  Assign(Output,'aplusb.out'); Rewrite(Output);
  Read(A,B);
  Write(A+B);  
end.
