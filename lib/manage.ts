import type { RowDataPacket } from "mysql2";
import type { SessionUser } from "./auth";
import { schedulableOrgs } from "./map-data";
import { database } from "./server";

interface EventRow extends RowDataPacket {
  OpportunityID: number; Title: string; OrgID: number; Organization: string; EventDate: string; Location: string;
  Notes: string | null; Upcoming: number; SiteName: string | null; OnMap: number;
}
interface VolunteerRow extends RowDataPacket {
  RegistrationID: number; OpportunityID: number; Name: string; Email: string; Status: string; HoursLogged: string; RegistrationDate: string;
}
interface OkRow extends RowDataPacket { Ok: number }
interface OrgIdRow extends RowDataPacket { OrgID: number }

/**
 * Which events a user manages (SQL condition on VolunteerOpportunity v):
 *   Admin     → every event
 *   Organizer → events they scheduled, plus events of organizations they belong to
 *   anyone else (User, Arborist) → none
 */
function managedEvents(user: SessionUser) {
  return {
    sql: `(? OR (? AND (v.CreatedBy = ? OR v.OrgID IN (SELECT m.OrgID FROM OrganizationMember m WHERE m.UserID = ?))))`,
    params: [user.roles.includes("Admin"), user.roles.includes("Organizer"), user.UserID, user.UserID],
  };
}

/** Organizations whose events this user manages (used by the organizer reports). */
export async function managedOrgIds(user: SessionUser) {
  const scope = managedEvents(user);
  const [rows] = await database().query<OrgIdRow[]>(`SELECT DISTINCT v.OrgID FROM VolunteerOpportunity v WHERE ${scope.sql}
    UNION SELECT m.OrgID FROM OrganizationMember m WHERE m.UserID = ? AND ?`,
    [...scope.params, user.UserID, user.roles.includes("Organizer")]);
  return rows.map((row) => row.OrgID);
}

/** Data for the Manage Events page. `orgs` are the organizations this user may schedule new events for. */
export async function manageSnapshot(user: SessionUser) {
  const orgs = await schedulableOrgs(user);
  if (!orgs.length) return { orgs, events: [] };
  const scope = managedEvents(user);
  const db = database();
  const [[events], [volunteers]] = await Promise.all([
    db.query<EventRow[]>(`SELECT v.OpportunityID, v.Title, v.OrgID, o.Name AS Organization, DATE_FORMAT(v.EventDate, '%Y-%m-%d') AS EventDate,
        v.Location, v.Notes, v.EventDate >= CURDATE() AS Upcoming, p.Name AS SiteName, v.Latitude IS NOT NULL AS OnMap
      FROM VolunteerOpportunity v JOIN Organization o ON o.OrgID = v.OrgID LEFT JOIN PlantingSite p ON p.SiteID = v.SiteID
      WHERE ${scope.sql} ORDER BY v.EventDate DESC, v.Title`, scope.params),
    db.query<VolunteerRow[]>(`SELECT r.RegistrationID, r.OpportunityID, CONCAT(u.FName, ' ', u.LName) AS Name, u.Email, r.Status, r.HoursLogged,
        DATE_FORMAT(r.RegistrationDate, '%Y-%m-%d') AS RegistrationDate
      FROM Registration r JOIN Users u ON u.UserID = r.UserID JOIN VolunteerOpportunity v ON v.OpportunityID = r.OpportunityID
      WHERE ${scope.sql} ORDER BY u.LName, u.FName`, scope.params),
  ]);
  return {
    orgs,
    events: events.map((event) => ({
      ...event,
      Upcoming: Boolean(event.Upcoming),
      OnMap: Boolean(event.OnMap),
      volunteers: volunteers.filter((v) => v.OpportunityID === event.OpportunityID)
        .map(({ RegistrationID, Name, Email, Status, HoursLogged, RegistrationDate }) => ({ RegistrationID, Name, Email, Status, HoursLogged: Number(HoursLogged), RegistrationDate })),
    })),
  };
}

/** True if this user manages the given event. */
export async function canManageEvent(user: SessionUser, opportunityId: number) {
  const scope = managedEvents(user);
  const [[row]] = await database().query<OkRow[]>(
    `SELECT 1 AS Ok FROM VolunteerOpportunity v WHERE v.OpportunityID = ? AND ${scope.sql}`, [opportunityId, ...scope.params]);
  return Boolean(row);
}
