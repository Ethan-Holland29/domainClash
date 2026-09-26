import { CHARACTERS } from './Characters';
import { PORTRAITS } from './Portraits';
import { PASSIVE_CUES } from '../combat/CombatRules';
import { GESTURE_LABELS } from '../handTracking/GestureTypes';

const TITLES: Record<string,string> = {gojo:'Special Grade Sorcerer',yuta:'Special Grade Sorcerer',geto:'Special Grade Sorcerer',yuji:'1st Grade Sorcerer',megumi:'1st Grade Sorcerer',toji:'Homeless Man',ryu:'Culling Game Player',sukuna:'Special Grade Cursed Object',choso:'Cursed Womb Death Painting'};
export function heroMarkup(seat: number): string {
  return `<article class="fighter-preview" data-seat="${seat}"><div class="hero-nameplate"><span class="player-badge">P${seat+1}</span><div class="hero-identity"><h2></h2><small></small></div></div><img class="fighter-art" alt=""><div class="hero-copy"><div class="technique-banner select-passive"><p></p></div><div class="technique-banner"><span>TECHNIQUE</span><p class="fighter-technique"></p></div><div class="technique-banner ultimate-banner"><span>ULTIMATE</span><h3></h3></div></div><p class="pick-status" role="status"></p></article>`;
}
export function paintHero(root: HTMLElement, id: string, status: string): void {
  const c=CHARACTERS.find(c=>c.id===id)??CHARACTERS[0];
  if(root.dataset.fighter!==c.id){
    root.dataset.fighter=c.id;
    const img=root.querySelector<HTMLImageElement>('.fighter-art')!;img.src=PORTRAITS[c.id].image;img.alt=c.name;
    root.querySelector('h2')!.textContent=c.name;root.querySelector('small')!.textContent=TITLES[c.id];
    root.querySelector('.select-passive p')!.textContent=`Passive ability: ${PASSIVE_CUES[c.id].name}`;
    root.querySelector('.fighter-technique')!.textContent=c.abilities.filter(g=>g!=='BASIC_PUNCH').map(g=>GESTURE_LABELS[g]).join(' / ')||'Basic Punch';
    root.querySelector('h3')!.textContent=c.ultimate?.name??'No active ultimate';
  }
  root.querySelector('.pick-status')!.textContent=status;
}
export function buildRoster(root:HTMLElement,seat:number,preview:(id:string)=>void,pick:(id:string)=>void):void {
  for(const [index,c] of CHARACTERS.entries()){
    const b=document.createElement('button');b.className='portrait-card';b.dataset.id=c.id;b.setAttribute('aria-label',c.name);b.setAttribute('aria-pressed','false');
    b.innerHTML=`<span class="tile-player">P${seat+1}</span><img class="portrait-art" src="${PORTRAITS[c.id].image}" alt=""><span class="tile-name">${c.name}</span>`;
    b.onmouseenter=()=>preview(c.id);b.onfocus=()=>preview(c.id);b.onclick=()=>pick(c.id);
    b.onkeydown=e=>{const offsets:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowDown:3,ArrowUp:-3};if(e.key in offsets){e.preventDefault();root.querySelectorAll<HTMLButtonElement>('button')[(index+offsets[e.key]+9)%9].focus();}};
    root.append(b);
  }
}
export function markRoster(root:HTMLElement,id:string,locked:boolean):void {
  root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.id===id));b.disabled=locked;});
}
