"use client";

import { useEffect, useState } from "react";
import { PredictResponse } from "@/types";

interface ResultCardProps {
  result: PredictResponse | null;
  isLoading: boolean;
  error: string | null;
}

export default function ResultCard({ result, isLoading, error }: ResultCardProps) {
  const [animatedProbability, setAnimatedProbability] = useState(0);

  // Animate probability bar on new result
  useEffect(() => {
    if (!result) {
      setAnimatedProbability(0);
      return;
    }
    setAnimatedProbability(0);
    const timer = setTimeout(() => {
      setAnimatedProbability(result.probability * 100);
    }, 100);
    return () => clearTimeout(timer);
  }, [result]);

  const isHigh = result?.risk === "High";

  // Max importance for relative bar sizing
  const maxImportance = result
    ? Math.max(...result.top_factors.map((f) => f.importance))
    : 1;

  if (isLoading) {
    return (
      <div className="result-placeholder">
        <div style={{ fontSize: "2.5rem", animation: "spin 1.5s linear infinite" }}>
          🫀
        </div>
        <p className="result-placeholder__text">Analyzing cardiac indicators…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="result-placeholder">
        <div className="result-placeholder__icon">⚠️</div>
        <div className="error-banner" role="alert">
          <span>⚠</span>
          <div>
            <strong>Prediction failed</strong>
            <br />
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="result-placeholder">
        <div className="result-placeholder__icon">🫀</div>
        <p className="result-placeholder__text">
          Fill in the patient details and click{" "}
          <strong>Predict Risk</strong> to see your results here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeInUp 0.4s ease" }}>
      {/* Risk Badge */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <span
          className={`risk-badge risk-badge--${isHigh ? "high" : "low"}`}
          role="status"
          aria-live="polite"
          id="risk-result-badge"
        >
          <span className="risk-badge__dot" aria-hidden="true" />
          {isHigh ? "High Risk" : "Low Risk"}
        </span>
      </div>

      {/* Probability Bar */}
      <div className="probability-section">
        <div className="probability-header">
          <span className="probability-label">Risk Probability</span>
          <span
            className={`probability-value probability-value--${isHigh ? "high" : "low"}`}
            aria-label={`Probability: ${(result.probability * 100).toFixed(1)}%`}
            id="risk-probability-display"
          >
            {(result.probability * 100).toFixed(1)}%
          </span>
        </div>
        <div
          className="probability-bar-track"
          role="progressbar"
          aria-valuenow={Math.round(result.probability * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Risk probability"
        >
          <div
            className={`probability-bar-fill probability-bar-fill--${isHigh ? "high" : "low"}`}
            style={{ width: `${animatedProbability}%` }}
          />
        </div>

        {/* Risk scale labels */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "6px",
            fontSize: "0.7rem",
            color: "var(--color-text-muted)",
          }}
        >
          <span>Low Risk</span>
          <span>Moderate</span>
          <span>High Risk</span>
        </div>
      </div>

      {/* Divider */}
      <div className="divider" />

      {/* Plain-language explanation */}
      <div
        className="explanation-box"
        aria-label="Prediction explanation"
        id="risk-explanation"
      >
        💬 {result.explanation}
      </div>

      {/* Top Contributing Factors */}
      <p className="factors-title">Top Contributing Factors</p>
      <ul
        className="factors-list"
        aria-label="Top contributing factors"
        id="top-factors-list"
      >
        {result.top_factors.map((factor, idx) => {
          const barPct = (factor.importance / maxImportance) * 100;
          return (
            <li key={factor.feature} className="factor-item">
              <span className="factor-rank" aria-label={`Rank ${idx + 1}`}>
                {idx + 1}
              </span>

              <div className="factor-info">
                <div className="factor-label" title={factor.label}>
                  {factor.label}
                </div>
                <div className="factor-value">
                  Value: {typeof factor.value === "number"
                    ? factor.value.toFixed ? factor.value.toFixed(2) : factor.value
                    : factor.value}
                </div>
              </div>

              <div
                className="factor-bar"
                role="progressbar"
                aria-valuenow={Math.round(barPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${factor.label} importance`}
              >
                <div
                  className="factor-bar-fill"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
