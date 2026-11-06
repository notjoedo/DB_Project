import type { RowDataPacket } from "mysql2";
import { database } from "./server";

export const SCHEDULER_ROLES = ["Coordinator", "Officer", "Director"];

interface OrgRow extends RowDataPacket { OrgID: number; Organization: string; Reason: string }

/**
 * Organizations a user may schedule events for:
 *   Admin role      → every organization
 *   Organizer role  → any organization they belong to
 *   otherwise       → organizations where they are a Coordinator, Officer, or Director
 */
export async function schedulableOrgs(user: { UserID: number; roles: string[] }) {
  const admin = user.roles.includes("Admin"), organizer = user.roles.includes("Organizer");
  const [rows] = await database().query<OrgRow[]>(`SELECT o.OrgID, o.Name AS Organization,
      COALESCE(m.OrgRole, 'Admin') AS Reason
    FROM Organization o LEFT JOIN OrganizationMember m ON m.OrgID=o.OrgID AND m.UserID=?
    WHERE ? OR m.OrgRole IN (?) OR (? AND m.UserID IS NOT NULL)
    ORDER BY o.Name`, [user.UserID, admin, SCHEDULER_ROLES, organizer]);
  return rows.map(({ OrgID, Organization, Reason }) => ({ OrgID, Organization, Reason }));
}

interface SiteRow extends RowDataPacket {
  SiteID: number; Name: string; Latitude: number; Longitude: number; CanopyCoverPct: number; ImperviousPct: number;
  SurfaceTempF: number; TreesNeeded: number; Status: string; SubmittedDate: string; SubmittedBy: string | null; NeedScore: number;
}
interface RecommendationRow extends RowDataPacket { SiteID: number; SpeciesID: number; CommonName: string; Quantity: number }
interface EventRow extends RowDataPacket {
  OpportunityID: number; Title: string; EventDate: string; Location: string; Notes: string | null; Latitude: number; Longitude: number; Upcoming: number;
  OrgID: number; Organization: string; SiteID: number | null; SiteName: string | null; CreatedBy: string | null; SignUps: number;
}
interface VolunteerRow extends RowDataPacket { OpportunityID: number; RegistrationID: number; UserID: number; Name: string; Status: string }
interface MatchRow extends RowDataPacket { Kind: "event" | "site"; ID: number; Field: string; Value: string }

/** Everything the planting map shows: priority areas and events placed on the map. Public, so no emails or IDs of users. */
export async function mapSnapshot() {
  const db = database();
  const [[sites], [recommendations], [events], [volunteers]] = await Promise.all([
    db.query<SiteRow[]>(`SELECT p.SiteID, p.Name, p.Latitude, p.Longitude, p.CanopyCoverPct, p.ImperviousPct,
      p.SurfaceTempF, p.TreesNeeded, p.Status, DATE_FORMAT(p.SubmittedDate, '%Y-%m-%d') AS SubmittedDate,
      CONCAT(u.FName, ' ', u.LName) AS SubmittedBy, p.NeedScore
      FROM SitePriority p LEFT JOIN Users u ON u.UserID=p.SubmittedBy
      ORDER BY p.NeedScore DESC, p.SiteID`),
    db.query<RecommendationRow[]>(`SELECT sr.SiteID, sr.SpeciesID, t.CommonName, sr.Quantity
      FROM SiteRecommendation sr JOIN TreeSpecies t ON t.SpeciesID=sr.SpeciesID
      ORDER BY sr.SiteID, sr.Quantity DESC`),
    db.query<EventRow[]>(`SELECT v.OpportunityID, v.Title, DATE_FORMAT(v.EventDate, '%Y-%m-%d') AS EventDate, v.Location, v.Notes,
      v.Latitude, v.Longitude, v.EventDate >= CURDATE() AS Upcoming, v.OrgID, o.Name AS Organization,
      v.SiteID, p.Name AS SiteName, CONCAT(c.FName, ' ', c.LName) AS CreatedBy,
      COUNT(CASE WHEN r.Status <> 'Cancelled' THEN 1 END) AS SignUps
      FROM VolunteerOpportunity v JOIN Organization o ON o.OrgID=v.OrgID
      LEFT JOIN PlantingSite p ON p.SiteID=v.SiteID
      LEFT JOIN Users c ON c.UserID=v.CreatedBy
      LEFT JOIN Registration r ON r.OpportunityID=v.OpportunityID
      WHERE v.Latitude IS NOT NULL
      GROUP BY v.OpportunityID, v.Title, v.EventDate, v.Location, v.Notes, v.Latitude, v.Longitude, v.OrgID, o.Name, v.SiteID, p.Name, c.FName, c.LName
      ORDER BY v.EventDate, v.OpportunityID`),
    db.query<VolunteerRow[]>(`SELECT r.OpportunityID, r.RegistrationID, r.UserID, CONCAT(u.FName, ' ', u.LName) AS Name, r.Status
      FROM Registration r JOIN Users u ON u.UserID=r.UserID
      JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID
      WHERE v.Latitude IS NOT NULL ORDER BY u.LName, u.FName`),
  ]);

  return {
    sites: sites.map((site) => ({
      ...site,
      NeedScore: Number(site.NeedScore),
      recommendations: recommendations.filter((rec) => rec.SiteID === site.SiteID).map(({ SpeciesID, CommonName, Quantity }) => ({ SpeciesID, CommonName, Quantity })),
    })),
    events: events.map((event) => ({
      ...event,
      Upcoming: Boolean(event.Upcoming),
      SignUps: Number(event.SignUps),
      volunteers: volunteers.filter((volunteer) => volunteer.OpportunityID === event.OpportunityID)
        .map(({ RegistrationID, UserID, Name, Status }) => ({ RegistrationID, UserID, Name, Status })),
    })),
  };
}

