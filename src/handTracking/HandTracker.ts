import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { GameConfig } from "../config/GameConfig";
import type { Handedness, HandFrame, TrackedHand } from "./HandTypes";

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private lastVideoTime = -1;
  private generation = 0;
  private worker:Worker|null=null;private busy=false;private failure='';private sentAt=-1000;
  private sample:HTMLCanvasElement|null=null;
  mode='Not started';

  private lastFrame: HandFrame = { hands: [], timestampMs: -1 };

  async initialize(): Promise<void> {
    if (this.landmarker||this.worker) return;
    const generation = ++this.generation;
    if(typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'){
      try{await this.initializeWorker();if(generation!==this.generation)return;this.mode='Background hand tracking';return;}
      catch{if(generation!==this.generation)return;(this.worker as Worker|null)?.terminate();this.worker=null;}
    }
    this.mode='Compatibility hand tracking';
    const vision = await FilesetResolver.forVisionTasks(GameConfig.tracking.mediapipeWasmCdn);
    const landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: GameConfig.tracking.modelAssetPath,
      },
      runningMode: "VIDEO",
      numHands: GameConfig.tracking.numHands,
      minHandDetectionConfidence: GameConfig.tracking.minHandDetectionConfidence,
      minHandPresenceConfidence: GameConfig.tracking.minHandPresenceConfidence,
      minTrackingConfidence: GameConfig.tracking.minTrackingConfidence,
    });
    if (generation !== this.generation) { landmarker.close(); return; }
    this.landmarker = landmarker;
  }

  detect(video: HTMLVideoElement, timestampMs: number): HandFrame {
    if(this.failure)throw Error(this.failure);
    if(this.worker){
      if(!this.busy&&timestampMs-this.sentAt>=50&&video.currentTime!==this.lastVideoTime){
        this.busy=true;this.sentAt=timestampMs;this.lastVideoTime=video.currentTime;const generation=this.generation;
        const scale=Math.min(1,640/video.videoWidth,480/video.videoHeight);
        void createImageBitmap(video,{resizeWidth:Math.max(1,Math.round(video.videoWidth*scale)),resizeHeight:Math.max(1,Math.round(video.videoHeight*scale))}).then(image=>{
          if(generation!==this.generation||!this.worker){image.close();return;}
          this.worker.postMessage({type:'frame',image,timestampMs},[image]);
        }).catch(()=>{if(generation===this.generation)this.busy=false;});
      }
      return this.lastFrame;
    }
    if (!this.landmarker) {
      return { hands: [], timestampMs };
    }
    if (video.currentTime === this.lastVideoTime||timestampMs-this.sentAt<66) {
      return this.lastFrame;
    }
    this.lastVideoTime = video.currentTime;

    this.sentAt=timestampMs;
    this.sample??=document.createElement('canvas');const scale=Math.min(1,640/video.videoWidth,480/video.videoHeight);
    this.sample.width=Math.round(video.videoWidth*scale);this.sample.height=Math.round(video.videoHeight*scale);
    this.sample.getContext('2d')!.drawImage(video,0,0,this.sample.width,this.sample.height);
    const result = this.landmarker.detectForVideo(this.sample, timestampMs);
    const hands: TrackedHand[] = [];
    const landmarks = result.landmarks ?? [];

    for (let i = 0; i < landmarks.length; i++) {
      const pts = landmarks[i];
      const category = result.handedness?.[i]?.[0];
      hands.push({
        landmarks: pts.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        handedness: toHandedness(category?.categoryName),
        score: category?.score ?? 0,
      });
    }

    this.lastFrame = { hands, timestampMs, receivedAtMs: performance.now() };
    return this.lastFrame;
  }

  private initializeWorker():Promise<void>{
    return new Promise((resolve,reject)=>{
      const worker=new Worker('/tracking/hand-worker.js');this.worker=worker;let ready=false;
      const timeout=setTimeout(()=>reject(Error('Tracking worker timed out')),45000);
      worker.onerror=()=>{clearTimeout(timeout);if(!ready)reject(Error('Tracking worker unavailable'));else this.failure='Tracking worker interrupted';};
      worker.onmessage=({data})=>{
        if(data.type==='ready'){ready=true;clearTimeout(timeout);resolve();}
        if(data.type==='frame'){this.lastFrame={...data.frame,receivedAtMs:performance.now()};this.busy=false;}
        if(data.type==='error'){clearTimeout(timeout);this.busy=false;if(!ready)reject(Error(data.message));else this.failure=data.message;}
      };
      worker.postMessage({type:'init'});
    });
  }
  close(): void {
    this.generation++;this.worker?.terminate();this.worker=null;this.busy=false;this.failure='';this.sentAt=-1000;this.mode='Not started';
    this.landmarker?.close();
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.lastFrame = { hands: [], timestampMs: -1 };
  }
}

function toHandedness(name: string | undefined): Handedness {
  if (name === "Left" || name === "Right") return name;
  return "Unknown";
}
