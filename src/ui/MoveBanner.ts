/** Big text flash over the stage when a move fires, e.g. "SUKUNA - CLEAVE". */
export class MoveBanner {
  private readonly element: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly subtitle: HTMLDivElement;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'move-banner';
    this.element.hidden = true;
    this.subtitle = document.createElement('div');
    this.subtitle.className = 'move-banner-sub';
    this.title = document.createElement('div');
    this.title.className = 'move-banner-title';
    this.element.append(this.subtitle, this.title);
    parent.appendChild(this.element);
  }

  show(subtitle: string, title: string, color: string, durationMs = 1400): void {
    this.subtitle.textContent = subtitle;
    this.title.textContent = title;
    this.element.style.setProperty('--char-color', color);
    this.element.hidden = false;
    // Restart the CSS animation.
    this.element.classList.remove('play');
    void this.element.offsetWidth;
    this.element.classList.add('play');
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => (this.element.hidden = true), durationMs);
  }
}
