import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireUser, type SessionUser } from "@/lib/auth";
import { schedulableOrgs } from "@/lib/map-data";
import { database } from "@/lib/server";

interface RequestRow extends RowDataPacket {
  RegistrationID: number; Volunteer: string; Email: string; RegistrationDate: string; Status: string;
  OpportunityID: number; Title: string; EventDate: string; Location: string; Organization: string;
}

/**
 * Organizations whose volunteer requests this user reviews: the same ones they may schedule
 * events for (Admins → all; Organizers → orgs they belong to; Coordinators/Officers/Directors).
 */
const managedOrgIds = async (user: SessionUser) => (await schedulableOrgs(user)).map((org) => org.OrgID);

/** Pending and confirmed sign-ups for upcoming events of the organizations the user manages. */
async function requests(orgIds: number[]) {
  if (!orgIds.length) return [];
  const [rows] = await database().query<RequestRow[]>(`SELECT r.RegistrationID, CONCAT(u.FName, ' ', u.LName) AS Volunteer, u.Email,
      DATE_FORMAT(r.RegistrationDate, '%Y-%m-%d') AS RegistrationDate, r.Status,
      v.OpportunityID, v.Title, DATE_FORMAT(v.EventDate, '%Y-%m-%d') AS EventDate, v.Location, o.Name AS Organization
    FROM Registration r JOIN Users u ON u.UserID=r.UserID
    JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID JOIN Organization o ON o.OrgID=v.OrgID
    WHERE v.OrgID IN (?) AND v.EventDate >= CURDATE() AND r.Status IN ('Pending', 'Confirmed')
    ORDER BY v.EventDate, v.OpportunityID, r.RegistrationDate, r.RegistrationID`, [orgIds]);
  return [...rows];
}

export async function GET(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  try {
    const orgIds = await managedOrgIds(user);
    return Response.json({ canManage: orgIds.length > 0, requests: await requests(orgIds) });
  } catch (error) {
    console.error("Requests:", error);
    return Response.json({ error: "Could not load volunteer requests." }, { status: 503 });
  }
}

/** Accept (→ Confirmed) or decline (→ Cancelled) a pending request. Body: { RegistrationID, action: "accept" | "decline" }. */
export async function PATCH(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const registrationId = Number(data.RegistrationID), action = data.action;
  if (!Number.isInteger(registrationId) || (action !== "accept" && action !== "decline")) {
    return Response.json({ error: "Choose a request and whether to accept or decline it." }, { status: 400 });
  }

  try {
    const orgIds = await managedOrgIds(user);
    if (!orgIds.length) return Response.json({ error: "You don't manage volunteer requests for any organization." }, { status: 403 });
    // The join conditions ensure the request is still pending, upcoming, and for an organization this user manages.
    const [result] = await database().query<ResultSetHeader>(
      `UPDATE Registration r JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID
       SET r.Status=? WHERE r.RegistrationID=? AND r.Status='Pending' AND v.EventDate >= CURDATE() AND v.OrgID IN (?)`,
      [action === "accept" ? "Confirmed" : "Cancelled", registrationId, orgIds],
    );
    if (!result.affectedRows) return Response.json({ error: "This request was already handled, the event has passed, or it isn't for your organization." }, { status: 409 });
    return Response.json({ ok: true, requests: await requests(orgIds) });
  } catch (error) {
    console.error("Request update:", error);
    return Response.json({ error: "The request could not be updated." }, { status: 503 });
  }
}
