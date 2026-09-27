import {CHARACTERS as KITS,createBattle,resolveTurn,chooseMove,unavailableReason} from '../shared/battle.mjs';
// Turn-based 1v1 on the shared battle engine: both players lock in a move, the
// server resolves the turn and publishes its battle text; clients play it back.
export const COUNTDOWN_MS=3000,RESULT_MS=7000;
/** Time to choose a move once the previous turn's text has played; then a move is picked automatically. */
export const TURN_MS=30000;
/** Playback time budgeted per line of battle text (matches the client's pacing). */
export const LINE_MS=1100;
export class Match {
 constructor(now=0,random=Math.random){this.random=random;this.phase='waiting';this.players=[this.player(now),null];this.events=[];this.seq=0;this.now=now;this.startedAt=0;this.winner=null;this.reason='';this.round=1;this.returnAt=0;this.battle=null;this.choices=[null,null];this.deadline=0;}
 player(now){return {ready:false,lastSeen:now};}
 event(type,data={}){this.events.push({seq:++this.seq,type,...data});if(this.events.length>100)this.events.shift();}
 join(now){const seat=this.players.findIndex(p=>!p);if(this.phase!=='waiting'||seat<0)return 'Room is full or has started';this.players[seat]=this.player(now);this.lastJoinedSeat=seat;return null;}
 preview(seat,id){if(this.phase!=='waiting'||this.players[seat]?.ready)return 'Character is locked';if(!Object.hasOwn(KITS,id))return 'Unknown character';this.players[seat].previewId=id;return null;}
 tracking(seat,body){if(!body||!Number.isFinite(body.hands)||!Number.isFinite(body.fps)||body.hands<0||body.hands>2||body.fps<0||body.fps>240)return 'Invalid tracking stats';this.players[seat].tracking={hands:Math.floor(body.hands),fps:Math.round(body.fps),at:this.now};return null;}
 select(seat,id){if(this.phase!=='waiting'||this.players[seat]?.ready)return 'Character is locked';if(!Object.hasOwn(KITS,id))return 'Unknown character';this.players[seat].characterId=id;return null;}
 ready(seat,now){this.tick(now);if(this.phase!=='waiting')return 'Match already started';if(this.requireCharacter&&!this.players[seat].characterId)return 'Choose a character first';this.players[seat].ready=true;if(this.players.every(p=>p?.ready)){this.phase='countdown';this.startedAt=now+COUNTDOWN_MS;this.event('countdown');}return null;}
 finish(winner,reason){if(this.phase==='finished')return;this.phase='finished';this.finishedAt=this.now;this.returnAt=this.now+RESULT_MS;this.winner=winner;this.reason=reason;this.choices=[null,null];this.event('finished',{winner,reason});}
 leave(seat){if(this.players[seat])this.players[seat].departed=true;if(this.phase==='finished')return;this.finish(this.players[1-seat]?1-seat:null,'Opponent left the room');}
 nextRound(now){this.players=this.players.map(p=>p&&!p.departed&&now-p.lastSeen<=15000?{...this.player(now),characterId:p.characterId,previewId:p.characterId}:null);this.phase='waiting';this.round++;this.startedAt=0;this.returnAt=0;this.winner=null;this.reason='';this.battle=null;this.choices=[null,null];this.deadline=0;this.event('selection');}
 /** Locks in this turn's move for a seat; the turn resolves once both have chosen. */
 choose(seat,id,now){
  if(now<this.now)return 'Stale input';
  this.tick(now);
  if(this.phase!=='playing'||!this.battle)return 'Wait for the fight to start';
  if(typeof id!=='string')return 'Unknown move';
  if(this.choices[seat])return 'Move already chosen for this turn';
  const reason=unavailableReason(this.battle,seat,id);if(reason)return reason;
  this.choices[seat]=id;this.event('chosen',{owner:seat});
  if(this.choices.every(Boolean))this.resolve(now);
  return null;
 }
 resolve(now){
  const choices=this.choices;this.choices=[null,null];
  const {state,events}=resolveTurn(this.battle,choices,this.random);
  const turn=this.battle.turn;this.battle=state;
  this.event('turn',{turn,lines:events});
  this.deadline=now+events.length*LINE_MS+TURN_MS;
  if(state.over)this.finish(state.winner==='draw'?null:state.winner,events.some(e=>e.type==='time')?'Turn limit':'Knockout');
 }
 tick(now){
  if(!Number.isFinite(now)||now<this.now)return;
  this.now=now;if(this.phase==='finished'){if(now>=this.returnAt)this.nextRound(now);return;}
  const stale=this.players.map((p,i)=>p&&now-p.lastSeen>15000?i:-1).filter(i=>i>=0);
  if(stale.length){this.finish(stale.length===2?null:this.players[1-stale[0]]?1-stale[0]:null,stale.length===2?'Both players disconnected':'Connection lost');return;}
  if(this.phase==='countdown'&&now>=this.startedAt){this.phase='playing';this.battle=createBattle(this.players[0].characterId??'gojo',this.players[1].characterId??'gojo');this.deadline=now+TURN_MS;this.event('fight');}
  if(this.phase!=='playing')return;
  // Out of time: the server picks for anyone who has not chosen.
  if(now>=this.deadline){for(const seat of [0,1])if(!this.choices[seat]){this.choices[seat]=chooseMove(this.battle,seat,this.random);this.event('timeout',{owner:seat});}this.resolve(now);}
 }
 snapshot(seat){return {phase:this.phase,seat,round:this.round,returnAt:this.returnAt,now:this.now,startedAt:this.startedAt,winner:this.winner,reason:this.reason,deadline:this.deadline,battle:this.battle,
  // Only whether the opponent has chosen, never what.
  players:this.players.map((p,i)=>p?{characterId:p.characterId??null,previewId:p.previewId??p.characterId??null,tracking:p.tracking??null,ready:p.ready,chosen:!!this.choices[i],choice:i===seat?this.choices[i]:null}:null),events:this.events};}
}
