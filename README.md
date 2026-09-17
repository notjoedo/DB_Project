# Treefinder

A responsive tree information and stewardship app built with React, Vinext, Leaflet, and Cloudflare D1.

## Features

- Nationwide OpenStreetMap explorer with navigation for all 50 states and DC, geolocation, site search, priority filters, and local planting-site insights.
- Real NASA GIBS MODIS Terra NDVI overlay across the USA, including Alaska and Hawaii; published imagery dates, opacity control, official color legend, and explicit 250 m resolution.
- Public AWS Sentinel-2 Collection 1 L2A scene discovery near the map center, with acquisition dates, tile-wide cloud percentages, and source STAC records.
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

## Nationwide satellite coverage

`/api/vegetation` resolves NASA GIBS's published imagery dates from its official WMTS capabilities. Leaflet loads cached public map tiles directly from NASA's `MODIS_Terra_NDVI_8Day` layer. The source uses 250 m MODIS pixels and rolling 8-day observations. At close zoom, tiles are enlarged; no additional spatial detail is created. Missing dates are rejected and missing tiles are not interpreted as low vegetation. Coverage is national; individual pixels can be missing due to clouds, snow, or observation quality. Alaska and Hawaii have separate navigation entries; the layer is global and also supports the Aleutians across the date line.

`/api/satellite` searches Earth Search's `sentinel-2-c1-l2a` collection for the latest eight scenes intersecting a small map-center bounding box over the 60 days ending on the chosen date. It returns public red, NIR, and scene-classification asset URLs, acquisition dates, and scene-wide cloud cover. Scene discovery is not an NDVI computation, and the map's displayed NDVI remains NASA's 250 m product.

A custom nationwide 10 m Sentinel-2 preprocessing service is not deployed. It would run separately from the web request runtime: partition the USA into land-intersecting work units, read cloud-optimized GeoTIFF windows, apply each asset's reflectance scale/offset, mask clouds/shadows/snow/no-data with SCL, form seasonal multi-scene composites, and store NDVI plus valid-observation coverage as COGs and cached tiles. Use restartable jobs and a bounded concurrency budget. Raw imagery is openly accessible, while production compute, output storage, and delivery need an explicit infrastructure budget. Low NDVI alone cannot establish planting suitability; canopy, heat, plantable land, native range, utilities, and permissions are separate requirements.

Sources: [NASA GIBS](https://earthdata.nasa.gov/gibs), [public Sentinel-2 COGs](https://registry.opendata.aws/sentinel-2-l2a-cogs/), [Earth Search](https://github.com/Element84/earth-search).

## Data and geospatial limits

The initial six planting areas, canopy percentages, growing conditions, priorities, and three events are clearly labeled examples. They are not a current canopy assessment, confirmed planting sites, or real scheduled volunteer activities. Community-approved sites use reported conditions and do not display measured canopy. Hardiness values should be checked locally before planting.

The NYC census overlay contains historical 2015 survey records, fetched near the selected site with a 500-record cap. These records are not a real-time tree inventory. Matching scores reflect five equally weighted compatibility checks (zone, sunlight, soil texture, canopy width, moisture), not a scientific survival prediction. Local drainage, utility clearance, soil chemistry, and permits need professional assessment.

Botanical entries cite NC State Extension. Organization links point to the organizations' own sites and do not imply partnership. Image attribution is shown in the volunteering view.

No paid API keys are required for this version. Before large-scale production traffic, configure a commercial or self-hosted map tile provider to meet OpenStreetMap usage requirements. A city canopy raster, current inventory, heat-vulnerability layer, detailed soil survey, and municipal planting eligibility would support authoritative planting prioritization.

WebMCP exposes `explore_planting_site` where the browser supports it, using the same visible site selection and compatibility calculation.
