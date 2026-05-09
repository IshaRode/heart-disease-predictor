/**
 * OAuth callback route handler.
 * Supabase redirects here after Google OAuth with a `code` param.
 * We exchange it for a session and redirect the user to the home page.
 *
 * Supabase redirect URL to configure:
 *   Dashboard → Authentication → URL Configuration → Redirect URLs
 *   Add: http://localhost:3000/auth/callback  (dev)
 *        https://<your-domain>/auth/callback  (prod)
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin;
  
  const searchParams = requestUrl.searchParams;
  const code = searchParams.get("code");
  // `next` can be used to redirect somewhere specific after login
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful OAuth — redirect to app
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — redirect to sign-in with an error flag
  return NextResponse.redirect(`${origin}/auth/signin?error=oauth_callback_failed`);
}
