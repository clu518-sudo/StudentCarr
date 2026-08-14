import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import CareerChatbot from './CareerChatbot';

// Desktop-first three-column application shell:
//   [ Sidebar ] [ Workspace (Header + routed page) ] [ Career chatbot ]
// The chatbot collapses into a slide-over drawer on smaller screens, toggled
// from the header. Existing routing (<Outlet />) and page components are
// preserved unchanged inside the workspace column.
const DashboardLayout = () => {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="sc-shell">
      <Sidebar />

      <div className="sc-main">
        <Header onToggleChat={() => setChatOpen((open) => !open)} />
        <main className="sc-workspace sc-dark">
          <Outlet />
        </main>
      </div>

      <CareerChatbot open={chatOpen} onClose={() => setChatOpen(false)} />

      <div
        className={`sc-chat-backdrop${chatOpen ? ' is-open' : ''}`}
        onClick={() => setChatOpen(false)}
        aria-hidden="true"
      />
    </div>
  );
};

export default DashboardLayout;
