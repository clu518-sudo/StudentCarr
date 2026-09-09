import React, { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../contexts/AuthContext";
import { chatApi } from "../../lib/apiClient";

// Persistent right-side career assistant panel.
//
// sendMessage streams the reply token-by-token over SSE (chatApi.stream) and
// patches the assistant's own message in place as events arrive. This panel
// does not compute or send page context; the assistant's context comes from
// MCP tools server-side instead.

const QUICK_ACTIONS = [
  {
    label: "summarize my profile and recommend some relevant job types",
    prompt: "summarize my profile and recommend some relevant job types",
  },
  {
    label: "How are my applications progressing?",
    prompt: "How are my applications progressing?",
  },
];

const GREETING =
  "Hi! I'm your career assistant. Ask me about your profile, applications, skills, or interviews.";

const formatTime = (value) =>
  new Date(value ?? Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

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
      text: GREETING,
      time: formatTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const replyTimerRef = useRef(null);
  const threadIdRef = useRef(null);
  const streamControllerRef = useRef(null);

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

  // Abort any in-flight stream on unmount so a late SSE event can't call
  // setState after the panel is gone.
  useEffect(
    () => () => {
      streamControllerRef.current?.abort();
    },
    [],
  );

  // Resume the most recent persisted thread so history survives a refresh.
  useEffect(() => {
    if (!accessToken) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const response = await chatApi.history(accessToken);
        const data = response?.data;
        if (cancelled || !data?.threadId || !data.messages?.length) return;

        threadIdRef.current = data.threadId;
        setMessages((prev) => [
          ...prev,
          ...data.messages.map((entry) => ({
            id: nextId(),
            role: entry.role,
            text: entry.content,
            time: formatTime(entry.createdAt),
          })),
        ]);
      } catch {
        // A failed hydrate just means starting a fresh thread.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const TOOL_LABEL = {
    list_applications: "Checking your applications",
    list_application_emails: "Checking your application emails",
    get_email_detail: "Reading that email",
    get_user_profile: "Checking your profile",
  };

  const describeTool = (tool) => TOOL_LABEL[tool] || `Using ${tool}`;

  const patchMessage = (id, patch) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id
          ? {
              ...message,
              ...(typeof patch === "function" ? patch(message) : patch),
            }
          : message,
      ),
    );
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

    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", text: "", toolActivity: [], time: formatTime() },
    ]);

    const controller = new AbortController();
    streamControllerRef.current = controller;

    try {
      await chatApi.stream(
        {
          message: text,
          threadId: threadIdRef.current || undefined,
          signal: controller.signal,
          onEvent: (eventName, payload) => {
            if (eventName === "token") {
              if (payload?.text) {
                patchMessage(assistantId, (message) => ({
                  text: message.text + payload.text,
                }));
              }
              return;
            }

            // Tool activity is appended, never cleared, so it stays visible
            // as a log for the rest of this turn instead of flashing by.
            if (eventName === "tool_start") {
              patchMessage(assistantId, (message) => ({
                toolActivity: [
                  ...message.toolActivity,
                  { runId: payload?.runId, tool: payload?.tool, done: false },
                ],
              }));
              return;
            }

            if (eventName === "tool_end") {
              patchMessage(assistantId, (message) => ({
                toolActivity: message.toolActivity.map((entry) =>
                  entry.runId === payload?.runId
                    ? { ...entry, done: true }
                    : entry,
                ),
              }));
              return;
            }

            if (eventName === "completed") {
              if (payload?.threadId) {
                threadIdRef.current = payload.threadId;
              }
              patchMessage(assistantId, (message) => ({
                text: payload?.reply ?? "",
                // Safety net: a dropped tool_end shouldn't leave a stray
                // "running" entry in the log once the turn is done.
                toolActivity: message.toolActivity.map((entry) => ({
                  ...entry,
                  done: true,
                })),
              }));
              return;
            }

            if (eventName === "error") {
              patchMessage(assistantId, {
                text: `Something went wrong: ${payload?.error || "please try again."}`,
              });
            }
          },
        },
        accessToken,
      );
    } catch (error) {
      if (error.name !== "AbortError") {
        patchMessage(assistantId, {
          text: `Something went wrong: ${error.message || "please try again."}`,
        });
      }
    } finally {
      setIsThinking(false);
      streamControllerRef.current = null;
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  // Wipes the saved threads and resets the panel to a clean slate.
  const handleClearHistory = async () => {
    if (isThinking) return;
    if (!window.confirm("Delete all saved chat history for this account?")) {
      return;
    }

    try {
      await chatApi.clearHistory(accessToken);
      threadIdRef.current = null;
      setMessages([
        { id: nextId(), role: "assistant", text: GREETING, time: formatTime() },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          text: `Could not clear history: ${error.message || "please try again."}`,
          time: formatTime(),
        },
      ]);
    }
  };

  const handleQuickAction = (prompt) => {
    sendMessage(prompt);
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
            {/* .sc-chat-delete mirrors .sc-chat-fold's look but isn't
                subject to the workspace-collapsed pointer-events: none
                rule that targets .sc-chat-fold — this button must stay
                clickable whenever the workspace is folded. */}
            <button
              type="button"
              className="sc-chat-delete"
              onClick={handleClearHistory}
              disabled={isThinking}
              aria-label="Delete saved chat history"
              title="Delete saved chat history"
            >
              🗑
            </button>
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
            {message.toolActivity?.length > 0 && (
              <div className="sc-tool-log">
                {message.toolActivity.map((entry, index) => (
                  <div
                    key={entry.runId || index}
                    className={`sc-tool-log-line${entry.done ? " done" : ""}`}
                  >
                    <span className="sc-tool-log-icon" aria-hidden="true">
                      {entry.done ? "✓" : "⋯"}
                    </span>
                    {describeTool(entry.tool)}
                  </div>
                ))}
              </div>
            )}
            <div className="sc-md">
              {message.role === "assistant" &&
              !message.text &&
              !message.toolActivity?.length ? (
                <span className="sc-typing">Thinking…</span>
              ) : (
                <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
              )}
            </div>
          </div>
        ))}
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
