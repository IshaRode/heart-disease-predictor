/**
 * AuthGuard — client-side route protection.
 *
 * Why this exists:
 *  Next.js 16 Turbopack has a known issue where middleware doesn't always
 *  execute on the root route in dev mode. This component provides a
 *  reliable client-side fallback: if the user is not authenticated after
 *  the Supabase session is checked, they're immediately redirected to sign-in.
 *
 * Usage: wrap any protected page with <AuthGuard>{children}</AuthGuard>.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until session check is complete before deciding
    if (!isLoading && !user) {
      router.replace("/auth/signin");
    }
  }, [user, isLoading, router]);

  // While loading, show a minimal spinner so there's no flash of content
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-bg-primary)",
        }}
        aria-label="Checking authentication…"
        role="status"
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid rgba(79, 156, 249, 0.2)",
            borderTopColor: "var(--color-accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  // If no user after loading, render nothing (redirect is in progress)
  if (!user) return null;

  return <>{children}</>;
}
