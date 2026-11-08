var
  a, b: longint;
begin
  assign(input, 'sum.in');
  reset(input);
  assign(output, 'sum.out');
  rewrite(output);
  readln(a);
  readln(b);
  writeln(a + b);
end.
