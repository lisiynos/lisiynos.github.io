import java.io.File;
import java.io.PrintWriter;
import java.util.Scanner;

public class Main {
  public static void main(String[] args) throws Exception {
    Scanner in = new Scanner(new File("sum.in")); // Открываем входной файл
    PrintWriter out = new PrintWriter(new File("sum.out")); // Открываем выходной файл
    int a = in.nextInt(), b = in.nextInt();
    out.println(a + b);
    in.close();
    out.close();
  }
}
