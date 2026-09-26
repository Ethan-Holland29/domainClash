/** Victory / defeat screen over the stage with a Restart button. */
export class MatchOverlay {
  private readonly element: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly subtitle: HTMLParagraphElement;
  onRestart: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'match-overlay';
    this.element.hidden = true;
    this.title = document.createElement('h2');
    this.subtitle = document.createElement('p');
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.textContent = 'Restart match';
    restart.addEventListener('click', () => this.onRestart?.());
    this.element.append(this.title, this.subtitle, restart);
    parent.appendChild(this.element);
  }

  show(result: 'won' | 'lost', detail: string): void {
    this.element.classList.toggle('won', result === 'won');
    this.element.classList.toggle('lost', result === 'lost');
    this.title.textContent = result === 'won' ? 'VICTORY' : 'DEFEAT';
    this.subtitle.textContent = detail;
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
