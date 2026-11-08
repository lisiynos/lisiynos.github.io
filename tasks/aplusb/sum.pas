var a, b : longint; { ещё лучше int64 }
begin
  assign(input,'sum.in'); reset(input);
  assign(output,'sum.out'); rewrite(output);
  read(a, b);
  writeln(a+b)
end.
