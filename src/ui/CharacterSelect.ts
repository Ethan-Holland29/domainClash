import { MOVE_SLOTS, SLOT_NAME, characterMoves, type CharacterDefinition } from '../characters/Characters';
import type { GestureDefinition } from '../handTracking/GestureTypes';

/**
 * Character select screen over the stage: one card per character with its
 * three moves. Pick by clicking a card or pressing 1..N.
 */
export class CharacterSelect {
  private readonly element: HTMLDivElement;
  private readonly characters: CharacterDefinition[];
  private readonly moveStatus: (gesture: GestureDefinition) => string;
  onSelect: ((character: CharacterDefinition) => void) | null = null;

  constructor(
    parent: HTMLElement,
    characters: CharacterDefinition[],
    moveStatus: (gesture: GestureDefinition) => string,
  ) {
    this.characters = characters;
    this.moveStatus = moveStatus;
    this.element = document.createElement('div');
    this.element.className = 'character-select';
    this.element.hidden = true;
    parent.appendChild(this.element);

    window.addEventListener('keydown', (e) => {
      if (this.element.hidden || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && this.characters[index]) this.choose(this.characters[index]);
    });
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  /** Shows the screen, highlighting the current character if any. */
  open(current: CharacterDefinition | null = null): void {
    const title = document.createElement('h2');
    title.textContent = 'Choose your sorcerer';
    const cards = document.createElement('div');
    cards.className = 'character-cards';
    this.characters.forEach((c, i) => cards.appendChild(this.card(c, i, c === current)));
    const hint = document.createElement('p');
    hint.className = 'character-hint';
    hint.textContent = `Click a card or press 1-${this.characters.length}. Moves are triggered with hand signs.`;
    this.element.replaceChildren(title, cards, hint);
    this.element.hidden = false;
  }

  close(): void {
    this.element.hidden = true;
  }

  private choose(character: CharacterDefinition): void {
    this.close();
    this.onSelect?.(character);
  }

  private card(character: CharacterDefinition, index: number, selected: boolean): HTMLButtonElement {
    const moves = characterMoves(character);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `character-card${selected ? ' selected' : ''}`;
    card.style.setProperty('--char-color', character.color);

    const name = document.createElement('div');
    name.className = 'character-name';
    name.textContent = `${index + 1}. ${character.name}`;
    card.appendChild(name);

    for (const slot of MOVE_SLOTS) {
      const move = moves[slot];
      const row = document.createElement('div');
      row.className = 'character-move';
      const label = document.createElement('span');
      label.className = 'slot';
      label.textContent = SLOT_NAME[slot];
      const moveName = document.createElement('span');
      moveName.className = 'move';
      moveName.textContent = move.name;
      const status = document.createElement('span');
      status.className = 'status';
      status.textContent = this.moveStatus(move);
      row.append(label, moveName, status);
      card.appendChild(row);
    }
    card.addEventListener('click', () => this.choose(character));
    return card;
  }
}
