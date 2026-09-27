import { SelectionModel } from './SelectionModel';
import { buildRoster, heroMarkup, paintHero } from './SelectionView';
import { CHARACTERS } from './Characters';
import { PORTRAITS } from './Portraits';
import { characterAudio } from '../audio/CharacterAudio';
import { TutorialDialogs } from './TutorialDialogs';

/** P1 gets the original full-art screen first; confirming P1 opens the shared P1/P2 grid. */
export class CharacterSelect {
  private models = [new SelectionModel(), new SelectionModel()];
  private activeSeat = 0;
  private audio = characterAudio;
  private tutorials = new TutorialDialogs();
  private classicVoicePlayed?: string;

  constructor(container: HTMLElement, choose: (id: string, opponent: string) => boolean | void | Promise<boolean | void>, multiplayer: () => void) {
    this.models[1].preview = 'sukuna';
    this.renderClassic(container, multiplayer, () => {
      this.models[0].confirm();
      this.activeSeat = 1;
      this.renderShared(container, choose, multiplayer);
    });
  }

  private renderClassic(container: HTMLElement, multiplayer: () => void, proceed: () => void): void {
    this.classicVoicePlayed = undefined;
    container.className = 'classic-p1-select';
    container.innerHTML = `<div class="selection-scenery" aria-hidden="true"></div>
      <header class="select-heading"><span class="selection-brand">DOMAIN CLASH</span><h1>CHARACTER SELECT</h1><span class="select-round">PLAYER 1 · CHOOSE YOUR FIGHTER</span><button type="button" class="tutorial-entry tutorial-about">About Character</button><button type="button" class="tutorial-entry tutorial-how-to-play">How to play</button><button type="button" class="multiplayer-entry">Multiplayer</button></header>
      <section class="classic-roster"><div class="roster-label"><b>P1</b><span>SELECT YOUR SORCERER</span></div><div class="portrait-grid" aria-label="Player 1 character roster"></div><p class="select-hint">Hover to preview · Click to select · Arrow keys to browse</p></section>
      <section class="classic-hero">${heroMarkup(0)}</section>
      <footer class="selection-footer"><span id="p1-select-status" role="status">Choose a fighter for Player 1, then confirm to pass the screen to Player 2.</span><button class="random-pick" data-seat="0">Random P1</button><button id="p1-confirm" class="confirm-pick">Confirm P1 fighter →</button></footer>`;

    this.tutorials.bind(container, () => this.models[0].picked ?? this.models[0].preview);

    const grid = container.querySelector<HTMLElement>('.portrait-grid')!;
    const preview = (id: string): void => {
      if (!this.models[0].confirmed) this.models[0].preview = id;
      this.paintClassic(container);
    };
    buildRoster(grid, 0, preview, id => {
      this.audio.playUiCue('select');
      this.models[0].preview = id;
      this.audio.playSelectionVoice(id);
      this.classicVoicePlayed = id;
      this.paintClassic(container);
    });
    this.bindHoverSounds(grid);
    container.querySelector<HTMLButtonElement>('.random-pick')!.onclick = () => {
      this.audio.playUiCue('select');
      const chosen = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)] ?? CHARACTERS[0];
      this.models[0].preview = chosen.id;
      this.audio.playSelectionVoice(chosen.id);
      this.classicVoicePlayed = chosen.id;
      this.paintClassic(container);
    };
      container.querySelector<HTMLButtonElement>('#p1-confirm')!.onclick = () => {
        this.audio.playUiCue('select');
      if (!this.models[0].picked) {
        this.models[0].pick(this.models[0].preview);
        if (this.classicVoicePlayed !== this.models[0].preview) this.audio.playSelectionVoice(this.models[0].preview);
        }
        proceed();
        this.tutorials.showCharacter(this.models[0].picked ?? this.models[0].preview);
    };
    container.querySelector<HTMLButtonElement>('.multiplayer-entry')!.onclick = multiplayer;
    this.paintClassic(container);
    window.dispatchEvent(new Event('domainclash:selection-updated'));
  }

  private paintClassic(container: HTMLElement): void {
    const model = this.models[0];
    const id = model.picked ?? model.preview;
    container.dataset.fighter = id;
    container.style.setProperty('--fighter-color', PORTRAITS[id].color);
    container.querySelector<HTMLElement>('.selection-scenery')!.style.backgroundImage = `url("${PORTRAITS[id].background}")`;
    paintHero(container.querySelector<HTMLElement>('.fighter-preview')!, id, model.picked ? 'PICKED · READY TO CONFIRM' : 'CHOOSE A FIGHTER');
    for (const button of container.querySelectorAll<HTMLButtonElement>('.portrait-card')) {
      const selected=button.dataset.id===id;
      button.setAttribute('aria-pressed', String(selected));
      button.querySelector<HTMLElement>('.tile-player')!.textContent=selected?'P1':'';
    }
    container.querySelector('#p1-select-status')!.textContent = model.picked
      ? `${CHARACTERS.find(c => c.id === model.picked)?.name} is selected for Player 1. Confirm to choose Player 2.`
      : `${CHARACTERS.find(c => c.id === model.preview)?.name} · previewing for Player 1. Confirm to choose Player 2.`;
  }

  private renderShared(container: HTMLElement, choose: (id: string, opponent: string) => boolean | void | Promise<boolean | void>, multiplayer: () => void): void {
    container.className = 'dual-select';
    container.innerHTML = `<div class="selection-scenery" aria-hidden="true"></div><header class="select-heading"><span class="selection-brand">DOMAIN CLASH</span><h1>CHARACTER SELECT</h1><button type="button" class="tutorial-entry tutorial-about">About Character</button><button type="button" class="tutorial-entry tutorial-how-to-play">How to play</button><button type="button" class="multiplayer-entry">Multiplayer</button></header>
      <section class="local-player" data-seat="0">${heroMarkup(0)}<div class="local-player-controls"><button class="seat-control" data-seat="0" aria-pressed="false">P1 is choosing</button><button class="random-pick" data-seat="0">Random P1</button><button class="confirm-pick" data-seat="0" hidden>Confirm P1 fighter</button><button class="change-pick" data-seat="0">Change P1 pick</button></div></section>
      <section class="shared-roster"><div class="roster-label"><b class="active-seat-label">P2 PICKING</b><span>SHARED CHARACTER GRID</span></div><div class="portrait-grid" aria-label="Shared character roster"></div><p class="grid-instructions">Player 2: choose from the shared grid. Random buttons are beside each fighter.</p></section>
      <section class="local-player" data-seat="1">${heroMarkup(1)}<div class="local-player-controls"><button class="seat-control" data-seat="1" aria-pressed="true">P2 is choosing</button><button class="random-pick" data-seat="1">Random P2</button><button class="confirm-pick" data-seat="1">Confirm P2 fighter</button><button class="change-pick" data-seat="1" hidden>Change P2 pick</button></div></section>
      <footer class="selection-footer"><span id="local-select-status" role="status">P1 confirmed. Player 2, choose your fighter.</span><button id="choose-fighter" disabled>Play solo →</button></footer>`;

    this.tutorials.bind(container, () => this.models[this.activeSeat].picked ?? this.models[this.activeSeat].preview);

    const paint = (): void => {
      const grid = container.querySelector<HTMLElement>('.portrait-grid')!;
      for (const seat of [0, 1]) {
        const model = this.models[seat], panel = container.querySelector<HTMLElement>(`.local-player[data-seat="${seat}"]`)!;
        panel.querySelector('.fighter-preview')!.setAttribute('data-seat', String(seat));
        paintHero(panel.querySelector<HTMLElement>('.fighter-preview')!, model.picked ?? model.preview,
          model.confirmed ? 'FIGHTER LOCKED' : model.picked ? 'PICKED · READY TO CONFIRM' : 'CHOOSE A FIGHTER');
        panel.querySelector('.player-badge')!.textContent = `P${seat + 1}`;
        panel.querySelector<HTMLButtonElement>('.seat-control')!.setAttribute('aria-pressed', String(this.activeSeat === seat));
        panel.querySelector<HTMLButtonElement>('.random-pick')!.disabled = model.confirmed;
        panel.querySelector<HTMLButtonElement>('.confirm-pick')!.hidden = model.confirmed;
        panel.querySelector<HTMLButtonElement>('.change-pick')!.hidden = !model.confirmed;
      }
      for (const button of grid.querySelectorAll<HTMLButtonElement>('.portrait-card')) {
        const id = button.dataset.id!;
        const selected0 = (this.models[0].picked ?? this.models[0].preview) === id;
        const selected1 = (this.models[1].picked ?? this.models[1].preview) === id;
        button.dataset.p1Selected = String(selected0);
        button.dataset.p2Selected = String(selected1);
        button.setAttribute('aria-pressed', String(selected0 || selected1));
        button.querySelector<HTMLElement>('.tile-player')!.textContent = [selected0 ? 'P1' : '', selected1 ? 'P2' : ''].filter(Boolean).join(' + ');
        button.disabled = this.models[this.activeSeat].confirmed;
      }
      container.dataset.activeSeat = String(this.activeSeat);
      container.querySelector('.active-seat-label')!.textContent = `P${this.activeSeat + 1} PICKING`;
      const active = this.models[this.activeSeat];
      container.querySelector<HTMLElement>('.selection-scenery')!.style.backgroundImage = `url("${PORTRAITS[active.picked ?? active.preview].background}")`;
      const ready = this.models.every(model => model.confirmed);
      container.querySelector<HTMLButtonElement>('#choose-fighter')!.disabled = !ready;
      container.querySelector('#local-select-status')!.textContent = ready
        ? 'Both fighters confirmed. Ready for solo battle.'
        : `P1 confirmed · P2 is choosing${active.picked ? ` · ${CHARACTERS.find(c => c.id === active.picked)?.name} selected` : ''}`;
    };

    const grid = container.querySelector<HTMLElement>('.portrait-grid')!;
    buildRoster(grid, 1, id => { if (this.models[this.activeSeat].hover(id)) paint(); }, id => {
      if (this.models[this.activeSeat].confirmed) return;
      this.audio.playUiCue('select');
      this.models[this.activeSeat].pick(id);
      this.audio.playSelectionVoice(id);
      paint();
    });
    this.bindHoverSounds(grid);
    for (const seat of [0, 1]) {
      container.querySelector<HTMLButtonElement>(`.seat-control[data-seat="${seat}"]`)!.onclick = () => {
        if (!this.models[seat].confirmed) this.activeSeat = seat;
        paint();
      };
      container.querySelector<HTMLButtonElement>(`.random-pick[data-seat="${seat}"]`)!.onclick = () => {
        if (this.models[seat].confirmed) return;
        this.audio.playUiCue('select');
        this.activeSeat = seat;
        const chosen = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)] ?? CHARACTERS[0];
        this.models[seat].pick(chosen.id);
        this.audio.playSelectionVoice(chosen.id);
        paint();
      };
      container.querySelector<HTMLButtonElement>(`.confirm-pick[data-seat="${seat}"]`)!.onclick = () => {
        this.audio.playUiCue('select');
        this.models[seat].confirm();
        this.activeSeat = 1;
        paint();
        this.tutorials.showCharacter(this.models[seat].picked ?? this.models[seat].preview);
      };
      container.querySelector<HTMLButtonElement>(`.change-pick[data-seat="${seat}"]`)!.onclick = () => {
        if (seat === 0) {
          this.models[0].unlock();
          this.renderClassic(container, multiplayer, () => {
            this.models[0].confirm();
            this.activeSeat = 1;
            this.renderShared(container, choose, multiplayer);
          });
          return;
        }
        this.models[seat].unlock();
        this.activeSeat = seat;
        paint();
      };
    }
    container.querySelector<HTMLButtonElement>('#choose-fighter')!.onclick = async () => {
      if (!this.models.every(model => model.confirmed)) return;
      const button=container.querySelector<HTMLButtonElement>('#choose-fighter')!;
      button.disabled=true;button.textContent='Preparing hand tracking…';
      try {
        const started=await choose(this.models[0].picked!, this.models[1].picked!);
        if(started===false)container.querySelector<HTMLElement>('#local-select-status')!.textContent='Hand tracking is still preparing. Please try again in a moment.';
      } catch {
        container.querySelector<HTMLElement>('#local-select-status')!.textContent='Hand tracking could not load. Retry camera setup, then start the fight again.';
      } finally {
        button.disabled=false;button.textContent='Play solo →';
      }
    };
    container.querySelector<HTMLButtonElement>('.multiplayer-entry')!.onclick = multiplayer;
    paint();
    window.dispatchEvent(new Event('domainclash:selection-updated'));
  }

  private bindHoverSounds(grid: HTMLElement): void {
    for (const button of grid.querySelectorAll<HTMLButtonElement>('.portrait-card')) {
      button.addEventListener('mouseenter', () => this.audio.playUiCue('hover'));
      button.addEventListener('focus', () => this.audio.playUiCue('hover'));
    }
  }
}
