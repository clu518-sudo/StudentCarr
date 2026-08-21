import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getSectionMeta } from '../../lib/navigation';

// Workspace top bar for the dark app shell.
// Adds a chat toggle used to open the assistant drawer on smaller screens.
const Header = ({ onToggleChat = () => {} }) => {
  const { user, logout, isVisitor } = useAuth();
  const location = useLocation();
  const sectionMeta = getSectionMeta(location.pathname);

  // Fall back through several display fields so we always show *something*
  // even when only an email is available (e.g. fresh Google login).
  const displayName = user?.name || user?.fullName || user?.email || "User";

  return (
    <header className="sc-topbar">
      <div className="sc-topbar-title">{sectionMeta.label}</div>

      <div className="sc-topbar-actions">
        {isVisitor ? (
          <span className="rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200">
            Visitor Mode
          </span>
        ) : null}

        {/* User identity chip */}
        <div className="flex items-center" style={{ gap: '10px' }}>
          <div className="sc-avatar" style={{ width: '34px', height: '34px' }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--sc-text)' }}>{displayName}</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--sc-muted)' }}>{user?.email}</p>
          </div>
        </div>

        <button onClick={logout} className="sc-btn" type="button">
          Logout
        </button>

        {/* Opens the career chatbot drawer on tablet/mobile widths. */}
        <button
          type="button"
          className="sc-icon-btn sc-chat-toggle"
          onClick={onToggleChat}
          aria-label="Toggle career assistant"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
