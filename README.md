# Treefinder — Phase 2 MySQL Project

This is a small local web app for the Phase 2 database requirements. It displays sample data and supports inserts and permanent deletes for the five major tables.

## Start the project

Docker Desktop must be running. Then use:

```sh
npm install
npm run db:start
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The MySQL container runs `sqlproject/volunteer_db.sql` automatically the first time it starts. The script creates the `volunteer_db` database, seven tables, constraints, and all sample data.

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

The connection settings are in `.env.local`. Example values are provided in `.env.example`.
