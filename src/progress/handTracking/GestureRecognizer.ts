import { GestureRecognizer as MainRecognizer } from '../../signs/handTracking/GestureRecognizer';
import { mainFrame, signDefinition } from './MainSigns';
import type { TrackedHand } from './HandTypes';
import type { GestureType, GestureEvaluation, GestureRecognitionState } from './GestureTypes';

export interface GestureEvent {type:'enter'|'confirmed'|'released';gesture:GestureType}
export class GestureRecognizer {
  readonly core=new MainRecognizer({},[]);
  private evaluate:(hands:TrackedHand[])=>GestureEvaluation[];
  private keys='';
  private context?: () => { moves: GestureType[]; aspect: number };
  private lastTime:number|null=null;
  private state:GestureRecognitionState={phase:'idle',candidateGesture:null,confirmedGesture:null,holdProgress:0,debug:[]};
  constructor(evaluate:(hands:TrackedHand[])=>GestureEvaluation[], context?: () => { moves: GestureType[]; aspect: number }){this.evaluate=evaluate;this.context=context;}
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
    const context=this.context?.();
    const debug=context?[]:this.evaluate(hands),ids=[...(context?.moves??debug.map(e=>e.gesture))].sort();
    const keys=ids.join(',');
    if(keys!==this.keys){this.suspend();this.keys=keys;this.core.setDefinitions(ids.map(signDefinition));}
    if(this.lastTime!==null&&now-this.lastTime>250)this.suspend();
    this.lastTime=now;
    this.core.update(mainFrame(hands,now,context?.aspect??debug[0]?.aspectRatio??4/3));
    const state=this.core.snapshot(),active=state.active?.id as GestureType|undefined;
    this.state={phase:state.phase,candidateGesture:active??null,confirmedGesture:state.phase==='confirmed'?active??null:null,holdProgress:state.holdProgress,debug:context?state.gestures.map(g=>({gesture:g.definition.id as GestureType,aspectRatio:context.aspect,matched:state.active?.id===g.definition.id,debug:{score:g.score,error:1-g.score,limit:1-this.core.config.enterThreshold,checks:Object.fromEntries(g.evaluation.checks.map(c=>[c.label,c.score>=this.core.config.enterThreshold]))}})):debug};
    return this.state;
  }
  getState():GestureRecognitionState{return this.state;}
}
