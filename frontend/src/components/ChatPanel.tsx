"use client";

/**
 * ChatPanel.tsx — Floating AI Health Assistant
 *
 * Design pattern: Floating Action Button (FAB) + slide-up popup.
 *  - A pill-shaped FAB is fixed to the bottom-right corner of the viewport.
 *  - The FAB appears only after a prediction result exists (passed via props).
 *  - Clicking the FAB toggles a chat popup that slides up from the button.
 *  - The popup contains the full scrollable chat with message bubbles,
 *    typing indicator, starter questions, and the input area.
 *  - Pressing Escape or clicking the close (✕) button collapses the popup.
 *  - An unread-message badge on the FAB shows how many messages are in the thread.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import { PredictRequest, PredictResponse, ChatMessage } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  /** Original 13-feature patient input submitted via the prediction form */
  patientData: PredictRequest;
  /** ML model output from /predict — provides context for the LLM */
  predictionData: PredictResponse;
}

// ---------------------------------------------------------------------------
// Starter questions — shown in empty state to reduce friction
// ---------------------------------------------------------------------------

const STARTER_QUESTIONS = [
  "Why is my risk classified this way?",
  "What do the top contributing factors mean?",
  "How can I improve my heart health?",
  "Is this result accurate?",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatPanel({ patientData, predictionData }: ChatPanelProps) {
  const [isOpen, setIsOpen]     = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const isHigh = predictionData.risk === "High";

  // Auto-scroll to bottom on new messages / loading state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus the input when the popup opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Close popup on Escape key
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Send a message
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question || isLoading) return;

    const userMsg: ChatMessage = {
      id:        `user-${Date.now()}`,
      role:      "user",
      content:   question,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          patient_data: patientData,
          prediction_data: {
            risk:        predictionData.risk,
            probability: predictionData.probability,
            top_factors: predictionData.top_factors,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error ?? "The AI assistant failed to respond.");
      }

      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id:        `assistant-${Date.now()}`,
        role:      "assistant",
        content:   data.answer,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, patientData, predictionData]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* ── Floating Action Button ── */}
      <button
        className={`chat-fab ${isOpen ? "chat-fab--active" : ""}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        aria-expanded={isOpen}
        aria-controls="chat-popup"
        id="chat-fab-btn"
      >
        {/* Robot / close icon */}
        <span className="chat-fab__icon" aria-hidden="true">
          {isOpen ? "✕" : "🤖"}
        </span>
        <span className="chat-fab__label">
          {isOpen ? "Close" : "AI Assistant"}
        </span>

        {/* Unread / message count badge */}
        {!isOpen && messages.length > 0 && (
          <span className="chat-fab__badge" aria-label={`${messages.length} messages`}>
            {messages.length}
          </span>
        )}

        {/* Pulse ring — shown when no messages yet (invite to click) */}
        {messages.length === 0 && !isOpen && (
          <span className="chat-fab__pulse" aria-hidden="true" />
        )}
      </button>

      {/* ── Chat Popup ── */}
      <div
        id="chat-popup"
        className={`chat-popup ${isOpen ? "chat-popup--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-popup-heading"
        aria-hidden={!isOpen}
      >
        {/* Popup Header */}
        <div className="chat-popup__header">
          <div className="chat-popup__header-left">
            <div className="chat-popup__avatar" aria-hidden="true">🤖</div>
            <div>
              <h2 className="chat-popup__title" id="chat-popup-heading">
                AI Health Assistant
              </h2>
              <p className="chat-popup__subtitle">
                <span
                  className={`chat-popup__dot chat-popup__dot--${isHigh ? "high" : "low"}`}
                  aria-hidden="true"
                />
                {predictionData.risk} Risk · NVIDIA LLM
              </p>
            </div>
          </div>
          <button
            className="chat-popup__close"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
            id="chat-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Disclaimer */}
        <div className="chat-popup__disclaimer" role="note">
          <span aria-hidden="true">ℹ️</span>
          <span>
            Educational only — not a substitute for{" "}
            <strong>professional medical advice</strong>.
          </span>
        </div>

        {/* Message Area */}
        <div
          className="chat-popup__messages"
          ref={scrollRef}
          aria-live="polite"
          aria-label="Chat conversation"
          id="chat-messages-container"
        >
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="chat-popup__empty">
              <div className="chat-popup__empty-icon" aria-hidden="true">💬</div>
              <p className="chat-popup__empty-text">
                Ask me anything about your prediction.
              </p>
              <div className="chat-popup__starters" role="list">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    className="chat-popup__starter-btn"
                    onClick={() => sendMessage(q)}
                    role="listitem"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bubbles */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-msg chat-msg--${msg.role}`}
              aria-label={`${msg.role === "user" ? "You" : "Assistant"} at ${msg.timestamp}`}
            >
              {msg.role === "assistant" && (
                <div className="chat-msg__avatar" aria-hidden="true">🤖</div>
              )}
              <div className="chat-msg__group">
                <div className={`chat-msg__bubble chat-msg__bubble--${msg.role}`} id={`msg-${msg.id}`}>
                  {msg.content}
                </div>
                <span className="chat-msg__time" aria-hidden="true">{msg.timestamp}</span>
              </div>
              {msg.role === "user" && (
                <div className="chat-msg__avatar chat-msg__avatar--user" aria-hidden="true">👤</div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="chat-msg chat-msg--assistant" aria-label="Assistant is typing" aria-live="assertive">
              <div className="chat-msg__avatar" aria-hidden="true">🤖</div>
              <div className="chat-msg__bubble chat-msg__bubble--assistant">
                <div className="chat-typing" aria-hidden="true">
                  <span className="chat-typing__dot" />
                  <span className="chat-typing__dot" />
                  <span className="chat-typing__dot" />
                </div>
                <span className="sr-only">Assistant is typing…</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="chat-popup__error" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="chat-popup__input-area">
          <div className="chat-popup__input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-popup__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your prediction… (Enter to send)"
              disabled={isLoading}
              rows={2}
              maxLength={1000}
              aria-label="Type your question"
              id="chat-input"
            />
            <button
              className="chat-popup__send-btn"
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              id="chat-send-btn"
            >
              {isLoading ? (
                <span className="chat-popup__send-spinner" aria-hidden="true" />
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ width: 18, height: 18 }}>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
          <p className="chat-popup__input-hint">
            {input.length}/1000 · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}
