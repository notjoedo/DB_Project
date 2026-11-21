import type { ResultSetHeader } from "mysql2";
import { requireUser } from "@/lib/auth";
import { canManageEvent, manageSnapshot } from "@/lib/manage";
import { database } from "@/lib/server";

/**
 * Manage Events, for anyone who can schedule events for at least one organization
 * (Admins, and Organizers for the organizations they belong to):
 *   GET    events of those organizations, each with its volunteers
 *   PATCH  edit an event's title, date, location, or notes
 *   DELETE delete an event (its sign-ups are removed with it)
 */

const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  try {
    return Response.json(await manageSnapshot(user));
  } catch (error) {
    console.error("Manage events:", error);
    return Response.json({ error: "Could not load your events." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(data.OpportunityID);
  const title = str(data.Title, 150), location = str(data.Location, 150), eventDate = str(data.EventDate, 10), notes = str(data.Notes, 500) || null;
  if (!Number.isInteger(id) || !title || !location || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(eventDate))) {
    return Response.json({ error: "Enter a title, date, and location." }, { status: 400 });
  }
  try {
    if (!(await canManageEvent(user, id))) return Response.json({ error: "You can only edit events for organizations you schedule for." }, { status: 403 });
    await database().execute("UPDATE VolunteerOpportunity SET Title = ?, EventDate = ?, Location = ?, Notes = ? WHERE OpportunityID = ?",
      [title, eventDate, location, notes, id]);
    return Response.json({ ok: true, ...(await manageSnapshot(user)) });
  } catch (error) {
    console.error("Edit event:", error);
    return Response.json({ error: "The event could not be saved." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(data.OpportunityID);
  if (!Number.isInteger(id)) return Response.json({ error: "Choose an event." }, { status: 400 });
  try {
    if (!(await canManageEvent(user, id))) return Response.json({ error: "You can only delete events for organizations you schedule for." }, { status: 403 });
    const [result] = await database().execute<ResultSetHeader>("DELETE FROM VolunteerOpportunity WHERE OpportunityID = ?", [id]);
    if (!result.affectedRows) return Response.json({ error: "That event no longer exists." }, { status: 404 });
    return Response.json({ ok: true, ...(await manageSnapshot(user)) });
  } catch (error) {
    console.error("Delete event:", error);
    return Response.json({ error: "The event could not be deleted." }, { status: 503 });
  }
}
