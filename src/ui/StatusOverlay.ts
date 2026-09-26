/** Centered message over the stage for loading and error states. */
export class StatusOverlay {
  private readonly element: HTMLDivElement;
  private readonly message: HTMLParagraphElement;
  private readonly button: HTMLButtonElement;
  private onAction: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'status-overlay';
    this.message = document.createElement('p');
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.addEventListener('click', () => this.onAction?.());
    this.element.append(this.message, this.button);
    parent.appendChild(this.element);
  }

  show(message: string, action?: { label: string; onClick: () => void }): void {
    this.message.textContent = message;
    this.onAction = action?.onClick ?? null;
    this.button.textContent = action?.label ?? '';
    this.button.hidden = !action;
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
