import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireUser, type SessionUser } from "@/lib/auth";
import { errorCode, schedulableOrgs } from "@/lib/map-data";
import { database } from "@/lib/server";

/**
 * Manage Organizations. Admins manage every organization; Organizers, Coordinators,
 * Officers, and Directors manage the organizations they run (same rule as scheduling).
 *   GET    organizations with their members, plus everyone (by name) for the add-member picker
 *   POST   { OrgID, UserID, OrgRole }              add a member
 *          { Name, Type, ContactEmail }             create an organization (Admin)
 *   PATCH  { MembershipID, OrgRole }                change a member's role
 *          { OrgID, Name, Type, ContactEmail }      edit an organization's details
 *   DELETE { MembershipID }                         remove a member
 *          { OrgID }                                delete an organization (Admin)
 */

const TYPES = ["Nonprofit", "Government", "School", "Community Group", "Business"];
const ORG_ROLES = ["Member", "Coordinator", "Officer", "Director"];

interface OrgRow extends RowDataPacket { OrgID: number; Name: string; Type: string; ContactEmail: string; Events: number }
interface MemberRow extends RowDataPacket { MembershipID: number; OrgID: number; UserID: number; Name: string; Email: string; OrgRole: string; JoinDate: string }
interface PersonRow extends RowDataPacket { UserID: number; Name: string; Email: string }
interface OrgOfRow extends RowDataPacket { OrgID: number }

const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const isAdmin = (user: SessionUser) => user.roles.includes("Admin");

async function managedIds(user: SessionUser) {
  return (await schedulableOrgs(user)).map((org) => org.OrgID);
}

async function snapshot(user: SessionUser) {
  const ids = await managedIds(user);
  if (!ids.length) return { canCreate: isAdmin(user), organizations: [], people: [] };
  const db = database();
  const [[orgs], [members], [people]] = await Promise.all([
    db.query<OrgRow[]>(`SELECT o.OrgID, o.Name, o.Type, o.ContactEmail,
        (SELECT COUNT(*) FROM VolunteerOpportunity v WHERE v.OrgID = o.OrgID) AS Events
      FROM Organization o WHERE o.OrgID IN (?) ORDER BY o.Name`, [ids]),
    db.query<MemberRow[]>(`SELECT m.MembershipID, m.OrgID, m.UserID, CONCAT(u.FName, ' ', u.LName) AS Name, u.Email, m.OrgRole,
        DATE_FORMAT(m.JoinDate, '%Y-%m-%d') AS JoinDate
      FROM OrganizationMember m JOIN Users u ON u.UserID = m.UserID WHERE m.OrgID IN (?)
      ORDER BY FIELD(m.OrgRole, 'Director', 'Officer', 'Coordinator', 'Member'), u.LName, u.FName`, [ids]),
    db.query<PersonRow[]>("SELECT UserID, CONCAT(FName, ' ', LName) AS Name, Email FROM Users ORDER BY LName, FName"),
  ]);
  return {
    canCreate: isAdmin(user),
    organizations: orgs.map((org) => ({
      ...org,
      Events: Number(org.Events),
      members: members.filter((m) => m.OrgID === org.OrgID).map(({ MembershipID, UserID, Name, Email, OrgRole, JoinDate }) => ({ MembershipID, UserID, Name, Email, OrgRole, JoinDate })),
    })),
    people: people.map(({ UserID, Name, Email }) => ({ UserID, Name, Email })),
  };
}

/** The organization a membership belongs to, if this user manages it. */
async function managedMembershipOrg(user: SessionUser, membershipId: number) {
  const [[row]] = await database().query<OrgOfRow[]>("SELECT OrgID FROM OrganizationMember WHERE MembershipID = ?", [membershipId]);
  return row && (await managedIds(user)).includes(row.OrgID) ? row.OrgID : null;
}

