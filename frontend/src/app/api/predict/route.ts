import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";

/**
 * POST /api/predict
 * Proxy to the FastAPI /predict endpoint.
 * Keeps CORS and API base URL config in one place.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const upstream = await fetch(`${FASTAPI_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Next.js 14 — opt out of caching for dynamic prediction requests
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { error: `Backend error: ${detail}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to reach prediction service: ${message}` },
      { status: 503 }
    );
  }
}
