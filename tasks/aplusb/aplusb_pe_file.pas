{$APPTYPE CONSOLE}
var A,B : Int64;
begin
  Assign(Input,'aplusb.in'); Reset(Input);
  Assign(Output,'YA_NE_POMNU.out'); Rewrite(Output);
  Read(A,B);
  Write(A+B);  
end.
