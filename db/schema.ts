import {
  integer,
  real,
  sqliteTable,
  text,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("Organization", {
  orgId: integer("OrgID").primaryKey({ autoIncrement: true }),
  name: text("Name").notNull().unique(),
  type: text("Type").notNull(),
  contactEmail: text("ContactEmail").notNull().unique(),
});

export const users = sqliteTable("Users", {
  userId: integer("UserID").primaryKey({ autoIncrement: true }),
  firstName: text("FName").notNull(),
  lastName: text("LName").notNull(),
  email: text("Email").notNull().unique(),
});

export const roles = sqliteTable("Role", {
  roleId: integer("RoleID").primaryKey(),
  roleName: text("RoleName").notNull().unique(),
});

export const userRoles = sqliteTable(
  "UserRole",
  {
    userId: integer("UserID")
      .notNull()
      .references(() => users.userId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    roleId: integer("RoleID")
      .notNull()
      .references(() => roles.roleId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const opportunities = sqliteTable("VolunteerOpportunity", {
  opportunityId: integer("OpportunityID").primaryKey({ autoIncrement: true }),
  orgId: integer("OrgID")
    .notNull()
    .references(() => organizations.orgId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  title: text("Title").notNull(),
  eventDate: text("EventDate").notNull(),
  location: text("Location").notNull(),
});

export const organizationMembers = sqliteTable(
  "OrganizationMember",
  {
    membershipId: integer("MembershipID").primaryKey({ autoIncrement: true }),
    orgId: integer("OrgID")
      .notNull()
      .references(() => organizations.orgId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: integer("UserID")
      .notNull()
      .references(() => users.userId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    joinDate: text("JoinDate").notNull(),
    orgRole: text("OrgRole").notNull().default("Member"),
  },
  (table) => [uniqueIndex("UQ_Member_OrgUser").on(table.orgId, table.userId)],
);

export const registrations = sqliteTable(
  "Registration",
  {
    registrationId: integer("RegistrationID").primaryKey({
      autoIncrement: true,
    }),
    userId: integer("UserID")
      .notNull()
      .references(() => users.userId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    opportunityId: integer("OpportunityID")
      .notNull()
      .references(() => opportunities.opportunityId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    registrationDate: text("RegistrationDate").notNull(),
    status: text("Status").notNull().default("Pending"),
    hoursLogged: real("HoursLogged").notNull().default(0),
  },
  (table) => [
    uniqueIndex("UQ_Registration_UserOpp").on(
      table.userId,
      table.opportunityId,
    ),
  ],
);
