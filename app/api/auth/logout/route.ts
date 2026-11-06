import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, clearSession, revokeRefreshToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(REFRESH_COOKIE)?.value;
  try {
    if (token) await revokeRefreshToken(token);
  } catch (error) {
    console.error("Logout:", error);
  }
  return clearSession(NextResponse.json({ ok: true }));
}
