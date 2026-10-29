import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/lib/server";

type TableName =
  | "Organization"
  | "Users"
  | "VolunteerOpportunity"
  | "OrganizationMember"
  | "Registration";
const TABLES: Record<TableName, { pk: string }> = {
  Organization: { pk: "OrgID" },
  Users: { pk: "UserID" },
  VolunteerOpportunity: { pk: "OpportunityID" },
  OrganizationMember: { pk: "MembershipID" },
  Registration: { pk: "RegistrationID" },
};
const str = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const int = (value: unknown) =>
  Number.isInteger(Number(value)) ? Number(value) : NaN;
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user)
    return {
      error: Response.json(
        { error: "Sign in to open the administrator database." },
        { status: 401 },
      ),
    };
  const adminEmail = (env as any).TREEFINDER_ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || user.email.toLowerCase() !== adminEmail)
    return {
      error: Response.json(
        { error: "Administrator access is required." },
        { status: 403 },
      ),
    };
  return { user };
}

async function snapshot() {
  const db = database();
  const countTables = [
    "Organization",
    "Users",
    "Role",
    "UserRole",
    "VolunteerOpportunity",
    "OrganizationMember",
    "Registration",
  ] as const;
  const countRows = await Promise.all(
    countTables.map(async (name) => {
      const row = await db
        .prepare(`SELECT COUNT(*) AS RowCount FROM ${name}`)
        .first<{ RowCount: number }>();
      return { TableName: name, RowCount: Number(row?.RowCount ?? 0) };
    }),
  );
  const [organizations, users, opportunities, members, registrations, roles] =
    await Promise.all([
      db
        .prepare(
          "SELECT OrgID, Name, Type, ContactEmail FROM Organization ORDER BY OrgID DESC",
        )
        .all(),
      db
        .prepare(
          `SELECT u.UserID, u.FName, u.LName, u.Email,
      COALESCE(GROUP_CONCAT(r.RoleName, ', '), 'User') AS Roles
      FROM Users u LEFT JOIN UserRole ur ON ur.UserID=u.UserID
      LEFT JOIN Role r ON r.RoleID=ur.RoleID
      GROUP BY u.UserID ORDER BY u.UserID DESC`,
        )
        .all(),
      db
        .prepare(
          `SELECT v.OpportunityID, v.OrgID, o.Name AS Organization, v.Title, v.EventDate, v.Location,
      COUNT(r.RegistrationID) AS SignUps FROM VolunteerOpportunity v
      JOIN Organization o ON o.OrgID=v.OrgID
      LEFT JOIN Registration r ON r.OpportunityID=v.OpportunityID
      GROUP BY v.OpportunityID ORDER BY v.EventDate, v.OpportunityID`,
        )
        .all(),
      db
        .prepare(
          `SELECT m.MembershipID, m.OrgID, o.Name AS Organization, m.UserID,
      u.FName || ' ' || u.LName AS Member, m.JoinDate, m.OrgRole
      FROM OrganizationMember m JOIN Organization o ON o.OrgID=m.OrgID
      JOIN Users u ON u.UserID=m.UserID ORDER BY m.MembershipID DESC`,
        )
        .all(),
      db
        .prepare(
          `SELECT r.RegistrationID, r.UserID, u.FName || ' ' || u.LName AS Volunteer,
      r.OpportunityID, v.Title AS Opportunity, r.RegistrationDate, r.Status, r.HoursLogged
      FROM Registration r JOIN Users u ON u.UserID=r.UserID
      JOIN VolunteerOpportunity v ON v.OpportunityID=r.OpportunityID
      ORDER BY r.RegistrationID DESC`,
        )
        .all(),
      db.prepare("SELECT RoleID, RoleName FROM Role ORDER BY RoleID").all(),
    ]);
  return {
    counts: countRows,
    tables: {
      Organization: organizations.results,
      Users: users.results,
      VolunteerOpportunity: opportunities.results,
      OrganizationMember: members.results,
      Registration: registrations.results,
    },
    lookups: {
      organizations: [...organizations.results]
        .reverse()
        .map((row: any) => ({ id: row.OrgID, label: row.Name })),
      users: [...users.results]
        .reverse()
        .map((row: any) => ({
          id: row.UserID,
          label: `${row.FName} ${row.LName}`,
        })),
      opportunities: opportunities.results.map((row: any) => ({
        id: row.OpportunityID,
        label: row.Title,
      })),
      roles: roles.results,
    },
  };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    return Response.json({ ...(await snapshot()), admin: auth.user });
  } catch (error) {
    console.error("Phase 2 database read:", error);
    return Response.json(
      { error: "The database could not be read." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const body = (await request.json()) as any;
    const table = body.table as TableName;
    if (!TABLES[table])
      return Response.json(
        { error: "Choose a supported table." },
        { status: 400 },
      );
    const data = body.data ?? {};
    const db = database();
    if (table === "Organization") {
      const name = str(data.Name, 100),
        type = str(data.Type, 30),
        email = str(data.ContactEmail, 100).toLowerCase();
      if (
        !name ||
        ![
          "Nonprofit",
          "Government",
          "School",
          "Community Group",
          "Business",
        ].includes(type) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
        return Response.json(
          { error: "Enter a name, valid organization type, and email." },
          { status: 400 },
        );
      await db
        .prepare(
          "INSERT INTO Organization (Name,Type,ContactEmail) VALUES (?,?,?)",
        )
        .bind(name, type, email)
        .run();
    } else if (table === "Users") {
      const first = str(data.FName, 50),
        last = str(data.LName, 50),
        email = str(data.Email, 100).toLowerCase();
      if (!first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return Response.json(
          { error: "Enter first name, last name, and a valid email." },
          { status: 400 },
        );
      const result = await db
        .prepare("INSERT INTO Users (FName,LName,Email) VALUES (?,?,?)")
        .bind(first, last, email)
        .run();
      await db
        .prepare("INSERT INTO UserRole (UserID,RoleID) VALUES (?,1)")
        .bind(result.meta.last_row_id)
        .run();
    } else if (table === "VolunteerOpportunity") {
      const orgId = int(data.OrgID),
        title = str(data.Title, 150),
        eventDate = str(data.EventDate, 10),
        location = str(data.Location, 150);
      if (
        !Number.isFinite(orgId) ||
        !title ||
        !validDate(eventDate) ||
        !location
      )
        return Response.json(
          {
            error:
              "Choose an organization and enter a title, date, and location.",
          },
          { status: 400 },
        );
      await db
        .prepare(
          "INSERT INTO VolunteerOpportunity (OrgID,Title,EventDate,Location) VALUES (?,?,?,?)",
        )
        .bind(orgId, title, eventDate, location)
        .run();
    } else if (table === "OrganizationMember") {
      const orgId = int(data.OrgID),
        userId = int(data.UserID),
        joinDate = str(data.JoinDate, 10),
        role = str(data.OrgRole, 30);
      if (
        !Number.isFinite(orgId) ||
        !Number.isFinite(userId) ||
        !validDate(joinDate) ||
        !["Member", "Coordinator", "Officer", "Director"].includes(role)
      )
        return Response.json(
          {
            error:
              "Choose an organization, user, join date, and valid member role.",
          },
          { status: 400 },
        );
      await db
        .prepare(
          "INSERT INTO OrganizationMember (OrgID,UserID,JoinDate,OrgRole) VALUES (?,?,?,?)",
        )
        .bind(orgId, userId, joinDate, role)
        .run();
    } else {
      const userId = int(data.UserID),
        opportunityId = int(data.OpportunityID),
        registrationDate = str(data.RegistrationDate, 10),
        status = str(data.Status, 20),
        hours = Number(data.HoursLogged);
      if (
        !Number.isFinite(userId) ||
        !Number.isFinite(opportunityId) ||
        !validDate(registrationDate) ||
        !["Pending", "Confirmed", "Cancelled", "Completed"].includes(status) ||
        !Number.isFinite(hours) ||
        hours < 0 ||
        hours > 24
      )
        return Response.json(
          {
            error:
              "Choose a user and opportunity, then enter a valid date, status, and 0–24 hours.",
          },
          { status: 400 },
        );
      await db
        .prepare(
          "INSERT INTO Registration (UserID,OpportunityID,RegistrationDate,Status,HoursLogged) VALUES (?,?,?,?,?)",
        )
        .bind(userId, opportunityId, registrationDate, status, hours)
        .run();
    }
    return Response.json({ ok: true, snapshot: await snapshot() });
  } catch (error: any) {
    console.error("Phase 2 database insert:", error);
    const message = String(error?.message ?? "");
    if (/UNIQUE constraint failed/i.test(message))
      return Response.json(
        {
          error:
            "That record already exists. Unique names, emails, memberships, and registrations cannot be repeated.",
        },
        { status: 409 },
      );
    if (/FOREIGN KEY constraint failed/i.test(message))
      return Response.json(
        { error: "A selected related record no longer exists." },
        { status: 409 },
      );
    return Response.json(
      { error: "The record could not be inserted." },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const body = (await request.json()) as any;
    const table = body.table as TableName;
    const config = TABLES[table];
    const id = int(body.id);
    if (!config || !Number.isFinite(id))
      return Response.json(
        { error: "Choose a valid record." },
        { status: 400 },
      );
    const db = database();
    const statements: Record<TableName, string> = {
      Organization: "DELETE FROM Organization WHERE OrgID=?",
      Users: "DELETE FROM Users WHERE UserID=?",
      VolunteerOpportunity:
        "DELETE FROM VolunteerOpportunity WHERE OpportunityID=?",
      OrganizationMember: "DELETE FROM OrganizationMember WHERE MembershipID=?",
      Registration: "DELETE FROM Registration WHERE RegistrationID=?",
    };
    const result = await db.prepare(statements[table]).bind(id).run();
    if (!result.meta.changes)
      return Response.json({ error: "Record not found." }, { status: 404 });
    return Response.json({ ok: true, snapshot: await snapshot() });
  } catch (error) {
    console.error("Phase 2 database delete:", error);
    return Response.json(
      { error: "The record could not be deleted." },
      { status: 503 },
    );
  }
}
