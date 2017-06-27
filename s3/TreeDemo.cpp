// TreeDemo.cpp: ���������� ����� ����� ��� ����������� ����������.
//

#include "stdafx.h"

#include <iostream>
#include <assert.h>

using namespace std;

// ������� (����) ������
template <typename T> // T - ��� �������� ��� ������
struct Node { // struct - ��� ���� � ������ ��-��������� public
  T value; // �������� � ���� ������
  int count; // ���������� ��������� � ����� ���������
  Node* left, *right; // ������ �� ����� � ������ ���������
  // �����������
  Node(T value) {
    left = right = NULL;
    this->value = value;
    count = 1; // ���������� ������� ������ ����
  };
};

// ������
template <typename T> // T - ��� �������� ��� ������
class Tree { // class - ��� ���� � ������ ��-��������� private
  Node<T>* root; // ������� ������
public:
  Tree() {
    root = NULL;
  }
  // �������� ��������
  void add(T value) {
    // ������ ����� �������
    Node<T>* el = new Node<T>(value);
    // ���� ��� �� ������ ��������, �� ���� ������� ��������
    if(root == NULL) {
      root = el;
      return;
    };
    // ����, � ������ ���� ��� ��������� ��� ����� �������
    Node<T>* cur = root; // ��������� ��� ������
    while(cur != NULL) {
      // ���������, ����� �� �� ��������� el � cur
      if(value < cur->value) { // ��� �����
        if(cur->left == NULL) {
          cur->left = el; // ����������� ����� ������� �����
          return;
        }
        cur = cur->left; // ���������� ������ �����
      };
      if(value > cur->value) { // ��� ������
        if(cur->right == NULL) {
          cur->right = el; // ����������� ����� ������� ������
          return;
        }
        cur = cur->right; // ���������� ������ ������
      };
      if(value == cur->value) {
        cur->count++;
        delete el; // ������� ������
        return;
      };
    };
  };
  // ����� ��������
  bool find(T value) {
    Node<T>* cur = root; // ���������, ������� �� ����
    while(cur != NULL) {
      if(cur->value == value)
        return true; // ����� �������!
      if(value > cur->value) // ���� �� ��� �� ���� ������ �������� => ��� ������
        cur = cur->right;
      else if(value < cur->value)
        cur = cur->left;
    }
    // ���� �� ��� ��� �� �����, ������ ��� ��� ;)
    return false;
  }
  // ����������� ����� � ����������� ���������� ����� ���������
  int count(T value) {
    return countRec(value, root);
  }
  int countRec(T value, Node<T>* cur) {
    if(cur == NULL) return 0;
    if(cur->value == value) return cur->count;
    return countRec(value, (value > cur->value) ? cur->right : cur->left);
  }
};



int main() {
  Tree <int> t;

  assert(!t.find(5));
  t.add(5);
  assert(t.count(5) == 1);

  t.add(5);
  assert(t.count(5) == 2);

  int g;
  int h;
  cout << "If Add, write '1' or Find, write '2'?" << endl;

  do {
    cin >> g;

    if(g == 1) {
      cin >> h;
      t.add(h);
    }

    if(g == 2) {
      cin >> h;
      t.find(h);
      if(t.find(h))
        cout << "We found this number" << endl;
      else
        cout << "not.";
    }

  } while(g != 0);

  return 0;
}

