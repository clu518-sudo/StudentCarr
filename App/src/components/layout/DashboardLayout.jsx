import React, { useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import CareerChatbot from './CareerChatbot';
import DemoWelcomeGuide from '../onboarding/DemoWelcomeGuide';
import InterfaceIcon from '../common/InterfaceIcon';

// The workspace keeps its full width. The assistant floats above it instead of
// taking a grid column or folding the page away. Chat stays mounted when hidden.
const DashboardLayout = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenerRef = useRef(null);
  const toggleChat = (event) => {
    if (!chatOpen) chatOpenerRef.current = event.currentTarget;
    setChatOpen((open) => !open);
  };

  return (
    <div className="sc-shell sc-floating-chat-shell">
      <Sidebar />
      <div className="sc-main">
        <Header />
        <main className="sc-workspace sc-dark">
          <Outlet />
        </main>
      </div>

      <CareerChatbot open={chatOpen} onClose={() => setChatOpen(false)} openerRef={chatOpenerRef} />
      <button
        type="button"
        className="sc-chat-launcher"
        onClick={toggleChat}
        aria-label="Open career assistant"
        aria-controls="career-assistant"
        aria-expanded={chatOpen}
        aria-hidden={chatOpen}
        tabIndex={chatOpen ? -1 : 0}
        title="Open career assistant"
      >
        <InterfaceIcon name="chat" />
      </button>
      <DemoWelcomeGuide />
    </div>
  );
};

export default DashboardLayout;
