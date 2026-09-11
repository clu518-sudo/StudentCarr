import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { attachPointerEffects } from './pointerFeedback.mjs';

// Presentation only: no application state, handlers, navigation, or API access.
const PointerEffects = () => {
  const layer = useRef(null);
  useEffect(() => attachPointerEffects(layer.current), []);

  return createPortal(
    <div ref={layer} className="sc-pointer-effects" aria-hidden="true">
      <span className="sc-pointer-halo" />
      {[0, 1, 2].map((index) => <span key={index} className="sc-pointer-pulse" />)}
    </div>,
    document.body,
  );
};

export default PointerEffects;
