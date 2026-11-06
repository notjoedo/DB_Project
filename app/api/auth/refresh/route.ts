import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, clearSession, rotateRefreshToken } from "@/lib/auth";

/** Trades the refresh-token cookie for a new access token and a new refresh token. */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  try {
    return (await rotateRefreshToken(token)) ?? clearSession(NextResponse.json({ error: "Your session has expired. Please log in again." }, { status: 401 }));
  } catch (error) {
    console.error("Refresh:", error);
    return NextResponse.json({ error: "Could not refresh the session." }, { status: 503 });
  }
}
