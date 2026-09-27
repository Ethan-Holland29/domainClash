/** Authored canvas paths, based on the series' visual motifs. No generated images. */
export const TAU = Math.PI * 2;
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function line(c: CanvasRenderingContext2D, points: number[], color: string, width = 2): void {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
}
export function ring(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width = 2, squash = 1): void {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.ellipse(x, y, Math.max(.1,r), Math.max(.1,r*squash), 0, 0, TAU); c.stroke();
}
function polygon(c: CanvasRenderingContext2D, points: number[], color: string): void {
  c.fillStyle=color;c.beginPath();c.moveTo(points[0],points[1]);
  for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);c.closePath();c.fill();
}
export function lightning(c:CanvasRenderingContext2D,x:number,y:number,tx:number,ty:number,time:number,color='#b8acff'):void {
  const p=[x,y];
  for(let i=1;i<12;i++){const k=i/12;p.push(x+(tx-x)*k+Math.sin(i*7+Math.floor(time/70))*18*Math.sin(k*Math.PI),y+(ty-y)*k);}
  p.push(tx,ty);line(c,p,'#19102e',9);line(c,p,color,4);line(c,p,'#fff',1);
}
export function dog(c:CanvasRenderingContext2D,x:number,y:number,scale:number,white=false):void {
  c.save();c.translate(x,y);c.scale(scale,scale);
  const pts=[-50,8,-64,-68,-26,-45,0,-60,25,-45,65,-70,50,8,28,55,0,77,-30,55];
  polygon(c,pts,white?'#d4dadf':'#050910');line(c,[...pts,pts[0],pts[1]],white?'#334152':'#738491',2);
  polygon(c,[-34,-6,-9,1,-27,9],'#ef333e');polygon(c,[34,-6,9,1,27,9],'#ef333e');
  polygon(c,[-13,33,13,33,0,46],white?'#161a24':'#acb7c0');line(c,[-22,52,0,58,23,52],white?'#243040':'#bacad5',2);
  for(const s of [-1,1])polygon(c,[s*23,48,s*18,60,s*12,52],'#faf4e5');
  polygon(c,[-8,-25,0,-39,8,-25],'#b23038');c.restore();
}
export function nue(c:CanvasRenderingContext2D,x:number,y:number,scale:number,time:number):void {
  c.save();c.translate(x,y);c.scale(scale,scale);
  for(const side of [-1,1]) {c.save();c.scale(side,1);c.rotate(Math.sin(time/170)*.08);
    polygon(c,[12,0,58,-36,178,-82,145,-33,161,-28,117,-9,132,-3,91,16,97,29,31,24],'#5d342a');
    for(let i=0;i<11;i++){
      const x=29+i*11,y=5-i*5;
      polygon(c,[x,y-14,x+42,y-39,x+22,y+8,x+12,y+2],'#331e21');
      line(c,[x+4,y-9,x+35,y-34],'#bd7957',1.4);
      line(c,[x+10,y-4,x+28,y-25],'#7d4d38',2);
    }
    line(c,[14,-3,52,-32,176,-81],'#d39967',2);c.restore();}
  polygon(c,[-29,-25,0,-44,29,-25,22,36,0,51,-23,36],'#e3d4bb');
  polygon(c,[-23,-16,-3,-8,-17,4],'#151323');polygon(c,[23,-16,3,-8,17,4],'#151323');
  polygon(c,[-6,9,6,9,0,26],'#d89d50');
  line(c,[-24,-23,-9,-16,-18,6,-10,24,0,33,10,24,18,6,9,-16,24,-23],'#3b3034',1.5);
  line(c,[-12,-31,0,-22,12,-31],'#514034',2);
  for(const side of [-1,1]){line(c,[side*15,36,side*24,55,side*33,62],'#bd9c76',4);line(c,[side*24,55,side*14,65],'#15121a',2);}
  c.restore();
}
export function wheel(c:CanvasRenderingContext2D,x:number,y:number,r:number,time:number):void {
  c.save();c.translate(x,y);c.rotate(time/1300);ring(c,0,0,r,'#d1bf80',5);ring(c,0,0,r*.7,'#f0e1b0',2);
  for(let i=0;i<8;i++){const a=i*TAU/8;line(c,[Math.cos(a)*r*.2,Math.sin(a)*r*.2,Math.cos(a)*r,Math.sin(a)*r],'#caba87',4);ring(c,Math.cos(a)*r,Math.sin(a)*r,r*.12,'#fff0ba',4);}c.restore();
}
export function spirit(c:CanvasRenderingContext2D,x:number,y:number,scale:number,rika=false):void {
  c.save();c.translate(x,y);c.scale(scale,scale);
  c.fillStyle=rika?'#dadbd2':'#8979a9';c.beginPath();c.moveTo(-85,100);c.bezierCurveTo(-90,-30,-60,-82,0,-92);c.bezierCurveTo(66,-82,92,-14,85,100);c.lineTo(45,62);c.lineTo(0,85);c.lineTo(-42,59);c.fill();
  polygon(c,[-65,-20,0,-54,65,-20,42,6,-43,6],'#11101a');
  if(rika)ring(c,0,-28,10,'#ec5667',4);else {ring(c,-24,-18,5,'#fff',3);ring(c,24,-18,5,'#fff',3);}
  polygon(c,[-48,25,45,25,29,66,-32,66],'#1b0f25');
  for(let i=0;i<8;i++)polygon(c,[-42+i*11,25,-37+i*11,47,-32+i*11,25],'#f7efda');
  if(rika){polygon(c,[-58,-59,-96,-119,-27,-83],'#d6d6ce');polygon(c,[58,-59,96,-119,27,-83],'#d6d6ce');}
  c.restore();
}
export function drawDomainBackdrop(c:CanvasRenderingContext2D,id:string):void {
  const g=c.createRadialGradient(480,245,30,480,270,610);
  g.addColorStop(0,id==='sukuna'?'#32060766':'#03091744');g.addColorStop(1,id==='sukuna'?'#240004ee':'#01020aed');c.fillStyle=g;c.fillRect(0,0,960,540);
  if(id==='gojo'){
    for(let i=0;i<160;i++){const x=((i*137.508)%960),y=((i*i*19.73)%540);c.fillStyle=i%4?'#b6d6ed99':'#fff';c.fillRect(x,y,i%3===0?2:1,1);}
    for(let i=0;i<38;i++){const a=i*TAU/38;line(c,[480+Math.cos(a)*165,250+Math.sin(a)*120,480+Math.cos(a)*650,250+Math.sin(a)*470],i%3?'#6b8bca30':'#dbefff66',1);}
    c.fillStyle='#02030b';c.beginPath();c.ellipse(480,250,138,120,-.18,0,TAU);c.fill();ring(c,480,250,142,'#e6f8ff',3,.85);ring(c,480,250,148,'#688cff80',8,.85);
  }else if(id==='sukuna'){
    // Open shrine, curved eaves, crimson posts and a bone platform.
    c.fillStyle='#110406';c.fillRect(0,405,960,135);
    for(let i=0;i<5;i++)polygon(c,[235-i*22,399+i*17,725+i*22,399+i*17,747+i*22,416+i*17,213-i*22,416+i*17],i%2?'#72675e':'#c5b39a');
    for(const x of [325,395,565,635]){c.fillStyle='#791a20';c.fillRect(x,258,17,143);line(c,[x+3,264,x+3,395],'#d6544a',3);}
    c.fillStyle='#090407';c.fillRect(420,270,120,130);
    for(const roof of [{y:253,s:1},{y:196,s:.68}]){c.save();c.translate(480,roof.y);c.scale(roof.s,roof.s);c.fillStyle='#140b10';c.beginPath();c.moveTo(-242,-29);c.quadraticCurveTo(-151,11,0,-87);c.quadraticCurveTo(151,11,242,-29);c.lineTo(209,17);c.quadraticCurveTo(0,-8,-209,17);c.closePath();c.fill();line(c,[-241,-29,-209,17,0,-6,209,17,241,-29],'#d4b6a2',3);c.restore();}
    for(let i=0;i<17;i++){const x=260+i*27;c.fillStyle='#b9ad92';c.beginPath();c.ellipse(x,427,12,15,0,0,TAU);c.fill();c.fillStyle='#211016';c.fillRect(x-7,422,4,5);c.fillRect(x+3,422,4,5);}
  }else if(id==='megumi'){
    c.fillStyle='#03060c';c.fillRect(0,382,960,158);
    dog(c,190,423,.68);dog(c,762,437,.54,true);
    for(let i=0;i<10;i++){c.fillStyle='#03060de8';c.beginPath();c.moveTo(i*110-25,540);c.bezierCurveTo(i*110+80,365,i*110-65,300,i*110,245+i%3*58);c.bezierCurveTo(i*110-15,400,i*110+105,430,i*110+25,540);c.fill();}
  }else if(id==='yuta'){
    for(let i=0;i<28;i++){const x=(i*173)%960,y=310+(i*53)%210;c.save();c.translate(x,y);c.rotate((i%5-2)*.2);line(c,[0,30,0,-88],'#d1d9d9',3);line(c,[-12,-63,12,-63],'#ba9770',4);line(c,[0,-88,0,-65],'#201826',6);c.restore();}
  }
}
export function drawDomainMotion(c:CanvasRenderingContext2D,id:string,time:number):void {
  if(id==='gojo'){
    c.save();c.translate(480,250);c.rotate(time/19000);for(let i=0;i<4;i++){c.save();c.rotate(i*.73);ring(c,0,0,150+i*8,'#c9eeff60',2,.23);c.restore();}c.restore();
  }else if(id==='sukuna'){
    for(let i=0;i<5;i++){const p=((time/1100+i/5)%1);c.globalAlpha=Math.sin(p*Math.PI)*.35;line(c,[-50,540*p,1010,540*p-170],'#f7e3df',1);}c.globalAlpha=1;
  }else if(id==='megumi'){
    for(let i=0;i<9;i++){const p=(time/2300+i/9)%1;c.globalAlpha=(1-p)*.4;ring(c,(i*163)%960,415+i%3*35,10+p*135,'#96b5b1',2,.13);}c.globalAlpha=1;
  }
}
