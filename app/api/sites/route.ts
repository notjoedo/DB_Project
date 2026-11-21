import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireUser } from "@/lib/auth";
import { errorCode, mapSearch, mapSnapshot } from "@/lib/map-data";
import { readPoint } from "@/lib/mrlc";
import { obstructionAt } from "@/lib/osm";
import { database } from "@/lib/server";

const STATUSES = ["Proposed", "Approved", "Planted"];
// A new area can't sit on top of an existing one; events within this distance link to it.
const SITE_RADIUS_METERS = 300;

interface NearbyRow extends RowDataPacket { Name: string }

/**
 * Propose a planting area anywhere in the lower 48. Any logged-in user can; it starts as
 * Proposed until an arborist approves it. Canopy and paved % come from NLCD at that point,
 * not from the user, and only developed land (streets, neighborhoods, parks) is accepted.
 * OpenStreetMap rules out roofs, sports fields, and water inside that developed land.
 */
export async function POST(request: Request) {
  const { user, denied } = await requireUser(request);
  if (denied) return denied;
  const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof data.Name === "string" ? data.Name.trim().slice(0, 100) : "";
  const lat = Number(data.Latitude), lng = Number(data.Longitude);
  const trees = Number(data.TreesNeeded), heat = Number(data.SurfaceTempF);
  if (!name || !(Math.abs(lat) <= 85) || !(Math.abs(lng) <= 180)) {
    return Response.json({ error: "Pick a spot on the map and give the area a name." }, { status: 400 });
  }
  if (!Number.isInteger(trees) || trees < 1 || trees > 1000) {
    return Response.json({ error: "Trees needed must be a whole number from 1 to 1000." }, { status: 400 });
  }
  if (!Number.isFinite(heat) || heat < 50 || heat > 140) {
    return Response.json({ error: "Summer surface temperature must be between 50°F and 140°F." }, { status: 400 });
  }

  let reading;
  try {
    reading = await readPoint(lat, lng);
  } catch (error) {
    console.error("Canopy lookup:", error);
    return Response.json({ error: "Tree canopy data is unavailable right now, so the area can't be scored. Try again soon." }, { status: 503 });
  }
  if (reading.canopy === null || reading.impervious === null) {
    return Response.json({ error: "There's no tree canopy data here. Planting areas must be in the lower 48 states." }, { status: 400 });
  }
  if (!reading.developed) {
    return Response.json({ error: `This spot is ${reading.landCover?.toLowerCase()}, not developed land. Pick a street, neighborhood, school, or park.` }, { status: 400 });
  }

  try {
    const obstruction = await obstructionAt(lat, lng);
    if (obstruction) {
      return Response.json({ error: `This spot is on ${obstruction}, where trees can't be planted. Try a lawn, a street strip, or the edge of a parking lot.` }, { status: 400 });
    }
  } catch (error) {
    // If OSM is down, don't block the proposal; an arborist still reviews every area.
    console.error("OSM lookup:", error);
  }

  try {
    const db = database();
    const [[nearby]] = await db.query<NearbyRow[]>(
      `SELECT Name FROM PlantingSite WHERE ST_Distance_Sphere(POINT(Longitude, Latitude), POINT(?, ?)) <= ? LIMIT 1`,
      [lng, lat, SITE_RADIUS_METERS]);
    if (nearby) return Response.json({ error: `This spot is already inside the planting area "${nearby.Name}".` }, { status: 409 });

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO PlantingSite (Name, Latitude, Longitude, CanopyCoverPct, ImperviousPct, SurfaceTempF, TreesNeeded, Status, SubmittedBy, SubmittedDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Proposed', ?, CURDATE())`,
      [name, lat.toFixed(6), lng.toFixed(6), reading.canopy, reading.impervious, heat.toFixed(1), trees, user.UserID]);
    return Response.json({ ok: true, id: result.insertId, snapshot: await mapSnapshot() });
  } catch (error) {
    console.error("MySQL insert:", error);
    if (errorCode(error) === "ER_DUP_ENTRY") return Response.json({ error: `A planting area named "${name}" already exists.` }, { status: 409 });
    return Response.json({ error: "The planting area could not be saved." }, { status: 503 });
  }
}

export async function GET(request: Request) {
  try {
    const text = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
    if (text) return Response.json({ matches: await mapSearch(text) });
    return Response.json(await mapSnapshot());
  } catch (error) {
    console.error("MySQL read:", error);
    return Response.json({ error: "Could not connect to MySQL. Start it with: npm run db:start" }, { status: 503 });
  }
}

/**
 * Arborist review (arborists and admins only):
 *   { id, Status }                     approve an area or mark it planted
 *   { id, TreesNeeded, SurfaceTempF }  correct the numbers a user proposed
 */
export async function PATCH(request: Request) {
  const { denied } = await requireUser(request, "Admin", "Arborist");
  if (denied) return denied;
  try {
    const body = (await request.json()) as { id?: unknown; Status?: unknown; TreesNeeded?: unknown; SurfaceTempF?: unknown };
    const id = Number(body.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Choose a site." }, { status: 400 });
    let result: ResultSetHeader;
    if (body.Status !== undefined) {
      const status = typeof body.Status === "string" ? body.Status : "";
      if (!STATUSES.includes(status)) return Response.json({ error: "Choose a valid status." }, { status: 400 });
      [result] = await database().execute<ResultSetHeader>("UPDATE PlantingSite SET Status=? WHERE SiteID=?", [status, id]);
    } else {
      const trees = Number(body.TreesNeeded), heat = Number(body.SurfaceTempF);
      if (!Number.isInteger(trees) || trees < 1 || trees > 1000) return Response.json({ error: "Trees needed must be a whole number from 1 to 1000." }, { status: 400 });
      if (!Number.isFinite(heat) || heat < 50 || heat > 140) return Response.json({ error: "Summer surface temperature must be between 50°F and 140°F." }, { status: 400 });
      [result] = await database().execute<ResultSetHeader>("UPDATE PlantingSite SET TreesNeeded=?, SurfaceTempF=? WHERE SiteID=?", [trees, heat.toFixed(1), id]);
    }
    if (!result.affectedRows) return Response.json({ error: "Site not found." }, { status: 404 });
    return Response.json({ ok: true, snapshot: await mapSnapshot() });
  } catch (error) {
    console.error("MySQL update:", error);
    return Response.json({ error: "The site could not be updated." }, { status: 503 });
  }
}

/**
 * Delete a planting area (arborists and admins only). Its tree recommendations are removed
 * with it (ON DELETE CASCADE); events held there stay but lose the link (ON DELETE SET NULL).
 */
export async function DELETE(request: Request) {
  const { denied } = await requireUser(request, "Admin", "Arborist");
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ error: "Choose a site." }, { status: 400 });
  try {
    const [result] = await database().execute<ResultSetHeader>("DELETE FROM PlantingSite WHERE SiteID=?", [id]);
    if (!result.affectedRows) return Response.json({ error: "Site not found." }, { status: 404 });
    return Response.json({ ok: true, snapshot: await mapSnapshot() });
  } catch (error) {
    console.error("MySQL delete:", error);
    return Response.json({ error: "The site could not be deleted." }, { status: 503 });
  }
}
