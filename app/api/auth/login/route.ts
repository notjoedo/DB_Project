import type { RowDataPacket } from "mysql2";
import { clientKey, loadUser, sessionResponse, tooManyAttempts } from "@/lib/auth";
import { verifyPassword } from "@/lib/password.mjs";
import { database } from "@/lib/server";

interface LoginRow extends RowDataPacket { UserID: number; PasswordHash: string | null }

export async function POST(request: Request) {
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof data.Email === "string" ? data.Email.trim().toLowerCase() : "";
  const password = typeof data.Password === "string" ? data.Password : "";
  if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });
  if (tooManyAttempts(`login:${clientKey(request)}:${email}`)) {
    return Response.json({ error: "Too many login attempts. Try again in 15 minutes." }, { status: 429 });
  }

  try {
    const [[row]] = await database().query<LoginRow[]>("SELECT UserID, PasswordHash FROM Users WHERE Email=?", [email]);
    // Same message for an unknown email and a wrong password, so accounts can't be probed.
    if (!(await verifyPassword(password, row?.PasswordHash))) {
      return Response.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    return await sessionResponse((await loadUser(row.UserID))!);
  } catch (error) {
    console.error("Login:", error);
    return Response.json({ error: "Could not log in right now." }, { status: 503 });
  }
}
