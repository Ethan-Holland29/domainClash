import type {AbilityId} from '../combat/AbilityTypes';
import type {MatchSnapshot} from './MultiplayerClient';
import rules from '../../server/rules.json' with {type:'json'};
/** Predict only short regular visuals; the server still decides energy, cooldowns, hits and domains. */
export class LocalCastFeedback {
 private next=0;private until=0;private pending:{token:number;id:AbilityId;at:number}[]=[];
 reset():void{this.until=0;this.pending=[];}
 predict(id:AbilityId,state:MatchSnapshot|null,now:number):number|null{
  this.pending=this.pending.filter(p=>now-p.at<5000);
  if(!state||state.phase!=='playing'||rules[id].domain||now<this.until)return null;
  const player=state.players[state.seat];if(!player||player.regularAt>state.now||player.energy<rules[id].cost||state.domains.some(d=>d.owner===state.seat&&state.now<d.activeAt))return null;
  const token=++this.next;this.pending.push({token,id,at:now});this.until=now+1000;return token;
 }
 confirm(id:AbilityId,now:number):boolean{this.pending=this.pending.filter(p=>now-p.at<5000);const i=this.pending.findIndex(p=>p.id===id);if(i<0)return false;this.pending.splice(i,1);return true;}
 reject(token:number):void{this.pending=this.pending.filter(p=>p.token!==token);}
}
