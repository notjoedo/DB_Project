import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { database } from "@/lib/server";

const STATUSES = ["Proposed", "Approved", "Planted"];

interface SiteRow extends RowDataPacket {
  SiteID: number; Name: string; Latitude: number; Longitude: number; CanopyCoverPct: number; ImperviousPct: number;
  SurfaceTempF: number; TreesNeeded: number; Status: string; SubmittedDate: string; SubmittedBy: string | null; NeedScore: number;
}
interface RecommendationRow extends RowDataPacket { SiteID: number; SpeciesID: number; CommonName: string; Quantity: number }
interface EventRow extends RowDataPacket { SiteID: number; OpportunityID: number; Title: string; EventDate: string; Organization: string; SignUps: number }
interface VolunteerRow extends RowDataPacket { OpportunityID: number; RegistrationID: number; Name: string; Status: string }
interface MatchRow extends RowDataPacket { SiteID: number; Field: string; Value: string }
interface SpeciesRow extends RowDataPacket { SpeciesID: number; CommonName: string; ScientificName: string; Category: string }
interface UserRow extends RowDataPacket { UserID: number; Name: string }

const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const num = (value: unknown) => value === "" || value === null ? NaN : Number(value);
const between = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;

async function snapshot() {
  const db = database();
  const [[sites], [recommendations], [events], [volunteers], [species], [users]] = await Promise.all([
    db.query<SiteRow[]>(`SELECT p.SiteID, p.Name, p.Latitude, p.Longitude, p.CanopyCoverPct, p.ImperviousPct,
      p.SurfaceTempF, p.TreesNeeded, p.Status, DATE_FORMAT(p.SubmittedDate, '%Y-%m-%d') AS SubmittedDate,
      CONCAT(u.FName, ' ', u.LName) AS SubmittedBy, p.NeedScore
      FROM SitePriority p LEFT JOIN Users u ON u.UserID=p.SubmittedBy
      ORDER BY p.NeedScore DESC, p.SiteID`),
    db.query<RecommendationRow[]>(`SELECT sr.SiteID, sr.SpeciesID, t.CommonName, sr.Quantity
      FROM SiteRecommendation sr JOIN TreeSpecies t ON t.SpeciesID=sr.SpeciesID
      ORDER BY sr.SiteID, sr.Quantity DESC`),
    db.query<EventRow[]>(`SELECT v.SiteID, v.OpportunityID, v.Title, DATE_FORMAT(v.EventDate, '%Y-%m-%d') AS EventDate,
      o.Name AS Organization, COUNT(r.RegistrationID) AS SignUps
      FROM VolunteerOpportunity v JOIN Organization o ON o.OrgID=v.OrgID
      LEFT JOIN Registration r ON r.OpportunityID=v.OpportunityID
      WHERE v.SiteID IS NOT NULL
      GROUP BY v.SiteID, v.OpportunityID, v.Title, v.EventDate, o.Name ORDER BY v.EventDate`),
    db.query<VolunteerRow[]>(`SELECT r.OpportunityID, r.RegistrationID, CONCAT(u.FName, ' ', u.LName) AS Name, r.Status
      FROM Registration r JOIN Users u ON u.UserID=r.UserID
      JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID
      WHERE v.SiteID IS NOT NULL ORDER BY u.LName, u.FName`),
    db.query<SpeciesRow[]>("SELECT SpeciesID, CommonName, ScientificName, Category FROM TreeSpecies ORDER BY CommonName"),
    db.query<UserRow[]>("SELECT UserID, CONCAT(FName, ' ', LName) AS Name FROM Users ORDER BY FName, LName"),
  ]);

  return {
    sites: sites.map((site) => ({
      ...site,
      NeedScore: Number(site.NeedScore),
      recommendations: recommendations.filter((rec) => rec.SiteID === site.SiteID).map(({ SpeciesID, CommonName, Quantity }) => ({ SpeciesID, CommonName, Quantity })),
      events: events.filter((event) => event.SiteID === site.SiteID).map((event) => ({
        ...event,
        SignUps: Number(event.SignUps),
        volunteers: volunteers.filter((volunteer) => volunteer.OpportunityID === event.OpportunityID).map(({ RegistrationID, Name, Status }) => ({ RegistrationID, Name, Status })),
      })),
    })),
    species,
    users: users.map((user) => ({ id: user.UserID, label: user.Name })),
  };
}

