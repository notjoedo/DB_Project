import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  role: text("role").notNull().default("general"),
  certification: text("certification"),
  requestedRole: text("requested_role"),
});
export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    payload: text("payload").notNull(),
    status: text("status").notNull().default("pending"),
    created: text("created").notNull(),
  },
  (t) => [
    index("idx_records_kind_status").on(t.kind, t.status),
    index("idx_records_owner_kind").on(t.owner, t.kind),
  ],
);
export const registrations = sqliteTable(
  "registrations",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    event: text("event").notNull(),
    created: text("created").notNull(),
  },
  (t) => [uniqueIndex("idx_registration_owner_event").on(t.owner, t.event)],
);
export const votes = sqliteTable("votes", {
  owner: text("owner").primaryKey(),
  species: text("species").notNull(),
});
