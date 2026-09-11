import React, { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../contexts/AuthContext";
import { chatApi } from "../../lib/apiClient";
import InterfaceIcon from "../common/InterfaceIcon";
import FloatingChatPanel from "./FloatingChatPanel";

// Persistent right-side career assistant panel.
//
// sendMessage streams the reply token-by-token over SSE (chatApi.stream) and
// patches the assistant's own message in place as events arrive. This panel
// does not compute or send page context; the assistant's context comes from
// MCP tools server-side instead.

const QUICK_ACTIONS = [
  {
    id: "profile-summary",
    label: "Explore roles",
    prompt: "summarize my profile and recommend some relevant job types",
  },
  {
    id: "application-progress",
    label: "Application progress",
    prompt: "How are my applications progressing?",
  },
];

// Default limits snapshot before the server has ever responded — matches a
// fresh non-admin account's actual budget, so the UI doesn't flash from an
// unlimited-looking state down to the real cap once history loads.
const DEFAULT_LIMITS = {
  unlimited: false,
  messageLimit: 4,
  messagesUsed: 0,
  remaining: 4,
  usedQuickActions: [],
  canClearHistory: true,
};

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
  openerRef,
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
  const [limits, setLimits] = useState(DEFAULT_LIMITS);

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
        if (cancelled) return;

        if (data?.limits) {
          setLimits(data.limits);
        }

        if (!data?.threadId || !data.messages?.length) return;

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

  const sendMessage = async (rawText, quickActionId) => {
    const text = rawText.trim();
    if (!text || isThinking) {
      return;
    }
    // Demo-deploy guard: mirrors the server-side check in chatLimits.js so
    // an already-disabled control can't be forced via a stale ref. The
    // server is still the real enforcement point (see the 403 handling
    // below) — this just avoids a pointless round trip.
    if (!limits.unlimited && (limits.remaining <= 0 || (quickActionId && limits.usedQuickActions.includes(quickActionId)))) {
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
          quickActionId,
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
              if (payload?.limits) {
                setLimits(payload.limits);
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
        // A 403 from the demo-limit checks carries its own message and a
        // fresh limits snapshot — render that instead of the generic
        // fallback, and sync the UI's budget to what the server enforced.
        if (error.status === 403 && error.limits) {
          setLimits(error.limits);
        }
        patchMessage(assistantId, {
          text: error.status === 403
            ? error.message
            : `Something went wrong: ${error.message || "please try again."}`,
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

  // Wipes the saved threads and resets the panel to a clean slate. Non-admins
  // get exactly one of these, ever (see limits.canClearHistory / chatHistoryClears).
  const handleClearHistory = async () => {
    if (isThinking || !limits.canClearHistory) return;
    const confirmMessage = limits.unlimited
      ? "Delete all saved chat history for this account?"
      : "Delete all saved chat history for this account? This demo only allows this once.";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await chatApi.clearHistory(accessToken);
      threadIdRef.current = null;
      setMessages([
        { id: nextId(), role: "assistant", text: GREETING, time: formatTime() },
      ]);
      setLimits((prev) => ({
        ...prev,
        messagesUsed: 0,
        remaining: prev.messageLimit ?? DEFAULT_LIMITS.messageLimit,
        usedQuickActions: [],
        canClearHistory: prev.unlimited,
      }));
    } catch (error) {
      if (error.status === 403) {
        setLimits((prev) => ({ ...prev, canClearHistory: false }));
      }
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

  const handleQuickAction = (action) => {
    sendMessage(action.prompt, action.id);
  };

  return (
    <FloatingChatPanel
      open={open}
      onClose={onClose}
      openerRef={openerRef}
      headerActions={
        <button
          type="button"
          className="sc-chat-delete"
          onClick={handleClearHistory}
          disabled={isThinking || !limits.canClearHistory}
          aria-label="Delete saved chat history"
          title={
            limits.canClearHistory
              ? "Delete saved chat history"
              : "This demo allows clearing chat history only once"
          }
        >
          <InterfaceIcon name="trash" />
        </button>
      }
    >

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
                <span className="sc-typing" role="status"><span className="sc-thinking-dots" aria-hidden="true"><i /><i /><i /></span> Thinking…</span>
              ) : (
                <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
              )}
            </div>
          </div>
        ))}
      </div>

      {!limits.unlimited && (
        <p className="sc-chat-limit-note">
          {limits.remaining > 0
            ? `${limits.remaining} of ${limits.messageLimit} messages left in this demo`
            : `Demo limit reached — ${limits.messageLimit} messages per conversation`}
        </p>
      )}

      <div className="sc-quick-actions">
        {QUICK_ACTIONS.map((action) => {
          const used = limits.usedQuickActions.includes(action.id);
          return (
            <button
              key={action.id}
              type="button"
              className="sc-chip"
              disabled={isThinking || used || (!limits.unlimited && limits.remaining <= 0)}
              title={used ? "Already used in this conversation" : action.prompt}
              onClick={() => handleQuickAction(action)}
            >
              <InterfaceIcon name={used ? 'check' : 'arrow'} />
              {action.label}
            </button>
          );
        })}
      </div>

      <form className="sc-composer" onSubmit={handleSubmit}>
        <div className="sc-input-wrap">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              !limits.unlimited && limits.remaining <= 0
                ? "Demo limit reached — 4 messages per conversation"
                : "Ask anything about your career..."
            }
            aria-label="Message the career assistant"
            disabled={!limits.unlimited && limits.remaining <= 0}
          />
          <button
            type="submit"
            className="sc-send"
            disabled={!input.trim() || isThinking || (!limits.unlimited && limits.remaining <= 0)}
            aria-label="Send message"
            aria-busy={isThinking}
          >
            <InterfaceIcon name={isThinking ? 'sync' : 'send'} className={isThinking ? 'sc-spin' : ''} />
          </button>
        </div>
      </form>
    </FloatingChatPanel>
  );
};

export default CareerChatbot;
