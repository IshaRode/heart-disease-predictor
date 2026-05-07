/**
 * Next.js root middleware — runs on every non-static request.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session cookie (keeps JWTs alive).
 *  2. Protect the main app: unauthenticated users → /auth/signin.
 *  3. Guard auth pages: authenticated users → / (no re-visiting sign-in).
 *
 * NOTE: Uses the Node.js runtime (not Edge) for reliable cookie access
 * with Next.js 16 Turbopack.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for auth routes except the ones we explicitly want to guard
  const isAuthRoute = pathname.startsWith("/auth");

  // Build Supabase response wrapper
  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // getUser() makes a real API call to verify the JWT — do not remove.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // If there's a network/config error, treat as unauthenticated
      console.warn("[middleware] getUser error:", error.message);
    }

    // Unauthenticated → redirect to sign-in
    if (!user && !isAuthRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/signin";
      redirectUrl.searchParams.delete("code");
      return NextResponse.redirect(redirectUrl);
    }

    // Authenticated on auth page → redirect to home
    if (user && isAuthRoute && pathname !== "/auth/callback") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
  } catch (err) {
    console.error("[middleware] Unexpected error:", err);
    // On unexpected errors, allow the request through rather than crash
    if (!isAuthRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/signin";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static  (static assets)
     *  - _next/image   (image optimisation)
     *  - favicon.ico, and common image extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

