import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Top bar shown on every dashboard page. We add a single entry point here
// ("Connect to Claude Desktop") that routes to /mcp — per Phase 3 of
// TASK-MCP-Integration.md, this is the only top-bar surface for the MCP setup.
const Header = () => {
  const { user, logout } = useAuth();
  // Fall back through several display fields so we always show *something*
  // even when only an email is available (e.g. fresh Google login).
  const displayName = user?.name || user?.fullName || user?.email || "User";

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Student Career Dashboard
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Top-bar entry to the MCP / Claude Desktop setup page.
                Visible to all authenticated users — the destination page
                itself enforces the "Gmail must be connected first" gate. */}
            <Link
              to="/mcp"
              className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-md border border-primary-200 text-primary-700 text-sm font-medium hover:bg-primary-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Connect to Claude Desktop</span>
            </Link>

            {/* User identity chip */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
