/**
 * Auth route layout — a minimal, centered shell for sign-in/up pages.
 * Inherits the animated gradient background from the global body::before
 * pseudo-element and adds no additional chrome (no nav bar, no footer).
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication | Heart Disease Risk Predictor",
  description: "Sign in or create your account to access the AI-powered cardiac risk assessment tool.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-layout">
      {/* Centered card container — children render inside */}
      <main className="auth-main">{children}</main>

      <footer className="auth-footer">
        <p>For educational and research purposes only — not medical advice.</p>
      </footer>
    </div>
  );
}
