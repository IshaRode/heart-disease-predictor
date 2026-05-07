import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";

/**
 * POST /api/chat
 * Thin proxy to the FastAPI /chat endpoint.
 *
 * Why proxy through Next.js?
 *   - Avoids CORS complexity — browser talks to Next.js (same origin), 
 *     Next.js talks to FastAPI (server-to-server, no CORS header dance).
 *   - Keeps the FastAPI host URL in a single server-side env variable.
 *   - Future auth middleware can be added here without touching the frontend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const upstream = await fetch(`${FASTAPI_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Opt out of caching — each chat turn must be a fresh LLM call
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { error: `AI assistant error: ${detail}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to reach AI assistant service: ${message}` },
      { status: 503 }
    );
  }
}
