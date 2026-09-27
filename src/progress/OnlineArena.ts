import type { EffectCue } from './rendering/CharacterEffects';
import { MultiplayerClient, type MatchSnapshot } from '../multiplayer/MultiplayerClient';
import { PeerCamera } from '../multiplayer/PeerCamera';
import { MultiplayerSelect } from './characters/MultiplayerSelect';
import { characterAudio } from './audio/CharacterAudio';
import { BattlePlayback } from './combat/BattlePlayback';
import { moveSummary, renderFighterCards, showBattleLine } from './combat/CombatPanel';
import { GESTURE_LABELS, type GestureType } from './handTracking/GestureTypes';
import { CHARACTERS as KITS, MOVES, moveFor, moveOptions, mustSkipTurn, type BattleEvent, type BattleState, type Side } from '../../shared/battle.mjs';

/**
 * Online 1v1: the same turn-based battle as solo, resolved by the server.
 * Both players lock in a move (hand sign, button or number key); when both
 * have chosen, or the turn timer runs out, the server resolves the turn and
 * each client plays back the battle text.
 */
export class OnlineArena {
  readonly client=new MultiplayerClient();
  readonly playback=new BattlePlayback();
  private relay:PeerCamera;
  private selection:MultiplayerSelect;
  private frameCanvas=document.createElement('canvas');
  private frame:ImageBitmap|null=null;
  private busy=false;
  private disposed=false;
  private connecting=0;
  private phase='';
  private lastStats=0;
  private seenLine=-1;
  private buttonsKey='';
  private autoSkipKey='';
  /** Which battle the playback is showing (round), so a refresh mid-fight resynchronises. */
  private shownRound=-1;
  private screenValue:'lobby'|'select'|'fight'='lobby';
  visible=false;
  onEffect:(cue:EffectCue)=>void=()=>{};
  onVoiceEvent:(event:BattleEvent,state:BattleState)=>void=()=>{};
  onLock:(locked:boolean)=>void=()=>{};
  onScreen:()=>void=()=>{};
  onFighter:(id:string)=>void=()=>{};
  beforeReady:()=>Promise<boolean>=async()=>true;
  get screen(){return this.screenValue;}
  get inRoom():boolean{return !!this.client.state||this.client.connected;}
  private root:HTMLElement;
  private menu:HTMLElement;
  constructor(root:HTMLElement,video:HTMLVideoElement,remote:HTMLElement,menu:HTMLElement){
    this.root=root;this.menu=menu;
    remote.append(this.frameCanvas);
    this.relay=new PeerCamera(this.client,video);
    this.relay.onStatus=status=>{const label=document.querySelector<HTMLElement>('#remote-video-status');if(label)label.textContent=`Video: ${status}`;};
    this.relay.onStatus(this.relay.status);
    this.relay.onFrame=frame=>{this.frame?.close();this.frame=frame;this.drawRemote();};
    this.relay.onVideo=stream=>{const previous=remote.querySelector('video');if(previous===stream)return;previous?.remove();if(stream)remote.append(stream);this.frameCanvas.hidden=!!stream;};
    this.playback.onEffect=cue=>{if(this.visible)this.onEffect(cue);};
    this.playback.onEvent=(event,state)=>{if(this.visible)this.onVoiceEvent(event,state);};
    menu.innerHTML=`<section class="room-lobby"><header class="select-heading"><span class="selection-brand">DOMAIN CLASH</span><h1>MULTIPLAYER</h1></header><div class="room-form"><span class="room-eyebrow">PRIVATE MATCH / TWO SORCERERS</span><h2>Challenge a friend</h2><p>Create a room, share its code, then choose your fighters together.</p><button id="online-create">Create private match</button><div class="room-divider">OR JOIN A FRIEND</div><label for="online-code">Room code</label><input id="online-code" maxlength="10" autocomplete="off" placeholder="10-character code"><button id="online-join">Join private match</button><p id="lobby-message" role="status">Both players need this website’s address.</p><a href="#characters">← Back to character select</a></div></section><section id="network-selection" hidden></section>`;
    root.innerHTML=`<header class="duel-heading"><h2>DOMAIN CLASH</h2><span id="online-phase">ONLINE 1V1</span></header><p id="online-room"></p><div class="online-fighters"></div><p id="online-battle-text" class="battle-text" role="status" aria-live="polite"></p><p id="online-turn" class="turn-status"></p><div id="online-moves" class="actions"></div><div class="actions"><button id="online-skip" hidden>Skip text ▸</button><button id="online-leave">Leave match</button></div><p id="online-message" role="status"></p><details><summary>Match rules</summary><p>Each round both players lock in a move (hold a sign, click a move, or press its number; Space is Guard). Guard resolves before attacks and blocks direct attacks for the round, but not ultimates or passives. Other moves resolve in a coin-flip order. Guard cannot be used on consecutive turns. If the timer runs out, a move is chosen automatically.</p><p>Fighters have 200 HP and start with 0 meter, except Sukuna, who starts at 175 HP and can hold 150 meter. Basic Punch usually deals 10 damage and gains 5 meter; Sukuna deals 5, Toji deals 15 and gains 10, and Yuji may land a double-damage Black Flash. Punches can miss 10% of the time. Techniques usually gain 20 meter and can miss 5%. Meter does not regenerate. Ultimates spend all meter; Yuji's Straight Hands needs 80, and other ultimates need 100.</p><p>Cooldowns apply after an attempt, including a miss: Red and Blue wait three turns, Granite Blast one turn, and other regular techniques two turns. Megumi's summons and ultimates have no cooldown. The move cards show each character's descriptions, costs, cooldowns, passives, and effects. Mahoraga replaces Megumi with 50 HP after three enemy responses. He can be summoned below 70 HP and starts with 20% damage reduction, which falls by 4 points each turn.</p><p>Supernova makes its target skip one turn to wipe blood, then deals 2 damage per consumed stack at the start of the next two turns. Passives and summons resolve as described in each move card and are also shown in the battle log and callouts.</p></details><details open class="combat-log"><summary>Battle log</summary><ol id="online-log" aria-live="off"></ol></details><div id="online-music-slot"></div>`;
    this.selection=new MultiplayerSelect(menu.querySelector('#network-selection')!,id=>void this.client.action('preview',{id}),async id=>{
      if(!await this.client.action('character',{id}))return false;
      this.onFighter(id);
      if(!await this.beforeReady())return false;
      return this.client.action('ready');
    },()=>void this.leave(),id=>void this.client.action('selection-voice',{id}));
    menu.querySelector<HTMLButtonElement>('#online-create')!.onclick=()=>void this.connect();
    menu.querySelector<HTMLButtonElement>('#online-join')!.onclick=()=>void this.connect(menu.querySelector<HTMLInputElement>('#online-code')!.value.trim());
    menu.querySelector<HTMLInputElement>('#online-code')!.onkeydown=e=>{if(e.key==='Enter')void this.connect(menu.querySelector<HTMLInputElement>('#online-code')!.value.trim());};
    this.q<HTMLButtonElement>('online-leave').onclick=()=>void this.leave();
    this.q<HTMLButtonElement>('online-skip').onclick=()=>{this.playback.skip();this.renderBattle();};
    this.client.onStatus=text=>this.message(text);
    this.client.onState=state=>{if(!this.disposed)this.render(state);};
    this.client.onEvent=event=>{
      const s=this.client.state;
      if(event.type==='selection-voice'&&event.owner!==s?.seat&&event.characterId)characterAudio.playSelectionVoice(event.characterId);
      if(event.type==='selection'){this.shownRound=-1;this.q('online-log').replaceChildren();return;}
      if(event.type==='fight'&&s?.battle){this.shownRound=s.round??1;this.playback.reset(s.battle,s.seat as Side,'Fight! Choose your move.');}
      if(event.type==='turn'&&event.lines&&s?.battle){this.sync(s);this.playback.play(s.battle,event.lines);this.message('');}
      if(event.type==='timeout'&&s)this.playback.show(event.owner===s.seat?'Time ran out: a move was chosen for you.':'Your opponent ran out of time.',null);
      if(event.type==='finished'&&event.reason)this.playback.show(event.reason,null);
      this.renderBattle();
    };
  }
  private q<T extends HTMLElement=HTMLElement>(id:string):T{return this.root.querySelector<T>('#'+id)!;}
  setCharacter(id:string):void {if(!this.inRoom&&!this.busy)this.client.characterId=id;}
  private async connect(code?:string):Promise<void>{
    if(this.busy||this.inRoom)return;
    if(code!==undefined&&!/^[A-Fa-f0-9]{10}$/.test(code)){this.message('Enter the 10-character room code.');return;}
    this.busy=true;const attempt=++this.connecting;this.message('Connecting…');
    this.menu.querySelectorAll<HTMLButtonElement>('.room-form button').forEach(b=>b.disabled=true);
    try{await this.client.connect(code);if(this.disposed||attempt!==this.connecting)return;this.onLock(true);}
    catch(e){this.message(e instanceof Error?e.message:'Connection failed.');this.onLock(false);}
    finally{this.busy=false;this.menu.querySelectorAll<HTMLButtonElement>('.room-form button').forEach(b=>b.disabled=false);}
  }
  private message(text:string):void{
    this.q('online-message').textContent=text;this.menu.querySelector('#lobby-message')!.textContent=text;
    if(this.visible)document.querySelector('#combat-status')!.textContent=text;
  }
  /** Why this move cannot be locked in right now, or null. */
  private blocked(id:string):string|null{
    const s=this.client.state;
    if(!s||s.phase!=='playing'||!s.battle)return 'Wait for the fight to start';
    if(s.players[s.seat]?.chosen)return 'Move locked in: waiting for your opponent';
    const option=moveOptions(s.battle,s.seat as Side).find(o=>o.id===id);
    return option?option.reason:'Not in your kit';
  }
  /** Locks in a move for this turn (from a hand sign, button or key). */
  choose(id:string):void{
    if(!this.visible)return;
    const reason=this.blocked(id);
    if(reason){this.message(reason);return;}
    void this.client.action('move',{id}).then(ok=>{if(ok)this.message('Move locked in. Waiting for your opponent…');});
  }
  key(event:KeyboardEvent):void {
    if(!this.visible||this.screen!=='fight'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement||event.target instanceof HTMLButtonElement)return;
    const s=this.client.state;if(!s?.battle)return;
    if(event.code==='Space'){event.preventDefault();this.choose('GUARD');return;}
    const options=moveOptions(s.battle,s.seat as Side).filter(o=>o.id!=='GUARD');
    const id=options[Number(event.key)-1]?.id;if(id){event.preventDefault();this.choose(id);}
  }
  /** Sends hand-tracking stats for the opponent's camera panel (throttled). */
  reportTracking(hands:number,fps:number,now:number):void{
    if(this.inRoom&&now-this.lastStats>500){this.lastStats=now;void this.client.action('tracking',{hands,fps:Math.min(240,Math.max(0,fps))});}
  }
  tick(deltaMs:number):void{if(this.playback.playing){this.playback.tick(deltaMs);this.renderBattle();}}
  suspend():void{/* Recognition is shared with solo and suspended by the page. */}
  cameraStopped():void{void this.relay.clear();if(this.inRoom)void this.client.action('tracking',{hands:0,fps:0});}
  private drawRemote():void{
    this.frameCanvas.width=this.frame?.width??640;this.frameCanvas.height=this.frame?.height??480;
    const ctx=this.frameCanvas.getContext('2d')!;ctx.clearRect(0,0,this.frameCanvas.width,this.frameCanvas.height);if(this.frame)ctx.drawImage(this.frame,0,0);
  }
  private setScreen(screen:'lobby'|'select'|'fight'):void{
    this.menu.querySelector<HTMLElement>('.room-lobby')!.hidden=screen!=='lobby';
    this.menu.querySelector<HTMLElement>('#network-selection')!.hidden=screen!=='select';
    if(this.screenValue!==screen){this.screenValue=screen;this.onScreen();}
  }
  /** Joined (or refreshed) mid-fight: show the current battle without replaying it. */
  private sync(s:MatchSnapshot):void{
    if(!s.battle||this.shownRound===(s.round??1))return;
    this.shownRound=s.round??1;this.playback.reset(s.battle,s.seat as Side,'Choose your move.');
  }
  private render(s:MatchSnapshot):void{
    const selection=s.phase==='waiting';
    this.onLock(true);
    if(selection){this.selection.update(s);this.relay.stop();}
    else if(s.phase==='finished')this.relay.stop();
    else {this.relay.start();this.relay.update(s);}
    const character=s.players[s.seat]?.characterId;
    if(character&&!selection&&character!==this.client.characterId){this.client.characterId=character;this.onFighter(character);}
    this.setScreen(selection?'select':'fight');
    this.sync(s);
    this.q('online-room').textContent=`ROOM ${s.code} · ROUND ${s.round??1} · YOU ARE P${s.seat+1}`;
    const outcome=s.winner===null?'DRAW':s.winner===s.seat?'VICTORY':'DEFEAT';
    this.q('online-phase').textContent=s.phase==='finished'?outcome:s.phase==='countdown'?`FIGHT IN ${Math.max(1,Math.ceil((s.startedAt-s.now)/1000))}`:s.phase==='playing'&&s.battle?`TURN ${s.battle.turn}`:'SELECT FIGHTERS';
    this.renderBattle();
    const other=s.players[1-s.seat],stats=other?.tracking,fresh=stats&&s.now-stats.at<2500&&s.cameraActive?.[1-s.seat];
    document.querySelector('#remote-stats')!.textContent=fresh?`Hands detected: ${stats.hands} · FPS: ${stats.fps}`:'Hands detected: — · FPS: — · Camera off or waiting';
    document.querySelector('#local-camera-label')!.textContent=`P${s.seat+1} · YOU`;
    document.querySelector('#remote-camera-label')!.textContent=`P${2-s.seat} · OPPONENT`;
    document.querySelector<HTMLElement>('#app')!.dataset.seat=String(s.seat);
    const banner=document.querySelector<HTMLElement>('#match-result')!;
    // Let the final turn's text finish before the result banner covers it.
    banner.hidden=s.phase!=='finished'||!this.visible||this.playback.playing;
    if(s.phase==='finished'){
      banner.dataset.result=outcome.toLowerCase();
      banner.querySelector('h2')!.textContent=outcome;
      banner.querySelector('.result-player')!.textContent=`P${s.seat+1} · ${KITS[character??'gojo']?.name??''}`;
      banner.querySelector('.result-reason')!.textContent=`${s.reason} · Returning to fighter selection in ${Math.max(0,Math.ceil(((s.returnAt??s.now)-s.now)/1000))}s`;
    }
    if(this.phase!==s.phase){
      this.phase=s.phase;this.message(s.phase==='finished'?`${outcome} · ${s.reason}`:s.phase==='playing'?'Fight! Hold a sign or use the move buttons.':s.phase==='countdown'?'Both fighters confirmed. Get ready!':'Choose your fighter for the next round.');
    }
  }
  /** Fighter cards, battle text, turn status and move buttons. */
  private renderBattle():void{
    const s=this.client.state;
    const battle=s?.battle;
    const fighters=this.root.querySelector('.online-fighters')!;
    if(!s||!battle){fighters.replaceChildren();this.q('online-moves').replaceChildren();this.buttonsKey='';this.q('online-turn').textContent='';return;}
    const seat=s.seat as Side;
    renderFighterCards(fighters,battle,this.playback,seat);
    const line=this.playback.line;
    if(line.serial!==this.seenLine){
      this.seenLine=line.serial;
      showBattleLine(this.q('online-battle-text'),battle,line,seat);
      const log=this.q('online-log');
      log.replaceChildren(...this.playback.log.slice(0,20).map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
      log.scrollTop=0;
    }
    this.q<HTMLButtonElement>('online-skip').hidden=!this.playback.playing;
    const me=s.players[seat],other=s.players[1-seat];
    const seconds=Math.max(0,Math.ceil((s.deadline-s.now)/1000));
    this.q('online-turn').textContent=s.phase!=='playing'?'':me?.chosen?`Locked in: ${me.choice?(MOVES[moveFor(battle.sides[seat],me.choice)]?.name??me.choice):'move'} · ${other?.chosen?'resolving…':'waiting for your opponent'}`
      :`Choose your move${seconds<=30?` · ${seconds}s`:''}${other?.chosen?' · Opponent has chosen':''}${battle.sides[seat].stunned?' · You are stunned: this move will be lost':''}`;
    const options=moveOptions(battle,seat);
    const key=`${battle.sides[seat].id}:${battle.sides[seat].mahoraga}:${options.map(o=>o.id).join(',')}`;
    const host=this.q('online-moves');
    if(key!==this.buttonsKey){
      this.buttonsKey=key;
      let n=0;
      host.replaceChildren(...options.map(o=>{
        const b=document.createElement('button');b.className='move-button';b.dataset.action=o.id;
        b.innerHTML='<span class="move-name"></span><span class="move-meta"></span><span class="move-reason"></span>';
        b.querySelector('.move-name')!.textContent=`${o.id==='GUARD'?'Space':++n} · ${o.name}`;
        b.onclick=()=>this.choose(o.id);
        return b;
      }));
    }
    for(const o of options){
      const b=host.querySelector<HTMLButtonElement>(`[data-action="${o.id}"]`)!;
      const f=battle.sides[seat],move=MOVES[moveFor(f,o.id)];
      const reason=s.phase!=='playing'||me?.chosen||this.playback.playing?'':o.reason;
      b.disabled=s.phase!=='playing'||!!me?.chosen||!!o.reason;
      b.querySelector('.move-meta')!.textContent=moveSummary(f,o.id)||move.text;
      b.querySelector('.move-reason')!.textContent=reason??'';
      b.dataset.kind=move.domain?'domain':move.kind;
      b.title=`${move.text}${move.lore?`\n${move.lore}`:''}${f.mahoraga?'':` (sign: ${GESTURE_LABELS[o.id as GestureType]??o.id})`}`;
    }
    const autoSkipKey=`${s.round}:${battle.turn}:${seat}`;
    if(s.phase==='playing'&&!me?.chosen&&!this.playback.playing&&mustSkipTurn(battle.sides[seat])&&this.autoSkipKey!==autoSkipKey){
      this.autoSkipKey=autoSkipKey;
      void this.client.action('move',{id:'BASIC_PUNCH'}).then(ok=>{if(!ok&&this.autoSkipKey===autoSkipKey)this.autoSkipKey='';});
    }
  }
  async leave():Promise<void>{
    this.connecting++;this.relay.stop();await this.client.leave();this.onLock(false);this.phase='';this.shownRound=-1;
    document.querySelector<HTMLElement>('#match-result')!.hidden=true;this.q('online-log').replaceChildren();this.renderBattle();
    this.setScreen('lobby');this.message('Room left. Create or join another private match.');this.onScreen();
  }
  dispose():void{this.disposed=true;this.connecting++;this.selection.dispose();this.relay.stop();this.frame?.close();this.frame=null;void this.client.leave();}
}
