"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import PredictionForm from "@/components/PredictionForm";
import ResultCard from "@/components/ResultCard";
import ChatPanel from "@/components/ChatPanel";
import { PredictRequest, PredictResponse } from "@/types";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";
import { createClient } from "@/lib/supabase/client";
import { savePrediction } from "@/lib/supabase/predictions";

export default function Home() {
  const { user, signOut } = useAuth();
  const supabase = createClient();

  const [result, setResult] = useState<PredictResponse | null>(null);
  const [patientData, setPatientData] = useState<PredictRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Submit handler ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (data: PredictRequest) => {
      setIsLoading(true);
      setError(null);
      setResult(null);
      setPatientData(data);

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

        // ── Persist to Supabase ────────────────────────────────────────
        if (user) {
          await savePrediction(supabase, user.id, data, prediction);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user]
  );

  return (
    <AuthGuard>
    <div className="app-wrapper" style={{ position: "relative" }}>
      {/* ── User Chip (top-right) ── */}
      {user && (
        <div className="user-chip" id="user-chip">
          <div className="user-chip__avatar" aria-hidden="true">
            {user.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="user-chip__email" title={user.email ?? ""}>
            {user.email}
          </span>
          <Link href="/history" className="user-chip__history-link" id="view-history-btn">
            📋 History
          </Link>
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
          <div className="glass-card">
            <div className="glass-card__header">
              <div className="glass-card__icon" aria-hidden="true">
                {result ? (result.risk === "High" ? "🚨" : "✅") : "📊"}
              </div>
              <div>
                <h2 className="glass-card__title" id="result-heading">
                  Prediction Results
                </h2>
                <p className="glass-card__subtitle">
                  {result ? `Random Forest · Recall 96.4%` : "Awaiting input"}
                </p>
              </div>
            </div>
            <div className="glass-card__body">
              <ResultCard result={result} isLoading={isLoading} error={error} />
            </div>
          </div>
        </aside>
      </main>


      {/* ── AI Health Assistant Chat Panel ── */}
      {result && patientData && (
        <ChatPanel patientData={patientData} predictionData={result} />
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
