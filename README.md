# Treefinder — Phase 2 Volunteer Database

Treefinder is a simple volunteer-management web application for the Phase 2 database requirements. The interface reads from the database, displays ready sample data, inserts records, and permanently deletes records from the five major tables.

## MySQL source of truth

The supplied MySQL 8 script is [`sqlproject/volunteer_db.sql`](sqlproject/volunteer_db.sql). It is preserved unchanged. Run it in MySQL Workbench or from the command line:

```sh
mysql -u root -p < sqlproject/volunteer_db.sql
```

The script creates `volunteer_db`, its seven normalized tables, foreign keys, validation checks, and sample data. The major tables already contain at least 20 tuples:

| Major table          | Initial rows |
| -------------------- | -----------: |
| Organization         |           20 |
| Users                |           30 |
| VolunteerOpportunity |           25 |
| OrganizationMember   |           30 |
| Registration         |           40 |

`Role` is a four-row lookup table. `UserRole` is a supporting many-to-many relationship table with 43 initial rows.

## Phase 2 interface

The Admin database page provides:

- Searchable views of all five major tables.
- Table row counts read from the database.
- Validated insert forms for each major table.
- Permanent delete actions with a confirmation dialog.
- Database-enforced uniqueness, checks, and foreign-key cascade behavior.
- Human-readable joined data, such as organization names, member names, opportunity titles, and registration counts.

The Overview and Opportunities pages also read joined data from the database. The previous NASA, Sentinel-2, NYC Open Data, and live map requests have been removed.

## Hosted and local database note

The hosted Sites runtime cannot open a raw MySQL TCP connection. Its deployment uses Cloudflare D1 with a compatibility migration that mirrors the table names, columns, relationships, constraints, and sample rows in the unchanged MySQL script. The GUI sends the same logical insert and delete operations to that database.

For the course submission, `volunteer_db.sql` remains the MySQL deliverable and can be run directly in MySQL Workbench. The compatibility migration is [`drizzle/0001_phase2_volunteer.sql`](drizzle/0001_phase2_volunteer.sql).

## Run the web app locally

```sh
npm install
npm run dev
```

The local Sites development identity uses the administrator email in `.env`. Production administrator access is restricted to the configured `TREEFINDER_ADMIN_EMAIL`.

Build with:

```sh
npm run build
```