// Each branch reports which field matched, so the UI can say why a site appeared.
async function search(text: string) {
  const like = `%${text.replace(/[\\%_]/g, "\\$&")}%`;
  const [rows] = await database().query<MatchRow[]>(`
    SELECT SiteID, 'Site' AS Field, Name AS Value FROM PlantingSite WHERE Name LIKE ?
    UNION SELECT p.SiteID, 'Submitted by', CONCAT(u.FName, ' ', u.LName) FROM PlantingSite p
      JOIN Users u ON u.UserID=p.SubmittedBy WHERE CONCAT(u.FName, ' ', u.LName) LIKE ?
    UNION SELECT sr.SiteID, 'Species', t.CommonName FROM SiteRecommendation sr
      JOIN TreeSpecies t ON t.SpeciesID=sr.SpeciesID WHERE t.CommonName LIKE ? OR t.ScientificName LIKE ?
    UNION SELECT v.SiteID, 'Event', CONCAT(v.Title, ' at ', v.Location) FROM VolunteerOpportunity v
      WHERE v.SiteID IS NOT NULL AND (v.Title LIKE ? OR v.Location LIKE ?)
    UNION SELECT v.SiteID, 'Organization', o.Name FROM VolunteerOpportunity v
      JOIN Organization o ON o.OrgID=v.OrgID WHERE v.SiteID IS NOT NULL AND o.Name LIKE ?
    UNION SELECT v.SiteID, 'Volunteer', CONCAT(u.FName, ' ', u.LName) FROM Registration r
      JOIN Users u ON u.UserID=r.UserID JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID
      WHERE v.SiteID IS NOT NULL AND CONCAT(u.FName, ' ', u.LName) LIKE ?
    ORDER BY SiteID`, Array(8).fill(like));
  return rows.map(({ SiteID, Field, Value }) => ({ SiteID, Field, Value }));
}

export async function GET(request: Request) {
  try {
    const text = str(new URL(request.url).searchParams.get("q"), 100);
    if (text) return Response.json({ matches: await search(text) });
    return Response.json(await snapshot());
  } catch (error) {
    console.error("MySQL read:", error);
    return Response.json({ error: "Could not connect to MySQL. Start it with: npm run db:start" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(data.Name, 100);
  const lat = num(data.Latitude), lng = num(data.Longitude);
  const canopy = num(data.CanopyCoverPct), impervious = num(data.ImperviousPct), temp = num(data.SurfaceTempF);
  const trees = num(data.TreesNeeded), userId = num(data.SubmittedBy);
  const species = Array.isArray(data.species) ? [...new Set(data.species.map(Number).filter(Number.isInteger))] : [];
  if (!name || !between(lat, -90, 90) || !between(lng, -180, 180) || !between(canopy, 0, 100) || !between(impervious, 0, 100)
    || !between(temp, 0, 150) || !Number.isInteger(trees) || !between(trees, 1, 5000) || !Number.isInteger(userId)) {
    return Response.json({ error: "Pick a spot on the map, then enter a name, submitter, 0–100% canopy and paved cover, surface temperature, and trees needed." }, { status: 400 });
  }

  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO PlantingSite (Name,Latitude,Longitude,CanopyCoverPct,ImperviousPct,SurfaceTempF,TreesNeeded,Status,SubmittedBy,SubmittedDate)
       VALUES (?,?,?,?,?,?,?,'Proposed',?,CURDATE())`,
      [name, lat.toFixed(6), lng.toFixed(6), canopy, impervious, temp, trees, userId],
    );
    // Split the requested trees evenly across the recommended species.
    for (const [index, speciesId] of species.entries()) {
      const quantity = Math.floor(trees / species.length) + (index < trees % species.length ? 1 : 0);
      if (quantity > 0) await connection.execute("INSERT INTO SiteRecommendation (SiteID,SpeciesID,Quantity) VALUES (?,?,?)", [result.insertId, speciesId, quantity]);
    }
    await connection.commit();
    return Response.json({ ok: true, id: result.insertId, snapshot: await snapshot() });
  } catch (error: unknown) {
    await connection.rollback();
    console.error("MySQL insert:", error);
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "ER_DUP_ENTRY") return Response.json({ error: "A site with that name already exists." }, { status: 409 });
    if (code === "ER_NO_REFERENCED_ROW_2") return Response.json({ error: "The selected user or species no longer exists." }, { status: 409 });
    return Response.json({ error: "The site could not be saved." }, { status: 503 });
  } finally {
    connection.release();
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown; Status?: unknown };
    const id = num(body.id), status = str(body.Status, 20);
    if (!Number.isInteger(id) || !STATUSES.includes(status)) return Response.json({ error: "Choose a site and a valid status." }, { status: 400 });
    const [result] = await database().execute<ResultSetHeader>("UPDATE PlantingSite SET Status=? WHERE SiteID=?", [status, id]);
    if (!result.affectedRows) return Response.json({ error: "Site not found." }, { status: 404 });
    return Response.json({ ok: true, snapshot: await snapshot() });
  } catch (error) {
    console.error("MySQL update:", error);
    return Response.json({ error: "The site could not be updated." }, { status: 503 });
  }
}
