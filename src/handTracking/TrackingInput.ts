import type {HandFrame,TrackedHand} from './HandTypes';
import type {GestureRecognizer} from './GestureRecognizer';
/** Consume each inference once. Its arrival time, not its capture age, determines freshness. */
export class TrackingInput {
 private capture=-1;private arrival=-1;private freshnessMs=350;private expired=false;
 hands:TrackedHand[]=[];
 reset():void{this.capture=this.arrival=-1;this.freshnessMs=350;this.expired=false;this.hands=[];}
 update(frame:HandFrame,now:number,gestureClock:number,gestures:Pick<GestureRecognizer,"suspend"|"update">):void{
  if(frame.timestampMs>=0&&frame.timestampMs>this.capture){
   const arrival=frame.receivedAtMs??now;
   const interval=this.arrival<0?0:Math.max(0,arrival-this.arrival);
   const processing=Math.max(0,arrival-frame.timestampMs);
   if(this.arrival>=0&&interval>this.freshnessMs)gestures.suspend();
   const elapsed=this.capture<0?0:Math.min(250,Math.max(0,frame.timestampMs-this.capture));
   this.capture=frame.timestampMs;this.arrival=arrival;this.expired=false;
   this.freshnessMs=Math.min(1500,Math.max(350,interval*2.5,processing*2+150));
   if(processing>2000){this.hands=[];gestures.suspend();this.expired=true;return;}
   this.hands=frame.hands;
   gestures.update(frame.hands,elapsed,gestureClock);
  }else if(this.arrival>=0&&now-this.arrival>this.freshnessMs&&!this.expired){
   this.expired=true;this.hands=[];
   // No fresh evidence means no progress and no release/re-arm of an already cast sign.
   gestures.suspend();
  }
 }
}
