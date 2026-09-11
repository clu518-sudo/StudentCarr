export const DEFAULT_CHAT_WIDTH = 420;
export const CHAT_WIDTH_KEY = 'studentcarr.chat.width.v1';
export const MOBILE_CHAT_BREAKPOINT = 640;

export function chatWidthBounds(viewportWidth) {
  const gutter = viewportWidth <= MOBILE_CHAT_BREAKPOINT ? 16 : 32;
  const max = Math.max(0, Math.min(840, viewportWidth - gutter));
  return { min: Math.min(340, max), max };
}

export function clampChatWidth(value, viewportWidth) {
  const { min, max } = chatWidthBounds(viewportWidth);
  const width = Number.isFinite(value) ? value : DEFAULT_CHAT_WIDTH;
  return Math.round(Math.min(max, Math.max(min, width)));
}

export function dragChatWidth(startWidth, startX, currentX, viewportWidth) {
  // The right edge stays anchored, so dragging left makes the panel wider.
  return clampChatWidth(startWidth + startX - currentX, viewportWidth);
}

export function keyboardChatWidth(key, currentWidth, viewportWidth, shiftKey = false) {
  const { min, max } = chatWidthBounds(viewportWidth);
  const step = shiftKey ? 48 : 16;
  if (key === 'Home') return min;
  if (key === 'End') return max;
  if (key === 'ArrowLeft') return clampChatWidth(currentWidth + step, viewportWidth);
  if (key === 'ArrowRight') return clampChatWidth(currentWidth - step, viewportWidth);
  return null;
}

export function readChatWidth(storage) {
  try {
    const width = Number(storage.getItem(CHAT_WIDTH_KEY));
    return Number.isFinite(width) && width >= 340 && width <= 840 ? width : DEFAULT_CHAT_WIDTH;
  } catch { return DEFAULT_CHAT_WIDTH; }
}

export function saveChatWidth(storage, width) {
  try { storage.setItem(CHAT_WIDTH_KEY, String(width)); } catch { /* Private / restricted storage is optional. */ }
}
