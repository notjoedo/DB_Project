import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireUser } from "@/lib/auth";
import { errorCode } from "@/lib/map-data";
import { hashPassword, passwordProblem } from "@/lib/password.mjs";
import { database } from "@/lib/server";

/**
 * Users and Roles, for administrators:
 *   GET    everyone with their roles
 *   POST   create an account (optionally an admin) with a temporary password
 *   PATCH  grant or remove one role
 *   DELETE remove an account
 */

interface PersonRow extends RowDataPacket {
  UserID: number; FName: string; LName: string; Email: string; Roles: string | null; CanLogIn: number; Organizations: string | null;
}
interface RoleRow extends RowDataPacket { RoleName: string }
interface CountRow extends RowDataPacket { Admins: number }

const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function people() {
  const db = database();
  const [[rows], [roles]] = await Promise.all([
    db.query<PersonRow[]>(`SELECT u.UserID, u.FName, u.LName, u.Email, u.PasswordHash IS NOT NULL AS CanLogIn,
        (SELECT GROUP_CONCAT(r.RoleName ORDER BY r.RoleID) FROM UserRole ur JOIN Role r ON r.RoleID = ur.RoleID
          WHERE ur.UserID = u.UserID) AS Roles,
        (SELECT GROUP_CONCAT(o.Name ORDER BY o.Name SEPARATOR ', ') FROM OrganizationMember m JOIN Organization o ON o.OrgID = m.OrgID
          WHERE m.UserID = u.UserID) AS Organizations
      FROM Users u ORDER BY u.LName, u.FName`),
    db.query<RoleRow[]>("SELECT RoleName FROM Role ORDER BY RoleID"),
  ]);
  return {
    people: rows.map((row) => ({ ...row, CanLogIn: Boolean(row.CanLogIn), Roles: row.Roles ? row.Roles.split(",") : [] })),
    roles: roles.map((row) => row.RoleName),
  };
}

async function adminCount() {
  const [[row]] = await database().query<CountRow[]>(
    "SELECT COUNT(*) AS Admins FROM UserRole ur JOIN Role r ON r.RoleID = ur.RoleID WHERE r.RoleName = 'Admin'");
  return Number(row.Admins);
}

export async function GET(request: Request) {
  const { denied } = await requireUser(request, "Admin");
  if (denied) return denied;
  try {
    return Response.json(await people());
  } catch (error) {
    console.error("People:", error);
    return Response.json({ error: "Could not load people." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const { denied } = await requireUser(request, "Admin");
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const first = str(data.FName, 50), last = str(data.LName, 50), email = str(data.Email, 100).toLowerCase();
  const password = typeof data.Password === "string" ? data.Password : "";
  const extraRoles = Array.isArray(data.Roles) ? data.Roles.filter((role): role is string => typeof role === "string" && role !== "User") : [];
  if (!first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a first name, last name, and valid email." }, { status: 400 });
  }
  const problem = passwordProblem(password);
  if (problem) return Response.json({ error: `Temporary password: ${problem}` }, { status: 400 });

  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO Users (FName, LName, Email, PasswordHash) VALUES (?, ?, ?, ?)", [first, last, email, await hashPassword(password)]);
    await connection.query("INSERT INTO UserRole (UserID, RoleID) SELECT ?, RoleID FROM Role WHERE RoleName IN (?)",
      [result.insertId, ["User", ...extraRoles]]);
    await connection.commit();
    return Response.json({ ok: true, ...(await people()) }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    if (errorCode(error) === "ER_DUP_ENTRY") return Response.json({ error: "An account with that email already exists." }, { status: 409 });
    console.error("Create account:", error);
    return Response.json({ error: "Could not create the account." }, { status: 503 });
  } finally {
    connection.release();
  }
}

export async function PATCH(request: Request) {
  const { user, denied } = await requireUser(request, "Admin");
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = Number(data.UserID), role = str(data.Role, 20), grant = data.Grant === true;
  if (!Number.isInteger(userId) || !role) return Response.json({ error: "Choose a person and a role." }, { status: 400 });
  if (role === "User" && !grant) return Response.json({ error: "Every account keeps the base User role." }, { status: 400 });

  try {
    const db = database();
    if (grant) {
      const [result] = await db.execute<ResultSetHeader>(
        "INSERT IGNORE INTO UserRole (UserID, RoleID) SELECT u.UserID, r.RoleID FROM Users u JOIN Role r ON r.RoleName = ? WHERE u.UserID = ?",
        [role, userId]);
      if (!result.affectedRows) return Response.json({ error: "That person already has this role, or no longer exists." }, { status: 409 });
    } else {
      if (role === "Admin") {
        if (userId === user.UserID) return Response.json({ error: "You can't remove your own Admin role. Ask another admin." }, { status: 403 });
        if (await adminCount() <= 1) return Response.json({ error: "There must always be at least one admin." }, { status: 409 });
      }
      await db.execute("DELETE ur FROM UserRole ur JOIN Role r ON r.RoleID = ur.RoleID WHERE ur.UserID = ? AND r.RoleName = ?", [userId, role]);
    }
    return Response.json({ ok: true, ...(await people()) });
  } catch (error) {
    console.error("Change role:", error);
    return Response.json({ error: "Could not change the role." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const { user, denied } = await requireUser(request, "Admin");
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = Number(data.UserID);
  if (!Number.isInteger(userId)) return Response.json({ error: "Choose a person." }, { status: 400 });
  if (userId === user.UserID) return Response.json({ error: "You can't delete your own account here." }, { status: 403 });
  try {
    const [result] = await database().execute<ResultSetHeader>("DELETE FROM Users WHERE UserID = ?", [userId]);
    if (!result.affectedRows) return Response.json({ error: "That person no longer exists." }, { status: 404 });
    return Response.json({ ok: true, ...(await people()) });
  } catch (error) {
    console.error("Delete account:", error);
    return Response.json({ error: "Could not delete the account." }, { status: 503 });
  }
}
