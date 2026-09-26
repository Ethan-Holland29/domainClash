import config from './characters.json';
export type VfxTier='low'|'medium'|'high';
export const VFX_LIMITS=config.budgets;

/** One shared allocator for both screen-local players, never a network particle stream. */
export class VfxBudget {
 private counts=[0,0];
 quality=1; private slow=0; private fast=0;
 claim(seat:number,tier:VfxTier){
  this.counts[seat]=Math.max(0,Math.min(Math.floor(VFX_LIMITS[tier]*this.quality),VFX_LIMITS.perPlayer,VFX_LIMITS.global-this.counts[1-seat]));
  return this.counts[seat];
 }
 release(seat:number){this.counts[seat]=0;}
 reduce(seat:number,count:number){this.counts[seat]=Math.max(0,Math.min(this.counts[seat],count));}
 get total(){return this.counts[0]+this.counts[1];}
 get local(){return this.counts[0];} get remote(){return this.counts[1];}
 sample(ms:number){
  if(ms<=0||ms>250)return;
  if(ms>33){this.slow++;this.fast=0;}else{this.slow=Math.max(0,this.slow-1);if(ms<22)this.fast++;}
  if(this.slow>=8){this.quality=Math.max(.25,this.quality*.65);this.slow=0;}
  if(this.fast>=240){this.quality=Math.min(1,this.quality+.1);this.fast=0;}
 }
}
