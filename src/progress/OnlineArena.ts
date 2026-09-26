import { MultiplayerClient, type MatchSnapshot } from '../multiplayer/MultiplayerClient';
import { PeerCamera } from '../multiplayer/PeerCamera';
import { MergedGestureRecognizer } from '../handTracking/MergedGestureRecognizer';
import { characterById } from '../characters/Characters';
import { MoveById, isDomain } from '../combat/MoveCatalog';
import type { AbilityId } from '../combat/AbilityTypes';
import type { TrackedHand } from './handTracking/HandTypes';
import { PORTRAITS } from './characters/Portraits';
import { MultiplayerSelect } from './characters/MultiplayerSelect';

export class OnlineArena {
  readonly client=new MultiplayerClient();
  readonly recognizer=new MergedGestureRecognizer();
  private relay:PeerCamera;
  private selection:MultiplayerSelect;
  private frameCanvas=document.createElement('canvas');
  private frame:ImageBitmap|null=null;
  private lastInference:number|null=null;
  private selected='gojo';
  private busy=false;
  private disposed=false;
  private connecting=0;
  private log:string[]=[];
  private phase='';
  private lastStats=0;
  private screenValue:'lobby'|'select'|'fight'='lobby';
  visible=false;
  onLock:(locked:boolean)=>void=()=>{};
  onScreen:()=>void=()=>{};
  onFighter:(id:string)=>void=()=>{};
  get screen(){return this.screenValue;}
  get inRoom():boolean{return !!this.client.state||this.client.connected;}
  private root:HTMLElement;
  private menu:HTMLElement;
  constructor(root:HTMLElement,video:HTMLVideoElement,remote:HTMLElement,menu:HTMLElement){
    this.root=root;this.menu=menu;
    remote.append(this.frameCanvas);
    this.relay=new PeerCamera(this.client,video);
    this.relay.onFrame=frame=>{this.frame?.close();this.frame=frame;this.drawRemote();};
    this.relay.onVideo=stream=>{const previous=remote.querySelector('video');if(previous===stream)return;previous?.remove();if(stream)remote.append(stream);this.frameCanvas.hidden=!!stream;};
    menu.innerHTML=`<section class="room-lobby"><header class="select-heading"><span class="selection-brand">DOMAIN CLASH</span><h1>MULTIPLAYER</h1></header><div class="room-form"><span class="room-eyebrow">PRIVATE MATCH / TWO SORCERERS</span><h2>Challenge a friend</h2><p>Create a room, share its code, then choose your fighters together.</p><button id="online-create">Create private match</button><div class="room-divider">OR JOIN A FRIEND</div><label for="online-code">Room code</label><input id="online-code" maxlength="10" autocomplete="off" placeholder="10-character code"><button id="online-join">Join private match</button><p id="lobby-message" role="status">Both players need this website’s address.</p><a href="#characters">← Back to character select</a></div></section><section id="network-selection" hidden></section>`;
    root.innerHTML=`<header class="duel-heading"><h2>DOMAIN CLASH</h2><span id="online-phase">ONLINE 1V1</span></header><p id="online-room"></p><div class="online-fighters"></div><details class="online-kit"><summary>Character kit</summary><p id="online-kit"></p></details><div class="actions"><button id="online-guard" disabled>Guard · Space</button><button id="online-leave">Leave match</button></div><div id="online-moves"></div><p id="online-message" role="status"></p><details><summary>Match rules</summary><p>100 HP · cursed energy regenerates · one second between attacks · 3-minute rounds. Domains use refinement and timing. Your confirmed character is locked until the next round. Hold a sign, then release before repeating.</p></details><details open class="combat-log"><summary>Battle log</summary><ol id="online-log"></ol></details>`;
    this.selection=new MultiplayerSelect(menu.querySelector('#network-selection')!,id=>void this.client.action('preview',{id}),async id=>{
      if(!await this.client.action('character',{id}))return false;
      this.selectMoves(id);this.onFighter(id);
      return this.client.action('ready');
    },()=>void this.leave());
    menu.querySelector<HTMLButtonElement>('#online-create')!.onclick=()=>void this.connect();
    menu.querySelector<HTMLButtonElement>('#online-join')!.onclick=()=>void this.connect(menu.querySelector<HTMLInputElement>('#online-code')!.value.trim());
    menu.querySelector<HTMLInputElement>('#online-code')!.onkeydown=e=>{if(e.key==='Enter')void this.connect(menu.querySelector<HTMLInputElement>('#online-code')!.value.trim());};
    this.q<HTMLButtonElement>('online-leave').onclick=()=>void this.leave();
    this.q<HTMLButtonElement>('online-guard').onclick=()=>void this.client.action('guard');
    this.client.onStatus=text=>this.message(text);
    this.client.onState=state=>{if(!this.disposed)this.render(state);};
    this.client.onEvent=event=>{
      if(event.type==='selection'){this.log=[];this.q('online-log').replaceChildren();return;}
      const name=event.id?MoveById[event.id]?.name??'':'';
      const text=event.type==='cast'?`${event.owner===this.client.state?.seat?'You':'Opponent'}: ${name}`:event.type==='clash'?'Domain clash!':event.type==='hit'?`${event.target===this.client.state?.seat?'You':'Opponent'} took ${event.damage} damage.`:event.type==='finished'?event.reason??'Match ended':event.type==='fight'?'Fight!':'';
      if(text){this.log.unshift(text);this.log=this.log.slice(0,12);this.q('online-log').replaceChildren(...this.log.map(line=>{const li=document.createElement('li');li.textContent=line;return li;}));}
      if(event.type==='cast'&&name&&this.visible){const reveal=document.getElementById('technique-reveal')!;reveal.textContent=name;reveal.classList.remove('burst');void reveal.offsetWidth;reveal.classList.add('burst');}
    };
    this.recognizer.onConfirmed(id=>this.cast(id));
    this.selectMoves('gojo');
  }
  private q<T extends HTMLElement=HTMLElement>(id:string):T{return this.root.querySelector<T>('#'+id)!;}
  setCharacter(id:string):void {if(!this.inRoom&&!this.busy){this.client.characterId=id;this.selectMoves(id);}}
  private selectMoves(id:string):void {
    if(this.selected===id&&this.root.querySelector('[data-ability]'))return;
    this.selected=id;
    const character=characterById(id);this.recognizer.setMoves(character.moves);
    this.q('online-kit').textContent=character.moves.map(id=>MoveById[id].name).join(' / ');
    this.q('online-moves').replaceChildren(...character.moves.map((id,i)=>{
      const card=document.createElement('article');card.className='online-move';
      const b=document.createElement('button');b.dataset.ability=id;b.disabled=true;b.onclick=()=>this.cast(id);
      const hint=document.createElement('p');hint.textContent=MoveById[id].sign;
      b.textContent=`${i+1} · ${MoveById[id].name}`;card.append(b,hint);return card;
    }));
  }
  private async connect(code?:string):Promise<void>{
    if(this.busy||this.inRoom)return;
    if(code!==undefined&&!/^[A-Fa-f0-9]{10}$/.test(code)){this.message('Enter the 10-character room code.');return;}
    this.busy=true;const attempt=++this.connecting;this.message('Connecting…');
    this.menu.querySelectorAll<HTMLButtonElement>('.room-form button').forEach(b=>b.disabled=true);
    try{await this.client.connect(code);if(this.disposed||attempt!==this.connecting)return;this.onLock(true);this.recognizer.reset();}
    catch(e){this.message(e instanceof Error?e.message:'Connection failed.');this.onLock(false);}
    finally{this.busy=false;this.menu.querySelectorAll<HTMLButtonElement>('.room-form button').forEach(b=>b.disabled=false);}
  }
  private message(text:string):void{
    this.q('online-message').textContent=text;this.menu.querySelector('#lobby-message')!.textContent=text;
    if(this.visible)document.querySelector('#combat-status')!.textContent=text;
  }
  private cast(id:AbilityId):void{if(this.visible&&this.client.state?.phase==='playing')void this.client.action('cast',{id});}
  key(event:KeyboardEvent):void {
    if(!this.visible||this.screen!=='fight'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement||event.target instanceof HTMLButtonElement)return;
    if(event.code==='Space'){event.preventDefault();void this.client.action('guard');return;}
    const id=characterById(this.selected).moves[Number(event.key)-1];if(id){event.preventDefault();this.cast(id);}
  }
  update(hands:TrackedHand[],now:number,aspect:number,fps=0){
    this.recognizer.aspectRatio=aspect;
    const dt=this.lastInference===null?0:Math.max(0,now-this.lastInference);this.lastInference=now;
    this.recognizer.update(hands.map(h=>({...h,score:h.handednessScore})),dt,now);
    if(this.inRoom&&now-this.lastStats>500){this.lastStats=now;void this.client.action('tracking',{hands:hands.length,fps:Math.min(240,Math.max(0,fps))});}
    return this.recognizer.state();
  }
  suspend():void{this.recognizer.suspend();this.lastInference=null;}
  cameraStopped():void{this.suspend();void this.relay.clear();if(this.inRoom)void this.client.action('tracking',{hands:0,fps:0});}
  private drawRemote():void{
    this.frameCanvas.width=this.frame?.width??640;this.frameCanvas.height=this.frame?.height??480;
    const ctx=this.frameCanvas.getContext('2d')!;ctx.clearRect(0,0,this.frameCanvas.width,this.frameCanvas.height);if(this.frame)ctx.drawImage(this.frame,0,0);
  }
  private setScreen(screen:'lobby'|'select'|'fight'):void{
    this.menu.querySelector<HTMLElement>('.room-lobby')!.hidden=screen!=='lobby';
    this.menu.querySelector<HTMLElement>('#network-selection')!.hidden=screen!=='select';
    if(this.screenValue!==screen){this.screenValue=screen;this.suspend();this.onScreen();}
  }
  private render(s:MatchSnapshot):void{
    const selection=s.phase==='waiting';
    this.onLock(true);
    if(selection){this.selection.update(s);this.relay.stop();}
    else if(s.phase==='finished')this.relay.stop();
    else {this.relay.start();this.relay.update(s);}
    const character=s.players[s.seat]?.characterId;if(character&&!selection)this.selectMoves(character);
    this.setScreen(selection?'select':'fight');
    this.q('online-room').textContent=`ROOM ${s.code} · ROUND ${s.round??1} · YOU ARE P${s.seat+1}`;
    this.q<HTMLButtonElement>('online-guard').disabled=s.phase!=='playing';
    const outcome=s.winner===null?'DRAW':s.winner===s.seat?'VICTORY':'DEFEAT';
    this.q('online-phase').textContent=s.phase==='finished'?outcome:s.phase==='countdown'?`FIGHT IN ${Math.max(1,Math.ceil((s.startedAt-s.now)/1000))}`:s.phase==='playing'?`${Math.max(0,180-Math.floor((s.now-s.startedAt)/1000))}s`:'SELECT FIGHTERS';
    const container=this.root.querySelector('.online-fighters')!;
    for(const seat of [0,1]){
      const p=s.players[seat],c=characterById(p?.characterId??'gojo');
      let card=container.children[seat] as HTMLElement|undefined;
      if(!card){card=document.createElement('div');card.className='duel-fighter';card.dataset.side=seat?'enemy':'player';card.innerHTML='<img alt=""><div class="duel-fighter-info"><small></small><strong></strong><div class="hp-track"><i></i></div><span class="hp-label"></span><div class="meter-track"><i></i></div><span class="meter-label"></span></div>';container.append(card);}
      const img=card.querySelector('img')!;img.hidden=!p;if(p&&img.getAttribute('src')!==PORTRAITS[c.id].image)img.src=PORTRAITS[c.id].image;
      card.querySelector('small')!.textContent=`P${seat+1} · ${seat===s.seat?'YOU':'OPPONENT'}`;card.querySelector('strong')!.textContent=p?c.name:'Waiting for player';
      card.querySelector<HTMLElement>('.hp-track i')!.style.width=`${p?.hp??100}%`;card.querySelector('.hp-label')!.textContent=`${p?.hp??100} / 100 HP`;
      card.querySelector<HTMLElement>('.meter-track i')!.style.width=`${p?.energy??100}%`;card.querySelector('.meter-label')!.textContent=`ENERGY ${p?.energy??100} / 100`;
    }
    const me=s.players[s.seat];
    this.root.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach((b,i)=>{const id=b.dataset.ability as AbilityId,ms=me?(isDomain(id)?me.domainAt:me.regularAt)-s.now:0;b.textContent=`${i+1} · ${MoveById[id].name}${ms>0?' · '+(ms/1000).toFixed(1)+'s':''}`;b.disabled=s.phase!=='playing'||ms>0;});
    const other=s.players[1-s.seat],stats=other?.tracking,fresh=stats&&s.now-stats.at<2500&&s.cameraActive?.[1-s.seat];
    document.querySelector('#remote-stats')!.textContent=fresh?`Hands detected: ${stats.hands} · FPS: ${stats.fps}`:'Hands detected: — · FPS: — · Camera off or waiting';
    document.querySelector('#local-camera-label')!.textContent=`P${s.seat+1} · YOU`;
    document.querySelector('#remote-camera-label')!.textContent=`P${2-s.seat} · OPPONENT`;
    document.querySelector<HTMLElement>('#app')!.dataset.seat=String(s.seat);
    const banner=document.querySelector<HTMLElement>('#match-result')!;
    banner.hidden=s.phase!=='finished'||!this.visible;
    if(s.phase==='finished'){
      banner.dataset.result=outcome.toLowerCase();
      banner.querySelector('h2')!.textContent=outcome;
      banner.querySelector('.result-player')!.textContent=`P${s.seat+1} · ${characterById(character??'gojo').name}`;
      banner.querySelector('.result-reason')!.textContent=`${s.reason} · Returning to fighter selection in ${Math.max(0,Math.ceil(((s.returnAt??s.now)-s.now)/1000))}s`;
    }
    if(this.phase!==s.phase){
      this.phase=s.phase;this.message(s.phase==='finished'?`${outcome} · ${s.reason}`:s.phase==='playing'?'Fight! Hold a sign or use the move buttons.':s.phase==='countdown'?'Both fighters confirmed. Get ready!':'Choose your fighter for the next round.');
    }
  }
  async leave():Promise<void>{
    this.connecting++;this.relay.stop();await this.client.leave();this.onLock(false);this.suspend();this.phase='';
    document.querySelector<HTMLElement>('#match-result')!.hidden=true;this.log=[];this.q('online-log').replaceChildren();
    this.setScreen('lobby');this.message('Room left. Create or join another private match.');this.onScreen();
  }
  dispose():void{this.disposed=true;this.connecting++;this.selection.dispose();this.relay.stop();this.frame?.close();this.frame=null;void this.client.leave();}
}
