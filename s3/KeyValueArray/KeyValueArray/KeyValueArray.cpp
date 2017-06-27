// KeyValueArray.cpp: ���������� ����� ����� ��� ����������� ����������.
#include "stdafx.h"
#include <assert.h>

using namespace std;

// ���� ����-��������
struct key_value_pair {
  string key; // ����
  string value; // ��������
  key_value_pair* left, *right; // ����� � ������ ���������
  <<< <<< < HEAD
  key_value_pair(string key, string value) : key(key), value(value) {
    left = NULL;
    right = NULL;
  }
};

struct dictionary;

struct my_iterator {
  dictionary* d;
  string key;
  void operator =(string value);
  operator string();
};

// ������� - ������ "����-��������"
struct dictionary {
  key_value_pair* root; // ������ ������
  dictionary() {
    root = NULL;
  };
  void add(string key, string value) {
    key_value_pair* n = new key_value_pair(key, value);
    if(root == NULL) {
      root = n;
      return;
      == == == =
        key_value_pair(string key, string value) : key(key), value(value), left(NULL), right(NULL) {
      }
    };

    // �������
    struct dictionary {
      key_value_pair* root; // ������ ������
      dictionary() : root(NULL) {
      };
      // ���������� ������ ����
      key_value_pair* add(string key, string value) {
        key_value_pair* n = new key_value_pair(key, value);
        if(root == NULL) {
          root = n;
          return n;
          >>> >>> > 53fdeb2efbc58c2d155d2403ac1f305307a301b2
        }
        // ���� ����� ��� ����� ����
        key_value_pair* cur = root;
        while(cur != NULL) {
          if(key > cur->key) {
            if(cur->right == NULL) {
              cur->right = n;
              <<< <<< < HEAD
              return;
              == == == =
                return n;
              >>> >>> > 53fdeb2efbc58c2d155d2403ac1f305307a301b2
            }
            cur = cur->right;
          }
          if(key < cur->key) {
            if(cur->left == NULL) {
              cur->left = n;
              <<< <<< < HEAD
              return;
              == == == =
                return n;
              >>> >>> > 53fdeb2efbc58c2d155d2403ac1f305307a301b2
            }
            cur = cur->left;
          }
          if(key == cur->key) {
            cur->value = value;
            delete n;
            <<< <<< < HEAD
          }
        }
      };
      // ����� � ������ ������
      string find(string key) {
        == == == =
          return cur;
      }
    }
    assert(false);
    return NULL;
  };
  // ����� � ������ ������
  string& find(string key) {
    >>> >>> > 53fdeb2efbc58c2d155d2403ac1f305307a301b2
    key_value_pair* cur = root;
    while(cur != NULL) {
      if(key < cur->key)
        cur = cur->left;
      else if(key > cur->key)
        cur = cur->right;
      else if(key == cur->key)
        return cur->value;
    };
    <<< <<< < HEAD
    return string("Not found!");
  };

  string& operator [](string key) {
    add(key, "Not found!");
    == == == =
      // ������� ����� ����
      return add(key, "Not found!")->value;
  };

  string& operator [](string key) {
    >>> >>> > 53fdeb2efbc58c2d155d2403ac1f305307a301b2
    return find(key);
  }
};

<<< <<< < HEAD


int _tmain(int argc, _TCHAR* argv[]) {
  dictionary d;
  //d.add("hello","HI!");
  d["hello"] = "HI!";
  cout << d.find("hello") << endl;

  cout << d["hello"] << endl;
  == == == =
  int main() {
    dictionary d;
    d.add("hello", "HI!");
    cout << d.find("hello") << endl;
    d["hello2"] = "HI2!";
    cout << d["hello"] << endl;
    cout << d["hello2"] << endl;

    >>> >>> > 53fdeb2efbc58c2d155d2403ac1f305307a301b2
    return 0;
  }

