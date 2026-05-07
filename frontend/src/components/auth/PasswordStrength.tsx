/**
 * PasswordStrength — visual password strength meter.
 * Scores passwords on length, uppercase, number, and special char presence.
 * Renders a 4-segment bar: Weak / Fair / Good / Strong.
 */
"use client";

import React, { useMemo } from "react";

interface PasswordStrengthProps {
  password: string;
}

type Strength = { label: string; level: 0 | 1 | 2 | 3 | 4; color: string };

function getStrength(password: string): Strength {
  if (!password) return { label: "", level: 0, color: "" };

  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: "Weak",   level: 1, color: "var(--color-high-risk)" };
  if (score === 2) return { label: "Fair",   level: 2, color: "var(--color-warning)" };
  if (score === 3) return { label: "Good",   level: 3, color: "#63b3ed" };
  return              { label: "Strong", level: 4, color: "var(--color-low-risk)" };
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => getStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="pwd-strength" aria-label={`Password strength: ${strength.label}`}>
      <div className="pwd-strength__bars">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className="pwd-strength__bar"
            style={{
              background:
                seg <= strength.level ? strength.color : "rgba(255,255,255,0.1)",
              transition: "background 0.25s ease",
            }}
          />
        ))}
      </div>
      <span className="pwd-strength__label" style={{ color: strength.color }}>
        {strength.label}
      </span>
    </div>
  );
}
