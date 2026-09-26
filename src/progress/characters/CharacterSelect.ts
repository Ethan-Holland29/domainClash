import { SelectionModel } from './SelectionModel';
import { buildRoster, heroMarkup, markRoster, paintHero } from './SelectionView';
import { CHARACTERS } from './Characters';
import { PORTRAITS } from './Portraits';

export class CharacterSelect {
  private models=[new SelectionModel(),new SelectionModel()];
  constructor(container:HTMLElement,choose:(id:string,opponent:string)=>void,multiplayer:()=>void){
    this.models[1].preview='sukuna';
    container.classList.add('dual-select');
    container.innerHTML=`<div class="selection-scenery" aria-hidden="true"></div><header class="select-heading"><span class="selection-brand">DOMAIN CLASH</span><h1>CHARACTER SELECT</h1><button class="multiplayer-entry">Multiplayer</button></header>
      <section class="local-roster" data-seat="0"><div class="roster-label"><b>P1</b><span>YOUR SORCERER</span></div><div class="portrait-grid" aria-label="Player 1 character roster"></div><p class="local-choice"></p><button class="confirm-pick">Confirm P1 fighter</button><button class="change-pick" hidden>Change P1 pick</button></section>
      <section class="center-preview">${heroMarkup(0)}</section>
      <section class="local-roster" data-seat="1"><div class="roster-label"><b>P2</b><span>SOLO OPPONENT</span></div><div class="portrait-grid" aria-label="Player 2 character roster"></div><p class="local-choice"></p><button class="confirm-pick">Confirm P2 fighter</button><button class="change-pick" hidden>Change P2 pick</button></section>
      <footer class="selection-footer"><span id="local-select-status" role="status">Click to pick · Confirm to lock · Multiplayer to face a friend</span><button id="choose-fighter" disabled>Play solo →</button></footer>`;
    const hero=container.querySelector<HTMLElement>('.fighter-preview')!;
    const paint=(seat:number)=>{
      const m=this.models[seat],panel=container.querySelector<HTMLElement>(`.local-roster[data-seat="${seat}"]`)!;
      markRoster(panel.querySelector('.portrait-grid')!,m.preview,m.confirmed);
      panel.querySelector('.local-choice')!.textContent=`${CHARACTERS.find(c=>c.id===m.preview)!.name} · ${m.confirmed?'CONFIRMED':m.picked?'PICKED':'PREVIEW'}`;
      panel.querySelector<HTMLElement>('.confirm-pick')!.hidden=m.confirmed;panel.querySelector<HTMLElement>('.change-pick')!.hidden=!m.confirmed;
      hero.dataset.seat=String(seat);hero.querySelector('.player-badge')!.textContent=`P${seat+1}`;
      paintHero(hero,m.preview,m.confirmed?'FIGHTER LOCKED':m.picked?'Pick fixed. Confirm when ready.':'Click a portrait to fix your pick.');
      container.querySelector<HTMLElement>('.selection-scenery')!.style.backgroundImage=`url("${PORTRAITS[m.preview].background}")`;
      container.querySelector<HTMLButtonElement>('#choose-fighter')!.disabled=!this.models.every(m=>m.confirmed);
      container.querySelector('#local-select-status')!.textContent=this.models.every(m=>m.confirmed)?'Both fighters confirmed. Ready for solo battle.':'Click to pick · Confirm to lock · Multiplayer to face a friend';
    };
    for(const seat of [0,1]){
      const panel=container.querySelector<HTMLElement>(`.local-roster[data-seat="${seat}"]`)!;
      buildRoster(panel.querySelector('.portrait-grid')!,seat,id=>{if(this.models[seat].hover(id))paint(seat);},id=>{this.models[seat].pick(id);paint(seat);});
      panel.querySelector<HTMLButtonElement>('.confirm-pick')!.onclick=()=>{this.models[seat].confirm();paint(seat);};
      panel.querySelector<HTMLButtonElement>('.change-pick')!.onclick=()=>{this.models[seat].unlock();paint(seat);};
      paint(seat);
    }
    paint(0);
    container.querySelector<HTMLButtonElement>('#choose-fighter')!.onclick=()=>{if(this.models.every(m=>m.confirmed))choose(this.models[0].picked!,this.models[1].picked!);};
    container.querySelector<HTMLButtonElement>('.multiplayer-entry')!.onclick=multiplayer;
  }
}
