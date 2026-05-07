/**
 * Supabase server-side client factory.
 * Must be called inside a Server Component, Route Handler, or middleware.
 * Reads/writes cookies via Next.js's cookies() API so the session is
 * propagated to all server-rendered pages without extra round-trips.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component — cookies() is read-only
            // in that context. The middleware will keep the session fresh anyway.
          }
        },
      },
    }
  );
}
