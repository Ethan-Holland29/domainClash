import { PORTRAITS } from './Portraits';
import { PASSIVE_CUES } from '../combat/CombatRules';
import { CHARACTERS } from './Characters';
import { GESTURE_LABELS } from '../handTracking/GestureTypes';
import {signHint} from '../integration/Signs';

const CHARACTER_TITLES: Record<string, string> = {
 gojo: 'Special Grade Sorcerer', yuta: 'Special Grade Sorcerer', geto: 'Special Grade Sorcerer',
 yuji: '1st Grade Sorcerer', megumi: '1st Grade Sorcerer', toji: 'Homeless Man',
 ryu: 'Culling Game Player', sukuna: 'Special Grade Cursed Object', choso: 'Cursed Womb Death Painting',
};
export class CharacterSelect {
  constructor(container: HTMLElement, choose: (id: string) => void) {
    let current = -1;
    container.innerHTML = `<div class="selection-scenery" aria-hidden="true"></div><header class="select-heading"><span class="selection-brand">DOMAIN CLASH</span><h1>CHARACTER SELECT</h1><span class="select-round">FREE BATTLE / 01</span></header><div class="select-roster"><div class="roster-label"><b>1P</b><span>SELECT YOUR SORCERER</span></div><div class="portrait-grid" aria-label="Character roster"></div><p class="select-hint">Hover to preview · Arrow keys to browse</p></div><div class="select-hero"><div class="hero-ring" aria-hidden="true"></div><div class="hero-streak" aria-hidden="true"></div><img class="hero-art" alt=""><div class="hero-nameplate"><span class="player-badge">1P</span><div class="hero-identity"><h2 id="preview-name"></h2><span id="preview-title"></span></div></div><div class="hero-copy"><div class="technique-banner select-passive"><p id="preview-passive"></p></div><div class="technique-banner"><span>TECHNIQUE</span><p id="preview-abilities"></p></div><div class="technique-banner ultimate-banner"><span id="ultimate-label">ULTIMATE</span><h3 id="preview-ultimate"></h3></div></div></div><footer class="selection-footer"><span>&ldquo;Throughout heaven and earth, I alone am the honored one&rdquo; — Satoru Gojo</span><button id="choose-fighter">Confirm fighter <b>→</b></button></footer>`;
    const hero = container.querySelector<HTMLElement>('.select-hero')!;
    const art = container.querySelector<HTMLImageElement>('.hero-art')!;
    const show = (index: number) => {
      if (index === current) return;
      current = index;
      const preview = CHARACTERS[index];
      art.src = PORTRAITS[preview.id].image;
      art.alt = preview.name;
      container.querySelector<HTMLElement>('.selection-scenery')!.style.backgroundImage = `url("${PORTRAITS[preview.id].background}")`;
      container.dataset.fighter = preview.id;
      container.style.setProperty('--fighter-color', PORTRAITS[preview.id].color);
      container.querySelector('#preview-name')!.textContent = preview.name;
      container.querySelector('#preview-title')!.textContent = CHARACTER_TITLES[preview.id];
      container.querySelector('#preview-passive')!.textContent = `Passive ability: ${PASSIVE_CUES[preview.id].name}`;
      container.querySelector('#preview-abilities')!.textContent = preview.plannedKit ? preview.plannedKit.technique ?? 'None' : preview.abilities.filter(g => g !== 'BASIC_PUNCH').map(g => GESTURE_LABELS[g]).join(' / ') || 'None';
      container.querySelector('#preview-ultimate')!.textContent = preview.plannedKit ? preview.plannedKit.ultimate ?? 'None' : preview.ultimate?.name ?? 'None';
      container.querySelector('#ultimate-label')!.textContent = 'ULTIMATE';
      container.querySelectorAll('.sign-guide').forEach(el=>el.remove());
      for(const [selector,moves] of [['#preview-abilities',preview.abilities],['#preview-ultimate',preview.ultimate?[preview.ultimate.gesture]:[]]] as const){
        const guide=document.createElement('div');guide.className='sign-guide';
        for(const move of moves){const line=document.createElement('p');line.textContent=`${GESTURE_LABELS[move]}: ${signHint(move)}`;guide.append(line);}
        container.querySelector(selector)!.after(guide);
      }
      container.querySelectorAll<HTMLButtonElement>('.portrait-card').forEach((b, i) => b.setAttribute('aria-pressed', String(index === i)));
      // Restart only when the character changes; rapid hovering cancels the old entrance.
      hero.classList.remove('character-enter');
      void hero.offsetWidth;
      hero.classList.add('character-enter');
    };
    CHARACTERS.forEach((character, index) => {
      const button = document.createElement('button');
      button.className = 'portrait-card';
      button.setAttribute('aria-label', character.name);
      button.innerHTML = `<span class="tile-player">1P</span><img class="portrait-art" src="${PORTRAITS[character.id].image}" alt=""><span class="tile-name">${character.name}</span>`;
      button.onmouseenter = () => show(index);
      button.onfocus = () => show(index);
      button.onclick = () => show(index);
      button.onkeydown = event => {
        const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
        if (!(event.key in offsets)) return;
        event.preventDefault();
        const next = (index + offsets[event.key] + CHARACTERS.length) % CHARACTERS.length;
        container.querySelectorAll<HTMLButtonElement>('.portrait-card')[next].focus();
      };
      container.querySelector('.portrait-grid')!.appendChild(button);
    });
    for (let slot = CHARACTERS.length; slot < 9; slot++) {
      const empty = document.createElement('div');
      empty.className = 'roster-empty';
      empty.setAttribute('aria-hidden', 'true');
      container.querySelector('.portrait-grid')!.appendChild(empty);
    }
    container.querySelector<HTMLButtonElement>('#choose-fighter')!.onclick = () => choose(CHARACTERS[current].id);
    show(0);
  }
}
