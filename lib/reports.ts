import type { RowDataPacket } from "mysql2";
import type { SessionUser } from "./auth";
import { managedOrgIds } from "./manage";
import { database } from "./server";

/**
 * Statistical reports, five per user type. Each one lists the SQL aggregate
 * functions it uses so the page can show them next to the title.
 *   volunteer → every signed-in user, about their own volunteering
 *   organizer → organizations whose events the user manages (see managedOrgIds)
 *   arborist  → planting sites and tree species (Arborist or Admin role)
 *   admin     → managerial overview of the whole database (Admin role)
 */
export type Audience = "volunteer" | "organizer" | "arborist" | "admin";
type Aggregate = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
type Format = "text" | "number" | "hours" | "date" | "month";
type Column = { key: string; label: string; format?: Format };
type Context = { userId: number; orgIds: number[] };

type Report = {
  id: string;
  audience: Audience;
  title: string;
  description: string;
  aggregates: Aggregate[];
  /** "stats" shows a single row as big numbers; "table" shows rows (with an optional bar chart). */
  layout: "stats" | "table";
  columns: Column[];
  chart?: { label: string; value: string };
  sql: string;
  params?: (ctx: Context) => unknown[];
};

export const AUDIENCES: { id: Audience; label: string; description: string }[] = [
  { id: "volunteer", label: "My Volunteering", description: "Your own sign-ups and hours." },
  { id: "organizer", label: "My Organizations", description: "Events, sign-ups, and members of the organizations you schedule for." },
  { id: "arborist", label: "Planting & Trees", description: "Planting areas, site conditions, and recommended species." },
  { id: "admin", label: "Managerial Overview", description: "Statistics across the whole system." },
];

const day = (expr: string) => `DATE_FORMAT(${expr}, '%Y-%m-%d')`;
const ACTIVE = "r.Status <> 'Cancelled'";

