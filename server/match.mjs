import {CombatManager} from '../src/combat/CombatManager.ts';
import {CHARACTERS} from '../src/characters/Characters.ts';
import {validOrigin} from '../src/effects/MovePalette.ts';
const character=id=>CHARACTERS.find(c=>c.id===id);
const serialize=f=>({...f,usedSummons:[...f.usedSummons],borrowedSummons:[...f.borrowedSummons],cooldowns:[...f.cooldowns]});
export class Match {
 constructor(now=0){this.now=now;this.waitingSince=now;this.phase='waiting';this.players=[this.player(now),null];this.events=[];this.seq=0;this.round=1;this.game=null;this.winner=null;this.reason='';this.startedAt=0;this.lastInput=[-Infinity,-Infinity];this.nextSelection=Infinity;}
 player(now){return {characterId:'gojo',ready:false,lastSeen:now,telemetry:{hands:0,fps:0,camera:false}};}
 event(type,data={}){this.events.push({seq:++this.seq,type,...data});if(this.events.length>100)this.events.shift();}
 join(now){if(this.phase!=='waiting'||this.players[1])return 'Room is full or has started';this.players[1]=this.player(now);return null;}
 select(seat,body){if(this.phase!=='waiting')return 'Fighters are locked during a match';if(body.round!==this.round)return 'Selection belongs to an earlier round';if(!this.players[seat])return 'Session expired';if(!character(body.id))return 'Unknown fighter';if(this.players[seat].ready)return 'Fighter already confirmed';this.players[seat].characterId=body.id;return null;}
 ready(seat,now,body={}){
  if(this.phase!=='waiting')return 'Match already started';if(body.round!==this.round)return 'Selection has changed; confirm again';
  if(!this.players[seat])return 'Session expired';if(!this.players.every(Boolean))return 'Waiting for opponent';this.players[seat].ready=true;
  if(this.players.every(p=>p?.ready)){this.game=new CombatManager(character(this.players[0].characterId),Math.random,'human');this.game.reset(character(this.players[0].characterId),character(this.players[1].characterId));this.phase='countdown';this.startedAt=now+3000;this.event('countdown');}return null;
 }
 cast(seat,id,now,body={}){
  this.tick(now);if(body.round!==this.round)return 'This input belongs to an earlier round';if(this.phase!=='playing')return 'Wait for the fight to start';
  const side=seat===0?'player':'enemy',f=seat===0?this.game.player:this.game.opponent;
  if(this.game.turn!==side)return 'Wait for your turn';if(now-this.lastInput[seat]<1000)return 'Wait one second between attacks';
  const reason=this.game.unavailable(id,f);if(reason)return reason;
  if(!this.game.attackFrom(seat,id))return 'Attack unavailable';this.lastInput[seat]=now;this.event('cast',{owner:seat,id,origin:validOrigin(body.origin),at:now,round:this.round,blackFlash:this.game.lastCastBlackFlash});this.checkResult(now);return null;
 }
 guard(){return 'Use your fighter’s assigned moves';}
 telemetry(seat,body){if(!this.players[seat])return 'Session expired';this.players[seat].telemetry={hands:Number.isFinite(body.hands)?Math.max(0,Math.min(2,Math.floor(body.hands))):0,fps:Number.isFinite(body.fps)?Math.max(0,Math.min(120,Math.round(body.fps))):0,camera:body.camera===true};return null;}
 finish(winner,reason){if(this.phase==='finished')return;this.phase='finished';this.winner=winner;this.reason=reason;this.finishedAt=this.now;this.nextSelection=this.now+5000;this.event('finished',{winner,reason});}
 checkResult(now){if(this.game?.status==='won')this.finish(0,'Knockout');if(this.game?.status==='lost')this.finish(1,'Knockout');if(this.phase==='playing'&&now-this.startedAt>600000){const a=this.game.player.hp/this.game.player.maxHp,b=this.game.opponent.hp/this.game.opponent.maxHp;this.finish(a===b?null:a>b?0:1,'Time limit');}}
 leave(seat){if(this.phase==='playing'||this.phase==='countdown')this.finish(1-seat,'Opponent left');this.players[seat]=null;if(this.phase==='waiting')this.finish(null,'Opponent left');}
 tick(now){
  if(!Number.isFinite(now)||now<this.now)return;const dt=Math.min(250,now-this.now);this.now=now;
  const stale=this.players.map((p,i)=>p&&now-p.lastSeen>20000?i:-1).filter(i=>i>=0);
  if(stale.length&&this.phase!=='finished'){this.finish(stale.length===2?null:1-stale[0],'Connection lost');for(const i of stale)this.players[i]=null;}
  if(this.phase==='finished'&&now>=this.nextSelection&&this.players.every(Boolean)){
   this.round++;this.phase='waiting';this.waitingSince=now;this.players.forEach(p=>p.ready=false);this.game=null;this.nextSelection=Infinity;this.lastInput=[-Infinity,-Infinity];this.event('selection');
  }
  if(this.phase==='countdown'&&now>=this.startedAt){this.phase='playing';this.game.start();this.event('fight');}
  if(this.phase==='playing'){this.game.tick(dt);this.checkResult(now);}
 }
 snapshot(seat){return {phase:this.phase,seat,now:this.now,round:this.round,startedAt:this.startedAt,winner:this.winner,reason:this.reason,players:this.players,domains:[],events:this.events,game:this.game?{player:serialize(this.game.player),opponent:serialize(this.game.opponent),turn:this.game.turn,turnNumber:this.game.turnNumber,status:this.game.status,message:this.game.message,log:this.game.log,technique:this.game.technique,techniqueSerial:this.game.techniqueSerial,passivePopup:this.game.passivePopup}:null};}
}
