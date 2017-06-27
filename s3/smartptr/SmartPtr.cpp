#include <iostream>

using namespace std;

// ���������������� �����, �� ������� �������� �� ����� ��������
struct MyClass {
  int id;
  static int count;
  MyClass() : id(++count) {
    cout << "MyClass::constructor #" << id << endl;
  };
  virtual ~MyClass() {
    cout << "MyClass::destructor #" << id << endl;
  };
};

int MyClass::count = 0;

// MyClass2 - ��������� ������ MyClass
struct MyClass2 : public MyClass {
  MyClass2() : MyClass() {
    cout << "MyClass2::constructor #" << id << endl;
  };
  ~MyClass2() {
    cout << "MyClass2::destructor #" << id << endl;
  };
};

// ����� ��������� - Smart Pointer
template <class T>  // T - �������� ���
struct SmartPtr {
  // �� ��������� � Smart-pointer
  SmartPtr(T* ptr) : p(ptr) {
  }
  // �������� ���������� � ��������� �� ��� T
  operator T* () {
    return p;
  }
  T* operator ->() {
    return p;
  }
  SmartPtr& operator =(T* ptr) {
    if(p)
      delete p;
    p = ptr;
    return *this;
  }
  //~SmartPtr(){
  //  if(p == NULL) return;
  //  delete p;
  //}
  static void operator delete(void* ptr) {
    cout << "delete(void *ptr)" << endl;
    //if(ptr){
    //  cout << "Real delete!" << endl;
    //   delete ptr;
    //  ptr = NULL;
    //}
  }
private:
  T* p; // ��������� �� �������� ���
};

// �������� ���������
int main(int argc, char* argv[]) {
  //MyClass *m
  SmartPtr<MyClass> m
    = new MyClass2();
  cout << m->id << endl;
  cout << (*m).id << endl;

  m = new MyClass2();

  //SmartPtr<MyClass>::operator delete(m);
  //SmartPtr<MyClass>::operator delete(m);
  delete m;
  //cout << m << endl;
  //delete m;

  return 0;
}

