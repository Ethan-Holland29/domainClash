import { CHARACTERS } from './Characters';
import { PORTRAITS } from './Portraits';
import type { MatchSnapshot } from '../../multiplayer/MultiplayerClient';
import { CHARACTERS as KITS, MOVES } from '../../../shared/battle.mjs';
import { PASSIVE_CUES, PASSIVES } from '../../combat/CombatRules';

const TITLES: Record<string,string> = {gojo:'Special Grade Sorcerer',yuta:'Special Grade Sorcerer',geto:'Special Grade Sorcerer',yuji:'1st Grade Sorcerer',megumi:'1st Grade Sorcerer',toji:'Homeless Man',ryu:'Culling Game Player',sukuna:'Special Grade Cursed Object',choso:'Cursed Womb Death Painting'};
export function heroMarkup(seat: number): string {
  return `<article class="fighter-preview" data-seat="${seat}"><div class="hero-ring" aria-hidden="true"></div><div class="hero-nameplate"><span class="player-badge">P${seat+1}</span><div class="hero-identity"><h2></h2><small></small></div></div><img class="fighter-art" alt=""><div class="hero-copy"><div class="technique-banner select-passive"><span>PASSIVE ABILITY</span><h3 class="passive-name"></h3><p class="passive-description"></p></div><div class="character-abilities"><span class="abilities-heading">TECHNIQUES &amp; DOMAIN</span><div class="technique-list"></div></div></div><p class="pick-status" role="status"></p><div class="hero-streak" aria-hidden="true"></div></article>`;
}
export function paintHero(root: HTMLElement, id: string, status: string): void {
  const c=CHARACTERS.find(c=>c.id===id)??CHARACTERS[0];
  const changed=root.dataset.fighter!==c.id;
  if(changed){
    root.dataset.fighter=c.id;
    const img=root.querySelector<HTMLImageElement>('.fighter-art')!;img.src=PORTRAITS[c.id].image;img.alt=c.name;
    root.querySelector('h2')!.textContent=c.name;root.querySelector('small')!.textContent=TITLES[c.id];
    root.querySelector('.passive-name')!.textContent=PASSIVE_CUES[c.id]?.name ?? KITS[c.id].passive.name;
    root.querySelector('.passive-description')!.textContent=PASSIVES[c.id] ?? KITS[c.id].passive.text;
    const list=root.querySelector<HTMLElement>('.technique-list')!;list.replaceChildren();
    for(const moveId of KITS[c.id].moves.filter(moveId=>moveId!=='BASIC_PUNCH')){
      const move=MOVES[moveId];if(!move)continue;
      const entry=document.createElement('article');entry.className='ability-detail';
      const heading=document.createElement('h4');heading.textContent=move.name;entry.append(heading);
      list.append(entry);
    }
    root.classList.remove('character-enter');
    void root.offsetWidth;
    root.classList.add('character-enter');
  }
  root.querySelector('.pick-status')!.textContent=status;
}
export function buildRoster(root:HTMLElement,seat:number,preview:(id:string)=>void,pick:(id:string)=>void):void {
  for(const [index,c] of CHARACTERS.entries()){
    const b=document.createElement('button');b.className='portrait-card';b.dataset.id=c.id;b.dataset.seat=String(seat);b.setAttribute('aria-label',c.name);b.setAttribute('aria-pressed','false');
    b.innerHTML=`<span class="tile-player"></span><img class="portrait-art" src="${PORTRAITS[c.id].image}" alt=""><span class="tile-name">${c.name}</span>`;
    b.onmouseenter=()=>preview(c.id);b.onfocus=()=>preview(c.id);b.onclick=()=>pick(c.id);
    b.onkeydown=e=>{const offsets:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowDown:3,ArrowUp:-3};if(e.key in offsets){e.preventDefault();root.querySelectorAll<HTMLButtonElement>('.portrait-card')[(index+offsets[e.key]+CHARACTERS.length)%CHARACTERS.length].focus();}};
    root.append(b);
  }
}
export function markRoster(root:HTMLElement,id:string,locked:boolean):void {
  root.querySelectorAll<HTMLButtonElement>('.portrait-card').forEach(b=>{
    const selected=b.dataset.id===id;
    b.setAttribute('aria-pressed',String(selected));
    b.querySelector<HTMLElement>('.tile-player')!.textContent=selected?`P${Number(b.dataset.seat??0)+1}`:'';
    b.disabled=locked;
  });
}

export function markNetworkRoster(root:HTMLElement,state:MatchSnapshot,localPreviewId:string,locked:boolean):void {
  const localSeat=state.seat,opponentSeat=1-localSeat;
  const local=state.players[localSeat],opponent=state.players[opponentSeat];
  const selectedId=(player:typeof local)=>player?.ready?player.characterId:player?.previewId??player?.characterId??null;
  const opponentId=selectedId(opponent);
  root.querySelectorAll<HTMLButtonElement>('.portrait-card').forEach(card=>{
    const localSelected=!!local&&card.dataset.id===localPreviewId;
    const opponentSelected=!!opponent&&card.dataset.id===opponentId;
    const p1Selected=(localSeat===0&&localSelected)||(opponentSeat===0&&opponentSelected);
    const p2Selected=(localSeat===1&&localSelected)||(opponentSeat===1&&opponentSelected);
    card.dataset.p1Selected=String(p1Selected);
    card.dataset.p2Selected=String(p2Selected);
    card.setAttribute('aria-pressed',String(localSelected));
    card.querySelector<HTMLElement>('.tile-player')!.textContent=p1Selected&&p2Selected?'P1 + P2':p1Selected?'P1':p2Selected?'P2':'';
    card.disabled=locked;
  });
}
