import { CombatManager } from './CombatManager';
import { CALLOUT_TYPES, type BattleLine, type BattlePlayback } from './BattlePlayback';
import { PORTRAITS } from '../characters/Portraits';
import { CHARACTERS } from '../characters/Characters';
import { GESTURE_LABELS } from '../handTracking/GestureTypes';
import type { GestureType } from '../handTracking/GestureTypes';
import { BASE, CHARACTERS as KITS, MOVES, moveFor, maxMeter, type BattleState, type Fighter, type Side } from '../../../shared/battle.mjs';
import { MOVE_DETAILS } from '../../combat/CombatRules';

/** The restored rule description, shared with character select. */
export function moveSummary(f: Fighter, id: string): string {
  const moveId = moveFor(f, id);
  if (moveId === 'BASIC_PUNCH') {
    if (f.id === 'toji') return '15 damage · +10 meter · 10% miss';
    if (f.id === 'sukuna') return '5 damage · +5 meter · 10% miss';
    if (f.id === 'yuji') return '10 damage · +5 meter · 33% Black Flash chance to double damage';
  }
  return MOVE_DETAILS[moveId] ?? MOVES[moveId].text;
}

/** Short status chips for a fighter card. */
export function statusChips(state: BattleState, side: Side): string[] {
  const f = state.sides[side];
  const chips: string[] = [];
  const stage = (label: string, v: number) => { if (v) chips.push(`${label} ${v > 0 ? '+' : ''}${v}`); };
  stage('Atk', f.stages.atk); stage('Def', f.stages.def); stage('Spd', f.stages.spd);
  if (f.stunned) chips.push('Stunned');
  if (f.bleed) chips.push(`Bleeding ${f.bleed}`);
  if (f.summonCountdown !== null) chips.push(`Mahoraga: ${f.summonCountdown} response(s) remaining`);
  if (state.domain?.owner === side) chips.push(`${MOVES[state.domain.move].name.replace('Domain Expansion: ', '')} · ${state.domain.turns} turn${state.domain.turns === 1 ? '' : 's'}`);
  if (f.mahoraga) chips.push(`Adaptation: ${Math.round(f.adaptation * 100)}% damage reduction`);
  if (f.lastMove === 'GUARD') chips.push('Guard used');
  return chips;
}

/** Fighter cards (portrait, HP following the battle text, cursed energy, status chips); `mySide` is listed first. */
export function renderFighterCards(host: Element, state: BattleState, playback: BattlePlayback, mySide: Side): void {
  for (const [index, side] of ([mySide, 1 - mySide] as Side[]).entries()) {
    const f = state.sides[side];
    let card = host.children[index] as HTMLElement | undefined;
    if (!card) {
      card = document.createElement('div'); card.className = 'duel-fighter';
      card.innerHTML = '<img alt=""><div class="duel-fighter-info"><small></small><strong></strong><div class="hp-track"><i></i></div><span class="hp-label"></span><div class="meter-track"><i></i></div><span class="meter-label"></span><div class="status-chips"></div></div>';
      host.append(card);
    }
    card.dataset.side = index === 0 ? 'player' : 'enemy';
    const portrait = card.querySelector('img')!;
    const src = PORTRAITS[f.id].image;
    if (portrait.getAttribute('src') !== src) portrait.src = src;
    card.querySelector('small')!.textContent = `${index === 0 ? 'YOU' : 'OPPONENT'}${KITS[f.id].mahoraga ? ' · MAHORAGA' : ''}`;
    const name = f.mahoraga ? 'Mahoraga' : f.name;
    card.querySelector('strong')!.textContent = name;
    const hp = playback.shownHp[side], max = playback.shownMaxHp[side];
    const bar = card.querySelector<HTMLElement>('.hp-track i')!;
    bar.style.width = `${Math.max(0, hp / max * 100)}%`;
    bar.dataset.level = hp / max <= 0.2 ? 'low' : hp / max <= 0.5 ? 'mid' : 'high';
    card.querySelector('.hp-label')!.textContent = `${hp} / ${max} HP`;
    const resource = 'METER';
    const ce = playback.shownCe[side];
    const capacity = maxMeter(f);
    card.querySelector<HTMLElement>('.meter-track i')!.style.width = `${Math.min(100, ce / capacity * 100)}%`;
    card.querySelector('.meter-label')!.textContent = `${resource} ${ce} / ${capacity}`;
    const chips = card.querySelector('.status-chips')!;
    const list = statusChips(state, side);
    if (chips.textContent !== list.join('')) chips.replaceChildren(...list.map(t => { const s = document.createElement('span'); s.textContent = t; return s; }));
    card.setAttribute('aria-label', `${name}: ${hp} of ${max} HP, ${resource.toLowerCase()} ${ce}. ${list.join(', ')}`);
  }
}

