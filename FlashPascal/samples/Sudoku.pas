program Sudoku;

// http://www.mots-croises.ch/Manuels/Sudoku/

uses
  Flash8Ext,Key;

{$FRAME_WIDTH   256}
{$FRAME_HEIGHT  320}
{$BACKGROUND $A6CAF0}

type
  TLink=class(MovieClip)
    constructor Create;
    procedure doRelease;
  end;

  TCustomButton = class(MovieClip)
    Caption: TextField;
    procedure DrawButton(BackColor, TopColor, BottomColor, Width, Height: Integer);
  end;

  TButton = class(TCustomButton)
    Index  : Integer;
    constructor Create(AIndex: Integer);
    procedure DrawCell(BackColor, TopColor, BottomColor: Integer);
    procedure DoNothing;
  end;

  TSudokuCell = class(TButton)
    constructor Create(AIndex: Integer);
    procedure Update;
    procedure DoClick;
  end;

  TDigit = class(TButton)
    constructor Create(AIndex: Integer);
    procedure DoClick;
  end;

  TSolve = class(TCustomButton)
    constructor Create;
    procedure doClick;
    procedure doRelease;
    procedure SolveCell(AIndex: Integer);
    procedure onKeyDown;
    procedure Log;
  end;

var
  Font   : TextFormat;
  Grid   : array[0..80] of Integer;
  Cells  : array[0..80] of TSudokuCell;
  Digits : array[0..8] of TDigit;
  Button : Integer;
  Empty  : Integer;
  Log    : TextField;
  Solve  : TSolve;

  Options: array[0..80] of Integer;
  VBox   : array[0..2, 0..8] of Integer;

procedure FlagOption(AIndex, AValue: Integer);
var
  v: Integer;
begin
  v := Options[AIndex];
  if (v <> AValue) and (v and AValue > 0) then
    Options[AIndex] := v - AValue;
end;

function IsOption(AIndex, AValue: Integer): Integer;
begin
  if Options[AIndex] and AValue = 0 then
    Result := 0
  else
    Result := 1;
end;

function UniqueOption(AValue, AIndex: Integer): Boolean;
var
  x, y, cx, cy, i, v, o, b, c1, c2 : Integer;
begin
  x := AIndex mod 9;
  y := AIndex div 9;
  v := 1 shl AValue;
  c1 := 0;
  c2 := 0;
  for i := 0 to 8 do
  begin
    c1 := c1 + IsOption(x + 9 * i, v);
    c2 := c2 + IsOption(i + 9 * y, v);
  end;
  Result := (c1 = 1) or (c2 = 1);
  if Result then
    Exit;
  cx := 3 * (x div 3);
  cy := 3 * (y div 3);
  c1 := 0;
  for i := 0 to 2 do
  begin
    c1 := c1 + IsOption(cx + 9 * (cy    ) + i, v)
             + IsOption(cx + 9 * (cy + 1) + i, v)
             + IsOption(cx + 9 * (cy + 2) + i, v);
  end;
  Result := c1 = 1;
end;

procedure SetOption(AIndex, AValue: Integer);
var
  x, y, cx, cy, i, v, o, b : Integer;
begin
  x := AIndex mod 9;
  y := AIndex div 9;
  v := 1 shl AValue;
  Options[AIndex] := v;
  for i := 0 to 8 do
  begin
    FlagOption(x + 9 * i, v);
    FlagOption(i + 9 * y, v);
  end;
  cx := 3 * (x div 3);
  cy := 3 * (y div 3);
  for i := 0 to 2 do
  begin
    FlagOption(cx + 9 * (cy    ) + i, v);
    FlagOption(cx + 9 * (cy + 1) + i, v);
    FlagOption(cx + 9 * (cy + 2) + i, v);
  end;
end;

procedure TestVBox(y, x1, y1, x2, y2, x3, y4, c2, c3: Integer);
var
  t1, t2, i, v, x : Integer;
begin
  t1 := VBox[x1, y + y1] or VBox[x2, y + y2];
  t2 := VBox[x3, y + y4];
  for i := 1 to 9 do
  begin
    v := 1 shl i;
    if (t2 and v > 0 ) and (t1 and v = 0) then
    begin
      for x := 0 to 2 do
      begin
        FlagOption(9 * y + 3 * c2 + x, v);
        FlagOption(9 * y + 3 * c3 + x, v);
      end;
    end;
  end;
end;

procedure SingleBox;
var
  x, y, i, v, o : Integer;
begin
// compute VBoxes
  for y := 0 to 8 do
  begin
    for x := 0 to 2 do
    begin
      v := 0;
      o := 9 * y + 3 * x;
      for i := 0 to 2 do
        v := v or Options[o + i];
      VBox[x, y] := v;
    end;
  end;