function orgDetails(data: Record<string, unknown>) {
  const name = str(data.Name, 100), type = str(data.Type, 30), email = str(data.ContactEmail, 100).toLowerCase();
  if (!name || !TYPES.includes(type) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { name, type, email };
}

function failure(error: unknown, action: string) {
  const code = errorCode(error);
  if (code === "ER_DUP_ENTRY") return Response.json({ error: "That already exists (organization names, emails, and memberships must be unique)." }, { status: 409 });
  if (code === "ER_NO_REFERENCED_ROW_2") return Response.json({ error: "That person or organization no longer exists." }, { status: 409 });
  console.error(`${action}:`, error);
  return Response.json({ error: `Could not ${action.toLowerCase()}.` }, { status: 503 });
}

export async function GET(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  try {
    return Response.json(await snapshot(user));
  } catch (error) {
    return failure(error, "Load organizations");
  }
}

export async function POST(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const db = database();
  try {
    if (data.UserID !== undefined) {
      const orgId = Number(data.OrgID), userId = Number(data.UserID), role = str(data.OrgRole, 30) || "Member";
      if (!Number.isInteger(orgId) || !Number.isInteger(userId) || !ORG_ROLES.includes(role)) {
        return Response.json({ error: "Choose a person and their role in the organization." }, { status: 400 });
      }
      if (!(await managedIds(user)).includes(orgId)) return Response.json({ error: "You can only add members to organizations you manage." }, { status: 403 });
      await db.execute("INSERT INTO OrganizationMember (OrgID, UserID, JoinDate, OrgRole) VALUES (?, ?, CURDATE(), ?)", [orgId, userId, role]);
    } else {
      if (!isAdmin(user)) return Response.json({ error: "Only admins can create organizations." }, { status: 403 });
      const org = orgDetails(data);
      if (!org) return Response.json({ error: "Enter a name, an organization type, and a valid contact email." }, { status: 400 });
      await db.execute("INSERT INTO Organization (Name, Type, ContactEmail) VALUES (?, ?, ?)", [org.name, org.type, org.email]);
    }
    return Response.json({ ok: true, ...(await snapshot(user)) }, { status: 201 });
  } catch (error) {
    return failure(error, "Save");
  }
}

export async function PATCH(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const db = database();
  try {
    if (data.MembershipID !== undefined) {
      const id = Number(data.MembershipID), role = str(data.OrgRole, 30);
      if (!Number.isInteger(id) || !ORG_ROLES.includes(role)) return Response.json({ error: "Choose a valid role." }, { status: 400 });
      if (!(await managedMembershipOrg(user, id))) return Response.json({ error: "You can only change members of organizations you manage." }, { status: 403 });
      await db.execute("UPDATE OrganizationMember SET OrgRole = ? WHERE MembershipID = ?", [role, id]);
    } else {
      const orgId = Number(data.OrgID), org = orgDetails(data);
      if (!Number.isInteger(orgId) || !org) return Response.json({ error: "Enter a name, an organization type, and a valid contact email." }, { status: 400 });
      if (!(await managedIds(user)).includes(orgId)) return Response.json({ error: "You can only edit organizations you manage." }, { status: 403 });
      await db.execute("UPDATE Organization SET Name = ?, Type = ?, ContactEmail = ? WHERE OrgID = ?", [org.name, org.type, org.email, orgId]);
    }
    return Response.json({ ok: true, ...(await snapshot(user)) });
  } catch (error) {
    return failure(error, "Save");
  }
}

export async function DELETE(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const db = database();
  try {
    if (data.MembershipID !== undefined) {
      const id = Number(data.MembershipID);
      if (!Number.isInteger(id) || !(await managedMembershipOrg(user, id))) return Response.json({ error: "You can only remove members of organizations you manage." }, { status: 403 });
      await db.execute("DELETE FROM OrganizationMember WHERE MembershipID = ?", [id]);
    } else {
      if (!isAdmin(user)) return Response.json({ error: "Only admins can delete organizations." }, { status: 403 });
      const orgId = Number(data.OrgID);
      const [result] = await db.execute<ResultSetHeader>("DELETE FROM Organization WHERE OrgID = ?", [orgId]);
      if (!result.affectedRows) return Response.json({ error: "That organization no longer exists." }, { status: 404 });
    }
    return Response.json({ ok: true, ...(await snapshot(user)) });
  } catch (error) {
    return failure(error, "Delete");
  }
}
