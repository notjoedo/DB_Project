import type { ResultSetHeader } from "mysql2";
import { clientKey, loadUser, sessionResponse, tooManyAttempts } from "@/lib/auth";
import { errorCode } from "@/lib/map-data";
import { hashPassword, passwordProblem } from "@/lib/password.mjs";
import { database } from "@/lib/server";

const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  if (tooManyAttempts(`register:${clientKey(request)}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many accounts created from here. Try again later." }, { status: 429 });
  }
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const first = str(data.FName, 50), last = str(data.LName, 50), email = str(data.Email, 100).toLowerCase();
  const password = typeof data.Password === "string" ? data.Password : "";
  if (!first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter your first name, last name, and a valid email." }, { status: 400 });
  }
  const problem = passwordProblem(password);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO Users (FName, LName, Email, PasswordHash) VALUES (?, ?, ?, ?)", [first, last, email, await hashPassword(password)]);
    // Every account starts with only the base 'User' role; others are granted with `npm run role`.
    await connection.execute("INSERT INTO UserRole (UserID, RoleID) SELECT ?, RoleID FROM Role WHERE RoleName='User'", [result.insertId]);
    await connection.commit();
    const user = await loadUser(result.insertId);
    return await sessionResponse(user!, undefined, 201);
  } catch (error) {
    await connection.rollback();
    if (errorCode(error) === "ER_DUP_ENTRY") return Response.json({ error: "An account with that email already exists." }, { status: 409 });
    console.error("Register:", error);
    return Response.json({ error: "Could not create the account." }, { status: 503 });
  } finally {
    connection.release();
  }
}
