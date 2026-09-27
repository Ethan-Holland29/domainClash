import { GestureRecognizer as MainRecognizer } from '../signs/handTracking/GestureRecognizer';
import { GESTURE_DEFINITIONS, withLearning, LEARNED_MODEL, SIGN_TUNING } from '../signs/handTracking/GestureDefinitions';
import type { GestureDefinition } from '../signs/handTracking/GestureTypes';
import type { HandFrame as SignFrame } from '../signs/handTracking/HandTypes';
import type { TrackedHand } from './HandTypes';
import type { GestureState, GestureEval, GestureListener } from './GestureTypes';
import { evaluateGestures } from './GestureDefinitions';
import { MoveById, isDomain } from '../combat/MoveCatalog';
import type { AbilityId } from '../combat/AbilityTypes';

const signIds: Partial<Record<AbilityId, string>> = {
  LAPSE_BLUE:'lapse-blue', REVERSAL_RED:'reversal-red', UNLIMITED_VOID:'unlimited-void',
  PRIMARY_ATTACK:'cleave', DISMANTLE:'dismantle', MALEVOLENT_SHRINE:'malevolent-shrine',
  DIVINE_DOGS:'divine-dogs', NUE:'nue', DOMAIN_EXPANSION:'chimera-shadow-garden',
  SECONDARY_ATTACK:'piercing-blood', MUTUAL_LOVE:'authentic-mutual-love', RYU_DOMAIN:'ryu-ishigori-domain',
};

export function toSignFrame(hands: TrackedHand[], timestampMs: number, aspectRatio: number): SignFrame {
  return {timestampMs, aspectRatio, hands:hands.map(h=>({
    landmarks:h.landmarks.map(p=>({x:1-p.x,y:p.y,z:p.z})),
    worldLandmarks:(h.worldLandmarks??[]).map(p=>({x:-p.x,y:p.y,z:p.z})),
    handedness:h.handedness, handednessScore:h.score,
  }))};
}

export function definitionFor(id: AbilityId): GestureDefinition {
  const fromMain = GESTURE_DEFINITIONS.find(d=>d.id===signIds[id]);
  if (fromMain) return {...fromMain,id};
  const move=MoveById[id];
  const builtIn=id==='BASIC_PUNCH'||id==='BLACK_FLASH'||id==='YUJI_DOMAIN';
  return withLearning({id,datasetLabel:id,name:move.name,sign:move.sign,
    action:isDomain(id)?'DOMAIN_EXPANSION':'PRIMARY_ATTACK',taughtOnly:!builtIn,
    evaluate(ctx){
      if(id==='BASIC_PUNCH') {
        const score=ctx.hands.length===1?Math.min(...(['index','middle','ring','pinky'] as const).map(f=>1-ctx.hands[0].fingers[f].extended),1-ctx.hands[0].fingers.thumb.extended):0;
        return {score,checks:[{label:'Closed fist, thumb tucked',score,detail:'One hand with all fingers folded'}]};
      }
      if(builtIn){
        const hands=ctx.hands.map(h=>({landmarks:h.hand.landmarks.map(p=>({...p,x:1-p.x})),handedness:h.hand.handedness,score:h.hand.handednessScore}));
        const result=evaluateGestures(hands).find(e=>e.id===id);
        return {score:result?.score??0,checks:result?.checks.map(c=>({label:c.name,score:c.passed?1:0,detail:c.detail}))??[]};
      }
      return {score:0,checks:[{label:'Record this sign first',score:0,detail:'Open Gesture training to teach this technique.'}]};
    },
  });
}

/** Main's recognizer, with an adapter for Kevin's inference and battle interfaces. */
export class MergedGestureRecognizer {
  readonly core=new MainRecognizer({},[]);
  private listeners=new Set<GestureListener>();
  private lastConfirmedAt=-Infinity;
  private definitions:GestureDefinition[]=[];
  lastFrame:SignFrame|null=null;
  aspectRatio=4/3;
  constructor(){this.core.onAction((_action,def)=>{this.lastConfirmedAt=performance.now();for(const listener of this.listeners)listener(def.id as AbilityId);});}
  setMoves(ids:AbilityId[]):void {
    this.definitions=ids.map(definitionFor);this.core.setDefinitions(this.definitions);
    this.refreshLabels();
  }
  refreshLabels():void {
    for(const def of this.definitions){
      const m=MoveById[def.id as AbilityId],count=LEARNED_MODEL.countFor(def.datasetLabel);
      const learned=count>=SIGN_TUNING.learned.minSamples;
      m.sign=learned?'Use your recorded sign for '+def.name+'.':def.sign;
      m.short=learned?'Learned sign · '+count+' samples':def.taughtOnly?'Custom sign · train first':def.sign;
      m.note=def.taughtOnly&&!learned?'Teach this sign in Gesture training, or use its key.':'Hold steadily, then release before repeating.';
    }
  }
  onConfirmed(listener:GestureListener):()=>void {this.listeners.add(listener);return()=>this.listeners.delete(listener);}
  reset():void {this.suspend();this.lastFrame=null;}
  suspend():void {const active=this.core.snapshot();if(active.phase==='confirmed'&&active.active)this.core.requireRelease(active.active.id);this.core.reset();this.lastFrame=null;}
  update(hands:TrackedHand[],_dt:number,now:number):GestureState {
    if (_dt >= 250) this.suspend();
    this.lastFrame=toSignFrame(hands,performance.now(),this.aspectRatio);
    this.core.update({...this.lastFrame,timestampMs:now});return this.state();
  }
  state():GestureState {const s=this.core.snapshot();const id=s.active?.id as AbilityId|undefined;return {candidate:id??null,confirmed:s.phase==='confirmed'?id??null:null,phase:s.phase==='candidate'?'holding':s.phase,holdProgress:s.holdProgress,score:s.score,lastConfirmedAt:this.lastConfirmedAt};}
  debugEvals():GestureEval[]{return this.core.snapshot().gestures.map(g=>({id:g.definition.id as AbilityId,displayName:g.definition.name,score:g.score,passed:g.score>=this.core.config.enterThreshold,checks:g.evaluation.checks.map(c=>({name:c.label,passed:c.score>=this.core.config.enterThreshold,value:c.score,detail:c.detail}))}));}
  getDefinitions():GestureDefinition[]{return this.definitions;}
}
