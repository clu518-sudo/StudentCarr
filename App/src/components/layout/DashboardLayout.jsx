import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import CareerChatbot from './CareerChatbot';

// Desktop-first three-column application shell:
//   [ Sidebar ] [ Workspace (Header + routed page) ] [ Career chatbot ]
// The chatbot collapses into a slide-over drawer on smaller screens, toggled
// from the header. On desktop it can instead be folded into a slim side rail
// (chatCollapsed), reclaiming workspace width without fully closing it.
// The workspace column can likewise fold into a slim rail (workspaceCollapsed),
// with the freed grid column handed to the chatbot.
// Existing routing (<Outlet />) and page components are preserved unchanged
// inside the workspace column.
const DashboardLayout = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);

  // Folding the workspace hands its space to the chatbot, so the chatbot
  // can't also be folded at the same time — collapsing the workspace force-
  // expands the chatbot, and its own fold toggle is disabled meanwhile.
  const handleToggleWorkspaceCollapse = () => {
    setWorkspaceCollapsed((collapsed) => {
      const next = !collapsed;
      if (next) {
        setChatCollapsed(false);
      }
      return next;
    });
  };

  const handleToggleChatCollapse = () => {
    if (workspaceCollapsed) {
      return;
    }
    setChatCollapsed((collapsed) => !collapsed);
  };

  return (
    <div
      className={`sc-shell${chatCollapsed ? ' chat-collapsed' : ''}${workspaceCollapsed ? ' workspace-collapsed' : ''}`}
    >
      <Sidebar />

      <div className="sc-main">
        <Header onToggleChat={() => setChatOpen((open) => !open)} />
        <main className="sc-workspace sc-dark">
          <Outlet />
        </main>
        <button
          type="button"
          className="sc-workspace-fold"
          onClick={handleToggleWorkspaceCollapse}
          aria-label={workspaceCollapsed ? 'Expand workspace' : 'Collapse workspace to the side'}
          title={workspaceCollapsed ? 'Expand workspace' : 'Collapse to the side'}
        >
          {workspaceCollapsed ? '»' : '«'}
        </button>
      </div>

      <CareerChatbot
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        collapsed={chatCollapsed}
        onToggleCollapse={handleToggleChatCollapse}
      />

      <div
        className={`sc-chat-backdrop${chatOpen ? ' is-open' : ''}`}
        onClick={() => setChatOpen(false)}
        aria-hidden="true"
      />
    </div>
  );
};

export default DashboardLayout;
