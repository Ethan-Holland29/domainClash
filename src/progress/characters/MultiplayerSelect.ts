import type { MatchSnapshot } from '../../multiplayer/MultiplayerClient';
import { SelectionModel } from './SelectionModel';
import { buildRoster, heroMarkup, markRoster, paintHero } from './SelectionView';
import { PORTRAITS } from './Portraits';

export class MultiplayerSelect {
  private model=new SelectionModel();
  private round=0;
  private code='';
  private seat=-1;
  private busy=false;
  private lastPreview=0;
  private pendingPreview=0;
  private state:MatchSnapshot|null=null;
  private root:HTMLElement;
  private preview:(id:string)=>void;
  private confirm:(id:string)=>Promise<boolean>;
  constructor(root:HTMLElement,preview:(id:string)=>void,confirm:(id:string)=>Promise<boolean>,leave:()=>void){
    this.root=root;this.preview=preview;this.confirm=confirm;
    root.className='network-select';
    root.innerHTML=`<div class="selection-scenery"></div><header class="select-heading"><span class="selection-brand">DOMAIN CLASH</span><h1>PRIVATE MATCH</h1><span class="room-label"></span></header><div class="network-hero" data-slot="0">${heroMarkup(0)}</div><section class="network-roster"><div class="roster-label"><b class="your-seat">P1</b><span>SELECT YOUR SORCERER</span></div><div class="portrait-grid" aria-label="Private match character roster"></div><p class="select-hint">Hover to preview · Click to fix your pick</p><button class="confirm-network">Confirm fighter · Play with both</button><p class="selection-message" role="status"></p></section><div class="network-hero" data-slot="1">${heroMarkup(1)}</div><footer class="selection-footer"><span>Both players confirm to begin. Your confirmed fighter stays locked.</span><button class="leave-selection">Leave private match</button></footer>`;
    root.querySelector<HTMLButtonElement>('.leave-selection')!.onclick=leave;
    root.querySelector<HTMLButtonElement>('.confirm-network')!.onclick=async()=>{
      if(this.busy||this.model.confirmed)return;this.busy=true;this.render();
      clearTimeout(this.pendingPreview);
      if(await this.confirm(this.model.preview))this.model.confirm();
      this.busy=false;this.render();
    };
  }
  update(state:MatchSnapshot):void {
    this.state=state;
    if(this.code!==state.code||this.seat!==state.seat||this.round!==(state.round??1)){
      this.code=state.code;
      this.root.dataset.seat=String(state.seat);
      this.seat=state.seat;this.round=state.round??1;this.model=new SelectionModel();this.model.preview=state.players[this.seat]?.characterId??'gojo';
      const grid=this.root.querySelector<HTMLElement>('.portrait-grid')!;grid.replaceChildren();
      buildRoster(grid,this.seat,id=>{if(this.model.hover(id)){this.queuePreview(id);this.render();}},id=>{this.model.pick(id);this.queuePreview(id);this.render();});
      this.root.querySelector('.your-seat')!.textContent=`P${this.seat+1}`;
    }
    if(state.players[this.seat]?.ready){this.model.preview=state.players[this.seat]!.characterId!;this.model.confirm();}
    this.render();
  }
  private queuePreview(id:string):void {
    clearTimeout(this.pendingPreview);
    this.pendingPreview=window.setTimeout(()=>{this.lastPreview=performance.now();this.preview(id);},Math.max(0,120-(performance.now()-this.lastPreview)));
  }
  private render():void {
    const s=this.state;if(!s)return;
    this.root.querySelector('.room-label')!.textContent=`ROOM ${s.code} · YOU ARE P${s.seat+1}`;
    this.root.querySelector<HTMLElement>('.selection-scenery')!.style.backgroundImage=`url("${PORTRAITS[this.model.preview].background}")`;
    for(const seat of [0,1]){
      const p=s.players[seat],hero=this.root.querySelector<HTMLElement>(`[data-slot="${seat}"] .fighter-preview`)!;
      paintHero(hero,seat===s.seat?this.model.preview:p?.ready?p.characterId!:p?.previewId??p?.characterId??'sukuna',!p?'WAITING FOR PLAYER':p.ready?'CONFIRMED · FIGHTER LOCKED':seat===s.seat?'YOUR PICK':'CHOOSING A FIGHTER');
      hero.classList.toggle('vacant',!p);hero.classList.toggle('confirmed',!!p?.ready);
    }
    markRoster(this.root.querySelector('.portrait-grid')!,this.model.preview,this.model.confirmed||this.busy);
    const b=this.root.querySelector<HTMLButtonElement>('.confirm-network')!;b.disabled=this.model.confirmed||this.busy;
    b.textContent=this.busy?'Confirming…':this.model.confirmed?'Fighter confirmed':'Confirm fighter · Play with both';
    this.root.querySelector('.selection-message')!.textContent=this.model.confirmed?'Waiting for the other player to confirm.':!s.players[1-s.seat]?'Share your room code with a friend.':'Choose a fighter, then confirm. Both players enter together.';
  }
  dispose():void{clearTimeout(this.pendingPreview);}
}
