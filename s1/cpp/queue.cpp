#include <iostream>
#include <assert.h>

using namespace std;

// ����������� ������ �������
// ������ � ����� �����������:
//   T - ��� �������� (��������: int, char, char*)
//   size - ������ ����� (����� �����)
template <typename T, int size>
class Queue {
  T data[size]; // ������ �������
  int head; // ������ ������� (������ �������)
  int tail; // ����� ������� (��������� �������)
public:
  // �����������
  Queue() {
    head = -1;
    tail = 0;
  };
  // ������� �����?
  bool isEmpty() {
    return head < tail;
  };
  // ������� �����?
  bool isFull() {
    return (head - tail + 1) >= size;
  };
  // �������� � ������ �������
  void put(T value) {
    assert(!isFull()); // ����� �������� ������ ���� ������� �� �����
    data[++head] = value; // �������� ������ ������ � ���������� ��������
  }
  // ����� �� ����� �������
  T get() {
    assert(!isEmpty()); // ����� ����� ������ ���� ������� �� �����
    return data[tail++]; // �������� �������� �� ������ � ������� ����� ������
  }
};

// �������� ��������� - ������������ �����
int main() {
  Queue<int, 5> s; // ������ ������ �����
  assert(s.isEmpty()); // ������ ������� ������ ���� �����
  s.put(5); // ��������� ���� �������
  assert(!s.isEmpty());
  assert(s.get() == 5);
  assert(s.isEmpty());
  assert(!s.isFull());
  s.put(1);
  s.put(2);
  s.put(3);
  s.put(4);
  assert(!s.isFull());
  s.put(5);
  assert(s.isFull());

  return 0;
}