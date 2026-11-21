import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireUser } from "@/lib/auth";
import { errorCode, mapSnapshot, schedulableOrgs } from "@/lib/map-data";
import { database } from "@/lib/server";

interface CheckRow extends RowDataPacket { Upcoming: number; NearestSite: number | null }

// Events within this distance of a planting area are linked to it.
const SITE_RADIUS_METERS = 300;

const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

/** Schedule a volunteer event at a map location, for an organization the user may schedule for. */
export async function POST(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = user.UserID, orgId = Number(data.OrgID), lat = Number(data.Latitude), lng = Number(data.Longitude);
  const title = str(data.Title, 150), location = str(data.Location, 150), eventDate = str(data.EventDate, 10);
  const notes = str(data.Notes, 500) || null;
  if (!Number.isInteger(orgId) || !title || !location || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    || !(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180)) {
    return Response.json({ error: "Pick a spot on the map, then choose the organization, a title, date, and location." }, { status: 400 });
  }

  try {
    if (!(await schedulableOrgs(user)).some((org) => org.OrgID === orgId)) {
      return Response.json({ error: "You can't schedule events for this organization. Only Admins and Organizers who belong to it can." }, { status: 403 });
    }
    const db = database();
    const [[check]] = await db.query<CheckRow[]>(`SELECT
        ? >= CURDATE() AS Upcoming,
        (SELECT SiteID FROM PlantingSite
          WHERE ST_Distance_Sphere(POINT(Longitude, Latitude), POINT(?, ?)) <= ?
          ORDER BY ST_Distance_Sphere(POINT(Longitude, Latitude), POINT(?, ?)) LIMIT 1) AS NearestSite`,
      [eventDate, lng, lat, SITE_RADIUS_METERS, lng, lat]);
    if (!check.Upcoming) return Response.json({ error: "Choose today or a future date." }, { status: 400 });

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO VolunteerOpportunity (OrgID,Title,EventDate,Location,Notes,Latitude,Longitude,SiteID,CreatedBy)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [orgId, title, eventDate, location, notes, lat.toFixed(6), lng.toFixed(6), check.NearestSite, userId],
    );
    return Response.json({ ok: true, id: result.insertId, snapshot: await mapSnapshot() });
  } catch (error) {
    console.error("MySQL insert:", error);
    if (errorCode(error) === "ER_NO_REFERENCED_ROW_2") return Response.json({ error: "The selected organization no longer exists." }, { status: 409 });
    return Response.json({ error: "The event could not be scheduled." }, { status: 503 });
  }
}
