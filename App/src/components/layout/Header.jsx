import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getSectionMeta } from '../../lib/navigation';

// Workspace top bar for the dark app shell: the user identity chip and logout.
// The MCP / Claude Desktop setup entry point was unlinked here per
// MCP_CHATBOT plan §10 (retired in favor of the in-app chatbot) — the route
// and backend are kept, just no longer reachable from navigation.
const Header = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const sectionMeta = getSectionMeta(location.pathname);

  // Fall back through several display fields so we always show *something*
  // even when only an email is available (e.g. fresh Google login).
  const displayName = user?.name || user?.fullName || user?.email || "User";

  return (
    <header className="sc-topbar">
      <div className="sc-topbar-title">{sectionMeta.label}</div>

      <div className="sc-topbar-actions">
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

      </div>
    </header>
  );
};

export default Header;
