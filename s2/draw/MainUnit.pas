unit MainUnit;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Variants,
  System.Classes, Vcl.Graphics, Vcl.Controls, Vcl.Forms, Vcl.Dialogs,
  Vcl.ExtCtrls, PngImage;

type
  TDrawForm = class(TForm)
    Image: TImage;
    procedure FormCreate(Sender: TObject);
  private
    procedure SaveToPNG(FileName: string);
    procedure Circle(x, y, r: integer);
    procedure Ris(x, y, r: integer);
  public
  end;

var
  DrawForm: TDrawForm;

implementation

{$R *.dfm}

procedure TDrawForm.FormCreate(Sender: TObject);
begin
  { �� ����������� ������ }
  Image.Canvas.Brush.Style := bsClear;
  { ���������� ������ � ������ �������� }
  Image.Width := 559;
  Image.Height := 220;
  Image.Picture.Bitmap.Width := Image.Width;
  Image.Picture.Bitmap.Height := Image.Height;
  { ����� ����������� ��������� }
  Ris(Image.Width div 2, Image.Height div 2, 100);
  { ���������� � ������� .png }
  SaveToPNG('ris.png');
end;

{ ���������� � ������� .png: FileName - ��� ����� }
procedure TDrawForm.SaveToPNG(FileName: string);
var
  png: TPngImage;
begin
  png := TPngImage.Create;
  png.Assign(Image.Picture.Bitmap);
  png.SaveToFile(FileName);
  png.Free;
end;

{ ���������� � �������: x, y - ����� ����������, r - ������ }
procedure TDrawForm.Circle(x, y, r: integer);
begin
  Image.Canvas.Ellipse(x - r, y - r, x + r, y + r);
end;

{ ����������� ��������� }
procedure TDrawForm.Ris(x, y, r: integer);
begin
  if r >= 15 then
  begin
    Circle(x, y, r);
    Ris(x - r, y, r * 2 div 3);
    Ris(x + r, y, r * 2 div 3)
  end;
end;

end.
