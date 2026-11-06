import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { database } from "./server";

export const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_DAYS = 7;
export const REFRESH_COOKIE = "tf_refresh";
const ISSUER = "treefinder";

let warned = false;
function secret() {
  let value = process.env.AUTH_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set in production.");
    if (!warned) console.warn("AUTH_SECRET is not set; using an insecure development secret. Add one to .env.local.");
    warned = true;
    value = "dev-only-insecure-secret-change-me";
  }
  return new TextEncoder().encode(value);
}

export type SessionUser = { UserID: number; FName: string; LName: string; Email: string; roles: string[] };
interface UserRow extends RowDataPacket { UserID: number; FName: string; LName: string; Email: string; Roles: string | null }
interface TokenRow extends RowDataPacket { TokenID: number; UserID: number; Expired: number; Revoked: number; Replayed: number }

export async function loadUser(userId: number): Promise<SessionUser | null> {
  const [[row]] = await database().query<UserRow[]>(`SELECT u.UserID, u.FName, u.LName, u.Email,
      GROUP_CONCAT(r.RoleName ORDER BY r.RoleID) AS Roles
    FROM Users u LEFT JOIN UserRole ur ON ur.UserID=u.UserID LEFT JOIN Role r ON r.RoleID=ur.RoleID
    WHERE u.UserID=? GROUP BY u.UserID, u.FName, u.LName, u.Email`, [userId]);
  return row ? { UserID: row.UserID, FName: row.FName, LName: row.LName, Email: row.Email, roles: row.Roles ? row.Roles.split(",") : [] } : null;
}

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

async function signAccessToken(user: SessionUser) {
  return new SignJWT({ roles: user.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.UserID))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
    .sign(secret());
}

/** Creates a refresh-token row and returns the raw token (only its hash is stored). */
async function issueRefreshToken(userId: number, connection?: PoolConnection) {
  const token = randomBytes(32).toString("base64url");
  await (connection ?? database()).execute(
    "INSERT INTO RefreshToken (UserID, TokenHash, ExpiresAt) VALUES (?, ?, NOW() + INTERVAL ? DAY)",
    [userId, sha256(token), REFRESH_TOKEN_DAYS],
  );
  return token;
}

function withRefreshCookie(response: NextResponse, token: string | null) {
  response.cookies.set(REFRESH_COOKIE, token ?? "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: token ? REFRESH_TOKEN_DAYS * 24 * 3600 : 0,
  });
  return response;
}

/** Response for a successful login/register/refresh: access token in the body, refresh token in an httpOnly cookie. */
export async function sessionResponse(user: SessionUser, connection?: PoolConnection, status = 200) {
  const refreshToken = await issueRefreshToken(user.UserID, connection);
  const response = NextResponse.json({ accessToken: await signAccessToken(user), expiresIn: ACCESS_TOKEN_SECONDS, user }, { status });
  return withRefreshCookie(response, refreshToken);
}

export const clearSession = (response: NextResponse) => withRefreshCookie(response, null);

/**
 * Exchanges a refresh token for a new session, revoking the old token (rotation).
 * Presenting a token revoked more than a few seconds ago means it was stolen or
 * replayed, so every session for that user is revoked. (A token revoked moments ago
 * is just two browser tabs refreshing at once, so that is simply refused.)
 */
export async function rotateRefreshToken(token: string) {
  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.query<TokenRow[]>(
      `SELECT TokenID, UserID, ExpiresAt <= NOW() AS Expired, RevokedAt IS NOT NULL AS Revoked,
         RevokedAt < NOW() - INTERVAL 30 SECOND AS Replayed
       FROM RefreshToken WHERE TokenHash=? FOR UPDATE`, [sha256(token)]);
    if (!row) { await connection.rollback(); return null; }
    if (row.Revoked) {
      if (row.Replayed) await connection.execute("UPDATE RefreshToken SET RevokedAt=NOW() WHERE UserID=? AND RevokedAt IS NULL", [row.UserID]);
      await connection.commit();
      return null;
    }
    if (row.Expired) { await connection.rollback(); return null; }
    await connection.execute("UPDATE RefreshToken SET RevokedAt=NOW() WHERE TokenID=?", [row.TokenID]);
    const user = await loadUser(row.UserID);
    if (!user) { await connection.rollback(); return null; }
    const response = await sessionResponse(user, connection);
    await connection.commit();
    return response;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function revokeRefreshToken(token: string) {
  await database().execute<ResultSetHeader>("UPDATE RefreshToken SET RevokedAt=NOW() WHERE TokenHash=? AND RevokedAt IS NULL", [sha256(token)]);
}

export async function revokeAllSessions(userId: number, except?: string) {
  await database().execute("UPDATE RefreshToken SET RevokedAt=NOW() WHERE UserID=? AND RevokedAt IS NULL AND TokenHash<>?", [userId, except ? sha256(except) : ""]);
}

/** The signed-in user from the `Authorization: Bearer` header, with roles read fresh from the database. */
export async function currentUser(request: Request | NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    return Number.isInteger(userId) ? await loadUser(userId) : null;
  } catch {
    return null;
  }
}

type Guard = { user: SessionUser; denied?: never } | { user?: never; denied: Response };

/** Requires a signed-in user, and optionally one of the given roles. */
export async function requireUser(request: Request, ...roles: string[]): Promise<Guard> {
  const user = await currentUser(request);
  if (!user) return { denied: Response.json({ error: "Please log in to continue." }, { status: 401 }) };
  if (roles.length && !roles.some((role) => user.roles.includes(role))) {
    return { denied: Response.json({ error: `This requires the ${roles.join(" or ")} role.` }, { status: 403 }) };
  }
  return { user };
}

// Small in-memory limiter for login/register attempts (per server process).
const attempts = new Map<string, { count: number; resetAt: number }>();
export function tooManyAttempts(key: string, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}
export const clientKey = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
