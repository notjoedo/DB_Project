import type { ResultSetHeader } from "mysql2";
import { requireUser } from "@/lib/auth";
import { errorCode, mapSnapshot } from "@/lib/map-data";
import { database } from "@/lib/server";

const opportunityOf = async (request: Request) => Number(((await request.json().catch(() => ({}))) as Record<string, unknown>).OpportunityID);

/** Sign the logged-in user up for an upcoming event (or re-activate a cancelled sign-up). */
export async function POST(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const opportunityId = await opportunityOf(request);
  if (!Number.isInteger(opportunityId)) return Response.json({ error: "Choose an event." }, { status: 400 });

  try {
    const db = database();
    const [rejoined] = await db.execute<ResultSetHeader>(
      `UPDATE Registration r JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID
       SET r.Status='Pending', r.RegistrationDate=CURDATE()
       WHERE r.UserID=? AND r.OpportunityID=? AND r.Status='Cancelled' AND v.EventDate >= CURDATE()`,
      [user.UserID, opportunityId],
    );
    if (!rejoined.affectedRows) {
      const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO Registration (UserID, OpportunityID, RegistrationDate, Status, HoursLogged)
         SELECT ?, OpportunityID, CURDATE(), 'Pending', 0 FROM VolunteerOpportunity
         WHERE OpportunityID=? AND EventDate >= CURDATE()`,
        [user.UserID, opportunityId],
      );
      if (!result.affectedRows) return Response.json({ error: "This event has already happened or no longer exists." }, { status: 409 });
    }
    return Response.json({ ok: true, snapshot: await mapSnapshot() });
  } catch (error) {
    if (errorCode(error) === "ER_DUP_ENTRY") return Response.json({ error: "You're already signed up for this event." }, { status: 409 });
    console.error("MySQL insert:", error);
    return Response.json({ error: "The sign-up could not be saved." }, { status: 503 });
  }
}

/** Cancel the logged-in user's sign-up for an upcoming event. */
export async function DELETE(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const opportunityId = await opportunityOf(request);
  if (!Number.isInteger(opportunityId)) return Response.json({ error: "Choose an event." }, { status: 400 });

  try {
    const [result] = await database().execute<ResultSetHeader>(
      `UPDATE Registration r JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID
       SET r.Status='Cancelled' WHERE r.UserID=? AND r.OpportunityID=? AND r.Status <> 'Cancelled' AND v.EventDate >= CURDATE()`,
      [user.UserID, opportunityId],
    );
    if (!result.affectedRows) return Response.json({ error: "You don't have an active sign-up for an upcoming event here." }, { status: 404 });
    return Response.json({ ok: true, snapshot: await mapSnapshot() });
  } catch (error) {
    console.error("MySQL update:", error);
    return Response.json({ error: "The sign-up could not be cancelled." }, { status: 503 });
  }
}
