"use client";

/**
 * /history — Full prediction history comparison view.
 *
 * Client component so we can handle inline deletes without a full page
 * reload. History is fetched from Supabase on mount, scoped to the
 * authenticated user via RLS.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";
import { createClient } from "@/lib/supabase/client";
import {
  fetchHistory,
  deleteHistoryEntry,
  PredictionHistoryRow,
} from "@/lib/supabase/predictions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ProbBar({ value, isHigh }: { value: number; isHigh: boolean }) {
  return (
    <div className="hist-prob-bar-track">
      <div
        className={`hist-prob-bar-fill hist-prob-bar-fill--${isHigh ? "high" : "low"}`}
        style={{ width: `${(value * 100).toFixed(1)}%` }}
      />
    </div>
  );
}

// Readable label map for the 13 form fields
const FIELD_LABELS: Record<string, string> = {
  age:      "Age",
  sex:      "Sex",
  cp:       "Chest Pain Type",
  trestbps: "Resting BP",
  chol:     "Cholesterol",
  fbs:      "Fasting Blood Sugar",
  restecg:  "Resting ECG",
  thalach:  "Max Heart Rate",
  exang:    "Exercise Angina",
  oldpeak:  "ST Depression",
  slope:    "ST Slope",
  ca:       "Major Vessels",
  thal:     "Thalassemia",
};

// ---------------------------------------------------------------------------
// Row component (expandable)
// ---------------------------------------------------------------------------

function HistoryRow({
  row,
  onDelete,
}: {
  row: PredictionHistoryRow;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isHigh = row.risk === "High";

  return (
    <article className="hist-row" aria-label={`Prediction ${formatDate(row.created_at)}: ${row.risk} risk`}>
      {/* ── Summary bar ── */}
      <div className="hist-row__summary">
        {/* Timestamp */}
        <span className="hist-row__date">{formatDate(row.created_at)}</span>

        {/* Risk badge */}
        <span className={`hist-row__badge hist-row__badge--${isHigh ? "high" : "low"}`}>
          <span className="hist-row__badge-dot" />
          {isHigh ? "🚨 High" : "✅ Low"}
        </span>

        {/* Probability */}
        <div className="hist-row__prob-col">
          <span
            className="hist-row__prob-val"
            style={{ color: isHigh ? "var(--color-high-risk)" : "var(--color-low-risk)" }}
          >
            {(row.probability * 100).toFixed(1)}%
          </span>
          <ProbBar value={row.probability} isHigh={isHigh} />
        </div>

        {/* Top factor */}
        <span className="hist-row__top-factor">
          {row.top_factors[0]?.label ?? "—"}
        </span>

        {/* Demog */}
        <span className="hist-row__demog">
          Age {row.form_inputs.age} · {row.form_inputs.sex === 1 ? "Male" : "Female"}
        </span>

        {/* Controls */}
        <div className="hist-row__controls">
          <button
            className="hist-btn hist-btn--expand"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded ? "▲ Hide" : "▼ Details"}
          </button>
          <button
            className="hist-btn hist-btn--delete"
            onClick={() => onDelete(row.id)}
            aria-label="Delete this entry"
          >
            Delete
          </button>
        </div>
      </div>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="hist-row__detail" aria-label="Full prediction details">
          <div className="hist-detail-grid">
            {/* Form inputs */}
            <div className="hist-detail-section">
              <p className="hist-detail-section__title">Form Inputs</p>
              <dl className="hist-inputs-list">
                {Object.entries(row.form_inputs).map(([k, v]) => (
                  <div key={k} className="hist-input-pair">
                    <dt className="hist-input-pair__label">{FIELD_LABELS[k] ?? k}</dt>
                    <dd className="hist-input-pair__value">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Top factors */}
            <div className="hist-detail-section">
              <p className="hist-detail-section__title">Top Contributing Factors</p>
              <ol className="hist-factors-list">
                {row.top_factors.map((f, i) => (
                  <li key={f.feature} className="hist-factor-item">
                    <span className="hist-factor-rank">{i + 1}</span>
                    <div className="hist-factor-info">
                      <span className="hist-factor-label">{f.label}</span>
                      <span className="hist-factor-meta">
                        val: {typeof f.value === "number" ? f.value.toFixed(2) : f.value}
                        {" · "}
                        imp: {(f.importance * 100).toFixed(1)}%
                      </span>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Explanation */}
              <div className="hist-explanation">
                💬 {row.explanation}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [rows, setRows] = useState<PredictionHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchHistory(supabase, user.id).then((data) => {
      setRows(data);
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleDelete = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await deleteHistoryEntry(supabase, id);
  };

  const highCount  = rows.filter((r) => r.risk === "High").length;
  const lowCount   = rows.filter((r) => r.risk === "Low").length;
  const avgProb    = rows.length
    ? (rows.reduce((s, r) => s + r.probability, 0) / rows.length * 100).toFixed(1)
    : null;

  return (
    <AuthGuard>
      <div className="app-wrapper hist-page">
        {/* ── Back nav ── */}
        <nav className="hist-nav" aria-label="Back navigation">
          <Link href="/" className="hist-back-link" id="back-to-predictor-link">
            ← Back to Predictor
          </Link>
        </nav>

        {/* ── Header ── */}
        <header className="hist-page__header">
          <div className="app-header__eyebrow">
            <span>📋</span>
            Prediction History
          </div>
          <h1 className="app-header__title" style={{ fontSize: "clamp(1.6rem, 4vw, 2.8rem)" }}>
            Your Past Assessments
          </h1>
          <p className="app-header__subtitle">
            Review all your previous heart disease risk predictions side-by-side.
          </p>
        </header>

        {/* ── Stats strip ── */}
        {rows.length > 0 && (
          <div className="hist-stats-strip" aria-label="Summary statistics">
            <div className="hist-stat-card">
              <span className="hist-stat-card__value">{rows.length}</span>
              <span className="hist-stat-card__label">Total Predictions</span>
            </div>
            <div className="hist-stat-card hist-stat-card--high">
              <span className="hist-stat-card__value" style={{ color: "var(--color-high-risk)" }}>
                {highCount}
              </span>
              <span className="hist-stat-card__label">High Risk</span>
            </div>
            <div className="hist-stat-card hist-stat-card--low">
              <span className="hist-stat-card__value" style={{ color: "var(--color-low-risk)" }}>
                {lowCount}
              </span>
              <span className="hist-stat-card__label">Low Risk</span>
            </div>
            {avgProb !== null && (
              <div className="hist-stat-card">
                <span className="hist-stat-card__value">{avgProb}%</span>
                <span className="hist-stat-card__label">Avg Probability</span>
              </div>
            )}
          </div>
        )}

        {/* ── Table ── */}
        <main className="hist-main" id="history-main-content">
          {isLoading ? (
            <div className="hist-empty-state">
              <span style={{ fontSize: "2.5rem", animation: "spin 1.5s linear infinite" }}>🫀</span>
              <p>Loading your history…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="hist-empty-state">
              <span style={{ fontSize: "3rem", opacity: 0.3 }}>📋</span>
              <p className="hist-empty-state__text">
                No predictions yet. Go back to the{" "}
                <Link href="/" style={{ color: "var(--color-accent)" }}>
                  predictor
                </Link>{" "}
                and submit your first assessment.
              </p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="hist-table-header" aria-hidden="true">
                <span>Date</span>
                <span>Risk</span>
                <span>Probability</span>
                <span>Top Factor</span>
                <span>Demographics</span>
                <span />
              </div>

              <div className="hist-table-body" role="list">
                {rows.map((row) => (
                  <HistoryRow key={row.id} row={row} onDelete={handleDelete} />
                ))}
              </div>
            </>
          )}
        </main>

        {/* ── Footer ── */}
        <footer
          style={{
            textAlign: "center",
            padding: "var(--space-xl)",
            color: "var(--color-text-muted)",
            fontSize: "0.78rem",
            borderTop: "1px solid var(--color-border)",
            marginTop: "var(--space-3xl)",
          }}
        >
          <p>For educational and research purposes only. Not a substitute for professional medical advice.</p>
        </footer>
      </div>
    </AuthGuard>
  );
}
