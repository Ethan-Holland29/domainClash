import { PORTRAITS } from './Portraits';
import { CHARACTERS } from './Characters';
import { GESTURE_LABELS } from '../handTracking/GestureTypes';

export class CharacterSelect {
  constructor(container: HTMLElement, choose: (id: string) => void) {
    let current = -1;
    container.innerHTML = `<div class="selection-scenery" aria-hidden="true"></div><header class="select-heading"><span>DOMAINCLASH</span><h1>CHARACTER SELECT</h1><span class="select-round">FREE BATTLE / 01</span></header><div class="select-roster"><div class="roster-label"><b>1P</b><span>SELECT YOUR SORCERER</span></div><div class="portrait-grid" aria-label="Character roster"></div><p class="select-hint">Hover to preview · Arrow keys to browse</p></div><div class="select-hero"><div class="hero-ring" aria-hidden="true"></div><div class="hero-streak" aria-hidden="true"></div><img class="hero-art" alt=""><div class="hero-nameplate"><span class="player-badge">1P</span><h2 id="preview-name"></h2></div><div class="hero-copy"><div class="technique-banner"><span>TECHNIQUE</span><p id="preview-abilities"></p></div><div class="technique-banner ultimate-banner"><span id="ultimate-label">ULTIMATE</span><h3 id="preview-ultimate"></h3></div></div></div><footer class="selection-footer"><span>&ldquo;Throughout heaven and earth, I alone am the honored one&rdquo; — Satoru Gojo</span><button id="choose-fighter">Confirm fighter <b>→</b></button></footer>`;
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
      container.querySelector('#preview-abilities')!.textContent = preview.plannedKit ? preview.plannedKit.technique ?? 'None' : preview.abilities.filter(g => g !== 'BASIC_PUNCH').map(g => GESTURE_LABELS[g]).join(' / ') || 'None';
      container.querySelector('#preview-ultimate')!.textContent = preview.plannedKit ? preview.plannedKit.ultimate ?? 'None for now' : preview.ultimate?.name ?? 'None for now';
      container.querySelector('#ultimate-label')!.textContent = 'ULTIMATE';
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
