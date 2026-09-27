import {MultiplayerClient} from './multiplayer/MultiplayerClient';
import {PeerCamera} from './multiplayer/PeerCamera';
import {HandTracker} from './handTracking/HandTracker';
const output=document.getElementById('result')!;
let cleanup=()=>{};let run=0;
document.getElementById('stop-check')!.onclick=()=>{run++;cleanup();output.textContent='Stopped.';};
document.getElementById('run-check')!.onclick=async()=>{
 run++;cleanup();const generation=run;
 const clients=[new MultiplayerClient(),new MultiplayerClient()];const locals=[document.createElement('video'),document.createElement('video')];
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d')!;
 const streams=locals.map(v=>{const stream=canvas.captureStream(24);v.muted=true;v.playsInline=true;v.srcObject=stream;void v.play();return stream;});
 const peers=clients.map((client,i)=>new PeerCamera(client,locals[i]));const tracker=new HandTracker();let tracking='Loading background tracker…',frames=0,raf=0,interval=0;let lastFrame=-1;
 cleanup=()=>{cancelAnimationFrame(raf);clearInterval(interval);peers.forEach(p=>p.stop());clients.forEach(c=>void c.leave());streams.forEach(s=>s.getTracks().forEach(t=>t.stop()));tracker.close();};
 const draw=(ts:number)=>{ctx.fillStyle='#125c69';ctx.fillRect(0,0,640,360);ctx.fillStyle='#aeffcc';ctx.fillRect((ts/8)%600,50,40,240);ctx.font='24px sans-serif';ctx.fillText('LIVE VIDEO TEST',200,180);raf=requestAnimationFrame(draw);};raf=requestAnimationFrame(draw);
 peers.forEach((peer,i)=>{peer.onVideo=video=>{const dest=document.getElementById(i?'two':'one') as HTMLVideoElement;if(dest.srcObject!==video?.srcObject)dest.srcObject=video?.srcObject??null;if(video)void dest.play().catch(()=>{});};clients[i].onState=state=>peer.update(state);});
 interval=window.setInterval(()=>{
  if(generation!==run)return;
  if(tracking==='Ready'&&locals[0].readyState>=2){try{const frame=tracker.detect(locals[0],performance.now());if(frame.timestampMs!==lastFrame){lastFrame=frame.timestampMs;frames++;}}catch{tracking='Tracking failed';}}
  output.textContent=clients.map((c,i)=>`Player ${i+1}: ${c.transport} / ${peers[i].status}`).join('\n')+`\nDecoded video frames: ${(document.getElementById('one') as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames} / ${(document.getElementById('two') as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames}\nTracking: ${tracking} / ${tracker.mode} / ${frames} results`;
 },100);
 try{
  await clients[0].connect();if(generation!==run)return;peers[0].start();
  while(!clients[0].state){if(generation!==run)return;await new Promise(r=>setTimeout(r,50));}
  await clients[1].connect(clients[0].state.code);if(generation!==run)return;peers[1].start();
  await tracker.initialize();if(generation!==run)return;tracking='Ready';
 }catch(error){tracking=(error as Error).message;}
};
window.addEventListener('pagehide',()=>{run++;cleanup();});
