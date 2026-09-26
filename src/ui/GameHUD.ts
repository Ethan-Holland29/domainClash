import { MOVE_SLOTS, SLOT_NAME, type CharacterDefinition, type MoveSlot } from '../characters/Characters';
import type { CombatSnapshot } from '../combat/CombatManager';
import type { GestureDefinition, GestureSnapshot } from '../handTracking/GestureTypes';

interface AbilityCard {
  slot: MoveSlot;
  move: GestureDefinition;
  root: HTMLDivElement;
  state: HTMLSpanElement;
  hold: HTMLDivElement;
  teach: HTMLSpanElement;
}

/**
 * The in-game HUD drawn over the camera view: both fighters' HP, the Domain
 * Meter, the three ability cards (ready / cooldown / domain readiness), and
 * which hand sign is being recognised. Debug information lives elsewhere.
 */
export class GameHUD {
  private readonly root: HTMLDivElement;
  private readonly playerName: HTMLSpanElement;
  private readonly playerHp: HTMLDivElement;
  private readonly playerHpText: HTMLSpanElement;
  private readonly meterBox: HTMLDivElement;
  private readonly meterFill: HTMLDivElement;
  private readonly meterText: HTMLSpanElement;
  private readonly domainBox: HTMLDivElement;
  private readonly domainName: HTMLSpanElement;
  private readonly domainTime: HTMLSpanElement;
  private readonly domainFill: HTMLDivElement;
  private readonly opponentHp: HTMLDivElement;
  private readonly opponentHpText: HTMLSpanElement;
  private readonly opponentStatus: HTMLDivElement;
  private readonly recognized: HTMLDivElement;
  private readonly abilities: HTMLDivElement;
  private readonly moveStatus: (move: GestureDefinition) => { learned: boolean; hint: string };
  private cards: AbilityCard[] = [];

