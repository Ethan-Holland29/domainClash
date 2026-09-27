import { GestureDatasetManager } from './data/GestureDatasetManager';
import { GestureRecorder } from './data/GestureRecorder';
import { DatasetPanel } from './ui/DatasetPanel';
import { LEARNED_MODEL } from './handTracking/GestureDefinitions';
import type { MergedGestureRecognizer } from '../handTracking/MergedGestureRecognizer';

export class Training {
  onTrained:()=>void=()=>{};
  private panel:DatasetPanel|null=null;
  private recorder:GestureRecorder|null=null;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private unsubscribe:(()=>void)|undefined;
  private disposed=false;
  private recognizer:MergedGestureRecognizer;
  constructor(recognizer:MergedGestureRecognizer){this.recognizer=recognizer;}
  async init():Promise<void>{
    const host=document.getElementById('training-content')!;
    try{
      const {manager}=await GestureDatasetManager.create();
      if(this.disposed)return;
      this.recorder=new GestureRecorder(()=>{
        const frame=this.recognizer.lastFrame;
        return frame&&performance.now()-frame.timestampMs<350?frame:null;
      },sample=>manager.add(sample));
      this.panel=new DatasetPanel(host,manager,this.recorder,this.groups());
      const train=async()=>{const samples=await manager.all();if(!this.disposed){LEARNED_MODEL.train(samples);this.onTrained();}};
      this.unsubscribe=manager.onChange(()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>void train(),500);});
      await train();await this.panel.refreshCounts();
      this.panel.setStatus('Your recordings stay in this browser. Export a backup to keep or share them.');
    }catch{host.textContent='Gesture storage unavailable in this browser. Built-in signs and keyboard controls still work.';}
  }
  private groups(){return [{name:'Selected fighter',labels:this.recognizer.getDefinitions().map(d=>d.datasetLabel)},{name:'Relaxed / no technique',labels:['NONE']}];}
  changed():void {this.recorder?.cancel();this.panel?.setLabelGroups(this.groups());}
  cancel():void {this.recorder?.cancel();}
  dispose():void {this.disposed=true;this.cancel();this.panel?.dispose();clearTimeout(this.timer);this.unsubscribe?.();}
}
