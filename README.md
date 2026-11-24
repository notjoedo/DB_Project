# Treefinder — Phase 2 MySQL Project

Treefinder is a web app that helps people find where trees need to be planted and organize volunteers to plant them. Everything is stored in a MySQL database, and all changes go through the app.

## What the app does

**Planting Map** (the home page)
- Shades developed land across the lower 48 states by tree cover, from red (no trees, plant here) to green (well shaded). The data comes from the 2021 National Land Cover Database from [MRLC](https://www.mrlc.gov/).
- Admins and Organizers can click the map to schedule a volunteer event for their organization. If the event is within 300 m of a planting area, it's linked to that area automatically.
- Anyone with an account can sign up for upcoming events, see who else is going, and search for events, organizations, volunteers, and planting areas.
- Planting areas are ranked by how much they need trees (the `SitePriority` view), and arborists move them from Proposed → Approved → Planted.

**Pages organized by task, not by table**
- **Manage Events:** edit or delete events, take attendance, and log volunteer hours.
- **Manage Organizations:** add people to an organization by name, set their role, and edit details.
- **Volunteer Requests:** new sign-ups start as Pending. Admins, and Organizers of the hosting organization, can accept or decline them.
- **Users and Roles** (Admin only): create accounts and grant or remove roles.
- **Reports:** five statistical reports for each type of user.

## Getting started

Make sure Docker Desktop is running, then:

```sh
npm install
npm run db:start
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The first time MySQL starts, it runs `sqlproject/volunteer_db.sql`. That creates the `volunteer_db` database with ten tables, the `SitePriority` view, all the constraints, and the sample data. `sqlproject/schema_export.sql` is the same schema exported straight from MySQL with `mysqldump`.

If your database was made before the map or accounts were added, run `npm run db:reset` once to pick up the new tables. The map's color layer needs an internet connection.

## Accounts and roles

Set up your environment file and create the first admin:

```sh
cp .env.example .env.local   # once, then set AUTH_SECRET to a long random value
npm run admin:init           # once, creates the first admin (asks for name, email, password)
```

`admin:init` is the only way to create an account outside the app, and it stops working once an admin exists. From then on, admins create accounts in **Users and Roles** with a temporary password, and grant or remove the Organizer, Arborist, and Admin roles there. Admins can't remove their own Admin role, so there's always at least one admin.

There are four types of users:

| Role | What they can do |
| --- | --- |
| User | View the map, sign up for events, see their own reports, and manage their profile |
| Organizer | Schedule and manage events for the organizations they belong to, and accept volunteer requests |
| Arborist | Approve, edit, mark planted, and delete planting areas |
| Admin | Everything above for every organization, plus managing users and roles |

Roles inside an organization (Member, Coordinator, Officer, Director) are just titles.

**Reports** gives each type of user five reports built with COUNT, SUM, AVG, MIN, and MAX: *My Volunteering* for everyone, *My Organizations* for people who schedule events, *Planting & Trees* for arborists, and a *Managerial Overview* for admins.

### How logging in works

- Passwords are hashed with scrypt, so no plain-text passwords are stored.
- When you log in, you get a short-lived access token (15 minutes) and a refresh token (7 days) kept in a secure cookie that page scripts can't read. The database only stores a hash of the refresh token.
- When the access token runs out, the app quietly swaps the refresh token for a new pair. If an old refresh token is ever reused, that user is signed out everywhere.
- Roles are checked against the database on every request, so role changes take effect right away.

## Useful commands

```sh
npm run db:start   # start MySQL
npm run db:stop    # stop MySQL
npm run db:reset   # wipe the local database and reload volunteer_db.sql
npm run dev        # start the web app
```

Heads up: `db:reset` deletes any changes in your local database before reloading the sample data.

## Sample data

| Table | Rows |
| --- | ---: |
| Organization | 20 |
| Users | 30 |
| VolunteerOpportunity | 25 |
| OrganizationMember | 30 |
| Registration | 40 |
| PlantingSite | 18 |
| TreeSpecies | 12 |
| SiteRecommendation | 36 |

Connection settings live in `.env.local`, and `.env.example` has example values.

## Group Roles

**Joe** - Verified the application against the evaluation criteria, testing each user type permissions and confirming changes made in the app appear in MySQL. Built the Reports page with five statistical reports per user type using COUNT, SUM, AVG, MIN, and MAX, and the npm run admin:init first-admin script.

**Lauren** - Built the Users and Roles page, where admins create accounts with a hashed temporary password, create other admins, grant or remove the Organizer, Arborist, and Admin roles, and delete accounts. Merged the team's work.

**Connor** - Built the Planting Map site proposal flow with OpenStreetMap checks for roofs, sports fields, and water, and the arborist features to approve, edit, mark planted, and delete planting areas. Updated the schema.

**Syon** - Built Manage Events (edit, delete, take attendance, log hours) and Manage Organizations (create organizations, add members by name, set their role), linked events to their hosting organizations, and restricted scheduling to Admins and Organizers of each organization. Made the interface operation-oriented by replacing the table-based Database Manager, made the layout scale to any screen size and took screenshots for the final phase slides.
