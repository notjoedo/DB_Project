import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { database } from "@/lib/server";

type TableName = "Organization" | "Users" | "VolunteerOpportunity" | "OrganizationMember" | "Registration" | "PlantingSite";
const TABLES: Record<TableName, string> = {
  Organization: "OrgID",
  Users: "UserID",
  VolunteerOpportunity: "OpportunityID",
  OrganizationMember: "MembershipID",
  Registration: "RegistrationID",
  PlantingSite: "SiteID",
};

interface CountRow extends RowDataPacket { RowCount: number }
interface OrganizationRow extends RowDataPacket { OrgID: number; Name: string; Type: string; ContactEmail: string }
interface UserRow extends RowDataPacket { UserID: number; FName: string; LName: string; Email: string; Roles: string }
interface OpportunityRow extends RowDataPacket { OpportunityID: number; OrgID: number; Organization: string; Title: string; EventDate: string; Location: string; SignUps: number }
interface MemberRow extends RowDataPacket { MembershipID: number; OrgID: number; Organization: string; UserID: number; Member: string; JoinDate: string; OrgRole: string }
interface SiteRow extends RowDataPacket { SiteID: number; Name: string; Latitude: number; Longitude: number; CanopyCoverPct: number; NeedScore: number; Status: string; SubmittedBy: string | null }
interface RegistrationRow extends RowDataPacket { RegistrationID: number; UserID: number; Volunteer: string; OpportunityID: number; Opportunity: string; RegistrationDate: string; Status: string; HoursLogged: number }

const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const int = (value: unknown) => Number.isInteger(Number(value)) ? Number(value) : NaN;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

async function snapshot() {
  const db = database();
  const countTables = ["Organization", "Users", "Role", "UserRole", "VolunteerOpportunity", "OrganizationMember", "Registration", "TreeSpecies", "PlantingSite", "SiteRecommendation"] as const;
  const counts = await Promise.all(countTables.map(async (name) => {
    const [rows] = await db.query<CountRow[]>(`SELECT COUNT(*) AS RowCount FROM ${name}`);
    return { TableName: name, RowCount: Number(rows[0].RowCount) };
  }));

  const [organizationsResult, usersResult, opportunitiesResult, membersResult, registrationsResult, sitesResult] = await Promise.all([
    db.query<OrganizationRow[]>("SELECT OrgID, Name, Type, ContactEmail FROM Organization ORDER BY OrgID DESC"),
    db.query<UserRow[]>(`SELECT u.UserID, u.FName, u.LName, u.Email,
      COALESCE(GROUP_CONCAT(r.RoleName ORDER BY r.RoleID SEPARATOR ', '), 'User') AS Roles
      FROM Users u LEFT JOIN UserRole ur ON ur.UserID=u.UserID
      LEFT JOIN Role r ON r.RoleID=ur.RoleID
      GROUP BY u.UserID, u.FName, u.LName, u.Email ORDER BY u.UserID DESC`),
    db.query<OpportunityRow[]>(`SELECT v.OpportunityID, v.OrgID, o.Name AS Organization, v.Title,
      DATE_FORMAT(v.EventDate, '%Y-%m-%d') AS EventDate, v.Location,
      COUNT(r.RegistrationID) AS SignUps FROM VolunteerOpportunity v
      JOIN Organization o ON o.OrgID=v.OrgID
      LEFT JOIN Registration r ON r.OpportunityID=v.OpportunityID
      GROUP BY v.OpportunityID, v.OrgID, o.Name, v.Title, v.EventDate, v.Location
      ORDER BY v.EventDate, v.OpportunityID`),
    db.query<MemberRow[]>(`SELECT m.MembershipID, m.OrgID, o.Name AS Organization, m.UserID,
      CONCAT(u.FName, ' ', u.LName) AS Member, DATE_FORMAT(m.JoinDate, '%Y-%m-%d') AS JoinDate, m.OrgRole
      FROM OrganizationMember m JOIN Organization o ON o.OrgID=m.OrgID
      JOIN Users u ON u.UserID=m.UserID ORDER BY m.MembershipID DESC`),
    db.query<RegistrationRow[]>(`SELECT r.RegistrationID, r.UserID, CONCAT(u.FName, ' ', u.LName) AS Volunteer,
      r.OpportunityID, v.Title AS Opportunity, DATE_FORMAT(r.RegistrationDate, '%Y-%m-%d') AS RegistrationDate,
      r.Status, r.HoursLogged FROM Registration r JOIN Users u ON u.UserID=r.UserID
      JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID ORDER BY r.RegistrationID DESC`),
    db.query<SiteRow[]>(`SELECT p.SiteID, p.Name, p.Latitude, p.Longitude, p.CanopyCoverPct, p.NeedScore, p.Status,
      CONCAT(u.FName, ' ', u.LName) AS SubmittedBy FROM SitePriority p
      LEFT JOIN Users u ON u.UserID=p.SubmittedBy ORDER BY p.SiteID DESC`),
  ]);

  const organizations = organizationsResult[0];
  const users = usersResult[0];
  const opportunities = opportunitiesResult[0];
  const members = membersResult[0];
  const registrations = registrationsResult[0];
  const sites = sitesResult[0];
  return {
    counts,
    tables: { Organization: organizations, Users: users, VolunteerOpportunity: opportunities, OrganizationMember: members, Registration: registrations, PlantingSite: sites },
    lookups: {
      organizations: [...organizations].reverse().map((row) => ({ id: row.OrgID, label: row.Name })),
      users: [...users].reverse().map((row) => ({ id: row.UserID, label: `${row.FName} ${row.LName}` })),
      opportunities: opportunities.map((row) => ({ id: row.OpportunityID, label: row.Title })),
    },
  };
}

