/** Decorative cursor overlay; retains the system cursor until the image has loaded. */
export function installLogoCursor(): () => void {
  const cursor = document.createElement('div');
  cursor.className = 'logo-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  // A manual popover is in the browser top layer, above both the page and modal dialogs.
  // Keeping it there avoids the character-select layout and lets it follow the pointer
  // across the entire screen while the disclaimer is open.
  cursor.setAttribute('popover', 'manual');
  const logo = document.createElement('img');
  logo.src = '/art/ui/jujutsu-high.png';
  logo.alt = '';
  cursor.append(logo);
  document.body.append(cursor);
  try { cursor.showPopover(); } catch { /* Older browsers keep the ordinary overlay cursor. */ }
  const bringCursorToFront = (): void => {
    if (!document.querySelector(':modal')) return;
    try {
      cursor.hidePopover();
      cursor.showPopover();
    } catch { /* Keep the regular cursor overlay if popovers are unavailable. */ }
  };
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let loaded = false;
  const hide = () => { cursor.hidden = true; document.documentElement.classList.remove('logo-cursor-active'); };
  const move = (event: PointerEvent) => {
    if (!loaded || !fine.matches || event.pointerType !== 'mouse') { hide(); return; }
    cursor.style.transform = `translate3d(${event.clientX-15}px, ${event.clientY-15}px, 0)`;
    cursor.hidden = false;
    document.documentElement.classList.add('logo-cursor-active');
  };
  logo.onload = () => { loaded = true; };
  logo.onerror = hide;
  hide();
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('domainclash:modal-opened', bringCursorToFront);
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  fine.addEventListener('change', hide);
  return () => {
    hide(); cursor.remove();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('domainclash:modal-opened', bringCursorToFront);
    document.documentElement.removeEventListener('pointerleave', hide);
    window.removeEventListener('blur', hide);
    fine.removeEventListener('change', hide);
  };
}