/** Events and planting areas matching the text; each branch reports which field matched. */
export async function mapSearch(text: string) {
  const like = `%${text.replace(/[\\%_]/g, "\\$&")}%`;
  const [rows] = await database().query<MatchRow[]>(`
    SELECT 'event' AS Kind, OpportunityID AS ID, 'Event' AS Field, CONCAT(Title, ' at ', Location) AS Value
      FROM VolunteerOpportunity WHERE Latitude IS NOT NULL AND (Title LIKE ? OR Location LIKE ?)
    UNION SELECT 'event', v.OpportunityID, 'Organization', o.Name FROM VolunteerOpportunity v
      JOIN Organization o ON o.OrgID=v.OrgID WHERE v.Latitude IS NOT NULL AND o.Name LIKE ?
    UNION SELECT 'event', v.OpportunityID, 'Scheduled by', CONCAT(u.FName, ' ', u.LName) FROM VolunteerOpportunity v
      JOIN Users u ON u.UserID=v.CreatedBy WHERE v.Latitude IS NOT NULL AND CONCAT(u.FName, ' ', u.LName) LIKE ?
    UNION SELECT 'event', v.OpportunityID, 'Volunteer', CONCAT(u.FName, ' ', u.LName) FROM Registration r
      JOIN Users u ON u.UserID=r.UserID JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID
      WHERE v.Latitude IS NOT NULL AND CONCAT(u.FName, ' ', u.LName) LIKE ?
    UNION SELECT 'site', SiteID, 'Area', Name FROM PlantingSite WHERE Name LIKE ?
    UNION SELECT 'site', p.SiteID, 'Submitted by', CONCAT(u.FName, ' ', u.LName) FROM PlantingSite p
      JOIN Users u ON u.UserID=p.SubmittedBy WHERE CONCAT(u.FName, ' ', u.LName) LIKE ?
    UNION SELECT 'site', sr.SiteID, 'Species', t.CommonName FROM SiteRecommendation sr
      JOIN TreeSpecies t ON t.SpeciesID=sr.SpeciesID WHERE t.CommonName LIKE ? OR t.ScientificName LIKE ?
    ORDER BY Kind, ID`, Array(9).fill(like));
  return rows.map(({ Kind, ID, Field, Value }) => ({ Kind, ID, Field, Value }));
}

export const errorCode = (error: unknown) => typeof error === "object" && error && "code" in error ? String(error.code) : "";