// Check boxes
  for i := 0 to 2 do
  begin
    TestVBox(3 * i, 0,0, 0,1, 0,2, 1,2);
    TestVBox(3 * i, 0,0, 0,2, 0,1, 1,2);
    TestVBox(3 * i, 0,1, 0,2, 0,0, 1,2);
  end;
end;

{ TLink }

constructor TLink.Create;
var
  t: TextField;
begin
  inherited Create(nil, '', -1);
  beginFill($000080);
  moveTo(0, 0);
  lineTo(256, 0);
  lineTo(256, 15);
  lineTo(0, 15);
  endFill;
  t := TextField.Create(Self, '', 0, 0, 0, 240, 15);
  t.Text := 'FlashPascal Sudoku (c)2009 by Paul TOTH';
  t.SetTextFormat(Font);
  onRelease := doRelease;
end;

procedure TLink.doRelease;
begin
  getURL('http://sourceforge.net/projects/flashpascal', '_blank');
end;

{ TCustomButton }

procedure TCustomButton.DrawButton(BackColor, TopColor, BottomColor, Width, Height: Integer);
begin
  beginFill(BackColor);
  lineStyle(1, TopColor);
  moveTo(0, Height);
  lineTo(0, 0);
  lineTo(Width, 0);
  lineStyle(1, BottomColor);
  lineTo(Width, Height);
  lineTo(0, Height);
  endFill;
end;

{ TButton }

constructor TButton.Create(AIndex: Integer);
begin
  inherited Create(nil, IntToStr(AIndex), AIndex);
  Caption := TextField.Create(Self, '', 0, 0, 5, 26, 26);
  OnPress := DoNothing;
end;

procedure TButton.DrawCell(BackColor, TopColor, BottomColor: Integer);
begin
  DrawButton(BackColor, TopColor, BottomColor, 25, 25);
end;

procedure TButton.DoNothing;
var
  i : Integer;
begin
  i := 0; // dummy code cause the compiler test for an empty code !
end;

{ TSudokuCell }
constructor TSudokuCell.Create(AIndex: Integer);
var
  x, y, v : Integer;
  c : Char;
begin
  inherited Create(AIndex);
  Index := AIndex;
  x := Index mod 9;
  y := Index div 9;
  _x := 10 + 25 * x +  3 * (x div 3);
  _y := 20 + 25 * y +  3 * (y div 3);
  v := Grid[AIndex];
  c := Chr(v and 15 + Ord('0'));
  if c = '0' then
  begin
    OnPress := DoClick;
    DrawCell($ffffff, $808080, $808080);
  end
  else
  begin
    Caption.Text := c;
    DrawCell($c0c0c0, $808080, $808080);
  end;
  Caption.SetTextFormat(Font);
end;

procedure TSudokuCell.DoClick;
var
  Cell: Integer;
begin
  Cell := Grid[Index];
  if Button < 0 then
  begin
    if Cell > 0 then
    begin
      Inc(Empty);
      Grid[Index] := 0;
    end;
  end
  else
  begin
    if Cell = 0 then
      Dec(Empty);
    if (Cell and 15) = Button + 1 then
      Grid[Index] := Cell xor 32
    else
      Grid[Index] := Button + 1;
  end;
  Update;
end;

procedure TSudokuCell.Update;
var
  v: Integer;
  c: Char;
begin
  v := Grid[Index];
  c := Chr(v and 15 + Ord('0'));
  if c = '0'  then
    Caption.Text := ''
  else
    Caption.Text := c;
  if (v and 32) = 0 then
    Font.Color := $c0c0c0
  else
    Font.Color := 0;
  Caption.SetTextFormat(Font);
end;

{ TDigit }

constructor TDigit.Create(AIndex: Integer);
begin
  inherited Create(AIndex + 90);
  Index := AIndex;
  _x := 10 + 26 * AIndex;
  _y := 260;
  DrawCell($d0d0d0, $e0e0e0, $808080);
  Caption.Text := Chr(AIndex + Ord('1'));
  Caption.SetTextFormat(Font);
  OnPress := DoClick;
end;

procedure TDigit.DoClick;
begin
  if Button >= 0 then
    Digits[Button].DrawCell($d0d0d0, $e0e0e0, $808080);
  if Button = Index then
    Button := -1
  else
  begin
    Button := Index;
    DrawCell($c0c0c0, $808080, $e0e0e0)
  end;
end;

{ TSolve }

constructor TSolve.Create;
begin
  inherited Create(nil, '', -2);
  _x := 50;
  _y := 290;
  DrawButton($d0d0d0, $e0e0e0, $808080, 150, 25);
  Caption := TextField.Create(Self, '', 0, 0, 5, 150, 25);
  Caption.Text := 'Solve';
  Caption.SetTextFormat(Font);
  onPress := doClick;
  onRelease := doRelease;
end;

procedure TSolve.doClick;
var
  cOld: Integer;
  cIndex: Integer;
