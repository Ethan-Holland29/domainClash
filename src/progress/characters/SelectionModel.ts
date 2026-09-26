/** Hover previews never overwrite a clicked or confirmed choice. */
export class SelectionModel {
  preview = 'gojo';
  picked: string | null = null;
  confirmed = false;
  hover(id: string): boolean { if (this.picked || this.confirmed) return false; this.preview = id; return true; }
  pick(id: string): void { if (!this.confirmed) { this.picked = id; this.preview = id; } }
  confirm(): string { this.picked ??= this.preview; this.confirmed = true; return this.picked; }
  unlock(): void { this.confirmed = false; this.picked = null; }
}
