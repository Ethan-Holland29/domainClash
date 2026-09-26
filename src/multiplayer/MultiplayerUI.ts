import { MultiplayerClient, type MatchSnapshot } from './MultiplayerClient';
import { MoveById,isDomain } from '../combat/MoveCatalog';
export class MultiplayerUI {
 private panel:HTMLElement;private hud:HTMLElement;private status:HTMLElement;private busy=false;private lastPhase="";
 constructor(client:MultiplayerClient,enter:()=>void,leave:()=>void,signal:AbortSignal,camera:()=>void){
  this.panel=document.createElement('section');this.panel.className='multiplayer-panel';this.panel.hidden=true;
  this.panel.innerHTML=`<div role="dialog" aria-modal="true" aria-label="Private multiplayer"><button class="mp-close" aria-label="Close multiplayer menu">×</button><p class="eyebrow">PRIVATE TWO-PLAYER MATCH</p><h2>Challenge a friend.</h2><p>Both players open the same server URL. Create a room and share its code.</p><p class="fine">Joining starts your camera and shares a live preview with this room’s opponent. No microphone or recording. You can stop your camera at any time.</p><button id="mp-camera">Enable / retry camera</button><p id="mp-camera-status" role="status"></p><div class="mp-connect"><button id="mp-create">Create private room</button><label>Match code<input id="mp-code" maxlength="10" autocomplete="off" placeholder="10-character code" /></label><button id="mp-join">Join room</button></div><div id="mp-room" hidden><p>Your room code</p><strong id="mp-room-code"></strong><p id="mp-wait"></p><button id="mp-ready">Ready to fight</button><button id="mp-leave">Leave room</button></div><p id="mp-status" role="status"></p><p class="fine">1-second shared attack recovery · 13–15s domain recovery · 100 HP · Energy regenerates. Guard with Space or the Guard button. Leaving or losing connection for 15 seconds forfeits. Camera previews are shared only within your room; hand recognition runs on your device. <a href="/connection-check.html" target="_blank" rel="noopener">Connection check</a></p></div>`;
  document.body.append(this.panel);this.status=this.panel.querySelector('#mp-status')!;
  this.hud=document.createElement('div');this.hud.className='multiplayer-hud';this.hud.hidden=true;document.querySelector('.camera-stage')!.append(this.hud);
  const q=(s:string)=>this.panel.querySelector<HTMLElement>(s)!;
  q('#mp-camera').onclick=()=>camera();
  q('.mp-close').onclick=()=>{this.panel.hidden=true;};
  const connect=async(code?:string)=>{if(this.busy)return;this.busy=true;this.status.textContent='Connecting…';try{await client.connect(code);enter();}catch(e){this.status.textContent=(e as Error).message;}finally{this.busy=false;}};
  q('#mp-create').onclick=()=>void connect();q('#mp-join').onclick=()=>{const code=(q('#mp-code') as HTMLInputElement).value.trim();if(!/^[A-Fa-f0-9]{10}$/.test(code)){this.message('Enter the 10-character room code');return;}void connect(code);};
  q('#mp-ready').onclick=()=>{void client.action('ready');this.panel.hidden=true;};
  q('#mp-leave').onclick=()=>{void client.leave();this.hud.hidden=true;q('#mp-room').hidden=true;q('.mp-connect').hidden=false;leave();this.message('Left the room.');};
  document.getElementById('multiplayer')!.addEventListener('click',()=>this.open(),{signal});
  this.panel.addEventListener('keydown',e=>{
    if(e.key==='Escape'){this.panel.hidden=true;e.stopPropagation();}
    if(e.key==='Tab'){const fields=Array.from(this.panel.querySelectorAll<HTMLElement>('button:not(:disabled),input')).filter(e=>e.offsetParent!==null);const index=fields.indexOf(document.activeElement as HTMLElement);fields[(index+(e.shiftKey?-1:1)+fields.length)%fields.length]?.focus();e.preventDefault();e.stopPropagation();}
  },{signal});
  this.hud.addEventListener('click',e=>{if((e.target as HTMLElement).closest('button'))void client.action('guard');},{signal});
 }
 open():void{this.panel.hidden=false;(this.panel.querySelector('button') as HTMLButtonElement).focus();}
 message(text:string):void{this.status.textContent=text;const toast=document.getElementById('status');if(toast)toast.textContent=text;}
 render(s:MatchSnapshot):void{
  if(s.phase!==this.lastPhase){this.lastPhase=s.phase;this.message(s.phase==='playing'?'Fight! One second between regular attacks. Space guards.':s.phase==='finished'?s.reason+' · Leave the room to start another match.':s.phase==='countdown'?'Both players ready. Get ready to fight.':'Share the code; both players must press Ready.');}
  this.panel.querySelector<HTMLElement>('.mp-connect')!.hidden=true;this.panel.querySelector<HTMLElement>('#mp-room')!.hidden=false;
  this.panel.querySelector('#mp-room-code')!.textContent=s.code;
  this.panel.querySelector('#mp-wait')!.textContent=s.phase==='waiting'?s.players[1]?'Opponent joined. Both players must be ready.':'Waiting for your friend…':s.phase==='finished'?s.reason:'Match in progress';
  (this.panel.querySelector('#mp-ready') as HTMLButtonElement).disabled=s.phase!=='waiting'||!!s.players[s.seat]?.ready;
  const me=s.players[s.seat]!,other=s.players[1-s.seat];
  const result=s.phase==='finished'?(s.winner===null?'DRAW':s.winner===s.seat?'VICTORY':'DEFEAT'):s.phase==='countdown'?`FIGHT IN ${Math.max(1,Math.ceil((s.startedAt-s.now)/1000))}`:s.phase==='waiting'?'WAITING FOR BOTH PLAYERS':`${Math.max(0,180-Math.floor((s.now-s.startedAt)/1000))}s`;
  this.hud.hidden=false;this.hud.innerHTML=`<div class="mp-health"><div>YOU · ${me.hp} HP<progress max="100" value="${me.hp}"></progress><small>ENERGY ${me.energy}/100</small></div><b>${result}</b><div>OPPONENT · ${other?.hp??100} HP<progress max="100" value="${other?.hp??100}"></progress><small>${s.phase==='finished'?'MATCH ENDED':other?'CONNECTED':'NOT JOINED'}</small></div></div><div class="mp-bottom"><span>${s.domains.length===2?'DOMAIN CLASH · SURE-HITS CANCELLED':s.domains.length?MoveById[s.domains[0].id].name:'ROOM '+s.code}</span><button ${s.phase!=='playing'?'disabled':''}>Guard · Space</button></div>`;
  for(const [i,b]of Array.from(document.querySelectorAll<HTMLElement>('[data-ability]')).entries()){
   const id=b.dataset.ability as keyof typeof MoveById,ms=(isDomain(id)?me.domainAt:me.regularAt)-s.now;
   b.querySelector('.technique-index')!.textContent=`${i+1} · ${ms>0?(ms/1000).toFixed(1)+'s':s.phase==='playing'?'READY':'WAIT'}`;
  }
 }
 dispose():void{this.panel.remove();this.hud.remove();}
}
