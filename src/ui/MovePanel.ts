import { MOVE_SLOTS, SLOT_NAME, type CharacterDefinition, type MoveSlot } from '../characters/Characters';
import type { GestureDefinition, GestureSnapshot } from '../handTracking/GestureTypes';

interface SlotRow {
  gesture: GestureDefinition;
  bar: HTMLDivElement;
  status: HTMLSpanElement;
  row: HTMLDivElement;
}

/**
 * The selected character and its three moves, each with a live match bar
 * and whether it is learned from recordings yet.
 */
export class MovePanel {
  private readonly element: HTMLElement;
  private readonly title: HTMLSpanElement;
  private readonly slots: HTMLDivElement;
  private readonly moveStatus: (gesture: GestureDefinition) => string;
  private rows: SlotRow[] = [];
  onChangeCharacter: (() => void) | null = null;

  constructor(parent: HTMLElement, moveStatus: (gesture: GestureDefinition) => string) {
    this.moveStatus = moveStatus;
    this.element = document.createElement('section');
    this.element.className = 'move-panel';
    this.element.hidden = true;

    const header = document.createElement('div');
    header.className = 'move-header';
    this.title = document.createElement('span');
    this.title.className = 'move-character';
    const change = document.createElement('button');
    change.type = 'button';
    change.textContent = 'Change character (C)';
    change.addEventListener('click', () => this.onChangeCharacter?.());
    header.append(this.title, change);

    this.slots = document.createElement('div');
    this.slots.className = 'move-slots';
    this.element.append(header, this.slots);
    parent.appendChild(this.element);
  }

  setCharacter(character: CharacterDefinition, moves: Record<MoveSlot, GestureDefinition>): void {
    this.element.style.setProperty('--char-color', character.color);
    this.title.textContent = character.name;
    this.rows = MOVE_SLOTS.map((slot) => {
      const row = document.createElement('div');
      row.className = 'move-slot';
      const label = document.createElement('span');
      label.className = 'slot';
      label.textContent = SLOT_NAME[slot];
      const name = document.createElement('span');
      name.className = 'move';
      name.textContent = moves[slot].name;
      const track = document.createElement('div');
      track.className = 'move-bar';
      const bar = document.createElement('div');
      track.appendChild(bar);
      const status = document.createElement('span');
      status.className = 'status';
      row.append(label, name, track, status);
      return { gesture: moves[slot], bar, status, row };
    });
    this.slots.replaceChildren(...this.rows.map((r) => r.row));
    this.refreshStatus();
    this.element.hidden = false;
  }

  /** Re-reads learned/untaught status (call after the dataset changes). */
  refreshStatus(): void {
    for (const r of this.rows) r.status.textContent = this.moveStatus(r.gesture);
  }

  update(snapshot: GestureSnapshot | null): void {
    for (const r of this.rows) {
      const status = snapshot?.gestures.find((g) => g.definition.id === r.gesture.id);
      const score = status?.score ?? 0;
      r.bar.style.width = `${Math.round(score * 100)}%`;
      const active = snapshot?.active?.id === r.gesture.id;
      r.row.classList.toggle('holding', active && snapshot?.phase === 'candidate');
      r.row.classList.toggle('fired', active && snapshot?.phase === 'confirmed');
    }
  }
}
