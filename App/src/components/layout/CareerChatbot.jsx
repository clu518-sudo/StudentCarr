import React, { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../contexts/AuthContext";
import { chatApi } from "../../lib/apiClient";

// Persistent right-side career assistant panel.
//
// There is no chatbot backend in the current codebase, so this panel is a
// self-contained UI that produces a local placeholder reply. The message flow
// is intentionally funnelled through a single `requestAssistantReply` function,
// so a real backend can be wired in later by replacing only that one function
// — no other UI changes required. This panel does not compute or send page
// context; the assistant's context comes from MCP tools server-side instead.

const QUICK_ACTIONS = [
  { label: "Improve my resume", prompt: "Help me improve my resume." },
  {
    label: "Draft a follow-up",
    prompt: "Draft a follow-up email for my application.",
  },
  {
    label: "Practice interview",
    prompt: "Start a practice interview with me.",
  },
];

const formatTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

let messageId = 0;
const nextId = () => {
  messageId += 1;
  return messageId;
};

const CareerChatbot = ({
  open = false,
  onClose = () => {},
  collapsed = false,
  onToggleCollapse = () => {},
}) => {
  const { accessToken } = useAuth();
  const [messages, setMessages] = useState(() => [
    {
      id: nextId(),
      role: "assistant",
      text: "Hi! I'm your career assistant. Ask me about your profile, applications, skills, or interviews.",
      time: formatTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const replyTimerRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  useEffect(
    () => () => {
      if (replyTimerRef.current) {
        window.clearTimeout(replyTimerRef.current);
      }
    },
    [],
  );

  // Single integration seam for a future AI backend. Today it returns a local
  // placeholder reply.
  const requestAssistantReply = async (userText) => {
    try {
      const response = await chatApi.send({ message: userText }, accessToken);
      return response?.data?.reply ?? "Sorry, I didn't get a reply.";
    } catch (error) {
      return `Something went wrong: ${error.message || "please try again."}`;
    }
  };

  const sendMessage = async (rawText) => {
    const text = rawText.trim();
    if (!text || isThinking) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", text, time: formatTime() },
    ]);
    setInput("");
    setIsThinking(true);

    try {
      const reply = await requestAssistantReply(text);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", text: reply, time: formatTime() },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (prompt) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <aside
      className={`sc-chat${open ? " is-open" : ""}${collapsed ? " is-collapsed" : ""}`}
      aria-label="Career chatbot"
    >
      <div className="sc-chat-head">
        <div className="sc-chat-title">
          <span className="sc-bot-icon" aria-hidden="true">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </span>
          <span className="sc-chat-title-label">Career Chatbot</span>
          <div className="sc-chat-title-actions">
            <button
              type="button"
              className="sc-chat-fold"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand assistant" : "Collapse assistant to the side"}
              title={collapsed ? "Expand assistant" : "Collapse to the side"}
            >
              {collapsed ? "«" : "»"}
            </button>
            <button
              type="button"
              className="sc-chat-close"
              onClick={onClose}
              aria-label="Close assistant"
            >
              ✕
            </button>
          </div>
        </div>
        <p>AI assistant for your job search.</p>
      </div>

      <div className="sc-messages" ref={messagesRef}>
        {messages.map((message) => (
          <div key={message.id} className={`sc-message ${message.role}`}>
            <div className="sc-md">
              <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="sc-message assistant typing">Assistant is typing…</div>
        )}
      </div>

      <div className="sc-quick-actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="sc-chip"
            onClick={() => handleQuickAction(action.prompt)}
          >
            {action.label}
          </button>
        ))}
      </div>

      <form className="sc-composer" onSubmit={handleSubmit}>
        <div className="sc-input-wrap">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask anything about your career..."
            aria-label="Message the career assistant"
          />
          <button
            type="submit"
            className="sc-send"
            disabled={!input.trim() || isThinking}
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
      </form>
    </aside>
  );
};

export default CareerChatbot;
