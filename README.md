# Treefinder

A responsive tree information and stewardship app built with React, Vinext, Leaflet, and Cloudflare D1.

## Features

- Interactive OpenStreetMap map, priority filters, neighborhood search, geolocation, and planting-site insights.
- Optional historical NYC Parks 2015 street-tree census overlay from NYC Open Data.
- Native species catalog with sunlight, size, and hardiness filters; botanical sources; wildlife information; transparent five-factor site matching; one favorite-tree vote per account.
- Event registration and cancellation, volunteer profiles, participation history, and administrator-reviewed hours.
- Community questions and replies with server-assigned verified arborist badges.
- Planting site, species, organization, and event submissions; arborist care guides; approval and moderation queues.
- Server-side role enforcement and ChatGPT sign-in. Initial administrator is allowlisted through the `TREEFINDER_ADMIN_EMAIL` runtime variable, configured to the verified Site owner at deployment.

## Run locally

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env` for the local mock admin. Local sign-in at `/signin-with-chatgpt?return_to=/` uses the starter's development identity only. Production uses platform authentication, with no local mock sign-in.

Generate migrations with `npm run db:generate`, build with `npm run build`, then apply each new migration once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_brainy_karma.sql
```

Hosted D1 migrations are applied by Sites during deployment. Database writes use prepared statements and are attributed to authenticated identities. Browser storage is not used for authoritative records.

## Data and geospatial limits

The initial six planting areas, canopy percentages, growing conditions, priorities, and three events are clearly labeled examples. They are not a current canopy assessment, confirmed planting sites, or real scheduled volunteer activities. Community-approved sites use reported conditions and do not display measured canopy. Hardiness values should be checked locally before planting.

The NYC census overlay contains historical 2015 survey records, fetched near the selected site with a 500-record cap. These records are not a real-time tree inventory. Matching scores reflect five equally weighted compatibility checks (zone, sunlight, soil texture, canopy width, moisture), not a scientific survival prediction. Local drainage, utility clearance, soil chemistry, and permits need professional assessment.

Botanical entries cite NC State Extension. Organization links point to the organizations' own sites and do not imply partnership. Image attribution is shown in the volunteering view.

No paid API keys are required for this version. Before large-scale production traffic, configure a commercial or self-hosted map tile provider to meet OpenStreetMap usage requirements. A city canopy raster, current inventory, heat-vulnerability layer, detailed soil survey, and municipal planting eligibility would support authoritative planting prioritization.

WebMCP exposes `explore_planting_site` where the browser supports it, using the same visible site selection and compatibility calculation.