  constructor(
    stage: HTMLElement,
    opponentName: string,
    moveStatus: (move: GestureDefinition) => { learned: boolean; hint: string },
  ) {
    this.moveStatus = moveStatus;
    this.root = document.createElement('div');
    this.root.className = 'game-hud';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-fighter player">
          <div class="hud-label"><span class="hud-name"></span><span class="hud-hp-text"></span></div>
          <div class="hud-bar hp"><div></div></div>
          <div class="hud-meter">
            <div class="hud-label small"><span>DOMAIN</span><span class="hud-meter-text"></span></div>
            <div class="hud-bar meter"><div></div></div>
          </div>
          <div class="hud-domain" hidden>
            <div class="hud-label small"><span class="hud-domain-name"></span><span class="hud-domain-time"></span></div>
            <div class="hud-bar domain-timer"><div></div></div>
          </div>
        </div>
        <div class="hud-fighter opponent">
          <div class="hud-label"><span class="hud-hp-text"></span><span class="hud-name"></span></div>
          <div class="hud-bar hp"><div></div></div>
          <div class="hud-opponent-status"></div>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="hud-recognized"></div>
        <div class="hud-abilities"></div>
      </div>
    `;
    stage.appendChild(this.root);
    const q = <T extends Element>(sel: string) => this.root.querySelector<T>(sel)!;
    this.playerName = q('.player .hud-name');
    this.playerHp = q('.player .hp div');
    this.playerHpText = q('.player .hud-hp-text');
    this.meterBox = q('.hud-meter');
    this.meterFill = q('.meter div');
    this.meterText = q('.hud-meter-text');
    this.domainBox = q('.hud-domain');
    this.domainName = q('.hud-domain-name');
    this.domainTime = q('.hud-domain-time');
    this.domainFill = q('.domain-timer div');
    this.opponentHp = q('.opponent .hp div');
    this.opponentHpText = q('.opponent .hud-hp-text');
    this.opponentStatus = q('.hud-opponent-status');
    this.recognized = q('.hud-recognized');
    this.abilities = q('.hud-abilities');
    q<HTMLSpanElement>('.opponent .hud-name').textContent = opponentName;
  }

  setCharacter(character: CharacterDefinition, moves: Record<MoveSlot, GestureDefinition>): void {
    this.root.style.setProperty('--char-color', character.color);
    this.playerName.textContent = character.name;
    this.cards = MOVE_SLOTS.map((slot) => {
      const root = document.createElement('div');
      root.className = `ability-card ${slot}`;
      root.innerHTML = `
        <div class="ability-cooldown"></div>
        <span class="ability-slot">${SLOT_NAME[slot]}</span>
        <span class="ability-name"></span>
        <span class="ability-state"></span>
        <span class="ability-teach"></span>
        <div class="ability-hold"><div></div></div>
      `;
      root.querySelector('.ability-name')!.textContent = moves[slot].name;
      return {
        slot,
        move: moves[slot],
        root,
        state: root.querySelector('.ability-state')!,
        hold: root.querySelector('.ability-hold div')!,
        teach: root.querySelector('.ability-teach')!,
      };
    });
    this.abilities.replaceChildren(...this.cards.map((c) => c.root));
    this.refreshTeachHints();
    this.root.hidden = false;
  }

  /** Re-reads which moves still need recorded samples (call after the dataset changes). */
  refreshTeachHints(): void {
    for (const c of this.cards) {
      const { learned, hint } = this.moveStatus(c.move);
      c.teach.textContent = learned ? '' : hint;
    }
  }

  update(fight: CombatSnapshot, gesture: GestureSnapshot | null): void {
    // Fighters
    this.playerHp.style.width = `${(fight.playerHp / fight.maxHp) * 100}%`;
    this.playerHpText.textContent = `${fight.playerHp}`;
    this.opponentHp.style.width = `${(fight.opponentHp / fight.maxHp) * 100}%`;
    this.opponentHpText.textContent = `${fight.opponentHp}`;
    this.root.classList.toggle('player-low', fight.playerHp <= 25);

    // Domain Meter
    this.meterFill.style.width = `${fight.meter}%`;
    this.meterText.textContent = fight.domainReady ? 'READY' : `${fight.meter}%`;
    this.meterBox.classList.toggle('ready', fight.domainReady);

    // Active Domain: name + countdown
    const domain = fight.domain;
    this.domainBox.hidden = !domain;
    this.root.classList.toggle('domain-up', !!domain);
    if (domain) {
      this.domainName.textContent = domain.name.toUpperCase();
      this.domainTime.textContent = `${(domain.remainingMs / 1000).toFixed(1)}s`;
      this.domainFill.style.width = `${(domain.remainingMs / domain.durationMs) * 100}%`;
    }

    // Opponent intent
    const status =
      fight.phase !== 'fighting' ? '' :
      domain?.effect.stunsOpponent ? 'FROZEN IN THE VOID' :
      fight.opponentState === 'windup' ? `WINDING UP! ${(fight.opponentWindupMs / 1000).toFixed(1)}s` :
      fight.opponentState === 'guard' ? 'GUARDING' : '';
    this.opponentStatus.textContent = status;
    this.opponentStatus.className = `hud-opponent-status ${fight.opponentState}`;

    // Ability cards
    for (const c of this.cards) {
      const g = gesture?.gestures.find((x) => x.definition.id === c.move.id);
      const isActive = gesture?.active?.id === c.move.id;
      const holding = isActive && gesture?.phase === 'candidate';
      c.hold.style.width = `${Math.round((holding ? gesture!.holdProgress : 0) * 100)}%`;
      c.root.classList.toggle('holding', !!holding);
      c.root.classList.toggle('cast', !!(isActive && gesture?.phase === 'confirmed'));
      c.root.style.setProperty('--match', `${Math.round((g?.score ?? 0) * 100)}%`);

      if (c.slot === 'ultimate') {
        c.root.classList.toggle('ready', fight.domainReady && !domain);
        c.root.classList.toggle('active', !!domain);
        c.root.style.setProperty('--cooldown', domain ? '0' : `${1 - fight.meter / 100}`);
        c.state.textContent = domain
          ? `ACTIVE ${(domain.remainingMs / 1000).toFixed(1)}s`
          : fight.domainReady ? 'DOMAIN READY' : `${fight.meter}%`;
      } else {
        const remaining = fight.cooldowns[c.slot];
        const total = fight.cooldownDurations[c.slot] || 1;
        c.root.classList.toggle('ready', remaining === 0);
        c.root.style.setProperty('--cooldown', `${remaining / total}`);
        c.state.textContent = remaining === 0 ? 'READY' : `${(remaining / 1000).toFixed(1)}s`;
      }
    }

    // Which sign is being read right now
    this.recognized.textContent = recognizedText(gesture);
  }

  /** Brief flash on a fighter's HP bar when they take damage. */
  flash(who: 'player' | 'opponent'): void {
    const el = this.root.querySelector<HTMLElement>(`.hud-fighter.${who}`)!;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
}

function recognizedText(g: GestureSnapshot | null): string {
  if (!g) return '';
  if (g.moving) return 'Hold your hands still';
  if (g.active) {
    return g.phase === 'confirmed' ? `${g.active.name}!` : `Holding: ${g.active.name} ${Math.round(g.holdProgress * 100)}%`;
  }
  const best = [...g.gestures].sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 0.35) return `Reading: ${best.definition.name} ${Math.round(best.score * 100)}%`;
  return g.hands.length ? 'Make a hand sign' : 'Show your hands';
}
