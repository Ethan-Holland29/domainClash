import { Moves, MoveById } from '../combat/MoveCatalog';
import type { AbilityId } from '../combat/AbilityTypes';
export function pageMoves(page:number) { const start=Math.min(Math.max(0,page)*3,Moves.length-3);return Moves.slice(start,start+3); }
export class MoveDock {
 private page=0;
 private selected:AbilityId[]|null=null;
 setMoves(ids:AbilityId[]):void {this.selected=ids;this.page=0;this.render();}
 private moves(){return this.selected?this.selected.map(id=>MoveById[id]):pageMoves(this.page);}
 private wheelAt=0;
 private touchY=0;
 readonly root:HTMLElement;
 private cast:(id:AbilityId)=>void;
 private changed:(ids:AbilityId[])=>void;
 constructor(cast:(id:AbilityId)=>void,changed:(ids:AbilityId[])=>void,signal:AbortSignal){
  this.cast=cast;this.changed=changed;
  this.root=document.querySelector('.technique-dock')!;
  this.root.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-ability]');if(b)this.cast(b.dataset.ability as AbilityId);},{signal});
  this.root.addEventListener('wheel',e=>{e.preventDefault();if(Math.abs(e.deltaY)>8&&performance.now()-this.wheelAt>280){this.move(Math.sign(e.deltaY));this.wheelAt=performance.now();}},{passive:false,signal});
  this.root.addEventListener('touchstart',e=>{this.touchY=e.touches[0].clientY;},{passive:true,signal});
  this.root.addEventListener('touchend',e=>{const delta=this.touchY-e.changedTouches[0].clientY;if(Math.abs(delta)>40)this.move(Math.sign(delta));},{signal});
  document.getElementById('moves-up')!.addEventListener('click',()=>this.move(-1),{signal});
  document.getElementById('moves-down')!.addEventListener('click',()=>this.move(1),{signal});
  this.render();
 }
 get ids():AbilityId[]{return this.moves().map(m=>m.id);}
 move(direction:number):void {if(this.selected)return;const next=Math.max(0,Math.min(Math.ceil(Moves.length/3)-1,this.page+direction));if(next!==this.page){this.page=next;this.render();}}
 private render():void {
  this.root.innerHTML=this.moves().map((m,i)=>`<button data-ability="${m.id}" class="technique" style="--move-color:${m.color}"><span class="technique-index">${i+1} · READY</span><span class="technique-name">${m.name}</span><small>${m.short}</small></button>`).join('');
  document.getElementById('move-page')!.textContent=`${this.page+1} / ${Math.ceil(Moves.length/3)} · Scroll here ↕ · Keys 1–3 cast visible moves`;
  (document.getElementById('moves-up') as HTMLButtonElement).disabled=this.page===0;
  (document.getElementById('moves-down') as HTMLButtonElement).disabled=this.page===Math.ceil(Moves.length/3)-1;
  if(this.selected){document.getElementById('move-page')!.textContent='YOUR TECHNIQUES · Keys 1 / 2 / 3 · Hold a sign, then release';(document.getElementById('moves-up') as HTMLButtonElement).hidden=true;(document.getElementById('moves-down') as HTMLButtonElement).hidden=true;}
  this.changed(this.ids);
 }
}
