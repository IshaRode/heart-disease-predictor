"use client";

import { useState, useCallback } from "react";
import PredictionForm from "@/components/PredictionForm";
import ResultCard from "@/components/ResultCard";
import ChatPanel from "@/components/ChatPanel";
import { PredictRequest, PredictResponse, PredictionHistoryEntry } from "@/types";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";

const MAX_HISTORY = 5;

export default function Home() {
  const { user, signOut } = useAuth();
  const [result, setResult] = useState<PredictResponse | null>(null);
  // Keep the submitted patient data in state so it can be forwarded to the
  // ChatPanel — the chatbot needs the original form input as LLM context.
  const [patientData, setPatientData] = useState<PredictRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PredictionHistoryEntry[]>([]);

  const handleSubmit = useCallback(async (data: PredictRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setPatientData(data); // capture form data for the chatbot context

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error ?? "Prediction failed");
      }

      const prediction: PredictResponse = await response.json();
      setResult(prediction);

      // Add to history (most recent first, cap at MAX_HISTORY)
      const entry: PredictionHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toLocaleTimeString(),
        input: data,
        result: prediction,
      };
      setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthGuard>
    <div className="app-wrapper" style={{ position: "relative" }}>
      {/* ── User Chip (top-right, shown when authenticated) ── */}
      {user && (
        <div className="user-chip" id="user-chip">
          {/* Avatar shows the first letter of the email */}
          <div className="user-chip__avatar" aria-hidden="true">
            {user.email?.[0] ?? "U"}
          </div>
          <span className="user-chip__email" title={user.email ?? ""}>
            {user.email}
          </span>
          <button
            className="user-chip__signout"
            onClick={signOut}
            id="signout-btn"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-header__eyebrow">
          <span>🫀</span>
          ML-Powered · UCI Heart Disease Dataset
        </div>
        <h1 className="app-header__title">Heart Disease<br />Risk Predictor</h1>
        <p className="app-header__subtitle">
          Enter patient data to receive an AI-powered risk assessment with
          explainable contributing factors.
        </p>
      </header>

      {/* ── Main Two-Column Grid ── */}
      <main className="main-grid" id="main-content">
        {/* Left: Form */}
        <section aria-labelledby="form-heading">
          <div className="glass-card">
            <div className="glass-card__header">
              <div className="glass-card__icon" aria-hidden="true">📋</div>
              <div>
                <h2 className="glass-card__title" id="form-heading">
                  Patient Information
                </h2>
                <p className="glass-card__subtitle">13 clinical features · UCI Cleveland dataset</p>
              </div>
            </div>
            <div className="glass-card__body">
              <PredictionForm onSubmit={handleSubmit} isLoading={isLoading} />
            </div>
          </div>
        </section>

        {/* Right: Results */}
        <aside aria-labelledby="result-heading" className="result-panel">
          <div className="glass-card" style={{ height: "fit-content" }}>
            <div className="glass-card__header">
              <div className="glass-card__icon" aria-hidden="true">
                {result ? (result.risk === "High" ? "🚨" : "✅") : "📊"}
              </div>
              <div>
                <h2 className="glass-card__title" id="result-heading">
                  Prediction Results
                </h2>
                <p className="glass-card__subtitle">
                  {result
                    ? `Random Forest · Recall 96.4%`
                    : "Awaiting input"}
                </p>
              </div>
            </div>
            <div className="glass-card__body">
              <ResultCard result={result} isLoading={isLoading} error={error} />
            </div>
          </div>
        </aside>
      </main>

      {/* ── Prediction History ── */}
      {history.length > 0 && (
        <section className="history-section" aria-labelledby="history-heading">
          <div className="history-header">
            <h3 className="history-title" id="history-heading">
              Recent Predictions
            </h3>
            <button
              className="history-clear-btn"
              onClick={() => setHistory([])}
              aria-label="Clear prediction history"
              id="clear-history-btn"
            >
              Clear history
            </button>
          </div>

          <div className="history-grid" role="list">
            {history.map((entry) => (
              <article
                key={entry.id}
                className="history-card"
                role="listitem"
                aria-label={`Prediction at ${entry.timestamp}: ${entry.result.risk} risk`}
              >
                <span className="history-card__timestamp">{entry.timestamp}</span>

                <div
                  className={`history-card__risk history-card__risk--${
                    entry.result.risk === "High" ? "high" : "low"
                  }`}
                >
                  <span aria-hidden="true">
                    {entry.result.risk === "High" ? "🚨" : "✅"}
                  </span>
                  {entry.result.risk} Risk
                </div>

                <div
                  className="history-card__prob"
                  style={{
                    color:
                      entry.result.risk === "High"
                        ? "var(--color-high-risk)"
                        : "var(--color-low-risk)",
                  }}
                >
                  {(entry.result.probability * 100).toFixed(1)}%
                </div>

                <p className="history-card__factors">
                  Key: {entry.result.top_factors
                    .slice(0, 3)
                    .map((f) => f.label)
                    .join(", ")}
                </p>

                <p className="history-card__factors">
                  Age {entry.input.age} · {entry.input.sex === 1 ? "Male" : "Female"}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── AI Health Assistant Chat Panel ── */}
      {/* Only rendered once a prediction result is available; the chatbot
          needs both patient_data and prediction_data as LLM context. */}
      {result && patientData && (
        <ChatPanel
          patientData={patientData}
          predictionData={result}
        />
      )}

      {/* ── Footer ── */}
      <footer
        style={{
          textAlign: "center",
          padding: "var(--space-xl)",
          color: "var(--color-text-muted)",
          fontSize: "0.78rem",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <p>
          For educational and research purposes only. Not a substitute for
          professional medical advice.
        </p>
        <p style={{ marginTop: "4px" }}>
          Model: Random Forest · Dataset: UCI Heart Disease (Cleveland) ·
          Recall: 96.4%
        </p>
      </footer>
    </div>
    </AuthGuard>
  );
}
