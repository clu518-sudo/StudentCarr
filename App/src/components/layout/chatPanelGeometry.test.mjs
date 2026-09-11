import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CHAT_WIDTH, CHAT_WIDTH_KEY, chatWidthBounds, clampChatWidth,
  dragChatWidth, keyboardChatWidth, readChatWidth, saveChatWidth,
} from './chatPanelGeometry.mjs';

test('desktop widths leave a gutter and never exceed the wide-view limit', () => {
  assert.deepEqual(chatWidthBounds(1440), { min: 340, max: 840 });
  assert.deepEqual(chatWidthBounds(800), { min: 340, max: 768 });
  assert.equal(clampChatWidth(100, 1440), 340);
  assert.equal(clampChatWidth(9999, 1440), 840);
  assert.equal(clampChatWidth(420, 1440), 420);
});

test('small viewports never have a minimum width larger than available space', () => {
  assert.deepEqual(chatWidthBounds(320), { min: 304, max: 304 });
  assert.equal(clampChatWidth(840, 320), 304);
  assert.equal(clampChatWidth(420, 0), 0);
});

test('dragging the left edge left expands, right contracts, with safe bounds', () => {
  assert.equal(dragChatWidth(420, 1000, 880, 1440), 540);
  assert.equal(dragChatWidth(420, 1000, 1060, 1440), 360);
  assert.equal(dragChatWidth(420, 1000, 2000, 1440), 340);
  assert.equal(dragChatWidth(420, 1000, 0, 800), 768);
});

test('keyboard resizing follows the left edge and supports fine / larger steps', () => {
  assert.equal(keyboardChatWidth('ArrowLeft', 420, 1440), 436);
  assert.equal(keyboardChatWidth('ArrowRight', 420, 1440), 404);
  assert.equal(keyboardChatWidth('ArrowLeft', 420, 1440, true), 468);
  assert.equal(keyboardChatWidth('Home', 420, 1440), 340);
  assert.equal(keyboardChatWidth('End', 420, 1440), 840);
  assert.equal(keyboardChatWidth('Tab', 420, 1440), null);
});

test('invalid preferences fall back to a useful default', () => {
  for (const value of [null, '', 'undefined', 'NaN', '-100', '100000']) {
    assert.equal(readChatWidth({ getItem: () => value }), DEFAULT_CHAT_WIDTH);
  }
  assert.equal(readChatWidth({ getItem: () => '516' }), 516);
  assert.equal(clampChatWidth(NaN, 1440), DEFAULT_CHAT_WIDTH);
});

test('storage failures do not prevent opening or resizing the assistant', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(readChatWidth(blocked), DEFAULT_CHAT_WIDTH);
  assert.doesNotThrow(() => saveChatWidth(blocked, 500));
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  saveChatWidth(storage, 500);
  assert.equal(values.get(CHAT_WIDTH_KEY), '500');
  assert.equal(readChatWidth(storage), 500);
});
