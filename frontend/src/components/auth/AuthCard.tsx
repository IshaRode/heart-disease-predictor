/**
 * AuthCard — glassmorphism container used by all auth pages.
 * Accepts an optional logo/icon, title, subtitle, and children.
 */
"use client";

import React from "react";

interface AuthCardProps {
  icon?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function AuthCard({
  icon = "🫀",
  title,
  subtitle,
  children,
}: AuthCardProps) {
  return (
    <div className="auth-card">
      {/* Brand header */}
      <div className="auth-card__brand">
        <div className="auth-card__brand-icon" aria-hidden="true">
          {icon}
        </div>
        <div className="auth-card__eyebrow">Heart Disease Risk Predictor</div>
      </div>

      {/* Title block */}
      <div className="auth-card__heading">
        <h1 className="auth-card__title">{title}</h1>
        {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
      </div>

      {/* Page-specific form content */}
      <div className="auth-card__body">{children}</div>
    </div>
  );
}
