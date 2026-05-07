"use client";

import React, { useState } from "react";
import { PredictRequest } from "@/types";

// ---------------------------------------------------------------------------
// Field Definitions
// ---------------------------------------------------------------------------

interface SelectOption {
  value: number;
  label: string;
}

interface FieldDef {
  key: keyof PredictRequest;
  label: string;
  hint: string;
  type: "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: SelectOption[];
  section?: string;
}

const FIELD_DEFS: FieldDef[] = [
  // ── Demographics
  {
    key: "age", label: "Age", hint: "years", type: "number",
    min: 1, max: 120, step: 1, section: "Demographics",
  },
  {
    key: "sex", label: "Sex", hint: "", type: "select", section: "Demographics",
    options: [{ value: 1, label: "Male" }, { value: 0, label: "Female" }],
  },
  // ── Clinical
  {
    key: "cp", label: "Chest Pain Type", hint: "", type: "select", section: "Clinical",
    options: [
      { value: 1, label: "1 – Typical Angina" },
      { value: 2, label: "2 – Atypical Angina" },
      { value: 3, label: "3 – Non-Anginal Pain" },
      { value: 4, label: "4 – Asymptomatic" },
    ],
  },
  {
    key: "trestbps", label: "Resting Blood Pressure", hint: "mm Hg",
    type: "number", min: 50, max: 250, step: 1, section: "Clinical",
  },
  {
    key: "chol", label: "Serum Cholesterol", hint: "mg/dl",
    type: "number", min: 100, max: 600, step: 1, section: "Clinical",
  },
  {
    key: "fbs", label: "Fasting Blood Sugar > 120", hint: "", type: "select", section: "Clinical",
    options: [{ value: 1, label: "Yes" }, { value: 0, label: "No" }],
  },
  {
    key: "restecg", label: "Resting ECG Result", hint: "", type: "select", section: "Clinical",
    options: [
      { value: 0, label: "0 – Normal" },
      { value: 1, label: "1 – ST-T Wave Abnormality" },
      { value: 2, label: "2 – Left Ventricular Hypertrophy" },
    ],
  },
  // ── Exercise
  {
    key: "thalach", label: "Max Heart Rate", hint: "bpm",
    type: "number", min: 50, max: 250, step: 1, section: "Exercise Test",
  },
  {
    key: "exang", label: "Exercise Induced Angina", hint: "", type: "select", section: "Exercise Test",
    options: [{ value: 1, label: "Yes" }, { value: 0, label: "No" }],
  },
  {
    key: "oldpeak", label: "ST Depression", hint: "exercise vs rest",
    type: "number", min: 0, max: 10, step: 0.1, section: "Exercise Test",
  },
  {
    key: "slope", label: "ST Slope", hint: "", type: "select", section: "Exercise Test",
    options: [
      { value: 1, label: "1 – Upsloping" },
      { value: 2, label: "2 – Flat" },
      { value: 3, label: "3 – Downsloping" },
    ],
  },
  // ── Advanced
  {
    key: "ca", label: "Major Vessels (Fluoroscopy)", hint: "0–4",
    type: "number", min: 0, max: 4, step: 1, section: "Advanced",
  },
  {
    key: "thal", label: "Thalassemia", hint: "", type: "select", section: "Advanced",
    options: [
      { value: 3, label: "3 – Normal" },
      { value: 6, label: "6 – Fixed Defect" },
      { value: 7, label: "7 – Reversable Defect" },
    ],
  },
];

// Default values matching a typical healthy profile
const DEFAULT_VALUES: PredictRequest = {
  age: 52,
  sex: 1,
  cp: 3,
  trestbps: 125,
  chol: 212,
  fbs: 0,
  restecg: 0,
  thalach: 168,
  exang: 0,
  oldpeak: 1.0,
  slope: 2,
  ca: 0,
  thal: 3,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PredictionFormProps {
  onSubmit: (data: PredictRequest) => void;
  isLoading: boolean;
}

export default function PredictionForm({ onSubmit, isLoading }: PredictionFormProps) {
  const [values, setValues] = useState<PredictRequest>(DEFAULT_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof PredictRequest, string>>>({});

  // Group fields by section
  const sections = FIELD_DEFS.reduce<Record<string, FieldDef[]>>((acc, field) => {
    const sec = field.section ?? "General";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(field);
    return acc;
  }, {});

  function handleChange(key: keyof PredictRequest, raw: string) {
    const val = raw === "" ? 0 : parseFloat(raw);
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof PredictRequest, string>> = {};
    FIELD_DEFS.forEach((f) => {
      const v = values[f.key] as number;
      if (f.type === "number") {
        if (isNaN(v)) {
          newErrors[f.key] = "Required";
        } else if (f.min !== undefined && v < f.min) {
          newErrors[f.key] = `Min ${f.min}`;
        } else if (f.max !== undefined && v > f.max) {
          newErrors[f.key] = `Max ${f.max}`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) {
      onSubmit(values);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Heart disease prediction form">
      {Object.entries(sections).map(([sectionName, fields]) => (
        <React.Fragment key={sectionName}>
          <p className="form-section-label">{sectionName}</p>

          <div className={`form-grid ${fields.length === 1 ? "form-grid--single" : ""}`}>
            {fields.map((field) => (
              <div key={field.key} className="form-field">
                <label htmlFor={`field-${field.key}`}>
                  {field.label}
                  {field.hint && (
                    <span className="field-hint">({field.hint})</span>
                  )}
                </label>

                {field.type === "select" ? (
                  <select
                    id={`field-${field.key}`}
                    className={`form-select${errors[field.key] ? " error" : ""}`}
                    value={values[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    disabled={isLoading}
                    aria-invalid={!!errors[field.key]}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`field-${field.key}`}
                    type="number"
                    className={`form-input${errors[field.key] ? " error" : ""}`}
                    value={values[field.key]}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    disabled={isLoading}
                    aria-invalid={!!errors[field.key]}
                  />
                )}

                {errors[field.key] && (
                  <span className="field-error" role="alert">
                    ⚠ {errors[field.key]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </React.Fragment>
      ))}

      <button
        type="submit"
        id="predict-submit-btn"
        className="submit-btn"
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <span className="submit-btn__spinner" aria-hidden="true" />
            Analyzing...
          </>
        ) : (
          <>
            🫀 Predict Risk
          </>
        )}
      </button>
    </form>
  );
}
