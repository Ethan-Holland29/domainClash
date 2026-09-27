import { CHARACTERS as CHARACTER_LIST } from './Characters';
import { PORTRAITS } from './Portraits';
import { CHARACTERS as KITS, MOVES } from '../../../shared/battle.mjs';

const HAND_SIGN_IMAGES: Record<string, string> = {
  AMPLIFICATION_BLUE: '/art/tutorials/hand-signs/amplification-blue.jpg',
  REVERSAL_RED: '/art/tutorials/hand-signs/reversal-red.jpg',
  GOJO_ULTIMATE: '/art/tutorials/hand-signs/unlimited-void.jpg',
  NUE: '/art/tutorials/hand-signs/nue.jpg',
  DIVINE_DOGS: '',
  MAHORAGA: '/art/tutorials/hand-signs/mahoraga.jpg',
  MEGUMI_ULTIMATE: '/art/tutorials/hand-signs/chimera-shadow-garden.jpg',
  CLEAVE: '/art/tutorials/hand-signs/cleave.jpg',
  SUKUNA_ULTIMATE: '/art/tutorials/hand-signs/malevolent-shrine.jpg',
  PIERCING_BLOOD: '/art/tutorials/hand-signs/piercing-blood.jpg',
  CHOSO_ULTIMATE: '/art/tutorials/hand-signs/supernova.jpg',
  GRANITE_BLAST: '/art/tutorials/hand-signs/granite-blast.jpg',
  RYU_ULTIMATE: '',
  YUJI_ULTIMATE: '/art/tutorials/hand-signs/straight-hands.jpg',
  CURSED_TOOLS: '/art/tutorials/hand-signs/cursed-tools.jpg',
  CURSE_SWALLOW: '/art/tutorials/hand-signs/curse-swallow.jpg',
  GETO_ULTIMATE: '/art/tutorials/hand-signs/uzumaki.jpg',
  RIKA: '/art/tutorials/hand-signs/rika.jpg',
  YUTA_ULTIMATE: '/art/tutorials/hand-signs/copy.jpg',
};

/** Character and universal-move field guides opened from the selection screens. */
export class TutorialDialogs {
  private characterDialog = this.makeDialog('character-tutorial');
  private howToDialog = this.makeDialog('how-to-tutorial');
  private currentCharacter = new WeakMap<HTMLElement, () => string>();
  private wiredRoots = new WeakSet<HTMLElement>();

  constructor(host: HTMLElement = document.body) {
    host.append(this.characterDialog, this.howToDialog);
  }

