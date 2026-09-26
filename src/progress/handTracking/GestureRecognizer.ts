import { GestureRecognizer as MainRecognizer } from '../../signs/handTracking/GestureRecognizer';
import { mainFrame, signDefinition } from './MainSigns';
import type { TrackedHand } from './HandTypes';
import type { GestureType, GestureRecognitionState } from './GestureTypes';

export interface GestureEvent {type:'enter'|'confirmed'|'released';gesture:GestureType}
export class GestureRecognizer {
  readonly core=new MainRecognizer({},[]);
  private getOptions:()=>{moves:GestureType[];aspect:number};
  private keys='';
  private lastTime:number|null=null;
  private state:GestureRecognitionState={phase:'idle',candidateGesture:null,confirmedGesture:null,holdProgress:0,debug:[]};
  constructor(getOptions:()=>{moves:GestureType[];aspect:number}){this.getOptions=getOptions;}
  onEvent(listener:(event:GestureEvent)=>void):()=>void {
    return this.core.onEvent(e=>{if(e.type!=='cancelled')listener({type:e.type,gesture:e.gesture.id as GestureType});});
  }
  suspend():void {
    const state=this.core.snapshot();
    if(state.phase==='confirmed'&&state.active)this.core.requireRelease(state.active.id);
    this.core.reset();this.lastTime=null;
    this.state={phase:'idle',candidateGesture:null,confirmedGesture:null,holdProgress:0,debug:[]};
  }
  update(hands:TrackedHand[],now:number):GestureRecognitionState {
    const {moves,aspect}=this.getOptions(),ids=[...moves].sort();
    const keys=ids.join(',');
    if(keys!==this.keys){this.suspend();this.keys=keys;this.core.setDefinitions(ids.map(signDefinition));}
    if(this.lastTime!==null&&now-this.lastTime>250)this.suspend();
    this.lastTime=now;
    this.core.update(mainFrame(hands,now,aspect));
    const state=this.core.snapshot(),active=state.active?.id as GestureType|undefined;
    // Use main's actual decision scores for diagnostics; never run the learned
    // matcher a second time merely to discover the currently selected moves.
    const ranked=[...state.gestures].sort((a,b)=>b.score-a.score);
    const debug=ranked.map((g,i)=>({gesture:g.definition.id as GestureType,aspectRatio:aspect,
      matched:!state.moving&&i===0&&g.score>=this.core.config.enterThreshold&&g.score-(ranked[1]?.score??0)>=this.core.config.ambiguityMargin,
      debug:{score:g.score,error:1-g.score,limit:1-this.core.config.enterThreshold,
        checks:Object.fromEntries(g.evaluation.checks.map(c=>[c.label,c.score>=this.core.config.enterThreshold]))}}));
    this.state={phase:state.phase,candidateGesture:active??null,confirmedGesture:state.phase==='confirmed'?active??null:null,holdProgress:state.holdProgress,debug};
    return this.state;
  }
  getState():GestureRecognitionState{return this.state;}
}
