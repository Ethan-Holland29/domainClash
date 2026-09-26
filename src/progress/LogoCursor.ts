/** Decorative cursor overlay; retains the system cursor until the image has loaded. */
export function installLogoCursor(): () => void {
  const cursor = document.createElement('div');
  cursor.className = 'logo-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  const logo = document.createElement('img');
  logo.src = '/art/ui/jujutsu-high.png';
  logo.alt = '';
  cursor.append(logo);
  document.body.append(cursor);
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let loaded = false;
  const hide = () => { cursor.hidden = true; document.documentElement.classList.remove('logo-cursor-active'); };
  const move = (event: PointerEvent) => {
    if (!loaded || !fine.matches || event.pointerType !== 'mouse') { hide(); return; }
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.hidden = false;
    document.documentElement.classList.add('logo-cursor-active');
  };
  logo.onload = () => { loaded = true; };
  logo.onerror = hide;
  hide();
  window.addEventListener('pointermove', move, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  fine.addEventListener('change', hide);
  return () => {
    hide(); cursor.remove();
    window.removeEventListener('pointermove', move);
    document.documentElement.removeEventListener('pointerleave', hide);
    window.removeEventListener('blur', hide);
    fine.removeEventListener('change', hide);
  };
}