const REPORTS: Report[] = [
  // ---------------------------------------------------------------- volunteer
  {
    id: "my-summary", audience: "volunteer", layout: "stats",
    title: "My volunteering summary",
    description: "Completed events, total and average hours, and your first and latest event.",
    aggregates: ["COUNT", "SUM", "AVG", "MIN", "MAX"],
    columns: [
      { key: "Events", label: "Events completed", format: "number" },
      { key: "TotalHours", label: "Total hours", format: "hours" },
      { key: "AvgHours", label: "Average hours per event", format: "hours" },
      { key: "FirstEvent", label: "First event", format: "date" },
      { key: "LatestEvent", label: "Latest event", format: "date" },
    ],
    sql: `SELECT COUNT(*) AS Events, COALESCE(SUM(r.HoursLogged), 0) AS TotalHours,
            ROUND(AVG(r.HoursLogged), 1) AS AvgHours,
            ${day("MIN(v.EventDate)")} AS FirstEvent, ${day("MAX(v.EventDate)")} AS LatestEvent
          FROM Registration r JOIN VolunteerOpportunity v ON v.OpportunityID = r.OpportunityID
          WHERE r.UserID = ? AND r.Status = 'Completed'`,
    params: (ctx) => [ctx.userId],
  },
  {
    id: "my-hours-by-org", audience: "volunteer", layout: "table",
    title: "My hours by organization",
    description: "Which organizations you have given the most time to.",
    aggregates: ["COUNT", "SUM"],
    columns: [
      { key: "Organization", label: "Organization" },
      { key: "Events", label: "Events", format: "number" },
      { key: "Hours", label: "Hours", format: "hours" },
    ],
    chart: { label: "Organization", value: "Hours" },
    sql: `SELECT o.Name AS Organization, COUNT(*) AS Events, SUM(r.HoursLogged) AS Hours
          FROM Registration r JOIN VolunteerOpportunity v ON v.OpportunityID = r.OpportunityID
          JOIN Organization o ON o.OrgID = v.OrgID
          WHERE r.UserID = ? AND r.Status = 'Completed'
          GROUP BY o.OrgID, o.Name ORDER BY Hours DESC, Organization`,
    params: (ctx) => [ctx.userId],
  },
  {
    id: "my-signups-by-status", audience: "volunteer", layout: "table",
    title: "My sign-ups by status",
    description: "How many of your sign-ups are pending, confirmed, completed, or cancelled.",
    aggregates: ["COUNT", "MAX"],
    columns: [
      { key: "Status", label: "Status" },
      { key: "SignUps", label: "Sign-ups", format: "number" },
      { key: "LatestEvent", label: "Latest event date", format: "date" },
    ],
    chart: { label: "Status", value: "SignUps" },
    sql: `SELECT r.Status, COUNT(*) AS SignUps, ${day("MAX(v.EventDate)")} AS LatestEvent
          FROM Registration r JOIN VolunteerOpportunity v ON v.OpportunityID = r.OpportunityID
          WHERE r.UserID = ?
          GROUP BY r.Status ORDER BY SignUps DESC`,
    params: (ctx) => [ctx.userId],
  },
  {
    id: "my-vs-community", audience: "volunteer", layout: "stats",
    title: "Me vs. the community",
    description: "Your total hours compared with every volunteer who has completed an event.",
    aggregates: ["SUM", "AVG", "MAX", "MIN", "COUNT"],
    columns: [
      { key: "MyHours", label: "My total hours", format: "hours" },
      { key: "AverageVolunteer", label: "Average volunteer", format: "hours" },
      { key: "TopVolunteer", label: "Top volunteer", format: "hours" },
      { key: "LowestVolunteer", label: "Lowest volunteer", format: "hours" },
      { key: "Volunteers", label: "Active volunteers", format: "number" },
    ],
    sql: `SELECT COALESCE((SELECT SUM(HoursLogged) FROM Registration WHERE UserID = ? AND Status = 'Completed'), 0) AS MyHours,
            ROUND(AVG(t.Total), 1) AS AverageVolunteer, MAX(t.Total) AS TopVolunteer,
            MIN(t.Total) AS LowestVolunteer, COUNT(*) AS Volunteers
          FROM (SELECT UserID, SUM(HoursLogged) AS Total FROM Registration
                WHERE Status = 'Completed' GROUP BY UserID) t`,
    params: (ctx) => [ctx.userId],
  },
  {
    id: "my-monthly", audience: "volunteer", layout: "table",
    title: "My activity by month",
    description: "Active sign-ups and hours for each month you volunteered.",
    aggregates: ["COUNT", "SUM"],
    columns: [
      { key: "Month", label: "Month", format: "month" },
      { key: "SignUps", label: "Sign-ups", format: "number" },
      { key: "Hours", label: "Hours", format: "hours" },
    ],
    chart: { label: "Month", value: "SignUps" },
    sql: `SELECT DATE_FORMAT(v.EventDate, '%Y-%m') AS Month, COUNT(*) AS SignUps, SUM(r.HoursLogged) AS Hours
          FROM Registration r JOIN VolunteerOpportunity v ON v.OpportunityID = r.OpportunityID
          WHERE r.UserID = ? AND ${ACTIVE}
          GROUP BY Month ORDER BY Month`,
    params: (ctx) => [ctx.userId],
  },

  // ---------------------------------------------------------------- organizer
  {
    id: "org-overview", audience: "organizer", layout: "table",
    title: "Organization overview",
    description: "Events, active sign-ups, and hours for each organization you schedule for.",
    aggregates: ["COUNT", "SUM"],
    columns: [
      { key: "Organization", label: "Organization" },
      { key: "Events", label: "Events", format: "number" },
      { key: "SignUps", label: "Sign-ups", format: "number" },
      { key: "Hours", label: "Total hours", format: "hours" },
    ],
    chart: { label: "Organization", value: "Hours" },
    sql: `SELECT o.Name AS Organization, COUNT(DISTINCT v.OpportunityID) AS Events,
            COUNT(CASE WHEN ${ACTIVE} THEN 1 END) AS SignUps,
            COALESCE(SUM(r.HoursLogged), 0) AS Hours
          FROM Organization o
          LEFT JOIN VolunteerOpportunity v ON v.OrgID = o.OrgID
          LEFT JOIN Registration r ON r.OpportunityID = v.OpportunityID
          WHERE o.OrgID IN (?)
          GROUP BY o.OrgID, o.Name ORDER BY Hours DESC, Organization`,
    params: (ctx) => [ctx.orgIds],
  },
  {
    id: "org-event-signups", audience: "organizer", layout: "table",
    title: "Sign-ups per event",
    description: "Turnout for each event, including cancellations and hours logged.",
    aggregates: ["COUNT", "SUM"],
    columns: [
      { key: "Event", label: "Event" },
      { key: "Organization", label: "Organization" },
      { key: "EventDate", label: "Date", format: "date" },
      { key: "SignUps", label: "Sign-ups", format: "number" },
      { key: "Cancelled", label: "Cancelled", format: "number" },
      { key: "Hours", label: "Hours", format: "hours" },
    ],
    chart: { label: "Event", value: "SignUps" },
    sql: `SELECT v.Title AS Event, o.Name AS Organization, ${day("v.EventDate")} AS EventDate,
            COUNT(CASE WHEN ${ACTIVE} THEN 1 END) AS SignUps,
            COUNT(CASE WHEN r.Status = 'Cancelled' THEN 1 END) AS Cancelled,
            COALESCE(SUM(r.HoursLogged), 0) AS Hours
          FROM VolunteerOpportunity v JOIN Organization o ON o.OrgID = v.OrgID
          LEFT JOIN Registration r ON r.OpportunityID = v.OpportunityID
          WHERE v.OrgID IN (?)
          GROUP BY v.OpportunityID, v.Title, o.Name, v.EventDate
          ORDER BY SignUps DESC, v.EventDate DESC`,
    params: (ctx) => [ctx.orgIds],
  },
  {
    id: "org-event-size", audience: "organizer", layout: "table",
    title: "Smallest, average, and largest events",
    description: "The range of turnout across each organization's events.",
    aggregates: ["COUNT", "MIN", "AVG", "MAX"],
    columns: [
      { key: "Organization", label: "Organization" },
      { key: "Events", label: "Events", format: "number" },
      { key: "Smallest", label: "Smallest", format: "number" },
      { key: "Average", label: "Average", format: "number" },
      { key: "Largest", label: "Largest", format: "number" },
    ],
    sql: `SELECT o.Name AS Organization, COUNT(*) AS Events, MIN(e.SignUps) AS Smallest,
            ROUND(AVG(e.SignUps), 1) AS Average, MAX(e.SignUps) AS Largest
          FROM (SELECT v.OpportunityID, v.OrgID, COUNT(CASE WHEN ${ACTIVE} THEN 1 END) AS SignUps
                FROM VolunteerOpportunity v LEFT JOIN Registration r ON r.OpportunityID = v.OpportunityID
                WHERE v.OrgID IN (?) GROUP BY v.OpportunityID, v.OrgID) e
          JOIN Organization o ON o.OrgID = e.OrgID
          GROUP BY o.OrgID, o.Name ORDER BY Largest DESC, Organization`,
    params: (ctx) => [ctx.orgIds],
  },
  {
    id: "org-members", audience: "organizer", layout: "table",
    title: "Members by role",
    description: "How many members hold each role, and when the earliest and latest joined.",
    aggregates: ["COUNT", "MIN", "MAX"],
    columns: [
      { key: "Role", label: "Role" },
      { key: "Members", label: "Members", format: "number" },
      { key: "EarliestJoin", label: "Earliest join", format: "date" },
      { key: "LatestJoin", label: "Latest join", format: "date" },
    ],
    chart: { label: "Role", value: "Members" },
    sql: `SELECT m.OrgRole AS Role, COUNT(*) AS Members,
            ${day("MIN(m.JoinDate)")} AS EarliestJoin, ${day("MAX(m.JoinDate)")} AS LatestJoin
          FROM OrganizationMember m WHERE m.OrgID IN (?)
          GROUP BY m.OrgRole ORDER BY FIELD(m.OrgRole, 'Director', 'Officer', 'Coordinator', 'Member')`,
    params: (ctx) => [ctx.orgIds],
  },
  {
    id: "org-top-volunteers", audience: "organizer", layout: "table",
    title: "Top volunteers",
    description: "The ten volunteers with the most completed hours at your organizations' events.",
    aggregates: ["COUNT", "SUM", "MAX"],
    columns: [
      { key: "Volunteer", label: "Volunteer" },
      { key: "Events", label: "Events", format: "number" },
      { key: "Hours", label: "Total hours", format: "hours" },
      { key: "LongestShift", label: "Longest shift", format: "hours" },
    ],
    chart: { label: "Volunteer", value: "Hours" },
    sql: `SELECT CONCAT(u.FName, ' ', u.LName) AS Volunteer, COUNT(*) AS Events,
            SUM(r.HoursLogged) AS Hours, MAX(r.HoursLogged) AS LongestShift
          FROM Registration r JOIN Users u ON u.UserID = r.UserID
          JOIN VolunteerOpportunity v ON v.OpportunityID = r.OpportunityID
          WHERE v.OrgID IN (?) AND r.Status = 'Completed'
          GROUP BY u.UserID, u.FName, u.LName ORDER BY Hours DESC, Volunteer LIMIT 10`,
    params: (ctx) => [ctx.orgIds],
  },

  // ---------------------------------------------------------------- arborist
  {
    id: "sites-by-status", audience: "arborist", layout: "table",
    title: "Planting areas by status",
    description: "How many areas are proposed, approved, or planted, and how many trees they need.",
    aggregates: ["COUNT", "SUM", "AVG"],
    columns: [
      { key: "Status", label: "Status" },
      { key: "Sites", label: "Areas", format: "number" },
      { key: "Trees", label: "Trees needed", format: "number" },
      { key: "AvgNeed", label: "Average need score", format: "number" },
    ],
    chart: { label: "Status", value: "Trees" },
    sql: `SELECT Status, COUNT(*) AS Sites, SUM(TreesNeeded) AS Trees, ROUND(AVG(NeedScore), 1) AS AvgNeed
          FROM SitePriority GROUP BY Status ORDER BY FIELD(Status, 'Proposed', 'Approved', 'Planted')`,
  },
  {
    id: "site-conditions", audience: "arborist", layout: "table",
    title: "Site conditions range",
    description: "The lowest, average, and highest canopy, paved surface, and summer heat across all areas.",
    aggregates: ["MIN", "AVG", "MAX"],
    columns: [
      { key: "Measure", label: "Measure" },
      { key: "Lowest", label: "Lowest", format: "number" },
      { key: "Average", label: "Average", format: "number" },
      { key: "Highest", label: "Highest", format: "number" },
    ],
    sql: `SELECT 'Tree canopy (%)' AS Measure, MIN(CanopyCoverPct) AS Lowest,
            ROUND(AVG(CanopyCoverPct), 1) AS Average, MAX(CanopyCoverPct) AS Highest FROM PlantingSite
          UNION ALL SELECT 'Paved surface (%)', MIN(ImperviousPct), ROUND(AVG(ImperviousPct), 1), MAX(ImperviousPct) FROM PlantingSite
          UNION ALL SELECT 'Surface temperature (°F)', MIN(SurfaceTempF), ROUND(AVG(SurfaceTempF), 1), MAX(SurfaceTempF) FROM PlantingSite`,
  },
  {
    id: "species-demand", audience: "arborist", layout: "table",
    title: "Recommended trees by species",
    description: "How many areas recommend each species, and the total trees recommended.",
    aggregates: ["COUNT", "SUM"],
    columns: [
      { key: "Species", label: "Species" },
      { key: "Category", label: "Category" },
      { key: "Sites", label: "Areas", format: "number" },
      { key: "Trees", label: "Trees", format: "number" },
    ],
    chart: { label: "Species", value: "Trees" },
    sql: `SELECT t.CommonName AS Species, t.Category, COUNT(sr.SiteID) AS Sites, COALESCE(SUM(sr.Quantity), 0) AS Trees
          FROM TreeSpecies t LEFT JOIN SiteRecommendation sr ON sr.SpeciesID = t.SpeciesID
          GROUP BY t.SpeciesID, t.CommonName, t.Category ORDER BY Trees DESC, Species`,
  },
  {
    id: "tree-categories", audience: "arborist", layout: "table",
    title: "Tree categories",
    description: "Species, recommended trees, and mature height range for each category.",
    aggregates: ["COUNT", "SUM", "MIN", "MAX"],
    columns: [
      { key: "Category", label: "Category" },
      { key: "Species", label: "Species", format: "number" },
      { key: "Trees", label: "Trees recommended", format: "number" },
      { key: "ShortestFt", label: "Shortest (ft)", format: "number" },
      { key: "TallestFt", label: "Tallest (ft)", format: "number" },
    ],
    chart: { label: "Category", value: "Trees" },
    sql: `SELECT t.Category, COUNT(DISTINCT t.SpeciesID) AS Species, COALESCE(SUM(sr.Quantity), 0) AS Trees,
            MIN(t.MatureHeightFt) AS ShortestFt, MAX(t.MatureHeightFt) AS TallestFt
          FROM TreeSpecies t LEFT JOIN SiteRecommendation sr ON sr.SpeciesID = t.SpeciesID
          GROUP BY t.Category ORDER BY Trees DESC`,
  },
  {
    id: "site-volunteer-work", audience: "arborist", layout: "table",
    title: "Volunteer work at planting areas",
    description: "Events held at each area, hours volunteers completed there, and the latest event.",
    aggregates: ["COUNT", "SUM", "MAX"],
    columns: [
      { key: "Site", label: "Planting area" },
      { key: "Events", label: "Events", format: "number" },
      { key: "Hours", label: "Volunteer hours", format: "hours" },
      { key: "LatestEvent", label: "Latest event", format: "date" },
    ],
    chart: { label: "Site", value: "Hours" },
    sql: `SELECT p.Name AS Site, COUNT(DISTINCT v.OpportunityID) AS Events,
            COALESCE(SUM(CASE WHEN r.Status = 'Completed' THEN r.HoursLogged END), 0) AS Hours,
            ${day("MAX(v.EventDate)")} AS LatestEvent
          FROM PlantingSite p JOIN VolunteerOpportunity v ON v.SiteID = p.SiteID
          LEFT JOIN Registration r ON r.OpportunityID = v.OpportunityID
          GROUP BY p.SiteID, p.Name ORDER BY Hours DESC, Site`,
  },

  // ---------------------------------------------------------------- admin
  {
    id: "system-overview", audience: "admin", layout: "stats",
    title: "System overview",
    description: "Totals across the whole system.",
    aggregates: ["COUNT", "SUM", "AVG", "MIN", "MAX"],
    columns: [
      { key: "Users", label: "People", format: "number" },
      { key: "Organizations", label: "Organizations", format: "number" },
      { key: "Events", label: "Events", format: "number" },
      { key: "TotalHours", label: "Volunteer hours", format: "hours" },
      { key: "AvgHours", label: "Avg hours per sign-up", format: "hours" },
      { key: "FirstEvent", label: "First event", format: "date" },
      { key: "LatestEvent", label: "Latest event", format: "date" },
    ],
    sql: `SELECT (SELECT COUNT(*) FROM Users) AS Users,
            (SELECT COUNT(*) FROM Organization) AS Organizations,
            (SELECT COUNT(*) FROM VolunteerOpportunity) AS Events,
            (SELECT COALESCE(SUM(HoursLogged), 0) FROM Registration WHERE Status = 'Completed') AS TotalHours,
            (SELECT ROUND(AVG(HoursLogged), 1) FROM Registration WHERE Status = 'Completed') AS AvgHours,
            (SELECT ${day("MIN(EventDate)")} FROM VolunteerOpportunity) AS FirstEvent,
            (SELECT ${day("MAX(EventDate)")} FROM VolunteerOpportunity) AS LatestEvent`,
  },
  {
    id: "users-per-role", audience: "admin", layout: "table",
    title: "People per role",
    description: "How many accounts hold each system role.",
    aggregates: ["COUNT"],
    columns: [
      { key: "Role", label: "Role" },
      { key: "People", label: "People", format: "number" },
    ],
    chart: { label: "Role", value: "People" },
    sql: `SELECT ro.RoleName AS Role, COUNT(ur.UserID) AS People
          FROM Role ro LEFT JOIN UserRole ur ON ur.RoleID = ro.RoleID
          GROUP BY ro.RoleID, ro.RoleName ORDER BY ro.RoleID`,
  },
  {
    id: "org-leaderboard", audience: "admin", layout: "table",
    title: "Organization leaderboard",
    description: "The ten organizations with the most completed volunteer hours.",
    aggregates: ["COUNT", "SUM"],
    columns: [
      { key: "Organization", label: "Organization" },
      { key: "Type", label: "Type" },
      { key: "Events", label: "Events", format: "number" },
      { key: "Volunteers", label: "Volunteers", format: "number" },
      { key: "Hours", label: "Hours", format: "hours" },
    ],
    chart: { label: "Organization", value: "Hours" },
    sql: `SELECT o.Name AS Organization, o.Type, COUNT(DISTINCT v.OpportunityID) AS Events,
            COUNT(DISTINCT CASE WHEN ${ACTIVE} THEN r.UserID END) AS Volunteers,
            COALESCE(SUM(CASE WHEN r.Status = 'Completed' THEN r.HoursLogged END), 0) AS Hours
          FROM Organization o
          LEFT JOIN VolunteerOpportunity v ON v.OrgID = o.OrgID
          LEFT JOIN Registration r ON r.OpportunityID = v.OpportunityID
          GROUP BY o.OrgID, o.Name, o.Type ORDER BY Hours DESC, Events DESC LIMIT 10`,
  },
  {
    id: "monthly-activity", audience: "admin", layout: "table",
    title: "Monthly activity",
    description: "Events, active sign-ups, and hours for every month.",
    aggregates: ["COUNT", "SUM"],
    columns: [
      { key: "Month", label: "Month", format: "month" },
      { key: "Events", label: "Events", format: "number" },
      { key: "SignUps", label: "Sign-ups", format: "number" },
      { key: "Hours", label: "Hours", format: "hours" },
    ],
    chart: { label: "Month", value: "SignUps" },
    sql: `SELECT DATE_FORMAT(v.EventDate, '%Y-%m') AS Month, COUNT(DISTINCT v.OpportunityID) AS Events,
            COUNT(CASE WHEN ${ACTIVE} THEN 1 END) AS SignUps, COALESCE(SUM(r.HoursLogged), 0) AS Hours
          FROM VolunteerOpportunity v LEFT JOIN Registration r ON r.OpportunityID = v.OpportunityID
          GROUP BY Month ORDER BY Month`,
  },
  {
    id: "org-types", audience: "admin", layout: "table",
    title: "Organizations by type",
    description: "How many organizations of each type, and their smallest, average, and largest membership.",
    aggregates: ["COUNT", "MIN", "AVG", "MAX"],
    columns: [
      { key: "Type", label: "Type" },
      { key: "Organizations", label: "Organizations", format: "number" },
      { key: "FewestMembers", label: "Fewest members", format: "number" },
      { key: "AvgMembers", label: "Avg members", format: "number" },
      { key: "MostMembers", label: "Most members", format: "number" },
    ],
    chart: { label: "Type", value: "Organizations" },
    sql: `SELECT t.Type, COUNT(*) AS Organizations, MIN(t.Members) AS FewestMembers,
            ROUND(AVG(t.Members), 1) AS AvgMembers, MAX(t.Members) AS MostMembers
          FROM (SELECT o.OrgID, o.Type, COUNT(m.MembershipID) AS Members
                FROM Organization o LEFT JOIN OrganizationMember m ON m.OrgID = o.OrgID
                GROUP BY o.OrgID, o.Type) t
          GROUP BY t.Type ORDER BY Organizations DESC, t.Type`,
  },
];

