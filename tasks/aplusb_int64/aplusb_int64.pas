{$APPTYPE CONSOLE}
const FN = 'aplusb'; { Название входного и выходного файла }
var a,b : Int64; { Входные данные }
begin
  assign(Input,FN+'.in'); reset(Input);
  assign(Output,FN+'.out'); rewrite(Output);
  read(a,b); { Читаем исходные данные из входного файла }
  writeln(a+b); { Записываем результат в выходной файл }
end.