  bind(root: HTMLElement, selectedCharacter: () => string): void {
    this.currentCharacter.set(root, selectedCharacter);
    if (this.wiredRoots.has(root)) return;
    this.wiredRoots.add(root);
    root.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.tutorial-about')) {
        this.showCharacter(this.currentCharacter.get(root)?.() ?? 'gojo');
      } else if (event.target.closest('.tutorial-how-to-play')) {
        this.showHowToPlay();
      }
    });
  }

  private makeDialog(className: string): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.className = `tutorial-dialog ${className}`;
    dialog.innerHTML = `<header class="tutorial-header"><div><span class="tutorial-eyebrow">DOMAIN CLASH FIELD GUIDE</span><h2></h2></div><button class="tutorial-x" type="button" aria-label="Close guide">×</button></header><div class="tutorial-content"></div><footer class="tutorial-footer"><span>Close to continue.</span><button class="tutorial-done" type="button">Close</button></footer>`;
    dialog.querySelectorAll<HTMLButtonElement>('.tutorial-x,.tutorial-done').forEach(button => {
      button.addEventListener('click', () => dialog.close());
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    return dialog;
  }

  private show(dialog: HTMLDialogElement): void {
    if (!dialog.open) {
      dialog.showModal();
      window.dispatchEvent(new Event('domainclash:modal-opened'));
    }
  }

  showCharacter(id: string): void {
    const character = CHARACTER_LIST.find(entry => entry.id === id) ?? CHARACTER_LIST[0];
    const kit = KITS[id] ?? KITS.gojo;
    const title = this.characterDialog.querySelector('h2')!;
    title.textContent = `About ${character.name}`;
    const content = this.characterDialog.querySelector<HTMLElement>('.tutorial-content')!;
    content.replaceChildren();

    const intro = document.createElement('section');
    intro.className = 'tutorial-character-intro';
    const portrait = document.createElement('img');
    portrait.src = PORTRAITS[character.id].image;
    portrait.alt = character.name;
    const passive = document.createElement('div');
    passive.innerHTML = '<span class="tutorial-label">PASSIVE ABILITY</span>';
    const passiveName = document.createElement('h3');
    passiveName.textContent = kit.passive.name;
    const passiveText = document.createElement('p');
    passiveText.textContent = kit.passive.text;
    passive.append(passiveName, passiveText);
    intro.append(portrait, passive);
    content.append(intro);

    const heading = document.createElement('h3');
    heading.className = 'tutorial-section-title';
    heading.textContent = 'Techniques & domain';
    content.append(heading);
    const grid = document.createElement('div');
    grid.className = 'tutorial-ability-grid';
    for (const moveId of kit.moves as string[]) {
      if (moveId === 'BASIC_PUNCH') continue;
      const move = MOVES[moveId];
      if (!move) continue;
      const card = document.createElement('article');
      card.className = 'tutorial-ability-card';
      const imagePath = HAND_SIGN_IMAGES[moveId];
      if (imagePath) {
        const photo = document.createElement('img');
        photo.className = 'tutorial-sign-photo';
        photo.src = imagePath;
        photo.alt = `Hand-sign photo for ${move.name}`;
        card.append(photo);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'tutorial-image-placeholder';
        placeholder.setAttribute('role', 'img');
        placeholder.setAttribute('aria-label', moveId === 'HOLLOW_PURPLE' ? `${move.name} uses a button, no hand sign` : `${move.name} hand-sign photo coming soon`);
        placeholder.innerHTML = moveId === 'HOLLOW_PURPLE'
          ? '<span>BUTTON-ONLY MOVE<br>NO HAND SIGN</span>'
          : '<span>HAND SIGN PHOTO<br>COMING SOON</span>';
        card.append(placeholder);
      }
      const name = document.createElement('h4');
      name.textContent = move.name;
      const description = document.createElement('p');
      description.textContent = move.text;
      const kind = document.createElement('span');
      kind.className = 'tutorial-move-kind';
      kind.textContent = move.kind;
      card.append(kind, name, description);
      grid.append(card);
    }
    content.append(grid);
    this.show(this.characterDialog);
  }

  private showHowToPlay(): void {
    this.howToDialog.querySelector('h2')!.textContent = 'How to Play';
    const content = this.howToDialog.querySelector<HTMLElement>('.tutorial-content')!;
    content.replaceChildren();
    const intro = document.createElement('p');
    intro.className = 'tutorial-intro';
    intro.textContent = 'Choose a move each round using its hand pose in front of the camera or the move button. These two moves are shared by every fighter.';
    content.append(intro);

    const grid = document.createElement('div');
    grid.className = 'how-to-grid';
    const moves = [
      {
        name: 'Basic Punch', label: 'BASIC ATTACK', image: '/art/tutorials/basic-punch.jpg', alt: 'Closed fist shown for Basic Punch',
        sign: 'Make a fist with one hand and show it clearly in front of you.',
        effect: MOVES.BASIC_PUNCH.text,
      },
      {
        name: 'Block', label: 'DEFENSE', image: '/art/tutorials/block.jpg', alt: 'Arms crossed with fists for Block',
        sign: 'Cross your arms at the wrists with both hands closed into fists.',
        effect: MOVES.GUARD.text,
      },
    ];
    for (const move of moves) {
      const card = document.createElement('article');
      card.className = 'how-to-card';
      const placeholder = document.createElement('img');
      placeholder.className = 'how-to-photo';
      placeholder.src = move.image;
      placeholder.alt = move.alt;
      const label = document.createElement('span');
      label.className = 'tutorial-label';
      label.textContent = move.label;
      const name = document.createElement('h3');
      name.textContent = move.name;
      const sign = document.createElement('p');
      sign.textContent = move.sign;
      const effect = document.createElement('p');
      effect.className = 'how-to-effect';
      effect.textContent = move.effect;
      card.append(placeholder, label, name, sign, effect);
      grid.append(card);
    }
    content.append(grid);
    const note = document.createElement('p');
    note.className = 'tutorial-note';
    note.textContent = 'Block stops direct attacks for that round, but does not stop domain sure-hits and cannot be used on two consecutive turns. You can also choose moves with the on-screen buttons.';
    content.append(note);
    this.show(this.howToDialog);
  }
}
