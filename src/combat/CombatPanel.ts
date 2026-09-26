import { CombatManager } from './CombatManager';
import { characterGestures } from '../characters/CharacterTypes';
import { GESTURE_LABELS } from '../handTracking/GestureTypes';
export class CombatPanel {
  private seenTechnique = -1;
  private manager: CombatManager;
  private container: HTMLElement;
  constructor(container: HTMLElement, manager: CombatManager, onReset: () => void) {
    this.manager = manager; this.container = container;
    container.innerHTML = `<h2>Turn-based duel</h2><p>Take your time choosing a sign. One attack ends your turn; the opponent responds once. Leaving Combat pauses the duel.</p><div id="fight-stats"></div><div class="actions"><button id="fight-start">Start match</button><button id="fight-reset">Restart match</button></div><div id="fight-buttons" class="actions"></div><p>Attacks hit immediately in this prototype. Summons and ultimates use placeholder damage; their unique effects come later.</p>`;
    container.querySelector<HTMLButtonElement>('#fight-start')!.onclick = () => { onReset(); manager.start(); this.render(); };
    container.querySelector<HTMLButtonElement>('#fight-reset')!.onclick = () => { onReset(); manager.reset(); manager.start(); this.render(); };
  }
  setButtons(send: (gesture: import('../handTracking/GestureTypes').GestureType) => void): void {
    this.container.querySelector('#fight-buttons')!.replaceChildren(...characterGestures(this.manager.character).map(g => {
      const button = document.createElement('button'); button.dataset.gesture = g; button.onclick = () => send(g); return button;
    })); this.render();
  }
  render(): void {
    const m = this.manager;
    if (m.techniqueSerial !== this.seenTechnique) {
      this.seenTechnique = m.techniqueSerial;
      const reveal = document.querySelector<HTMLElement>('#technique-reveal')!;
      reveal.textContent = m.technique;
      reveal.classList.remove('burst');
      if (m.technique) { void reveal.offsetWidth; reveal.classList.add('burst'); }
    }
    const label = m.character.meter === 'blood' ? 'Blood' : m.character.meter === 'domain' ? 'Domain' : 'Ultimate';
    this.container.querySelector('#fight-stats')!.textContent = `Turn ${m.turnNumber} · ${m.turn === "player" ? "YOUR TURN" : "OPPONENT TURN"} · You: ${m.playerHp}/100 HP · Opponent: ${m.opponentHp}/100 HP · ${label}: ${m.meter}/100`;
    document.querySelector('#combat-status')!.textContent = `${m.message} You ${m.playerHp} HP · Opponent ${m.opponentHp} HP · ${label} ${m.meter}%`;
    this.container.querySelector<HTMLButtonElement>('#fight-start')!.disabled = m.status !== 'ready';
    for (const button of this.container.querySelectorAll<HTMLButtonElement>('[data-gesture]')) {
      const g = button.dataset.gesture as import('../handTracking/GestureTypes').GestureType;
      const remaining = m.remaining(g);
      const unavailable = g === m.character.ultimate?.gesture && m.meter < 100;
      button.disabled = m.status !== 'playing' || m.turn !== 'player' || remaining > 0 || unavailable;
      button.textContent = `${GESTURE_LABELS[g]} — ${remaining ? `${remaining} turn(s)` : unavailable ? 'needs 100 meter' : 'ready'}`;
    }
  }
}
