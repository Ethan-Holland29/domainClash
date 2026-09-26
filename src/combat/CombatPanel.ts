import { CombatManager } from './CombatManager';
import type { CombatAction, FighterState } from './CombatManager';
import { PORTRAITS } from '../characters/Portraits';
import { CHARACTERS } from '../characters/Characters';
import { GESTURE_LABELS } from '../handTracking/GestureTypes';
import type { GestureType } from '../handTracking/GestureTypes';
import { MOVE_DETAILS, PASSIVES } from './CombatRules';

export class CombatPanel {
  private seenTechnique = -1;
  private seenPassive = -1;
  private manager: CombatManager;
  private container: HTMLElement;
  private send: (gesture: GestureType) => void = () => {};
  private buttonsKey = '';
  private logKey = '';
  constructor(container: HTMLElement, manager: CombatManager, onReset: () => void) {
    this.manager = manager; this.container = container;
    container.innerHTML = `<header class="duel-heading"><h2>DOMAIN CLASH</h2><span id="duel-turn"></span></header><label class="opponent-picker">Opponent <select id="fight-opponent"></select></label><div id="fight-stats"></div><details class="passive-details"><summary>Your passive ability</summary><p id="fight-passive"></p></details><div id="fight-effects" aria-live="polite"></div><div class="actions"><button id="fight-start">Start match</button><button id="fight-reset">Restart match</button></div><div id="fight-buttons" class="actions"></div><details class="combat-rules"><summary>Move details and combat rules</summary><div id="fight-move-details"></div><p>Regular techniques must wait two of your turns before reuse; Gojo’s Red and Blue wait three; Ryu’s Granite Blast waits one. Each move cools down separately, including on a miss. Punches, ultimates and Megumi’s summons keep their existing rules. Meter gains and costs apply even on a miss. Yuji rolls Black Flash separately for each of Straight Hands’ four hits. Toji ignores passive damage, but opponents keep meter gains and Sukuna’s finger benefits. At full meter, Toji automatically purges on his next turn. Geto’s Grade 1 guard lasts through the opponent’s following turn; Curse Swallow pauses the next two summons. Uzumaki cannot deal negative damage. Yuta’s Copy rolls any other assigned ultimate, including Hollow Purple, and carries secondary effects; copied Chimera grants one usable summon button. New moves can be played with buttons until their signs are recorded. Summons consume their use when attempted. Dogs bite at the end of your next three actions, including their summon turn. Nue rolls equally among its four damage values. Healing cannot exceed the fighter’s current maximum HP. Hollow Purple unlocks after two attempts each of Red and Blue and costs 100 meter. Recovery turns advance automatically. Mahoraga takes over after three enemy responses; his adaptation halves incoming damage each turn, rounded down. Zero damage is possible.</p><p>Sukuna eats a finger after every third completed turn (including skipped turns), up to five; his maximum HP rises from 175 to 225. Shrine spends all meter, including overcharge. Choso gains stacks from cumulative actual HP lost, including small hits. Supernova spends stacks even on a miss; on hit it blinds for one turn and deals 5 blood damage at the start of each affected turn. Piercing Blood’s bonus lasts for the summoning turn and Megumi’s following turn. Missed summons do not activate the bonus. Ryu’s blast weakens on every attempt; Way Too Sweet restores its damage and heals on success.</p></details><details open class="combat-log"><summary>Battle log</summary><ol id="fight-log" aria-live="polite"></ol></details>`;
    const picker = container.querySelector<HTMLSelectElement>('#fight-opponent')!;
    for (const c of CHARACTERS) { const option = document.createElement('option'); option.value = c.id; option.textContent = c.name; picker.append(option); }
    picker.value = manager.opponent.character.id;
    picker.onchange = () => { onReset(); manager.reset(manager.character, CHARACTERS.find(c => c.id === picker.value)!); this.render(); };
    container.querySelector<HTMLButtonElement>('#fight-start')!.onclick = () => { onReset(); manager.start(); this.render(); };
    container.querySelector<HTMLButtonElement>('#fight-reset')!.onclick = () => { onReset(); manager.reset(); manager.start(); this.render(); };
  }
  setButtons(send: (gesture: GestureType) => void): void { this.send = send; this.buttonsKey = ''; this.render(); }
  private moveDetails(action: CombatAction): string {
    const f = this.manager.player;
    let detail = MOVE_DETAILS[action] ?? '';
    if (action === 'BASIC_PUNCH' && f.character.id === 'toji') detail = '15 damage · +10 meter · 10% miss';
    if (action === 'BASIC_PUNCH' && f.character.id === 'yuji') detail = '10 damage · 33% chance of 20-damage Black Flash · +5 meter · 10% miss';
    if (action === 'BASIC_PUNCH' && f.character.id === 'sukuna') detail = '5 damage · +5 meter · 10% miss';
    if (action === 'BASIC_PUNCH' && f.mahoraga) detail = '30 damage · 10% miss';
    const cooldown = this.manager.cooldownDuration(action);
    return detail + (cooldown && !detail.includes('cooldown') ? ` · ${cooldown}-turn cooldown` : '');
  }
  private fighterText(f: FighterState): string {
    const meter = f.character.meter === 'blood' ? 'Blood' : f.character.meter === 'domain' ? 'Domain' : 'Ultimate';
    return `${f.mahoraga ? 'Mahoraga' : f.character.name}: ${f.hp}/${f.maxHp} HP · ${meter} ${f.meter}/${this.manager.maxMeter(f)}`;
  }
  private effects(f: FighterState): string {
    const effects: string[] = [];
    if (f.character.id === 'toji') effects.push(f.purge ? 'Expelling energy: lose 20 HP and skip' : '100 meter triggers an automatic purge next turn');
    if (f.character.id === 'yuji') effects.push('Black Flash 33% · Straight Hands at 80 meter');
    if (f.character.id === 'yuta') effects.push('+5 meter per attack');
    if (f.character.id === 'geto') effects.push(`Curse: ${f.curseGrade || 'none'} · summon pause: ${f.cursePause} turn(s)`);
    if (f.curseGuard) effects.push('Grade 1 guard: −33% damage');
    if (f.weaponBonus) effects.push('Picked-up tool: +10 damage this turn');
    if (f.borrowedSummons.size) effects.push(`Copied summon: ${[...f.borrowedSummons].map(g => GESTURE_LABELS[g]).join(', ')}`);

    if (f.character.id === 'gojo' && !f.mahoraga) {
      effects.push(`Limitless ${f.meter < 40 ? 'ACTIVE (−20% damage)' : 'inactive'}`);
      effects.push(`Purple: Red ${Math.min(2, f.redUses)}/2 · Blue ${Math.min(2, f.blueUses)}/2`);
    }
    if (f.character.id === 'megumi' && !f.mahoraga) effects.push(`Nue: ${f.usedSummons.has('NUE') ? 'used' : 'available'} · Dogs: ${f.usedSummons.has('DIVINE_DOGS') ? 'used' : 'available'}`);
    if (f.character.id === 'ryu') effects.push(`Granite Blast: ${f.graniteDamage} damage · 1-turn cooldown`);
    if (f.character.id === 'choso') effects.push(`Blood stacks: ${f.bloodStacks} · next stack: ${f.bloodDamageRemainder}/10 damage`);
    if (f.character.id === 'sukuna') effects.push(`Fingers: ${f.fingers}/5 · Cleave: ${15 + 10 * f.fingers} · Shrine: ${15 * Math.floor(f.meter / 30)} damage${f.meter < 100 ? ' (needs 100 meter)' : ''}`);
    if (f.bleedingTurns) effects.push(`Supernova blood: ${f.bleedingTurns} ticks left (5 damage each)`);
    if (f.bloodBlindTurns) effects.push('Blinded: must wipe blood this turn');
    if (f.dogsTurns) effects.push(`Dogs: ${f.dogsTurns} bites left`);
    if (f.voidAttacks) effects.push(`Void: ${f.voidAttacks} attacks affected`);
    if (f.recovery) effects.push(`Recovery: ${f.recovery} skipped turns left`);
    if (f.summonCountdown !== null) effects.push(`Mahoraga: ${f.summonCountdown} turns until takeover`);
    if (f.mahoraga) effects.push(`Adaptation: ${Number((f.adaptation * 100).toFixed(2))}% damage reduction`);
    return effects.join(' · ');
  }
  render(): void {
    const m = this.manager;
    m.showNextPassive();
    const popup = document.querySelector<HTMLElement>('#passive-popup')!;
    popup.hidden = !m.passivePopup;
    if (m.passivePopup && m.passivePopup.serial !== this.seenPassive) {
      const event = m.passivePopup;
      this.seenPassive = event.serial;
      popup.dataset.side = event.side;
      popup.querySelector('.passive-owner')!.textContent = `PLAYER ${event.side === 'player' ? '1' : '2'} · ${event.character}`;
      popup.querySelector('.passive-name')!.textContent = event.name;
      popup.classList.remove('passive-enter');
      void popup.offsetWidth;
      popup.classList.add('passive-enter');
    }

    if (m.techniqueSerial !== this.seenTechnique) {
      this.seenTechnique = m.techniqueSerial;
      const reveal = document.querySelector<HTMLElement>('#technique-reveal')!;
      reveal.textContent = m.technique; reveal.classList.remove('burst');
      if (m.technique) { void reveal.offsetWidth; reveal.classList.add('burst'); }
    }
    this.container.querySelector('#duel-turn')!.textContent = m.status === 'playing' ? `TURN ${m.turnNumber} / PLAYER ${m.turn === 'player' ? '1' : '2'}` : m.status === 'won' ? 'VICTORY' : m.status === 'lost' ? 'DEFEAT' : 'PREPARE TO FIGHT';
    this.container.dataset.turn = m.turn;
    this.container.dataset.result = m.status;
    document.querySelector<HTMLElement>('#app')!.style.setProperty('--battle-scene', `url("${PORTRAITS[m.character.id].background}")`);
    const stats = this.container.querySelector('#fight-stats')!;
    for (const [index, f] of [m.player, m.opponent].entries()) {
      let card = stats.children[index] as HTMLElement | undefined;
      if (!card) {
        card = document.createElement('div'); card.className = 'duel-fighter';
        card.innerHTML = '<img alt=""><div class="duel-fighter-info"><small></small><strong></strong><div class="hp-track"><i></i></div><span class="hp-label"></span><div class="meter-track"><i></i></div><span class="meter-label"></span></div>';
        stats.append(card);
      }
      card.dataset.side = index === 0 ? 'player' : 'enemy';
      const portrait = card.querySelector('img')!;
      const src = PORTRAITS[f.character.id].image;
      if (portrait.getAttribute('src') !== src) portrait.src = src;
      card.querySelector('small')!.textContent = `PLAYER ${index + 1}${m.status === 'playing' && (index === 0 ? m.turn === 'player' : m.turn === 'enemy') ? ' / YOUR MOVE' : ''}`;
      card.querySelector('strong')!.textContent = f.mahoraga ? 'Mahoraga' : f.character.name;
      const hp = card.querySelector<HTMLElement>('.hp-track i')!;
      hp.style.width = `${Math.max(0, f.hp / f.maxHp * 100)}%`;
      card.querySelector('.hp-label')!.textContent = `${f.hp} / ${f.maxHp} HP`;
      card.querySelector<HTMLElement>('.meter-track i')!.style.width = `${f.meter / m.maxMeter(f) * 100}%`;
      card.querySelector('.meter-label')!.textContent = `${f.character.meter.toUpperCase()} ${f.meter} / ${m.maxMeter(f)}`;
      card.setAttribute('aria-label', this.fighterText(f));
    }
    this.container.querySelector('#fight-passive')!.textContent = PASSIVES[m.character.id] ?? (m.character.plannedKit ? `Basic Punch is available. Technique: ${m.character.plannedKit.technique ?? 'None'}. Ultimate: ${m.character.plannedKit.ultimate ?? 'None for now'}. New move effects are pending.` : 'Universal combat rules apply.');
    this.container.querySelector('#fight-effects')!.textContent = `You: ${this.effects(m.player) || 'No active effects'}\nOpponent: ${this.effects(m.opponent) || 'No active effects'}`;
    document.querySelector('#combat-status')!.textContent = `${m.message} You ${m.playerHp} HP · Opponent ${m.opponentHp} HP`;
    this.container.querySelector<HTMLButtonElement>('#fight-start')!.disabled = m.status !== 'ready';
    this.container.querySelector<HTMLSelectElement>('#fight-opponent')!.disabled = m.status === 'playing';
    const actions = m.actions(); const key = `${m.character.id}:${actions.join(',')}`;
    if (this.buttonsKey !== key) {
      this.buttonsKey = key;
      this.container.querySelector('#fight-buttons')!.replaceChildren(...actions.map(action => {
        const b = document.createElement('button'); b.dataset.action = action;
        b.onclick = () => { if (action === 'HOLLOW_PURPLE' || m.player.borrowedSummons.has(action as GestureType)) m.attack(action); else this.send(action); this.render(); };
        return b;
      }));
      this.container.querySelector('#fight-move-details')!.replaceChildren(...actions.map(action => {
        const p = document.createElement('p');
        p.textContent = `${action === 'HOLLOW_PURPLE' ? 'Hollow Purple' : GESTURE_LABELS[action]}: ${this.moveDetails(action)}`;
        return p;
      }));
    }
    for (const b of this.container.querySelectorAll<HTMLButtonElement>('[data-action]')) {
      const action = b.dataset.action as CombatAction; const reason = m.unavailable(action);
      const name = m.player.mahoraga ? 'Mahoraga: Strike (30 damage)' : action === 'HOLLOW_PURPLE' ? 'Hollow Purple' : GESTURE_LABELS[action];
      b.disabled = m.status !== 'playing' || m.turn !== 'player' || !!reason;
      b.textContent = `${name}${reason ? ` — ${reason}` : ''}`; b.title = this.moveDetails(action);
    }
    const logKey = JSON.stringify(m.log);
    if (logKey !== this.logKey) {
      this.logKey = logKey;
      this.container.querySelector('#fight-log')!.replaceChildren(...m.log.slice(0,12).map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    }
  }
}
