# Treefinder — Phase 2 MySQL Project

This is a small local web app for the Phase 2 database requirements. It has two parts:

- **Planting Map** (the home page) shows where trees need to be planted and lets people organize volunteer events there.
  - A color scale shades developed land across the lower 48 states by tree canopy, from red (no trees, plant here) to green (well shaded). It uses the 2021 National Land Cover Database from [MRLC](https://www.mrlc.gov/), recolored by `/api/canopy/tiles`.
  - Coordinators, Officers, and Directors of an organization (from `OrganizationMember`) can click the map to schedule a `VolunteerOpportunity` at that spot. Events within 300 m of a `PlantingSite` are linked to it automatically (`ST_Distance_Sphere`).
  - Users can sign up for upcoming events (`Registration`), see who else is going, and search events, organizations, volunteers, and planting areas.
  - Planting areas are ranked by the `SitePriority` view and can be moved from Proposed → Approved → Planted.
- **Database Manager** displays sample data and supports inserts and permanent deletes for the major tables.

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

Anyone can view the map. Signing up for events, scheduling events, and the profile page need an account; the Database Manager tabs need the **Admin** role.

```sh
cp .env.example .env.local          # once; then set AUTH_SECRET to a long random value
./scripts/set-admin.sh you@vt.edu                  # after registering in the app (--remove to undo)
./scripts/role.sh add you@vt.edu Organizer Arborist  # grant other roles
./scripts/role.sh list                             # who has extra roles
./scripts/role.sh remove you@vt.edu Arborist
```

The scripts run SQL inside the `treefinder-mysql` Docker container, so MySQL must be running (`npm run db:start`).

Roles are `User`, `Organizer`, `Arborist`, and `Admin` (the `Role`/`UserRole` tables). Admins can schedule events for any organization, Organizers for any organization they belong to, and everyone else only for organizations where they are a Coordinator, Officer, or Director (`OrganizationMember`). Approving or planting an area needs `Arborist` or `Admin`.

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
