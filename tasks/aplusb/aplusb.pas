const FN = 'aplusb'; { Название входного и выходного файла }
var a,b : longint; { Входные данные }
begin
  assign(Input,FN+'.in'); reset(input);
  assign(Output,FN+'.out'); rewrite(output);
  read(a,b); { Читаем исходные данные из входного файла }
  writeln(a+b); { Записываем результат в выходной файл }
end.
