import {MultiplayerClient,type MatchSnapshot} from './MultiplayerClient';
import {PeerCamera} from './PeerCamera';
import {CHARACTERS} from '../characters/Characters';
import {PORTRAITS} from '../characters/Portraits';
import {PASSIVE_CUES} from '../combat/CombatRules';
import {CombatManager,type CombatAction} from '../combat/CombatManager';
import {CombatPanel} from '../combat/CombatPanel';
import {GESTURE_LABELS} from '../handTracking/GestureTypes';
import {signHint} from '../integration/Signs';
import {validOrigin,type HandOrigin} from '../effects/MovePalette';

export class MultiplayerSession {
 active=false;
 handOrigin:HandOrigin|null=null;
 onCast:(action:CombatAction,origin:HandOrigin,remote:boolean,characterId:string,age:number,blackFlash:boolean)=>void=()=>{};
 onReset:()=>void=()=>{};
 onWin:(id:string,age:number)=>void=()=>{};
 private lastViewAt=0;
 readonly client=new MultiplayerClient();
 private peer:PeerCamera;
 private app:HTMLElement;private combat:CombatManager;private panel:CombatPanel;
 private screen:HTMLElement;private lobby:HTMLDialogElement;private remote:HTMLElement;
 private choose:(id:string)=>void;private startCamera:()=>Promise<void>;private reset:()=>void;
 private lastRound=0;private lastPhase='';private lastTelemetry=0;private frame=0;private desired='gojo';private joining=false;private confirming=false;private selectionJob:Promise<void>|null=null;
 constructor(app:HTMLElement,combat:CombatManager,panel:CombatPanel,video:HTMLVideoElement,choose:(id:string)=>void,startCamera:()=>Promise<void>,reset:()=>void){
  this.app=app;this.combat=combat;this.panel=panel;this.choose=choose;this.startCamera=startCamera;this.reset=reset;
  this.screen=document.createElement('section');this.screen.id='multiplayer-selection';this.screen.hidden=true;app.append(this.screen);
  this.screen.innerHTML=`<div class="selection-scenery"></div><header class="select-heading"><span class="selection-brand">DOMAIN CLASH</span><h1>PRIVATE MATCH</h1><span class="mp-room"></span></header><div class="mp-select-layout"><article class="mp-hero" data-seat="0"></article><div class="mp-roster"><div class="roster-label"><b class="mp-seat"></b><span>SELECT YOUR SORCERER</span></div><div class="portrait-grid" aria-label="Multiplayer character roster"></div><p class="select-hint">Hover or use arrow keys to browse</p><button class="mp-confirm">Confirm fighter →</button><p class="mp-selection-status" role="status"></p></div><article class="mp-hero" data-seat="1"></article></div><footer class="selection-footer"><span>PRIVATE BATTLE / CHOOSE TOGETHER</span><button class="mp-bot">Play with bot</button></footer>`;
  CHARACTERS.forEach((c,i)=>{const b=document.createElement('button');b.className='portrait-card';b.setAttribute('aria-label',c.name);b.innerHTML=`<img class="portrait-art" src="${PORTRAITS[c.id].image}" alt=""><span class="tile-name">${c.name}</span>`;
   const select=()=>{if(this.confirming||this.client.state?.players[this.client.state.seat]?.ready)return;this.desired=c.id;void this.selectDesired();};b.onmouseenter=select;b.onfocus=select;b.onclick=select;
   b.onkeydown=e=>{const offsets:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowDown:3,ArrowUp:-3};if(e.key in offsets){e.preventDefault();this.screen.querySelectorAll<HTMLButtonElement>('.portrait-card')[(i+offsets[e.key]+9)%9].focus();}};this.screen.querySelector('.portrait-grid')!.append(b);});
  this.screen.querySelector<HTMLButtonElement>('.mp-confirm')!.onclick=()=>void this.confirm();
  this.screen.querySelector<HTMLButtonElement>('.mp-bot')!.onclick=()=>void this.leave();
  this.lobby=document.createElement('dialog');this.lobby.className='multiplayer-dialog';this.lobby.innerHTML=`<h2>PRIVATE MATCH</h2><p>Create a room and share its code, or join a friend.</p><button class="create-room">Create private match</button><label>Room code<input class="room-code" maxlength="10" autocomplete="off" placeholder="ENTER CODE"></label><button class="join-room">Join private match</button><p class="lobby-status" role="status"></p><button class="cancel-room">Back</button>`;app.append(this.lobby);
  this.lobby.querySelector<HTMLButtonElement>('.create-room')!.onclick=()=>void this.connect();this.lobby.querySelector<HTMLButtonElement>('.join-room')!.onclick=()=>void this.connect(this.lobby.querySelector<HTMLInputElement>('input')!.value.trim());
  this.lobby.querySelector<HTMLButtonElement>('.cancel-room')!.onclick=()=>this.lobby.close();
  const open=document.createElement('button');open.id='open-multiplayer';open.textContent='Multiplayer';open.onclick=()=>this.lobby.showModal();app.querySelector('.selection-footer')!.append(open);
  this.remote=document.createElement('section');this.remote.className='remote-camera-column';this.remote.hidden=true;this.remote.innerHTML=`<div class="stage"><video autoplay muted playsinline></video><canvas hidden></canvas><span class="remote-camera-label">OPPONENT CAMERA</span></div><div class="debug-hud remote-hud">Waiting for opponent camera</div>`;app.querySelector('.workspace')!.append(this.remote);
  const exit=document.createElement('button');exit.id='leave-room';exit.textContent='Leave match';exit.hidden=true;exit.onclick=()=>void this.leave();app.querySelector('.topbar')!.append(exit);
  this.peer=new PeerCamera(this.client,video);
  this.peer.onVideo=remote=>{const v=this.remote.querySelector('video')!;if(v.srcObject!==(remote?.srcObject??null)){v.srcObject=remote?.srcObject??null;if(v.srcObject)void v.play().catch(()=>{});}v.hidden=!remote;if(remote)this.remote.querySelector('canvas')!.hidden=true;};
  this.peer.onFrame=frame=>{const canvas=this.remote.querySelector('canvas')!;canvas.hidden=!frame;if(frame){canvas.width=frame.width;canvas.height=frame.height;canvas.getContext('2d')!.drawImage(frame,0,0);frame.close();}};
  this.client.onState=s=>this.update(s);this.client.onStatus=text=>{this.lobby.querySelector('.lobby-status')!.textContent=text;this.screen.querySelector('.mp-selection-status')!.textContent=text;if(this.active&&this.lastPhase!=='waiting')app.querySelector('#combat-status')!.textContent=text;};
  this.client.onExpired=()=>void this.leave();
  this.client.onEvent=e=>{const s=this.client.state;if(e.type==='cast'&&e.id&&s&&e.round===s.round&&s.now-(e.at??0)<1800)this.onCast(e.id,validOrigin(e.origin)??{x:.5,y:.6},e.owner!==s.seat,s.players[e.owner??s.seat]?.characterId??'',Math.max(0,s.now-(e.at??s.now)),e.blackFlash===true);};
  const draw=()=>{if(this.active&&this.client.state){this.peer.update(this.client.state);}this.frame=requestAnimationFrame(draw);};draw();
 }
 private selectDesired(){if(this.selectionJob)return this.selectionJob;this.selectionJob=(async()=>{try{let sent='';while(this.active&&sent!==this.desired){sent=this.desired;const ok=await this.client.action('select',{id:sent,round:this.client.state?.round});if(!ok)break;}}finally{this.selectionJob=null;}})();return this.selectionJob;}
 private async confirm(){if(this.confirming)return;this.confirming=true;try{await this.selectionJob;const state=this.client.state;if(!state||!this.active)return;if(await this.client.action('select',{id:this.desired,round:state.round}))await this.client.action('ready',{round:state.round});}finally{this.confirming=false;}}
 private async connect(code?:string){
  if(this.joining)return;if(code!==undefined&&!code){this.lobby.querySelector('.lobby-status')!.textContent='Enter the room code.';return;}
  this.joining=true;this.lobby.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await this.client.connect(code);this.active=true;this.lastPhase='';this.lastRound=0;this.desired='gojo';this.peer.start();this.panel.networkSend=a=>void this.attack(a);this.lobby.close();if(this.client.state)this.update(this.client.state);void this.startCamera();}
  catch(e){this.lobby.querySelector('.lobby-status')!.textContent=(e as Error).message;}
  finally{this.joining=false;this.lobby.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 async attack(action:CombatAction){const state=this.client.state;if(!state||state.phase!=='playing')return;await this.client.action('cast',{id:action,round:state.round,origin:this.handOrigin});}
 telemetry(hands:number,fps:number,camera:boolean){if(!this.active||performance.now()-this.lastTelemetry<1000)return;this.lastTelemetry=performance.now();void this.client.action('telemetry',{hands,fps,camera});}
 private hero(seat:number,state:MatchSnapshot){
  const target=this.screen.querySelector<HTMLElement>(`[data-seat="${seat}"]`)!,player=state.players[seat],c=CHARACTERS.find(c=>c.id===player?.characterId);
  const key=`${player?.characterId}:${player?.ready}`;if(target.dataset.key===key)return;target.dataset.key=key;
  if(!c||!player){target.innerHTML=`<span class="player-badge">P${seat+1}</span><h2>WAITING FOR PLAYER</h2><p>Share room ${state.code}</p>`;return;}
  target.style.setProperty('--fighter-color',PORTRAITS[c.id].color);
  target.innerHTML=`<img class="mp-hero-art" src="${PORTRAITS[c.id].image}" alt="${c.name}"><div class="mp-hero-copy"><span class="player-badge">P${seat+1}${player.ready?' / READY':''}</span><h2>${c.name}</h2><div class="technique-banner select-passive"><p>Passive ability: ${PASSIVE_CUES[c.id].name}</p></div><div class="technique-banner"><span>TECHNIQUE</span>${c.abilities.map(g=>`<p>${GESTURE_LABELS[g]}</p><small>${signHint(g)}</small>`).join('')}</div><div class="technique-banner ultimate-banner"><span>ULTIMATE</span><h3>${c.ultimate?.name??'None'}</h3><small>${c.ultimate?signHint(c.ultimate.gesture):'No ultimate assigned.'}</small></div></div>`;
 }
 update(state:MatchSnapshot){
  if(!this.active)return;
  const now=performance.now();if(this.lastPhase===state.phase&&this.lastRound===state.round&&now-this.lastViewAt<100)return;this.lastViewAt=now;
  const selection=state.phase==='waiting';
  if(this.lastPhase!==state.phase||this.lastRound!==state.round){
   this.reset();this.onReset();this.lastPhase=state.phase;this.lastRound=state.round;
   if(state.phase==='finished'&&state.winner!==null){const winner=state.players[state.winner];if(winner)this.onWin(winner.characterId,Math.max(0,state.now-(state.finishedAt??state.now)));}
   const own=state.players[state.seat];if(own){this.choose(own.characterId);this.desired=own.characterId;}
  }
  this.app.dataset.multiplayer='true';this.app.dataset.seat=String(state.seat);this.app.dataset.mode=selection?'selection':'combat';this.app.dataset.page='combat';
  this.app.querySelector<HTMLElement>('#character-screen')!.hidden=true;this.screen.hidden=!selection;
  this.app.querySelector<HTMLElement>('.workspace')!.hidden=selection;this.app.querySelector<HTMLElement>('.topbar')!.hidden=selection;this.remote.hidden=selection;
  this.app.querySelector<HTMLSelectElement>('#character')!.disabled=true;this.app.querySelector<HTMLElement>('.topbar a[href="#characters"]')!.hidden=true;
  this.app.querySelector<HTMLElement>('#settings-link')!.hidden=true;this.app.querySelector<HTMLElement>('#back-to-combat')!.hidden=true;this.app.querySelector<HTMLElement>('#leave-room')!.hidden=false;
  this.app.querySelector<HTMLElement>('.mode-tabs')!.hidden=true;this.app.querySelectorAll<HTMLElement>('.panel-area > section').forEach(el=>el.hidden=el.id!=='combat');
  this.screen.querySelector('.mp-room')!.textContent=`ROOM ${state.code}`;this.screen.querySelector('.mp-seat')!.textContent=`P${state.seat+1}`;
  this.hero(0,state);this.hero(1,state);
  this.screen.querySelectorAll<HTMLButtonElement>('.portrait-card').forEach((b,i)=>{b.setAttribute('aria-pressed',String(CHARACTERS[i].id===state.players[state.seat]?.characterId));b.disabled=!!state.players[state.seat]?.ready;});
  const confirm=this.screen.querySelector<HTMLButtonElement>('.mp-confirm')!;confirm.disabled=this.confirming||!state.players[1]||!!state.players[state.seat]?.ready;confirm.textContent=state.players[state.seat]?.ready?'Fighter confirmed':'Confirm fighter →';
  if(selection)this.screen.querySelector('.mp-selection-status')!.textContent=!state.players[1]?'Waiting for P2 to join.':state.players[state.seat]?.ready?'Waiting for your opponent to confirm.':state.reason?`${state.reason}. Choose fighters for the next round.`:'Choose your fighter, then confirm.';
  const opponent=state.players[1-state.seat];this.remote.querySelector('.remote-hud')!.textContent=`P${2-state.seat} · Hands: ${opponent?.telemetry.hands??0} detected · FPS: ${opponent?.telemetry.fps??0} · ${this.peer.status}`;
  this.remote.querySelector('.remote-camera-label')!.textContent=`P${2-state.seat} / ${opponent?.telemetry.camera?'LIVE':'CAMERA OFF'}`;
  if(state.game){
   const g=state.game;const restore=(f:any)=>({...f,usedSummons:new Set(f.usedSummons),borrowedSummons:new Set(f.borrowedSummons),cooldowns:new Map(f.cooldowns)});
   this.combat.player=restore(state.seat===0?g.player:g.opponent);this.combat.opponent=restore(state.seat===0?g.opponent:g.player);
   this.combat.turn=(g.turn==='player')===(state.seat===0)?'player':'enemy';this.combat.turnNumber=g.turnNumber;
   this.combat.status=state.phase==='finished'?(state.winner===state.seat?'won':'lost'):state.phase==='playing'?'playing':'ready';
   const sharedText=(text:string)=>text.replace(/Your turn\./g,'P1’s turn.').replace(/Opponent’s turn\./g,'P2’s turn.').replace('Victory! The opponent has fallen.','P1 wins.').replace('Defeat. Restart to try again.','P2 wins.');
   this.combat.message=sharedText(g.message);this.combat.log=g.log.map(sharedText);this.combat.technique=g.technique;this.combat.techniqueSerial=state.round*100000+g.techniqueSerial;
   this.combat.passivePopup=g.passivePopup?{...g.passivePopup,serial:state.round*100000+g.passivePopup.serial,side:(g.passivePopup.side==='player')===(state.seat===0)?'player':'enemy'}:null;
   this.panel.render();
   if(g.passivePopup)this.app.querySelector('.passive-owner')!.textContent=`PLAYER ${g.passivePopup.side==='player'?1:2} · ${g.passivePopup.character}`;
   const stats=this.app.querySelector('#fight-stats')!;Array.from(stats.children).forEach((el,i)=>{(el as HTMLElement).style.order=String(state.seat===0?i:1-i);el.querySelector('small')!.textContent=`PLAYER ${i===0?state.seat+1:2-state.seat}${this.combat.turn===(i===0?'player':'enemy')&&state.phase==='playing'?' / YOUR MOVE':''}`;});
   this.app.querySelector('#duel-turn')!.textContent=state.phase==='countdown'?`START IN ${Math.max(1,Math.ceil((state.startedAt-state.now)/1000))}`:state.phase==='finished'?`${state.winner===null?'DRAW':`P${state.winner+1} WINS`} / ${state.players.every(Boolean)?'RETURNING TO SELECT':state.reason+' — Leave match'}`:`TURN ${g.turnNumber} / P${g.turn==='player'?1:2}`;
  }
 }
 async leave(){this.active=false;this.onReset();this.peer.stop();await this.client.leave();this.panel.networkSend=null;delete this.app.dataset.multiplayer;delete this.app.dataset.seat;this.screen.hidden=true;this.remote.hidden=true;this.app.querySelector<HTMLElement>('#leave-room')!.hidden=true;this.app.querySelector<HTMLElement>('.topbar a[href="#characters"]')!.hidden=false;this.app.querySelector<HTMLSelectElement>('#character')!.disabled=false;this.combat.reset();location.hash='characters';window.dispatchEvent(new Event('hashchange'));}
 dispose(){cancelAnimationFrame(this.frame);this.peer.stop();void this.client.leave();}
}
