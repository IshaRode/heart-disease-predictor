/**
 * Reset Password Page
 * Landed here via the email link Supabase sends after resetPasswordForEmail().
 * The URL contains a token Supabase handles automatically via the callback route.
 * We call updateUser() with the new password.
 */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/AuthCard";
import PasswordStrength from "@/components/auth/PasswordStrength";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  // Supabase sets the session automatically when the user arrives via the
  // magic link — we just need to verify the session is active.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // No active session — the link may have expired
        setError(
          "This reset link has expired or is invalid. Please request a new one."
        );
      }
    });
  }, []);

  /* ── Validation ────────────────────────────────────────────── */
  function validate(): string | null {
    if (!password)          return "New password is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  /* ── Submit new password ───────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError(null);
    setIsLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
    } else {
      setSuccess(true);
      setIsLoading(false);
      // Auto-redirect to sign-in after 3 seconds
      setTimeout(() => router.push("/auth/signin?message=password_reset"), 3000);
    }
  }

  /* ── Success state ─────────────────────────────────────────── */
  if (success) {
    return (
      <AuthCard title="Password updated" icon="🔓">
        <div className="auth-success-state">
          <div className="auth-success-icon" aria-hidden="true">✅</div>
          <p className="auth-success-text">
            Your password has been updated successfully.
          </p>
          <p className="auth-success-subtext">
            Redirecting you to sign in…
          </p>
          <Link
            href="/auth/signin?message=password_reset"
            className="submit-btn"
            style={{ display: "block", textAlign: "center", marginTop: "var(--space-lg)" }}
            id="goto-signin-after-reset"
          >
            Sign In Now
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set new password"
      subtitle="Choose a strong password for your account."
      icon="🔐"
    >
      {error && (
        <div className="auth-alert auth-alert--error" role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span> {error}
          {error.includes("expired") && (
            <span>
              {" "}
              <Link href="/auth/forgot-password" className="auth-link">
                Request a new link →
              </Link>
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-form">
        {/* New Password */}
        <div className="form-field">
          <label htmlFor="reset-password">New password</label>
          <div className="input-password-wrapper">
            <input
              id="reset-password"
              type={showPwd ? "text" : "password"}
              className="form-input"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoComplete="new-password"
              required
              aria-required="true"
              aria-describedby="reset-pwd-strength"
            />
            <button
              type="button"
              className="input-eye-btn"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? "👁️" : "🙈"}
            </button>
          </div>
          <div id="reset-pwd-strength">
            <PasswordStrength password={password} />
          </div>
        </div>

        {/* Confirm Password */}
        <div className="form-field">
          <label htmlFor="reset-confirm">Confirm new password</label>
          <input
            id="reset-confirm"
            type={showPwd ? "text" : "password"}
            className={`form-input ${confirm && confirm !== password ? "error" : ""}`}
            placeholder="Re-enter new password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(null); }}
            autoComplete="new-password"
            required
            aria-required="true"
          />
          {confirm && confirm !== password && (
            <span className="field-error" role="alert">✗ Passwords don&apos;t match</span>
          )}
          {confirm && confirm === password && password.length >= 8 && (
            <span className="field-ok" role="status">✓ Passwords match</span>
          )}
        </div>

        <button
          type="submit"
          className="submit-btn"
          id="reset-submit-btn"
          disabled={isLoading || !!error?.includes("expired")}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="submit-btn__spinner" aria-hidden="true" />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </button>
      </form>
    </AuthCard>
  );
}
