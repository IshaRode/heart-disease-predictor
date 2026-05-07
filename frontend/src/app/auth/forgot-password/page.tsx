/**
 * Forgot Password Page
 * Sends a Supabase password-reset email with a link to /auth/reset-password.
 * The link contains a one-time token that Supabase validates.
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/AuthCard";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [sent, setSent]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) { setError("Email is required."); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Please enter a valid email address."); return; }

    setError(null);
    setIsLoading(true);

    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        // Supabase will embed this URL in the email link.
        // Make sure this path is listed under Supabase → Auth → URL Configuration → Redirect URLs.
        redirectTo: `${window.location.origin}/auth/reset-password`,
      }
    );

    // NOTE: Supabase returns success even for unknown emails (to prevent
    // user enumeration). We always show the success state.
    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }

    setIsLoading(false);
  }

  /* ── Success state ─────────────────────────────────────────── */
  if (sent) {
    return (
      <AuthCard title="Email sent" icon="📧">
        <div className="auth-success-state">
          <div className="auth-success-icon" aria-hidden="true">✅</div>
          <p className="auth-success-text">
            If <strong style={{ color: "var(--color-text-primary)" }}>{email}</strong> is
            registered, you&apos;ll receive a password reset link shortly.
          </p>
          <p className="auth-success-subtext">
            Check your spam folder if you don&apos;t see it within a few minutes.
          </p>
          <Link
            href="/auth/signin"
            className="submit-btn"
            style={{ display: "block", textAlign: "center", marginTop: "var(--space-lg)" }}
            id="back-to-signin-link"
          >
            Back to Sign In
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      icon="🔑"
    >
      {error && (
        <div className="auth-alert auth-alert--error" role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-form">
        <div className="form-field">
          <label htmlFor="forgot-email">Email address</label>
          <input
            id="forgot-email"
            type="email"
            className="form-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            autoComplete="email"
            required
            aria-required="true"
          />
        </div>

        <button
          type="submit"
          className="submit-btn"
          id="forgot-submit-btn"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="submit-btn__spinner" aria-hidden="true" />
              Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </form>

      <p className="auth-footer-text">
        Remembered it?{" "}
        <Link href="/auth/signin" className="auth-link" id="back-to-signin-from-forgot">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
