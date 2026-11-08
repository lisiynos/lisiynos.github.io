import java.io.File;
import java.io.PrintWriter;
import java.math.BigInteger;
import java.util.Scanner;

public class Main {
  public static void main(String[] args) throws Exception {
    Scanner in = new Scanner(new File("sum.in")); // Открываем входной файл
    PrintWriter out = new PrintWriter(new File("sum.out")); // Открываем выходной файл
    BigInteger a = in.nextBigInteger(), b = in.nextBigInteger(); // Считываем входные данные    
    out.println(a.add(b)); // Вычисляем и выводим ответ
    in.close(); // Закрываем входной файл
    out.close(); // Закрываем выходной файл (ОБЯЗАТЕЛЬНО! Иначе на выходе может быть пустой файл)
  }
}