export async function GET() {
  try {
    return Response.json(await snapshot());
  } catch (error) {
    console.error("MySQL read:", error);
    return Response.json({ error: "Could not connect to MySQL. Start it with: npm run db:start" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { table?: unknown; data?: Record<string, unknown> };
    const table = body.table as TableName;
    if (!TABLES[table] || table === "PlantingSite") return Response.json({ error: "Choose a supported table." }, { status: 400 });
    const data = body.data ?? {};
    const db = database();

    if (table === "Organization") {
      const name = str(data.Name, 100), type = str(data.Type, 30), email = str(data.ContactEmail, 100).toLowerCase();
      if (!name || !["Nonprofit", "Government", "School", "Community Group", "Business"].includes(type) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "Enter a name, valid organization type, and email." }, { status: 400 });
      }
      await db.execute("INSERT INTO Organization (Name,Type,ContactEmail) VALUES (?,?,?)", [name, type, email]);
    } else if (table === "Users") {
      const first = str(data.FName, 50), last = str(data.LName, 50), email = str(data.Email, 100).toLowerCase();
      if (!first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "Enter first name, last name, and a valid email." }, { status: 400 });
      }
      const [result] = await db.execute<ResultSetHeader>("INSERT INTO Users (FName,LName,Email) VALUES (?,?,?)", [first, last, email]);
      await db.execute("INSERT INTO UserRole (UserID,RoleID) VALUES (?,1)", [result.insertId]);
    } else if (table === "VolunteerOpportunity") {
      const orgId = int(data.OrgID), title = str(data.Title, 150), eventDate = str(data.EventDate, 10), location = str(data.Location, 150);
      if (!Number.isFinite(orgId) || !title || !validDate(eventDate) || !location) {
        return Response.json({ error: "Choose an organization and enter a title, date, and location." }, { status: 400 });
      }
      await db.execute("INSERT INTO VolunteerOpportunity (OrgID,Title,EventDate,Location) VALUES (?,?,?,?)", [orgId, title, eventDate, location]);
    } else if (table === "OrganizationMember") {
      const orgId = int(data.OrgID), userId = int(data.UserID), joinDate = str(data.JoinDate, 10), role = str(data.OrgRole, 30);
      if (!Number.isFinite(orgId) || !Number.isFinite(userId) || !validDate(joinDate) || !["Member", "Coordinator", "Officer", "Director"].includes(role)) {
        return Response.json({ error: "Choose an organization, user, join date, and valid member role." }, { status: 400 });
      }
      await db.execute("INSERT INTO OrganizationMember (OrgID,UserID,JoinDate,OrgRole) VALUES (?,?,?,?)", [orgId, userId, joinDate, role]);
    } else {
      const userId = int(data.UserID), opportunityId = int(data.OpportunityID), registrationDate = str(data.RegistrationDate, 10), status = str(data.Status, 20), hours = Number(data.HoursLogged);
      if (!Number.isFinite(userId) || !Number.isFinite(opportunityId) || !validDate(registrationDate) || !["Pending", "Confirmed", "Cancelled", "Completed"].includes(status) || !Number.isFinite(hours) || hours < 0 || hours > 24) {
        return Response.json({ error: "Choose a user and opportunity, then enter a valid date, status, and 0–24 hours." }, { status: 400 });
      }
      await db.execute("INSERT INTO Registration (UserID,OpportunityID,RegistrationDate,Status,HoursLogged) VALUES (?,?,?,?,?)", [userId, opportunityId, registrationDate, status, hours]);
    }
    return Response.json({ ok: true, snapshot: await snapshot() });
  } catch (error: unknown) {
    console.error("MySQL insert:", error);
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "ER_DUP_ENTRY") return Response.json({ error: "That record already exists." }, { status: 409 });
    if (code === "ER_NO_REFERENCED_ROW_2") return Response.json({ error: "A selected related record no longer exists." }, { status: 409 });
    return Response.json({ error: "The record could not be inserted." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { table?: unknown; id?: unknown };
    const table = body.table as TableName;
    const id = int(body.id);
    if (!TABLES[table] || !Number.isFinite(id)) return Response.json({ error: "Choose a valid record." }, { status: 400 });
    const db = database();
    const [result] = await db.execute<ResultSetHeader>(`DELETE FROM ${table} WHERE ${TABLES[table]}=?`, [id]);
    if (!result.affectedRows) return Response.json({ error: "Record not found." }, { status: 404 });
    return Response.json({ ok: true, snapshot: await snapshot() });
  } catch (error) {
    console.error("MySQL delete:", error);
    return Response.json({ error: "The record could not be deleted." }, { status: 503 });
  }
}
