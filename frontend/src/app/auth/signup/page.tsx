/**
 * Sign-Up Page
 * Collects email, password, confirm-password.
 * Validates all fields client-side before calling Supabase.
 * On success: shows "check your email" state (Supabase sends confirmation email).
 * Google OAuth is also available on this page.
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/AuthCard";
import GoogleButton from "@/components/auth/GoogleButton";
import PasswordStrength from "@/components/auth/PasswordStrength";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  /* ── Validation ────────────────────────────────────────────── */
  function validate(): string | null {
    if (!email.trim())                 return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(email))   return "Please enter a valid email address.";
    if (!password)                     return "Password is required.";
    if (password.length < 8)           return "Password must be at least 8 characters.";
    if (password !== confirm)          return "Passwords do not match.";
    return null;
  }

  /* ── Email / Password sign-up ──────────────────────────────── */
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError(null);
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Supabase will send a confirmation email with a link back to this URL
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      if (authError.message.includes("User already registered")) {
        setError("An account with this email already exists. Try signing in instead.");
      } else if (authError.message.includes("Password should be")) {
        setError("Password is too weak. Use at least 8 characters with letters and numbers.");
      } else {
        setError(authError.message);
      }
      setIsLoading(false);
    } else {
      // Show success — Supabase sends a confirmation email
      setSuccess(true);
      setIsLoading(false);
    }
  }

  /* ── Google OAuth ──────────────────────────────────────────── */
  async function handleGoogleSignUp() {
    setError(null);
    setIsGoogleLoading(true);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setIsGoogleLoading(false);
    }
  }

  /* ── Success state ─────────────────────────────────────────── */
  if (success) {
    return (
      <AuthCard title="Check your inbox" icon="📬">
        <div className="auth-success-state">
          <div className="auth-success-icon" aria-hidden="true">✅</div>
          <p className="auth-success-text">
            We&apos;ve sent a confirmation link to{" "}
            <strong style={{ color: "var(--color-text-primary)" }}>{email}</strong>.
          </p>
          <p className="auth-success-subtext">
            Click the link in the email to activate your account, then sign in.
          </p>
          <Link
            href="/auth/signin"
            className="submit-btn"
            style={{ display: "block", textAlign: "center", marginTop: "var(--space-lg)" }}
            id="goto-signin-after-signup"
          >
            Go to Sign In
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Get instant access to AI-powered cardiac risk analysis."
    >
      {error && (
        <div className="auth-alert auth-alert--error" role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span> {error}
        </div>
      )}

      {/* Google OAuth */}
      <GoogleButton
        onClick={handleGoogleSignUp}
        isLoading={isGoogleLoading}
        label="Sign up with Google"
      />

      <div className="auth-divider">
        <span>or sign up with email</span>
      </div>

      <form onSubmit={handleSignUp} noValidate className="auth-form">
        {/* Email */}
        <div className="form-field">
          <label htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
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

        {/* Password */}
        <div className="form-field">
          <label htmlFor="signup-password">Password</label>
          <div className="input-password-wrapper">
            <input
              id="signup-password"
              type={showPwd ? "text" : "password"}
              className="form-input"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoComplete="new-password"
              required
              aria-required="true"
              aria-describedby="pwd-strength-hint"
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
          {/* Password strength meter */}
          <div id="pwd-strength-hint">
            <PasswordStrength password={password} />
          </div>
        </div>

        {/* Confirm Password */}
        <div className="form-field">
          <label htmlFor="signup-confirm">Confirm password</label>
          <div className="input-password-wrapper">
            <input
              id="signup-confirm"
              type={showConfirm ? "text" : "password"}
              className={`form-input ${confirm && confirm !== password ? "error" : ""}`}
              placeholder="Re-enter password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              autoComplete="new-password"
              required
              aria-required="true"
            />
            <button
              type="button"
              className="input-eye-btn"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirm ? "👁️" : "🙈"}
            </button>
          </div>
          {confirm && confirm !== password && (
            <span className="field-error" role="alert">
              ✗ Passwords don&apos;t match
            </span>
          )}
          {confirm && confirm === password && password.length >= 8 && (
            <span className="field-ok" role="status">
              ✓ Passwords match
            </span>
          )}
        </div>

        <button
          type="submit"
          className="submit-btn"
          id="signup-submit-btn"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="submit-btn__spinner" aria-hidden="true" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      {/* Sign-in link */}
      <p className="auth-footer-text">
        Already have an account?{" "}
        <Link href="/auth/signin" className="auth-link" id="goto-signin-link">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
