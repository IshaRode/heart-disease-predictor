/**
 * Supabase browser-side client.
 * Uses @supabase/ssr's createBrowserClient which automatically handles
 * cookie-based session storage (works with Next.js App Router).
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
