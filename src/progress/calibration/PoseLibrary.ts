import type { TrackedHand } from '../handTracking/HandTypes';
import { ALL_GESTURES, type GestureType, type GestureEvaluation } from '../handTracking/GestureTypes';
import { evaluateMain, samplesFromPoses, signDefinition } from '../handTracking/MainSigns';
import { LEARNED_MODEL, SIGN_TUNING } from '../../signs/handTracking/GestureDefinitions';
import type { TrainingSample } from '../../signs/handTracking/GestureKnnModel';
import type { GestureDatasetManager } from '../../signs/data/GestureDatasetManager';
import type { GestureSample } from '../../signs/data/GestureDatasetTypes';
import { toDatasetFile, validateDataset } from '../../signs/data/GestureDatasetImportExport';

export type Pose = number[][];
export type Library = Partial<Record<GestureType, Pose[]>>;
const KEY = 'domainclash.poses.v1';
export const MAX_POSES_PER_SIGN = 250;
export const MATCH_LIMIT = 0.19;

// Wrist-relative coordinates preserve finger shape and orientation. Palm scaling
// removes camera distance; wrist separation retains the two-hand relationship.
export function describe(hands: TrackedHand[], aspect = 4 / 3): Pose | null {
  if (!hands.length || hands.length > 2) return null;
  const sorted = [...hands].sort((a, b) => a.landmarks[0].x - b.landmarks[0].x);
  const scales = sorted.map(h => Math.hypot((h.landmarks[9].x - h.landmarks[0].x) * aspect, h.landmarks[9].y - h.landmarks[0].y));
  if (scales.some(s => s < 0.015)) return null;
  const mean = scales.reduce((a, b) => a + b, 0) / scales.length;
  return sorted.map((h, i) => {
    const wrist = h.landmarks[0];
    return [...h.landmarks.flatMap(p => [(p.x - wrist.x) * aspect / scales[i], (p.y - wrist.y) / scales[i], (p.z - wrist.z) * aspect / scales[i]]),
      (wrist.x - sorted[0].landmarks[0].x) * aspect / mean,
      (wrist.y - sorted[0].landmarks[0].y) / mean];
  });
}
export function distance(a: Pose, b: Pose): number {
  if (a.length !== b.length) return Infinity;
  const compare = (other: Pose) => Math.sqrt(a.reduce((sum, hand, i) => sum + hand.reduce((s, v, j) => {
    // Estimated depth is less reliable under occlusion; retain it at lower weight.
    const weight = j < 63 && j % 3 === 2 ? 0.25 : 1;
    return s + weight * (v - other[i][j]) ** 2;
  }, 0), 0) / (a.length * 49.25));
  const direct = compare(b);
  if (b.length === 1) {
    // Opposite hands have mirrored wrist-relative x coordinates. Keep y and
    // depth unchanged so finger shape and palm-facing direction still matter.
    const mirrored = [b[0].map((value, index) => index < 63 && index % 3 === 0 ? -value : value)];
    // Allow modest wrist tilt when switching hands, without ignoring pose shape.
    const variants = [b, mirrored].flatMap(pose => [-20, -10, 0, 10, 20].map(degrees => {
      const angle = degrees * Math.PI / 180;
      const hand = [...pose[0]];
      for (let i = 0; i < 63; i += 3) {
        hand[i] = pose[0][i] * Math.cos(angle) - pose[0][i + 1] * Math.sin(angle);
        hand[i + 1] = pose[0][i] * Math.sin(angle) + pose[0][i + 1] * Math.cos(angle);
      }
      return [hand];
    }));
    return Math.min(...variants.map(compare));
  }
  if (b.length !== 2) return direct;
  // When wrists cross, x-sorting swaps hand identities. Rebase their relative
  // wrist offsets as well as swapping the hand descriptors.
  const swapped = [
    [...b[1].slice(0, 63), 0, 0],
    [...b[0].slice(0, 63), -b[1][63], -b[1][64]],
  ];
  return Math.min(direct, compare(swapped));
}
export function validate(value: unknown): Library {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid sign library.');
  const result: Library = {};
  for (const [key, poses] of Object.entries(value)) {
    if (key === "DISMANTLE" || key === "DOMAIN_EXPANSION") continue; // Migrate older backups without losing other signs.
    if (!ALL_GESTURES.includes(key as GestureType) || !Array.isArray(poses) || !poses.length || poses.length > MAX_POSES_PER_SIGN) throw new Error('Invalid sign library.');
    for (const pose of poses) {
      if (!Array.isArray(pose) || ![1, 2].includes(pose.length) || !pose.every(h => Array.isArray(h) && h.length === 65 && h.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 100))) throw new Error('Invalid pose data.');
    }
    result[key as GestureType] = poses;
  }
  return result;
}
export class PoseLibrary {
  private imported:TrainingSample[]=[];
  private dataset:GestureDatasetManager|null=null;
  data: Library = {};
  warning = '';
  constructor() {
    try { const raw = localStorage.getItem(KEY); if (raw) this.data = validate(JSON.parse(raw)); }
    catch { this.warning = 'Saved signs could not be loaded. Record them again or import a backup.'; }
    this.retrain();
  }
  setImportedSamples(samples:TrainingSample[]):void{this.imported=samples;this.retrain();}
  async connectDataset(manager:GestureDatasetManager):Promise<void>{
    const samples=await manager.all();
    this.dataset=manager;
    this.setImportedSamples(samples);
  }
  count(gesture:GestureType):number{return LEARNED_MODEL.countFor(signDefinition(gesture).datasetLabel);}
  async saveSamples(gesture:GestureType,samples:GestureSample[],append:boolean):Promise<void>{
    if(!this.dataset)throw new Error('Sign storage is still loading or unavailable. Please try again.');
    if(!samples.length)throw new Error('Record an example first.');
    const label=signDefinition(gesture).datasetLabel;
    if(samples.some(s=>s.label!==label))throw new Error('These samples belong to a different sign.');
    // Replacing affects this move only. Other labels (including NONE counterexamples) survive.
    if(append)await this.dataset.import(samples,'merge');
    else await this.dataset.import([...(await this.dataset.all()).filter(s=>s.label!==label),...samples],'replace');
    this.setImportedSamples(await this.dataset.all());
  }
  async exportBackup():Promise<void>{
    if(!this.dataset)throw new Error('Sign storage is not ready.');
    const backup={format:'domainclash-progress-signs',version:2,legacy:this.data,dataset:toDatasetFile(await this.dataset.all())};
    const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='domainclash-signs.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async importBackup(text:string):Promise<void>{
    const value=JSON.parse(text);
    if(value?.format==='domainclash-gesture-dataset'||value?.format==='domainclash-progress-signs'){
      if(!this.dataset)throw new Error('Sign storage is not ready.');
      const combined=value.format==='domainclash-progress-signs';
      if(combined&&value.version!==2)throw new Error('Unsupported sign backup version.');
      const legacy=combined?validate(value.legacy):null;
      const samples=validateDataset(combined?value.dataset:value);
      const labels=new Set(samples.map(s=>s.label));
      if(legacy)Object.keys(legacy).forEach(id=>labels.add(signDefinition(id as GestureType).datasetLabel));
      await this.dataset.import([...(await this.dataset.all()).filter(s=>!labels.has(s.label)),...samples],'replace');
      if(legacy)this.replace({...this.data,...legacy});
      this.setImportedSamples(await this.dataset.all());
    }else {
      const legacy=validate(value);
      if(!this.dataset)throw new Error('Sign storage is not ready.');
      const labels=new Set(Object.keys(legacy).map(id=>signDefinition(id as GestureType).datasetLabel));
      await this.dataset.import((await this.dataset.all()).filter(s=>!labels.has(s.label)),'replace');
      this.replace({...this.data,...legacy});
      this.setImportedSamples(await this.dataset.all());
    }
  }
  private retrain():void {
    const counts=new Map<string,number>();
    this.imported.forEach(s=>counts.set(s.label,(counts.get(s.label)??0)+1));
    // Prefer original landmark recordings when sufficient samples exist. Legacy
    // backups remain stored, but must not distort imported main recordings.
    LEARNED_MODEL.train([...this.imported,...Object.entries(this.data).flatMap(([id,poses])=>
      (counts.get(signDefinition(id as GestureType).datasetLabel)??0)>=SIGN_TUNING.learned.minSamples?[]:samplesFromPoses(id as GestureType,poses!))]);
  }
  available(gesture:GestureType):boolean{const d=signDefinition(gesture);return !d.taughtOnly||LEARNED_MODEL.countFor(d.datasetLabel)>=SIGN_TUNING.learned.minSamples;}
  replace(data: Library): void {
    const valid = validate(data);
    localStorage.setItem(KEY, JSON.stringify(valid));
    this.data = valid;
    this.retrain();
  }
  addExample(gesture: GestureType, poses: Pose[]): void {
    if (!poses.length) throw new Error('Record an example first.');
    const existing = this.data[gesture] ?? [];
    if (existing.length + poses.length > MAX_POSES_PER_SIGN) {
      throw new Error('This sign has reached its sample limit. Export a backup, then replace its examples to start fresh.');
    }
    this.replace({ ...this.data, [gesture]: [...existing, ...poses] });
  }
  evaluate(hands: TrackedHand[], aspect: number, allowed: GestureType[] = ALL_GESTURES): GestureEvaluation[] {
    return evaluateMain(hands,aspect,allowed);
  }
}
