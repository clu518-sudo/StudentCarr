import React, { useCallback, useEffect, useRef, useState } from 'react';
import InterfaceIcon from '../common/InterfaceIcon';
import {
  DEFAULT_CHAT_WIDTH, MOBILE_CHAT_BREAKPOINT, chatWidthBounds, clampChatWidth,
  dragChatWidth, keyboardChatWidth, readChatWidth, saveChatWidth,
} from './chatPanelGeometry.mjs';

const viewportSize = () => document.documentElement.clientWidth;
const readPreferredWidth = () => {
  try { return readChatWidth(window.localStorage); } catch { return DEFAULT_CHAT_WIDTH; }
};

// Owns presentation only. Children remain mounted while closed, including any
// streaming reply, unsent draft, and loaded history in CareerChatbot.
const FloatingChatPanel = ({ open, onClose, openerRef, headerActions, children }) => {
  const [preferredWidth, setPreferredWidth] = useState(readPreferredWidth);
  const [viewportWidth, setViewportWidth] = useState(viewportSize);
  const [wide, setWide] = useState(false);
  const [resizing, setResizing] = useState(false);
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const wasOpenRef = useRef(false);
  const dragRef = useRef(null);
  const frameRef = useRef(0);
  const latestWidthRef = useRef(preferredWidth);
  const bounds = chatWidthBounds(viewportWidth);
  const width = wide ? bounds.max : clampChatWidth(preferredWidth, viewportWidth);

  const applyWidth = useCallback((nextWidth) => {
    latestWidthRef.current = nextWidth;
    setPreferredWidth(nextWidth);
  }, []);

  const finishResize = useCallback((nextWidth = latestWidthRef.current) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (drag.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
    document.documentElement.classList.remove('sc-chat-resizing');
    setResizing(false);
    applyWidth(nextWidth);
    try { saveChatWidth(window.localStorage, nextWidth); } catch { /* Optional preference. */ }
  }, [applyWidth]);

  useEffect(() => {
    const onResize = () => {
      finishResize();
      setViewportWidth(viewportSize());
    };
    const onBlur = () => finishResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onBlur);
      cancelAnimationFrame(frameRef.current);
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag?.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
      if (drag) document.documentElement.classList.remove('sc-chat-resizing');
    };
  }, [finishResize]);

  useEffect(() => {
    const panel = panelRef.current;
    if (open) {
      returnFocusRef.current = openerRef?.current || document.activeElement;
      panel.focus({ preventScroll: true });
    } else if (wasOpenRef.current) {
      finishResize();
      if (panel.contains(document.activeElement) || document.activeElement === document.body) {
        const focusFrame = requestAnimationFrame(() => {
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus({ preventScroll: true });
        });
        wasOpenRef.current = open;
        return () => cancelAnimationFrame(focusFrame);
      }
    }
    wasOpenRef.current = open;
  }, [open, openerRef, finishResize]);

  const beginResize = (event) => {
    if (event.button !== 0 || viewportWidth <= MOBILE_CHAT_BREAKPOINT || dragRef.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId, startX: event.clientX, startWidth: width,
      handle: event.currentTarget,
    };
    latestWidthRef.current = width;
    setWide(false);
    applyWidth(width);
    setResizing(true);
    document.documentElement.classList.add('sc-chat-resizing');
  };

  const moveResize = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextWidth = dragChatWidth(drag.startWidth, drag.startX, event.clientX, viewportSize());
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      applyWidth(nextWidth);
    });
  };

  const endResize = (event) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      finishResize(dragChatWidth(drag.startWidth, drag.startX, event.clientX, viewportSize()));
    }
  };

  const resizeWithKeyboard = (event) => {
    const nextWidth = keyboardChatWidth(event.key, width, viewportWidth, event.shiftKey);
    if (nextWidth === null) return;
    event.preventDefault();
    setWide(false);
    applyWidth(nextWidth);
    try { saveChatWidth(window.localStorage, nextWidth); } catch { /* Optional preference. */ }
  };

  const resetWidth = () => {
    setWide(false);
    applyWidth(DEFAULT_CHAT_WIDTH);
    try { saveChatWidth(window.localStorage, DEFAULT_CHAT_WIDTH); } catch { /* Optional preference. */ }
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing) return;
    event.stopPropagation();
    if (dragRef.current) finishResize(dragRef.current.startWidth);
    else onClose();
  };

  return (
    <aside
      ref={panelRef}
      id="career-assistant"
      className={`sc-chat sc-chat-floating${open ? ' is-open' : ''}${resizing ? ' is-resizing' : ''}`}
      style={{ '--sc-chat-width': `${width}px` }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="career-assistant-title"
      aria-hidden={!open}
      inert={open ? undefined : ''}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div
        className="sc-chat-resize-handle"
        role="separator"
        aria-label="Resize career assistant"
        aria-orientation="vertical"
        aria-controls="career-assistant"
        aria-valuemin={bounds.min}
        aria-valuemax={bounds.max}
        aria-valuenow={width}
        aria-valuetext={`${width} pixels wide`}
        title="Drag to resize · arrow keys adjust width · double-click to reset"
        tabIndex={open ? 0 : -1}
        onPointerDown={beginResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={() => finishResize()}
        onLostPointerCapture={() => finishResize()}
        onKeyDown={resizeWithKeyboard}
        onDoubleClick={resetWidth}
      ><span aria-hidden="true" /></div>

      <div className="sc-chat-head">
        <div className="sc-chat-title">
          <span className="sc-bot-icon" aria-hidden="true"><InterfaceIcon name="chat" /></span>
          <span className="sc-chat-title-label" id="career-assistant-title">Career Chatbot</span>
          <div className="sc-chat-title-actions">
            {headerActions}
            <button
              type="button"
              className="sc-chat-size-toggle"
              onClick={() => setWide((value) => !value)}
              aria-label={wide ? 'Restore assistant width' : 'Expand assistant width'}
              aria-pressed={wide}
              title={wide ? 'Restore width' : 'Wide view — keeps the page unchanged'}
            ><InterfaceIcon name={wide ? 'restore' : 'expand'} /></button>
            <button type="button" className="sc-chat-minimize" onClick={onClose} aria-label="Minimize assistant" title="Minimize assistant (Esc)">
              <InterfaceIcon name="minimize" />
            </button>
          </div>
        </div>
        <p>AI assistant for your job search.</p>
      </div>
      {children}
    </aside>
  );
};

export default FloatingChatPanel;