let popupTimer: ReturnType<typeof setTimeout> | undefined;
export const ABILITY_POPUP_MS = 3200;
/** Keep the camera banner to an ability label; descriptive sentences stay in the log. */
export function abilityPopupText(event: BattleLine['event'], fighter: Fighter): string | null {
  if (!event) return null;
  const actor = fighter.mahoraga ? 'Mahoraga' : fighter.name;
  let ability: string | undefined;
  switch (event.type) {
    case 'passive': case 'immune': ability = event.passive; break;
    case 'black-flash': ability = 'Black Flash'; break;
    case 'adapt': ability = 'Adaptation'; break;
    case 'mahoraga': ability = 'Mahoraga'; break;
    case 'domain-open': case 'domain-clash':
      ability = event.move ? MOVES[event.move]?.name.replace(/^Domain Expansion:\s*/, '') : 'Domain Expansion';
      break;
    default: return null;
  }
  return ability ? `${actor}’s ${ability}` : null;
}
/** Shows a battle-text line: the text box, the live status, the move banner and ability popups. */
export function showBattleLine(box: HTMLElement, state: BattleState, line: BattleLine, mySide: Side): void {
  box.textContent = line.text;
  const event = line.event;
  box.dataset.side = event?.side === undefined ? '' : event.side === mySide ? 'player' : 'enemy';
  document.querySelector('#combat-status')!.textContent = line.text;
  if (event?.type === 'move') {
    const reveal = document.querySelector<HTMLElement>('#technique-reveal')!;
    reveal.textContent = line.text.replace(/^.* used /, '').replace(/!$/, '');
    reveal.classList.remove('burst'); void reveal.offsetWidth; reveal.classList.add('burst');
  }
  if (event && CALLOUT_TYPES.has(event.type ?? '') && event.side !== undefined) {
    const f = state.sides[event.side];
    const popup = document.querySelector<HTMLElement>('#passive-popup')!;
    const label = abilityPopupText(event, f);
    if (!label) { popup.hidden = true; return; }
    popup.hidden = false;
    popup.dataset.side = event.side === mySide ? 'player' : 'enemy';
    popup.querySelector('.passive-owner')!.textContent = `${event.side === mySide ? 'YOU' : 'OPPONENT'} · ${f.mahoraga ? 'Mahoraga' : f.name}`;
    popup.querySelector('.passive-name')!.textContent = label;
    popup.classList.remove('passive-enter'); void popup.offsetWidth; popup.classList.add('passive-enter');
    clearTimeout(popupTimer);
    popupTimer = setTimeout(() => { popup.hidden = true; }, ABILITY_POPUP_MS);
  }
}

export class CombatPanel {
  private manager: CombatManager;
  private container: HTMLElement;
  private send: (gesture: GestureType) => void = () => {};
  private buttonsKey = '';
  private logKey = '';
  private seenLine = -1;

