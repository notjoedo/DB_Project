import type { RowDataPacket } from "mysql2";
import { requireUser } from "@/lib/auth";
import { canManageEvent, manageSnapshot } from "@/lib/manage";
import { database } from "@/lib/server";

/**
 * Take attendance: set one volunteer's sign-up status and hours for an event.
 * Hours are only kept for Completed sign-ups, and only once the event date has arrived.
 */

interface RegRow extends RowDataPacket { OpportunityID: number; Happened: number }

const STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];

export async function PATCH(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(data.RegistrationID), status = typeof data.Status === "string" ? data.Status : "";
  let hours = Number(data.HoursLogged);
  if (!Number.isInteger(id) || !STATUSES.includes(status)) return Response.json({ error: "Choose a volunteer and a status." }, { status: 400 });
  if (status !== "Completed") hours = 0;
  else if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return Response.json({ error: "Completed volunteers need between 0.25 and 24 hours." }, { status: 400 });

  try {
    const db = database();
    const [[reg]] = await db.query<RegRow[]>(`SELECT r.OpportunityID, v.EventDate <= CURDATE() AS Happened
      FROM Registration r JOIN VolunteerOpportunity v ON v.OpportunityID = r.OpportunityID WHERE r.RegistrationID = ?`, [id]);
    if (!reg) return Response.json({ error: "That sign-up no longer exists." }, { status: 404 });
    if (!(await canManageEvent(user, reg.OpportunityID))) return Response.json({ error: "You can only take attendance for your organizations' events." }, { status: 403 });
    if (status === "Completed" && !reg.Happened) return Response.json({ error: "You can mark volunteers completed once the event date arrives." }, { status: 409 });
    await db.execute("UPDATE Registration SET Status = ?, HoursLogged = ? WHERE RegistrationID = ?", [status, hours, id]);
    return Response.json({ ok: true, ...(await manageSnapshot(user)) });
  } catch (error) {
    console.error("Attendance:", error);
    return Response.json({ error: "Attendance could not be saved." }, { status: 503 });
  }
}
