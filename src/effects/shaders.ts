export const quadVertex=`
attribute vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;

// Procedural shading draws transparent energy only. The webcam is never sampled,
// copied into a texture, filtered, resized or encoded by this renderer.
export const energyFragment=`
precision mediump float;
uniform vec2 resolution, center;
uniform vec3 primary, secondary, ambient;
uniform float time, progress, charge, mode, radius, opacity, detail, aura;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float cloud(vec2 p){float n=noise(p)*.65;if(detail>.4)n+=noise(p*2.07)*.25;if(detail>.75)n+=noise(p*4.13)*.1;return n;}
float line(vec2 p,vec2 a,vec2 b,float width){vec2 v=b-a;float t=clamp(dot(p-a,v)/dot(v,v),0.,1.);return 1.-smoothstep(width,width+.022,length(p-a-v*t));}
float ring(float d,float r,float width){return 1.-smoothstep(width,width+.018,abs(d-r));}
float box(vec2 p,vec2 b){vec2 q=abs(p)-b;return 1.-smoothstep(0.,.018,length(max(q,0.))+min(max(q.x,q.y),0.));}
void main(){
 vec2 pixel=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);
 vec2 p=(pixel-center)/radius;
 float d=length(p),a=atan(p.y,p.x),t=progress;
 bool beam=(mode>1.5&&mode<2.5)||(mode>10.5&&mode<11.5)||(mode>19.5&&mode<20.5);
 if(charge>.5&&d>1.4)discard;
 if(charge<.5&&d>2.3&&!beam)discard;
 if(beam&&d>2.3&&abs(p.y+p.x*(center.x<resolution.x*.5?1.:-1.)*.18)>.7)discard;
 float n=cloud(p*3.1+vec2(-time*.45,time*.62));
 float turbulence=cloud(vec2(a*2.7+d*1.8,d*4.-time*3.));
 float energy=0.,core=0.,dark=0.;
 vec3 tint=primary;
 if(charge>.5){
  float edge=.32+charge*.1+(n-.5)*.25;
  energy=(1.-smoothstep(edge,edge+.5,d))*(.25+n*.85);
  energy+=ring(d,edge,.022)*.65;
  core=exp(-d*d*90.)*.8;
  energy*=aura;core*=aura;
 }else if(mode>20.5){
  float crack=abs(sin(a*5.+noise(vec2(d*8.,floor(time*12.)))*.7));
  float branch=(1.-smoothstep(.015,.10,crack))*(1.-smoothstep(.35,1.7,d));
  core=exp(-d*d*80.);dark=branch*.98*(1.-core);energy=branch*.12;
 }else if(mode<.5){
  energy=exp(-d*d*3.)*(.25+n)+ring(d,.25+t*1.8,.04)*(1.-t);
  core=exp(-d*d*55.)*max(0.,1.-t*2.);
 }else if(mode<1.5){
  dark=exp(-d*d*.55)*.25;
  for(int i=0;i<3;i++){float k=float(i)-1.;float cut=line(p,vec2(-1.4+k*.4,-.8+k*.25),vec2(1.4+k*.4,.5+k*.25),.014);energy+=cut;core+=cut*.9;}
 }else if(mode<2.5 || (mode>10.5&&mode<11.5) || mode>19.5){
  float side=center.x<resolution.x*.5?1.:-1.;
  vec2 q=vec2(p.x*side,p.y+p.x*side*.18);
  float thick=mode<2.5?.055:mode>19.5?.44:.24;
  float beam=(1.-smoothstep(thick*.4,thick+noise(q*12.-time*3.)*.1,abs(q.y)))*step(0.,q.x);
  energy=beam*.8+exp(-d*d*(mode>19.5?1.7:6.))*(1.+n);
  core=beam*(1.-smoothstep(0.,thick*.35,abs(q.y)))*.9+exp(-d*d*42.);
  if(mode>19.5){energy+=ring(d,.8+t*.6+(turbulence-.5)*.1,.025);energy+=exp(-d*d*.45)*n*.4;}
 }else if(mode<3.5 || (mode>7.5&&mode<8.5)){
  vec2 q=vec2(p.x,p.y*2.6-.7);float portal=length(q);
  dark=(1.-smoothstep(.7,1.,portal))*.85;
  energy=ring(portal,.9+(n-.5)*.13,.025)*.7;
  for(int i=0;i<5;i++){float k=float(i);float xx=(k-2.)*.34;float tendril=abs(p.x-xx-sin(p.y*7.+k+time)*.07);energy+=(1.-smoothstep(.018,.07,tendril))*smoothstep(-1.2,-.65,p.y)*(1.-smoothstep(-.2,.5,p.y))*.35;}
  if(mode<3.5){for(int i=0;i<2;i++){float x=float(i)*.9-.45;energy+=line(p,vec2(x-.17,.05),vec2(x-.1,-.45),.022)+line(p,vec2(x,.1),vec2(x+.1,-.5),.022);core+=exp(-length(p-vec2(x,-.28))*65.);}}
 }else if(mode<4.5){
  for(int i=0;i<2;i++){float side=float(i)*2.-1.;vec2 q=vec2(p.x*side,p.y);float bolt=abs(q.y+.3+q.x*.18+(noise(vec2(q.x*17.,floor(time*20.)))-.5)*.3);float e=(1.-smoothstep(.01,.04,bolt))*step(0.,q.x)*(1.-smoothstep(1.3,1.9,q.x));energy+=e;core+=e*.9;}
  energy+=exp(-d*d*3.)*.35;
 }else if(mode<5.5){
  energy=ring(d,.85,.045)+ring(d,.4,.025);
  for(int i=0;i<8;i++){float ang=float(i)*.785398+time*.25;vec2 v=vec2(cos(ang),sin(ang));energy+=line(p,v*.4,v*.85,.025);core+=exp(-length(p-v*.85)*32.);}
  energy+=exp(-d*d)*.18;
 }else if(mode<6.5){
  float hole=.72;dark=(1.-smoothstep(hole-.03,hole,d))*.98;
  float lens=ring(d,hole+(n-.5)*.035,.02);
  energy=lens*1.8+exp(-pow((d-hole)*6.,2.))*.5;
  float disk=length(vec2(p.x,p.y*4.));energy+=ring(disk,1.02,.025)*.75;
  core=lens*.85;
  vec2 cell=floor(p*50.);float star=step(.988,hash(cell))*(1.-smoothstep(0.,.16,length(fract(p*50.)-.5)));
  energy+=star*smoothstep(.8,1.1,d);core+=star;
 }else if(mode<7.5){
  energy=exp(-d*d*.5)*(.28+n*.3);
  vec2 q=p-vec2(0.,.05);float roof=line(q,vec2(-1.,-.4),vec2(0.,-.7),.1)+line(q,vec2(0.,-.7),vec2(1.,-.4),.1);
  float temple=max(roof,max(box(q-vec2(-.62,.08),vec2(.09,.55)),box(q-vec2(.62,.08),vec2(.09,.55))));
  temple=max(temple,box(q-vec2(0.,.58),vec2(.9,.11)));temple=max(temple,box(q-vec2(0.,-.05),vec2(.6,.07)));dark=clamp(temple,0.,1.)*.95;
  core=ring(length(vec2(p.x*.7,p.y*2.-1.2)),.95,.015)*.2;
 }else if(mode<9.5){
  float shell=.22+(n-.5)*.12;
  energy=exp(-d*d*2.5)*(.5+n)+ring(d,.2+t*2.,.022)*(1.-t)*.5;
  core=(1.-smoothstep(shell*.15,shell,d))*1.5;
  float ray=pow(abs(sin(a*4.+.3)),48.)+pow(abs(sin(a*7.-.8)),64.);
  energy+=ray*smoothstep(.18,.35,d)*(1.-smoothstep(.4,1.8,d))*.85;
 }else if(mode<10.5){
  float warp=d+(turbulence-.5)*.16;
  energy=exp(-d*d*1.8)*(.3+n)+ring(warp,.47,.025);
  energy+=pow(max(0.,sin(a*3.+log(d+.03)*8.+time*6.)),14.)*exp(-d*1.8)*.65;
  core=exp(-d*d*50.);
 }else if(mode<12.5){
  energy=exp(-d*d*2.)*n*.65;core=exp(-d*d*35.)*.25;
  energy+=ring(length(vec2(p.x,p.y*2.)),.4+t*.8,.04)*.4;
 }else if(mode<13.5){
  for(int i=0;i<4;i++){float k=float(i),beat=clamp(t*4.-k,0.,1.);vec2 q=p-vec2(sin(k*2.1),cos(k*2.1))*.5;energy+=ring(length(q),beat*.6,.04)*step(.01,beat)*(1.-beat);core+=exp(-dot(q,q)*65.)*step(.01,beat)*(1.-beat);}
 }else if(mode<14.5){
  vec2 q=vec2(p.x*.8-p.y*.6,p.x*.6+p.y*.8);float cut=line(q,vec2(-1.2,-.3),vec2(1.2,.1),.022);energy=cut;core=cut*.9;
  energy+=ring(length(q-vec2(0.,-1.1)),1.3,.02)*step(0.,q.y)*.4;
 }else if(mode<16.5){
  float spin=sin(a*4.+d*13.-time*7.);float mask=1.-smoothstep(.45,1.2,d);
  energy=mask*(.2+pow(max(0.,spin),5.)*.65)*(.5+n);
  dark=(1.-smoothstep(.13,.23,d))*.8;
  if(mode>15.5){energy+=ring(d,.8+(turbulence-.5)*.15,.045);core=exp(-d*d*22.)*.8;}
 }else if(mode<17.5){
  vec2 q=vec2(p.x,p.y*1.2);float skull=length(q);
  dark=(1.-smoothstep(.62,.75,skull))*.4;
  energy=ring(skull,.65+(n-.5)*.13,.06)*.6;
  float eye1=length((q-vec2(-.22,-.12))*vec2(1.,2.)),eye2=length((q-vec2(.22,-.12))*vec2(1.,2.));
  core=exp(-eye1*35.)+exp(-eye2*35.);
  float jaw=ring(length(vec2(q.x,(q.y-.2)*1.6)),.32,.022)*step(.15,q.y);energy+=jaw;
  for(int i=0;i<5;i++){float k=float(i);energy+=line(q,vec2((k-2.)*.105,.28),vec2((k-2.)*.07,.48),.017)*.7;}
  energy+=noise(p*5.-vec2(0.,time))*exp(-d*d)*.25;
 }else if(mode<18.5){
  energy=exp(-d*d*3.)*(.35+n*.5);core=exp(-d*d*50.);
  float diamond=abs(p.x)+abs(p.y);energy+=ring(diamond,.6+t*.3,.028);energy+=ring(diamond,.3+t*.25,.015);
 }else{
  for(int i=0;i<7;i++){float ang=float(i)*.8976;vec2 v=vec2(cos(ang),sin(ang))*(.15+t*1.3);float drop=length(p-v);energy+=exp(-drop*22.)*.85;core+=exp(-drop*65.)*.3;}
 }
 // Reuse noise for a luminous mantle without another blur or texture pass.
 float mantle=exp(-d*d*1.9)*(.22+n*.35);
 if(aura>.5&&mode<20.5)energy+=mantle;
 energy=max(energy,0.)*1.35;core=max(core,0.);
 float alpha=clamp(max(energy*.75,core)+dark,0.,.96)*opacity;
 vec3 rgb=mix(ambient,clamp(tint*energy*1.18+secondary*core,0.,1.),clamp(energy+core,0.,1.));
 if(dark>.5)rgb=mix(rgb,ambient,dark);
 gl_FragColor=vec4(rgb*alpha,alpha);
}`;

export const particleVertex=`
attribute vec4 particle;
uniform vec2 resolution;
varying float life;
void main(){life=particle.w;gl_Position=vec4(particle.x/resolution.x*2.-1.,1.-particle.y/resolution.y*2.,0.,1.);gl_PointSize=particle.z;}`;
export const particleFragment=`
precision mediump float;
uniform vec3 primary,secondary;
uniform float style;
varying float life;
void main(){vec2 p=gl_PointCoord*2.-1.;float d=length(p);float a=pow(max(0.,1.-d),2.);if(style>.5&&style<1.5)a*=1.-smoothstep(.1,.5,abs(p.x));if(style>1.5&&style<2.5)a=(1.-smoothstep(.65,1.,d))*.7;if(style>2.5&&style<3.5)a*=.45;vec3 c=mix(primary,secondary,pow(max(0.,1.-d),5.));gl_FragColor=vec4(c*a*life,a*life);}`;