  constructor(container: HTMLElement, manager: CombatManager, onReset: () => void) {
    this.manager = manager; this.container = container;
    container.innerHTML = `<header class="duel-heading"><h2>DOMAIN CLASH</h2><span id="duel-turn"></span></header>
<label class="opponent-picker">Opponent <select id="fight-opponent"></select></label>
<div id="fight-stats"></div>
<p id="battle-text" class="battle-text" role="status" aria-live="polite"></p>
<div class="actions"><button id="fight-start">Start match</button><button id="fight-reset">Restart match</button><button id="fight-skip" hidden>Skip text ▸</button></div>
<div id="fight-buttons" class="actions"></div>
<details class="passive-details"><summary>Passive abilities</summary><p id="fight-passive"></p></details>
<details class="combat-rules"><summary>Moves and battle rules</summary><div id="fight-move-details"></div>
<p>Each round both fighters choose a move. Guard resolves before attacks; otherwise, the order is decided by a coin flip.</p>
<p>Fighters have ${BASE.hp} HP and begin with 0 meter, except Sukuna, who starts at 175 HP. Basic Punch usually deals 10 damage and gains 5 meter; Sukuna deals 5, Toji deals 15 and gains 10, and Yuji may land a double-damage Black Flash. Punches can miss 10% of the time. Techniques usually gain 20 meter and can miss 5% of the time unless their description says otherwise. Meter does not regenerate. Ultimates spend all meter; Yuji's Straight Hands needs 80, and other ultimates need 100.</p>
<p>Guard blocks direct attacks for the round and fails if used on consecutive turns.</p>
<p>Cooldowns block a move for the listed number of full turns after use, including misses. Red and Blue each have a 3-turn cooldown; Granite Blast has a 1-turn cooldown; other regular techniques have a 2-turn cooldown. Character passives, summons, meter costs, and move effects are listed with each ability.</p>
<p>Mahoraga: Megumi can summon it once below 70 HP. After three enemy responses, it appears with ${BASE.mahoragaHp} HP, deals 30 damage, and starts with 20% damage reduction that falls by 4 points each turn.</p>
<p>Supernova makes its target skip a turn to wipe blood, then deals 2 damage per consumed stack at the start of their next 2 turns. Guard blocks direct attacks for the round, but not passives. Ultimates cannot be blocked.</p></details>
<details open class="combat-log"><summary>Battle log</summary><ol id="fight-log" aria-live="off"></ol></details><div id="fight-music-slot"></div>`;
    const picker = container.querySelector<HTMLSelectElement>('#fight-opponent')!;
    for (const c of CHARACTERS) { const option = document.createElement('option'); option.value = c.id; option.textContent = c.name; picker.append(option); }
    picker.value = manager.opponentCharacter.id;
    picker.onchange = () => { onReset(); manager.reset(manager.character, CHARACTERS.find(c => c.id === picker.value)!); this.render(); };
    container.querySelector<HTMLButtonElement>('#fight-start')!.onclick = () => { onReset(); manager.start(); this.render(); };
    container.querySelector<HTMLButtonElement>('#fight-reset')!.onclick = () => { onReset(); manager.reset(); manager.start(); this.render(); };
    container.querySelector<HTMLButtonElement>('#fight-skip')!.onclick = () => { manager.skip(); this.render(); };
  }

  setButtons(send: (gesture: GestureType) => void): void { this.send = send; this.buttonsKey = ''; this.render(); }