const NUMERIC: Format[] = ["number", "hours"];

/** Report groups this user may see, with their rows. */
export async function reportsFor(user: SessionUser) {
  const isAdmin = user.roles.includes("Admin");
  const orgIds = await managedOrgIds(user);
  const allowed: Record<Audience, boolean> = {
    volunteer: true,
    organizer: orgIds.length > 0,
    arborist: isAdmin || user.roles.includes("Arborist"),
    admin: isAdmin,
  };
  const ctx: Context = { userId: user.UserID, orgIds };
  const db = database();

  return Promise.all(AUDIENCES.filter((group) => allowed[group.id]).map(async (group) => ({
    ...group,
    reports: await Promise.all(REPORTS.filter((report) => report.audience === group.id).map(async (report) => {
      const [rows] = await db.query<RowDataPacket[]>(report.sql, report.params?.(ctx) ?? []);
      // MySQL returns SUM/AVG of DECIMAL columns as strings; turn numeric columns into numbers.
      const numeric = report.columns.filter((column) => NUMERIC.includes(column.format ?? "text")).map((column) => column.key);
      const clean = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) =>
        [key, numeric.includes(key) && value !== null ? Number(value) : value])));
      const { id, title, description, aggregates, layout, columns, chart } = report;
      return { id, title, description, aggregates, layout, columns, chart: chart ?? null, rows: clean };
    })),
  })));
}
