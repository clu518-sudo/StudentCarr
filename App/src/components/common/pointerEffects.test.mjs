import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPointerEffects, getPointerControl, POINTER_EFFECT_QUERY } from './pointerFeedback.mjs';

class EventHub {
  listeners = new Map();
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  emit(type, detail = {}) {
    const event = { ...detail, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; } };
    this.listeners.get(type)?.forEach((handler) => handler(event));
    return event;
  }
  count() { return [...this.listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0); }
}

function target({ scope = true, editable = false, disabled = false, interactive = true, labelDisabled = false } = {}) {
  const node = {
    isConnected: true,
    closest(selector) {
      if (selector === '.sc-shell, .sc-auth') return scope ? node : null;
      if (selector.startsWith('textarea')) return editable ? node : null;
      if (selector.startsWith(':disabled')) return disabled ? node : null;
      return interactive ? node : null;
    },
  };
  if (labelDisabled) node.control = { matches: () => true };
  return node;
}

function setup(enabled = true) {
  const browser = new EventHub();
  const doc = browser.document = new EventHub();
  const media = new EventHub();
  media.matches = enabled;
  browser.matchMedia = (query) => { assert.equal(query, POINTER_EFFECT_QUERY); return media; };
  const frames = new Map();
  let nextFrame = 0;
  browser.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
  browser.cancelAnimationFrame = (id) => frames.delete(id);
  const halo = { style: {} };
  const played = [];
  const pulses = [0, 1, 2].map(() => ({ style: {}, animate(keyframes, options) {
    const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true; } };
    played.push(animation);
    return animation;
  } }));
  const layer = { dataset: {}, querySelector: () => halo, querySelectorAll: () => pulses };
  const cleanup = attachPointerEffects(layer, browser);
  return { browser, doc, media, frames, halo, pulses, played, layer, cleanup,
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback()); } };
}

const mouse = (element = target(), extra = {}) => ({ target: element, pointerType: 'mouse', button: 0, buttons: 0, clientX: 80, clientY: 120, ...extra });

test('only eligible controls receive decoration; editing and disabled controls stay native', () => {
  const button = target();
  assert.equal(getPointerControl(button), button);
  for (const options of [{ scope: false }, { editable: true }, { disabled: true }, { interactive: false }, { labelDisabled: true }]) {
    assert.equal(getPointerControl(target(options)), null);
  }
  assert.equal(getPointerControl(null), null);
});

test('hover movement is coalesced into one animation frame and latest coordinates win', () => {
  const state = setup();
  state.doc.emit('pointermove', mouse());
  state.doc.emit('pointermove', mouse(target(), { clientX: 140 }));
  assert.equal(state.frames.size, 1);
  state.flush();
  assert.equal(state.halo.style.transform, 'translate3d(140px, 120px, 0)');
  assert.equal(state.layer.dataset.hover, 'true');
  state.cleanup();
});

test('left clicks add a bounded ripple without cancelling original input', () => {
  const state = setup();
  const event = state.doc.emit('pointerdown', mouse());
  assert.equal(event.defaultPrevented, false);
  assert.equal(event.stopped, false);
  assert.equal(state.layer.dataset.pressed, 'true');
  assert.equal(state.played[0].options.duration, 380);
  state.doc.emit('pointerup', mouse());
  assert.equal(state.layer.dataset.pressed, 'false');
  for (let index = 0; index < 6; index++) state.doc.emit('pointerdown', mouse());
  assert.equal(state.played.filter((animation) => !animation.cancelled).length, 3);
  state.cleanup();
  assert.ok(state.played.every((animation) => animation.cancelled));
});

test('touch, pen, right click, disabled controls, and dragging do not produce mouse effects', () => {
  const state = setup();
  for (const event of [mouse(target(), { pointerType: 'touch' }), mouse(target(), { pointerType: 'pen' }), mouse(target(), { button: 2 }), mouse(target({ disabled: true }))]) {
    state.doc.emit('pointerdown', event);
  }
  state.doc.emit('pointermove', mouse(target(), { buttons: 1 }));
  assert.equal(state.played.length, 0);
  assert.equal(state.frames.size, 0);
  assert.equal(state.layer.dataset.hover, 'false');
  state.cleanup();
});

test('reduced motion / coarse pointer / forced colors disable listeners, including live preference changes', () => {
  const state = setup(false);
  assert.equal(state.doc.count(), 0);
  state.media.matches = true;
  state.media.emit('change');
  state.doc.emit('pointerdown', mouse());
  assert.equal(state.played.length, 1);
  state.media.matches = false;
  state.media.emit('change');
  assert.equal(state.doc.count(), 0);
  assert.equal(state.browser.count(), 0);
  assert.equal(state.layer.dataset.hover, 'false');
  assert.equal(state.played[0].cancelled, true);
  state.cleanup();
  assert.equal(state.media.count(), 0);
});

test('keyboard, scrolling, leaving controls, cancelling input, and window blur clear feedback', () => {
  const state = setup();
  for (const type of ['keydown', 'scroll', 'pointerout', 'pointercancel', 'visibilitychange']) {
    state.doc.emit('pointerdown', mouse());
    state.doc.emit(type, { relatedTarget: target({ editable: true }) });
    assert.equal(state.layer.dataset.hover, 'false');
  }
  state.doc.emit('pointerdown', mouse());
  state.browser.emit('blur');
  assert.equal(state.layer.dataset.hover, 'false');
  state.cleanup();
});

test('removed nodes and component cleanup cannot leave a halo or pending frame behind', () => {
  const state = setup();
  const node = target();
  state.doc.emit('pointermove', mouse(node));
  node.isConnected = false;
  state.flush();
  assert.equal(state.layer.dataset.hover, 'false');
  state.doc.emit('pointermove', mouse());
  state.cleanup();
  assert.equal(state.frames.size, 0);
  assert.equal(state.doc.count() + state.browser.count() + state.media.count(), 0);
});
