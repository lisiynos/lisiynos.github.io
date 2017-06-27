{
 Flash Pascal sample based on this tutorial :
 http://www.zoneflash.net/tutoriaux/t006.php
}

{$FRAME_WIDTH  200}
{$FRAME_HEIGHT 200}
{$FRAME_RATE    32}

program Barycentre;

uses
 Flash8;

type
 TPoint=class(MovieClip)
  constructor Create(Depth,x,y,Color:integer);
 end;

 TSpot=class(TPoint)
  t,dt:double;
  constructor Create(Depth,x,y,Color:integer);
  procedure doEnterFrame;
  function Barycentre(a,b,c:integer; t:double):integer;
 end;

constructor TPoint.Create(Depth,x,y,Color:integer);
begin
 inherited Create(nil,'',Depth);
 lineStyle(0, Color);
 beginFill(Color);
 moveTo( 0,-2);
 curveTo(+2,-2,+2, 0);
 curveTo(+2,+2, 0,+2);
 curveTo(-2,+2,-2, 0);
 curveTo(-2,-2, 0,-2);
 endFill();
 _x:=x;
 _y:=y;
end;

constructor TSpot.Create(Depth,x,y,Color:integer);
begin
 inherited Create(Depth,x,y,Color); // todo: default parameters
 onEnterFrame:=doEnterFrame;
  t:=0;
 dt:=0.03;
end;

var
 pt:array[0..6] of TPoint;
  a:array[0..6] of TPoint;

procedure TSpot.doEnterFrame;
var
 n,m:integer;
begin
 t:=t+dt;
 if (t>=7) then t:=0;
 n:=Floor(t);
 if n=6 then m:=0 else m:=n+1;
 _x:=barycentre(pt[n]._x,a[n]._x,pt[m]._x,t-n);
 _y:=barycentre(pt[n]._y,a[n]._y,pt[m]._y,t-n);
end;

function TSpot.Barycentre(a,b,c:integer; t:double):integer;
begin
 Result:=Floor((1-t)*(1-t)*a+2*(1-t)*t*b+t*t*c);
end;

var
  i,j:integer;
  p:MovieClip;
begin
 pt[0]:=TPoint.Create( 0,100, 10,$0000ff);
 pt[1]:=TPoint.Create( 1, 20, 40,$0000ff);
 pt[2]:=TPoint.Create( 2, 80, 40,$0000ff);
 pt[3]:=TPoint.Create( 3, 80,140,$0000ff);
 pt[4]:=TPoint.Create( 4,120,140,$0000ff);
 pt[5]:=TPoint.Create( 5,120, 40,$0000ff);
 pt[6]:=TPoint.Create( 6,180, 40,$0000ff);

  a[0]:=TPoint.Create( 7, 25, 10,$ff0000);
  a[1]:=TPoint.Create( 8, 10, 90,$ff0000);
  a[2]:=TPoint.Create( 9, 10,160,$ff0000);
  a[3]:=TPoint.Create(10,100,190,$ff0000);
  a[4]:=TPoint.Create(11,180,160,$ff0000);
  a[5]:=TPoint.Create(12,180, 90,$ff0000);
  a[6]:=TPoint.Create(13,165, 10,$ff0000);

 p:=TSpot.Create(14,0,0,$00ff00);

 _root.lineStyle(0,$999999);
 _root.moveTo(pt[0]._x,pt[0]._y);
 j:=1;
 for i:=0 to 6 do begin
  _root.curveTo(a[i]._x,a[i]._y,pt[j]._x,pt[j]._y);
  if i=5 then j:=0 else j:=j+1;
 end;

end.
