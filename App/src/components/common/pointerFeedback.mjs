export const POINTER_EFFECT_QUERY = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)';

const controls = 'a[href], button, summary, [role="button"], [role="tab"], [role="checkbox"], input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"], input[type="reset"], label[for]';
const editing = 'textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), [contenteditable]:not([contenteditable="false"])';
const unavailable = ':disabled, [aria-disabled="true"], [aria-busy="true"], [inert]';

export function getPointerControl(target) {
  if (!target?.closest || !target.closest('.sc-shell, .sc-auth')) return null;
  if (target.closest(editing) || target.closest(unavailable)) return null;
  const control = target.closest(controls);
  // Labels can activate a disabled field even though they are not disabled nodes.
  if (control?.control?.matches(unavailable)) return null;
  return control;
}

export function attachPointerEffects(layer, browserWindow = window) {
  const doc = browserWindow.document;
  const media = browserWindow.matchMedia(POINTER_EFFECT_QUERY);
  const halo = layer.querySelector('.sc-pointer-halo');
  const pulses = Array.from(layer.querySelectorAll('.sc-pointer-pulse'));
  const animations = new Map();
  let frame = 0;
  let nextPulse = 0;
  let detach = () => {};

  const hide = () => {
    browserWindow.cancelAnimationFrame(frame);
    frame = 0;
    layer.dataset.hover = 'false';
    layer.dataset.pressed = 'false';
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  };

  const placeHalo = (x, y) => {
    halo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    layer.dataset.hover = 'true';
  };

  const move = (event) => {
    if (event.pointerType !== 'mouse' || event.buttons || !getPointerControl(event.target)) {
      hide();
      return;
    }
    // Coalesce pointer movement; never re-render React on mouse movement.
    browserWindow.cancelAnimationFrame(frame);
    const { clientX, clientY, target } = event;
    frame = browserWindow.requestAnimationFrame(() => {
      frame = 0;
      if (target.isConnected && getPointerControl(target)) placeHalo(clientX, clientY);
      else hide();
    });
  };

  const down = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !getPointerControl(event.target)) {
      hide();
      return;
    }
    browserWindow.cancelAnimationFrame(frame);
    frame = 0;
    placeHalo(event.clientX, event.clientY);
    layer.dataset.pressed = 'true';
    const pulse = pulses[nextPulse++ % pulses.length];
    animations.get(pulse)?.cancel();
    pulse.style.left = `${event.clientX}px`;
    pulse.style.top = `${event.clientY}px`;
    if (!pulse.animate) return;
    const animation = pulse.animate([
      { transform: 'scale(.25)', opacity: .8 },
      { transform: 'scale(1)', opacity: 0 },
    ], { duration: 380, easing: 'cubic-bezier(.2, .7, .2, 1)' });
    animations.set(pulse, animation);
    animation.onfinish = () => {
      if (animations.get(pulse) === animation) animations.delete(pulse);
    };
  };

  const up = (event) => {
    if (!getPointerControl(event.target)) hide();
    else layer.dataset.pressed = 'false';
  };
  const leave = (event) => { if (!getPointerControl(event.relatedTarget)) hide(); };

  const configure = () => {
    detach();
    hide();
    if (!media.matches) return;

    // Passive, observational listeners: never stop propagation or cancel input.
    const options = { passive: true, capture: true };
    const listeners = [
      [doc, 'pointermove', move],
      [doc, 'pointerover', move],
      [doc, 'pointerdown', down],
      [doc, 'pointerup', up],
      [doc, 'pointercancel', hide],
      [doc, 'pointerout', leave],
      [doc, 'keydown', hide],
      [doc, 'scroll', hide],
      [doc, 'visibilitychange', hide],
      [browserWindow, 'blur', hide],
    ];
    listeners.forEach(([target, type, handler]) => target.addEventListener(type, handler, options));
    detach = () => listeners.forEach(([target, type, handler]) => target.removeEventListener(type, handler, options));
  };

  media.addEventListener('change', configure);
  configure();
  return () => {
    media.removeEventListener('change', configure);
    detach();
    hide();
  };
}