  render(): void {
    const m = this.manager;
    const state = m.state;
    const status = m.status;
    this.container.querySelector('#duel-turn')!.textContent =
      status === 'choosing' ? `TURN ${state.turn} · CHOOSE YOUR MOVE` : status === 'resolving' ? `TURN ${state.turn - 1}`
        : status === 'won' ? 'VICTORY' : status === 'lost' ? 'DEFEAT' : status === 'draw' ? 'DRAW' : 'PREPARE TO FIGHT';
    this.container.dataset.result = status === 'won' || status === 'lost' || status === 'draw' ? status : 'playing';
    document.querySelector<HTMLElement>('#app')!.style.setProperty('--battle-scene', `url("${PORTRAITS[m.character.id].background}")`);
    this.renderCards();
    this.renderLine();
    const passive = (f: Fighter, who: string) => `${who} — ${KITS[f.id].passive.name}: ${KITS[f.id].passive.text}`;
    this.container.querySelector('#fight-passive')!.textContent = `${passive(m.player, 'You')}\n${passive(m.opponent, 'Opponent')}`;
    this.container.querySelector<HTMLButtonElement>('#fight-start')!.disabled = status !== 'ready';
    this.container.querySelector<HTMLButtonElement>('#fight-skip')!.hidden = status !== 'resolving';
    this.container.querySelector<HTMLSelectElement>('#fight-opponent')!.disabled = m.playing;
    this.renderButtons();
    const logKey = m.log.length + ':' + m.log[0];
    if (logKey !== this.logKey) {
      this.logKey = logKey;
      const log = this.container.querySelector('#fight-log')!;
      log.replaceChildren(...m.log.slice(0, 20).map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
      log.scrollTop = 0;
    }
  }

  private renderCards(): void {
    renderFighterCards(this.container.querySelector('#fight-stats')!, this.manager.state, this.manager.playback, 0);
  }

  private renderLine(): void {
    const line = this.manager.line;
    if (line.serial === this.seenLine) return;
    this.seenLine = line.serial;
    showBattleLine(this.container.querySelector<HTMLElement>('#battle-text')!, this.manager.state, line, 0);
  }

  private renderButtons(): void {
    const m = this.manager;
    const options = m.options();
    const key = `${m.player.id}:${m.player.mahoraga}:${options.map(o => o.id).join(',')}`;
    const host = this.container.querySelector('#fight-buttons')!;
    if (this.buttonsKey !== key) {
      this.buttonsKey = key;
      host.replaceChildren(...options.map(o => {
        const b = document.createElement('button'); b.dataset.action = o.id; b.className = 'move-button';
        b.innerHTML = '<span class="move-name"></span><span class="move-meta"></span><span class="move-reason"></span>';
        b.onclick = () => {
          // Moves that are hand signs go through the same input path as the camera.
          if (m.player.mahoraga) m.attack(o.id); else this.send(o.id as GestureType);
          this.render();
        };
        return b;
      }));
      this.container.querySelector('#fight-move-details')!.replaceChildren(...options.map(o => {
        const p = document.createElement('p');
        const move = MOVES[moveFor(m.player, o.id)];
        const description = moveSummary(m.player, o.id);
        p.textContent = `${o.name}${this.signHint(o.id)}: ${description}${move.lore ? ` (${move.lore})` : ''}`;
        return p;
      }));
    }
    for (const o of options) {
      const b = host.querySelector<HTMLButtonElement>(`[data-action="${o.id}"]`)!;
      const move = MOVES[moveFor(m.player, o.id)];
      b.disabled = m.status !== 'choosing' || !!o.reason;
      b.querySelector('.move-name')!.textContent = o.name + (o.id === 'GUARD' ? ' · Space' : '');
      b.querySelector('.move-meta')!.textContent = moveSummary(m.player, o.id) || move.text;
      // Reasons describe the next turn, so they wait until the battle text has finished.
      b.querySelector('.move-reason')!.textContent = m.status === 'choosing' ? o.reason ?? '' : '';
      b.dataset.kind = move.domain ? 'domain' : move.kind;
      b.title = `${move.text}${move.lore ? `\n${move.lore}` : ''}${this.signHint(o.id)}`;
    }
  }

  private signHint(id: string): string {
    if (this.manager.player.mahoraga && id === 'BASIC_PUNCH') return ' (Strike sign)';
    return ` (sign: ${GESTURE_LABELS[id as GestureType] ?? id})`;
  }
}
