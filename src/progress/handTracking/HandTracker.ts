import { HandTracker as MainTracker } from '../../signs/handTracking/HandTracker';
import type { HandTrackingResult } from './HandTypes';

/** Main's full landmark tracker, using the locally bundled matching runtime. */
export class HandTracker {
  private tracker=new MainTracker({wasmPath:'/tracking/wasm',modelPath:'/tracking/hand_landmarker.task',mirrored:false});
  private generation=0;
  get isReady():boolean{return this.tracker.isReady;}
  async initialize():Promise<void>{
    const generation=++this.generation,tracker=this.tracker;
    await tracker.init();
    if(generation!==this.generation)tracker.dispose();
  }
  detectForVideo(video:HTMLVideoElement,now:number):HandTrackingResult {
    const result=this.tracker.detect(video,now);
    return {timestampMs:now,hands:(result?.hands??[]).filter(h=>h.handedness!=='Unknown').map(h=>({...h,handedness:h.handedness as 'Left'|'Right'}))};
  }
  dispose():void {
    this.generation++;this.tracker.dispose();
    this.tracker=new MainTracker({wasmPath:'/tracking/wasm',modelPath:'/tracking/hand_landmarker.task',mirrored:false});
  }
}
