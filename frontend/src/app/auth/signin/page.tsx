/**
 * Sign-In Page
 * Supports: email/password login + Google OAuth
 * On success: middleware redirects to /
 * On error: inline error message is shown
 *
 * NOTE: useSearchParams() requires a <Suspense> wrapper in Next.js App Router.
 * We split the page into SignInContent (uses the hook) + a thin default export
 * that provides the boundary.
 */
"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/AuthCard";
import GoogleButton from "@/components/auth/GoogleButton";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [info, setInfo]         = useState<string | null>(null);

  // Show contextual messages from redirects (e.g. after sign-up or password reset)
  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg === "check_email")    setInfo("Check your email to confirm your account, then sign in.");
    if (msg === "password_reset") setInfo("Your password has been reset — please sign in with your new password.");
    const err = searchParams.get("error");
    if (err === "oauth_callback_failed") setError("Google sign-in failed. Please try again.");
  }, [searchParams]);

  /* ── Validation ────────────────────────────────────────────── */
  function validate(): string | null {
    if (!email.trim())            return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(email)) return "Please enter a valid email address.";
    if (!password)                return "Password is required.";
    return null;
  }

  /* ── Email / Password sign-in ──────────────────────────────── */
  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError(null);
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      // Map Supabase error codes to user-friendly messages
      if (authError.message.includes("Invalid login credentials")) {
        setError("Incorrect email or password. Please try again.");
      } else if (authError.message.includes("Email not confirmed")) {
        setError("Please confirm your email address before signing in.");
      } else {
        setError(authError.message);
      }
      setIsLoading(false);
    } else {
      // Success — middleware will redirect, but push just in case
      router.push("/");
      router.refresh();
    }
  }

  /* ── Google OAuth ──────────────────────────────────────────── */
  async function handleGoogleSignIn() {
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
    // On success, Supabase redirects the browser — no further action needed
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to access your risk predictor dashboard."
    >
      {/* ── Error / Info banners ── */}
      {error && (
        <div className="auth-alert auth-alert--error" role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span> {error}
        </div>
      )}
      {info && (
        <div className="auth-alert auth-alert--info" role="status" aria-live="polite">
          <span aria-hidden="true">ℹ️</span> {info}
        </div>
      )}

      {/* ── Google OAuth button ── */}
      <GoogleButton onClick={handleGoogleSignIn} isLoading={isGoogleLoading} />

      {/* ── Divider ── */}
      <div className="auth-divider">
        <span>or continue with email</span>
      </div>

      {/* ── Email/Password form ── */}
      <form onSubmit={handleEmailSignIn} noValidate className="auth-form">
        <div className="form-field">
          <label htmlFor="signin-email">Email address</label>
          <input
            id="signin-email"
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

        <div className="form-field">
          <label htmlFor="signin-password">
            Password
            <Link href="/auth/forgot-password" className="auth-link auth-link--inline" tabIndex={-1}>
              Forgot password?
            </Link>
          </label>
          <div className="input-password-wrapper">
            <input
              id="signin-password"
              type={showPwd ? "text" : "password"}
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoComplete="current-password"
              required
              aria-required="true"
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
        </div>

        <button
          type="submit"
          className="submit-btn"
          id="signin-submit-btn"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="submit-btn__spinner" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      {/* ── Sign-up link ── */}
      <p className="auth-footer-text">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="auth-link" id="goto-signup-link">
          Create one
        </Link>
      </p>
    </AuthCard>
  );
}

/**
 * Default export wraps SignInContent in a Suspense boundary.
 * Required because useSearchParams() opts the component out of static rendering.
 */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
