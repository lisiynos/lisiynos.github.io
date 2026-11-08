import java.io.*;
import java.util.*;

public class Pattern implements Runnable {

    BufferedReader br;      // экземпляр BufferedReader - хранит буфер
    StringTokenizer in;     // класс, обеспечивающий быструю и удобную работу со строками -
    // разбивание строки на кусочки по произвольным символам
    PrintWriter out;

    // Возвращает следующую подстроку, ограниченную пробелами(переводами строк, табуляциями)

    public String nextToken() throws IOException {
        //если in еще не существует или в нем нет больше токенов,
        //то in конструируется от следующей строки входного файла
        while (in == null || !in.hasMoreTokens()) {
            in = new StringTokenizer(br.readLine());
        }
        return in.nextToken();
    }

    //Возвращает следующее целое число из входного файла
    public int nextInt() throws IOException {
        return Integer.parseInt(nextToken());
    }

    //Возвращает следующее целое число из входного файла. Предполагается, что оно не помещается в int
    public long nextLong() throws IOException {
        return Long.parseLong(nextToken());
    }

    //Возвращает следующее вещественное число из входного файла
    public double nextDouble() throws IOException {
        return Double.parseDouble(nextToken());
    }

    //метод, в котором пишется решение
    //пример - задача а+б
    public void solve() throws IOException {
        int a = nextInt();
        int b = nextInt();
        out.println(a + b);
    }

    public static void main(String[] args) {
	new Pattern().run();	
    }

    public void run() {
        try {
            //из консоли:
            br = new BufferedReader(new InputStreamReader(System.in));
            out = new PrintWriter(System.out);
            //из файла:
            //br = new BufferedReader(new FileReader("input.txt"));
            //out = new PrintWriter("output.txt");

            solve();

            out.close();
        } catch (IOException e) {
            e.printStackTrace();
            System.exit(1);
        }
    }


}
