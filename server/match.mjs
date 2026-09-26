import rules from './rules.json' with {type:'json'};
export {rules};
export const OPENING=2400,CLASH_WINDOW=1000,REGULAR_RECOVERY=1000;
export class Match {
 constructor(now=0){this.phase='waiting';this.players=[this.player(now),null];this.domains=[];this.pending=[];this.events=[];this.seq=0;this.now=now;this.startedAt=0;this.winner=null;this.reason='';}
 player(now){return {hp:100,energy:100,ready:false,lastSeen:now,regularAt:0,domainAt:0,guardAt:0,guardUntil:0};}
 event(type,data={}){this.events.push({seq:++this.seq,type,...data});if(this.events.length>100)this.events.shift();}
 join(now){if(this.phase!=='waiting'||this.players[1])return 'Room is full or has started';this.players[1]=this.player(now);return null;}
 ready(seat,now){this.tick(now);if(this.phase!=='waiting')return 'Match already started';this.players[seat].ready=true;if(this.players.every(p=>p?.ready)){this.phase='countdown';this.startedAt=now+3000;this.event('countdown');}return null;}
 finish(winner,reason){if(this.phase==='finished')return;this.phase='finished';this.finishedAt=this.now;this.winner=winner;this.reason=reason;this.pending=[];this.domains=[];this.event('finished',{winner,reason});}
 leave(seat){if(this.phase==='finished')return;this.finish(this.players[1-seat]?1-seat:null,'Opponent left the room');}
 cast(seat,id,now){
  if(now<this.now)return 'Stale input';
  this.tick(now);const r=Object.hasOwn(rules,id)?rules[id]:null,p=this.players[seat];
  if(!r)return 'Unknown technique';if(this.phase!=='playing')return 'Wait for the fight to start';
  if(this.domains.some(d=>d.owner===seat&&now<d.activeAt))return 'Your domain is expanding';
  if(p.energy<r.cost)return 'Not enough cursed energy';
  if(!r.domain){if(now<p.regularAt)return 'Regular attacks recover for one second';p.regularAt=now+REGULAR_RECOVERY;p.energy-=r.cost;this.pending.push({owner:seat,id,at:now+180,damage:r.damage});this.event('cast',{owner:seat,id});return null;}
  if(now<p.domainAt)return 'Domain is cooling down';if(this.domains.some(d=>d.owner===seat))return 'Your domain is already active';
  const opponent=this.domains.find(d=>d.owner!==seat);
  if(opponent){const other=rules[opponent.id];if(r.tier<other.tier)return 'Opponent domain has higher refinement';if(r.tier===other.tier&&now-opponent.castAt>CLASH_WINDOW)return 'Equal domain response window has closed';}
  p.energy-=r.cost;p.domainAt=now+r.cooldown;
  const domain={id,owner:seat,castAt:now,activeAt:now+OPENING,endAt:now+OPENING+r.duration,nextTick:now+OPENING+1000};
  if(opponent&&r.tier>rules[opponent.id].tier){this.domains=[];this.event('overtake',{owner:seat,id,over:opponent.id});}
  this.domains.push(domain);this.event('cast',{owner:seat,id});
  if(opponent&&r.tier===rules[opponent.id].tier)this.event('clash',{ids:[opponent.id,id]});
  return null;
 }
 guard(seat,now){this.tick(now);if(this.phase!=='playing')return 'Match not active';const p=this.players[seat];if(now<p.guardAt||p.energy<10)return 'Guard unavailable';p.guardAt=now+1800;p.guardUntil=now+450;p.energy-=10;this.event('guard',{owner:seat});return null;}
 tick(now){
  if(!Number.isFinite(now)||now<this.now)return;
  const dt=now-this.now;this.now=now;if(this.phase==='finished')return;
  const stale=this.players.map((p,i)=>p&&now-p.lastSeen>15000?i:-1).filter(i=>i>=0);
  if(stale.length){this.finish(stale.length===2?null:this.players[1-stale[0]]?1-stale[0]:null,stale.length===2?'Both players disconnected':'Connection lost');return;}
  if(this.phase==='countdown'&&now>=this.startedAt){this.phase='playing';this.event('fight');}
  if(this.phase!=='playing')return;
  for(const p of this.players)p.energy=Math.min(100,p.energy+dt*.012);
  const damage=[0,0];
  this.pending=this.pending.filter(hit=>{if(hit.at>now)return true;const target=1-hit.owner;const guarded=this.players[target].guardUntil>=hit.at;const amount=guarded?Math.ceil(hit.damage*.45):hit.damage;damage[target]+=amount;this.event('hit',{owner:hit.owner,target,damage:amount,guarded});return false;});
  // Evaluate tick timestamps against the other domain's lifetime, even on a delayed server tick.
  for(const d of this.domains){while(d.nextTick<=now&&d.nextTick<=d.endAt){const clash=this.domains.some(o=>o.owner!==d.owner&&o.castAt<=d.nextTick&&o.endAt>=d.nextTick);if(!clash){damage[1-d.owner]+=3;this.event('hit',{owner:d.owner,target:1-d.owner,damage:3});}d.nextTick+=1000;}}
  this.domains=this.domains.filter(d=>d.endAt>now);
  this.players.forEach((p,i)=>p.hp=Math.max(0,p.hp-damage[i]));
  if(this.players.some(p=>p.hp===0)){this.finish(this.players.every(p=>p.hp===0)?null:this.players[0].hp>0?0:1,'Knockout');return;}
  if(now-this.startedAt>=180000){const [a,b]=this.players;this.finish(a.hp===b.hp?null:a.hp>b.hp?0:1,'Time limit');}
 }
 snapshot(seat){return {phase:this.phase,seat,now:this.now,startedAt:this.startedAt,winner:this.winner,reason:this.reason,players:this.players.map(p=>p?{hp:p.hp,energy:Math.floor(p.energy),ready:p.ready,regularAt:p.regularAt,domainAt:p.domainAt,guardUntil:p.guardUntil}:null),domains:this.domains,events:this.events};}
}
