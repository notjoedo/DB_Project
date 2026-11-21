# Treefinder — Phase 2 MySQL Project

This is a small local web app for the Phase 2 database requirements. It has two parts:

- **Planting Map** (the home page) shows where trees need to be planted and lets people organize volunteer events there.
  - A color scale shades developed land across the lower 48 states by tree canopy, from red (no trees, plant here) to green (well shaded). It uses the 2021 National Land Cover Database from [MRLC](https://www.mrlc.gov/), recolored by `/api/canopy/tiles`.
  - Organizers who belong to an organization (from `OrganizationMember`), and Admins, can click the map to schedule a `VolunteerOpportunity` at that spot. Events within 300 m of a `PlantingSite` are linked to it automatically (`ST_Distance_Sphere`).
  - Users can sign up for upcoming events (`Registration`), see who else is going, and search events, organizations, volunteers, and planting areas.
  - Planting areas are ranked by the `SitePriority` view and can be moved from Proposed → Approved → Planted.
- The rest of the app is organized by task, not by table:
  - **Manage Events**: edit or delete events, take attendance, and log volunteer hours.
  - **Manage Organizations**: add people to organizations, set their role in each, and edit details.
  - **Users and Roles** (Admin): create accounts and grant or remove roles.
  - **Reports**: five statistical reports per kind of user.

## Start the project

Docker Desktop must be running. Then use:

```sh
npm install
npm run db:start
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The MySQL container runs `sqlproject/volunteer_db.sql` automatically the first time it starts. The script creates the `volunteer_db` database, ten tables, the `SitePriority` view, constraints, and all sample data.

If your database was created before the planting map or accounts were added, run `npm run db:reset` once to load the new tables and columns. The canopy color scale needs an internet connection.

## Accounts and roles

Anyone can view the map. Signing up for events, scheduling events, Reports, and the profile page need an account; Users and Roles needs the **Admin** role, and Manage Events / Manage Organizations appear for people who run an organization.

```sh
cp .env.example .env.local   # once; then set AUTH_SECRET to a long random value
npm run admin:init           # once: create the first admin (prompts for name, email, password)
```

`admin:init` is the only account created outside the app, and it refuses to run once an admin exists. After that, admins use **Users and Roles** to create accounts (with a temporary password) and to grant or remove the Organizer, Arborist, and Admin roles. Admins can't remove their own Admin role, so there is always at least one.

**Reports** shows five statistical reports for each kind of user (using COUNT, SUM, AVG, MIN, and MAX): *My Volunteering* for everyone, *My Organizations* for people who schedule events, *Planting & Trees* for arborists, and a *Managerial Overview* for admins.

Roles are `User`, `Organizer`, `Arborist`, and `Admin` (the `Role`/`UserRole` tables). Admins can schedule and manage events for any organization, and Organizers for the organizations they belong to. Roles inside an organization (Member, Coordinator, Officer, Director) are titles only. Approving or planting an area needs `Arborist` or `Admin`.

- **Volunteer Requests page:** new sign-ups start as `Pending`. Admins, and Organizers for the organizations they belong to, see a *Volunteer Requests* tab listing pending sign-ups for that organization's upcoming events, and can accept (→ `Confirmed`) or decline (→ `Cancelled`) them.

How sessions work:
- Logging in returns a **15-minute access token** (a signed JWT). The browser keeps it in localStorage and sends it as `Authorization: Bearer ...`.
- A **7-day refresh token** is set as an httpOnly, SameSite=Strict cookie that page scripts can't read. The database stores only its SHA-256 hash (`RefreshToken` table).
- When the access token expires, the app calls `/api/auth/refresh`, which revokes the old refresh token and issues a new one (rotation). Reusing an old refresh token signs that user out everywhere.
- Passwords are hashed with scrypt. Roles are re-read from the database on every request, so role changes apply immediately.

## Useful commands

```sh
npm run db:start   # start MySQL
npm run db:stop    # stop MySQL
npm run db:reset   # erase the local database and rerun volunteer_db.sql
npm run dev        # start the web app
```

`db:reset` permanently deletes local database changes before recreating the sample data.

## Sample data

| Major table | Rows |
| --- | ---: |
| Organization | 20 |
| Users | 30 |
| VolunteerOpportunity | 25 |
| OrganizationMember | 30 |
| Registration | 40 |
| PlantingSite | 18 |
| TreeSpecies | 12 |
| SiteRecommendation | 36 |

The connection settings are in `.env.local`. Example values are provided in `.env.example`.