begin
  Empty := 0;
  cOld := (1 shl 10) - 2;
  for cIndex := 0 to 80 do
    Options[cIndex] := cOld;
  for cIndex := 0 to 80 do
    if (Grid[cIndex] and 16) > 0 then
      SetOption(cIndex, Grid[cIndex] and 15)
    else
    begin
      Grid[cIndex] := 0;
      Inc(Empty);
    end;
  if Empty > 0 then
  begin
    repeat
      cOld := Empty;
     // Log;
      for cIndex := 0 to 80 do
      begin
        if Grid[cIndex] = 0 then
          SolveCell(cIndex);
      end;
    until (Empty = 0) or (cOld = Empty);
  end;
  DrawButton($c0c0c0, $808080, $e0e0e0, 150, 25);
end;

procedure TSolve.doRelease;
begin
  DrawButton($d0d0d0, $e0e0e0, $808080, 150, 25);
end;

procedure TSolve.SolveCell(AIndex: Integer);
var
  Values, i: Integer;
begin
//  SingleBox;
// trivial solutions
  Values := Options[AIndex];
  for i := 1 to 9 do
  begin
    if (Values = (1 shl i)) then
    begin
      Grid[AIndex] := i or 32;
      Cells[AIndex].Update;
      SetOption(AIndex, i);
      Dec(Empty);
      Exit;
    end;
  end;
  if Values > 0 then
    for i := 1 to 9 do
      if (Values and (1 shl i)) > 0 then
        if UniqueOption(i, AIndex) then
        begin
          Grid[AIndex] := i or 32;
          Cells[AIndex].Update;
          SetOption(AIndex, i);
          Dec(Empty);
          Exit;
        end;
end;

procedure TSolve.onKeyDown;
var
  code : Integer;
begin
  code := getKeyAscii;
//  code := Key.getAscii;
  if (code >= Ord('0')) and (code <= Ord('9')) then
  begin
    Dec(code, Ord('1'));
    if code >= 0 then
      Digits[code].DoClick
    else
      if Button >= 0 then
        Digits[Button].DoClick;
  end;
end;

procedure TSolve.Log;
var
  x, y, i, v, b: Integer;
  s: string;
begin
 Trace('--------');
 s := '';
 for y := 0 to 8 do
 begin
   for x := 0 to 8 do
   begin
     if x mod 3 = 0 then
       s := s + '|';
     i := x + 9 * y;
     v := Options[i];
     for b := 1 to 9 do
       if v and (1 shl b) = 0 then
         s := s + '.'
       else
         s := s + Chr(b + Ord('0'));
     s := s + '|';
   end;
   if y mod 3 = 0 then
     Trace('');
   Trace(s);
   s := '';
 end;
end;

procedure SetLevel(AData: string);
{
var
  i, x, v : Integer;
begin
  x := 0;
  for i:= 1 to Length(AData) do
  begin
    v := Ord(AData[i]);
    if v = 32 then
      Inc(x)
    else
      if v < Ord('0') then
        Inc(x, v)
      else
      begin
        Grid[x] := v - Ord('0') + 16;
        Dec(Empty);
        Inc(x);
      end;
  end;
end;
}
var
  i, v : Integer;
begin
  Empty := 0;
  for i := 1 to Length(AData) do
  begin
    v := Ord(AData[i]) - Ord('0');
    if v = 0 then
      Inc(Empty)
    else
      v := v + 16;
    Grid[i - 1] := v;
  end;
end;

var
  i : Integer;
begin
  Font := TextFormat.Create('Tahoma', 9);
  Font.Align := 'center';
  Font.Bold := True;
  Font.Color := $ffffff;

  TLink.Create;

  Font.Color := 0;

  for i := 0 to 80 do
    Grid[i] := 0;
  Empty := 81;

  SetLevel('500170039007900000010000400000802700308000602005406000002000050000005900150029007');

//  SetLevel('090871340410903080386245910048090100601500498950184000509030071074600030820019654');

//  SetLevel('100007090030020008009600500005300900010080002600004000300000010041000007007000300');
//  SetLevel('500004200100020030090000005000400000805196302000005000400000060030070009007300008');
//  SetLevel('020001030800900001000060400009600180300000007087003900006090000100006008050300010');

//  SetLevel('000000000000390280040021093600070900900502006005060001180250030064018000000000000');

//  SetLevel('084210590056409800009058040047501938508090004931804075090045780800900450475182369');

  for i := 0 to 80 do
    Cells[i] := TSudokuCell.Create(i);

  for i := 0 to 8 do
    Digits[i] := TDigit.Create(i);

  Solve := TSolve.Create;

  Button := -1;

  Log := TextField.Create(nil, '', -3, 0, 320, 256, 40);

  //Key.addListener(Solve);
  addKeyListener(Solve);
end.
