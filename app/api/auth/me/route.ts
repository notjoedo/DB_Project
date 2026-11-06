import type { RowDataPacket } from "mysql2";
import type { NextRequest } from "next/server";
import { REFRESH_COOKIE, loadUser, requireUser, revokeAllSessions } from "@/lib/auth";
import { errorCode, schedulableOrgs } from "@/lib/map-data";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password.mjs";
import { database } from "@/lib/server";

interface MembershipRow extends RowDataPacket { OrgID: number; Organization: string; OrgRole: string; JoinDate: string }
interface RegistrationRow extends RowDataPacket {
  RegistrationID: number; OpportunityID: number; Title: string; EventDate: string; Organization: string; Status: string; HoursLogged: number; Upcoming: number;
}
interface ScheduledRow extends RowDataPacket { OpportunityID: number; Title: string; EventDate: string; Organization: string; SignUps: number }
interface HashRow extends RowDataPacket { PasswordHash: string | null }

const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function profile(userId: number) {
  const db = database();
  const user = await loadUser(userId);
  const [[memberships], [registrations], [scheduled], canSchedule] = await Promise.all([
    db.query<MembershipRow[]>(`SELECT m.OrgID, o.Name AS Organization, m.OrgRole, DATE_FORMAT(m.JoinDate, '%Y-%m-%d') AS JoinDate
      FROM OrganizationMember m JOIN Organization o ON o.OrgID=m.OrgID WHERE m.UserID=? ORDER BY o.Name`, [userId]),
    db.query<RegistrationRow[]>(`SELECT r.RegistrationID, r.OpportunityID, v.Title, DATE_FORMAT(v.EventDate, '%Y-%m-%d') AS EventDate,
      o.Name AS Organization, r.Status, r.HoursLogged, v.EventDate >= CURDATE() AS Upcoming
      FROM Registration r JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID JOIN Organization o ON o.OrgID=v.OrgID
      WHERE r.UserID=? ORDER BY v.EventDate DESC`, [userId]),
    db.query<ScheduledRow[]>(`SELECT v.OpportunityID, v.Title, DATE_FORMAT(v.EventDate, '%Y-%m-%d') AS EventDate, o.Name AS Organization,
      COUNT(CASE WHEN r.Status <> 'Cancelled' THEN 1 END) AS SignUps
      FROM VolunteerOpportunity v JOIN Organization o ON o.OrgID=v.OrgID LEFT JOIN Registration r ON r.OpportunityID=v.OpportunityID
      WHERE v.CreatedBy=? GROUP BY v.OpportunityID, v.Title, v.EventDate, o.Name ORDER BY v.EventDate DESC`, [userId]),
    user ? schedulableOrgs(user) : [],
  ]);
  return {
    user,
    memberships: [...memberships],
    registrations: registrations.map((row) => ({ ...row, Upcoming: Boolean(row.Upcoming) })),
    scheduled: scheduled.map((row) => ({ ...row, SignUps: Number(row.SignUps) })),
    canSchedule,
  };
}

export async function GET(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  try {
    return Response.json(await profile(user.UserID));
  } catch (error) {
    console.error("Profile:", error);
    return Response.json({ error: "Could not load your profile." }, { status: 503 });
  }
}

/** Update name/email, or change password. Changing email or password requires the current password. */
export async function PATCH(request: NextRequest) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const first = str(data.FName, 50) || user.FName, last = str(data.LName, 50) || user.LName;
  const email = (str(data.Email, 100) || user.Email).toLowerCase();
  const current = typeof data.CurrentPassword === "string" ? data.CurrentPassword : "";
  const next = typeof data.NewPassword === "string" ? data.NewPassword : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email." }, { status: 400 });

  try {
    const db = database();
    if (email !== user.Email || next) {
      const [[row]] = await db.query<HashRow[]>("SELECT PasswordHash FROM Users WHERE UserID=?", [user.UserID]);
      if (!(await verifyPassword(current, row?.PasswordHash))) return Response.json({ error: "Your current password is incorrect." }, { status: 403 });
    }
    if (next) {
      const problem = passwordProblem(next);
      if (problem) return Response.json({ error: problem }, { status: 400 });
      await db.execute("UPDATE Users SET PasswordHash=? WHERE UserID=?", [await hashPassword(next), user.UserID]);
      // Sign out every other device; this one keeps its session.
      await revokeAllSessions(user.UserID, request.cookies.get(REFRESH_COOKIE)?.value);
    }
    await db.execute("UPDATE Users SET FName=?, LName=?, Email=? WHERE UserID=?", [first, last, email, user.UserID]);
    return Response.json({ ok: true, ...(await profile(user.UserID)) });
  } catch (error) {
    if (errorCode(error) === "ER_DUP_ENTRY") return Response.json({ error: "Another account already uses that email." }, { status: 409 });
    console.error("Profile update:", error);
    return Response.json({ error: "Could not update your profile." }, { status: 503 });
  }
}
