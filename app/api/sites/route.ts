import type { ResultSetHeader } from "mysql2";
import { requireUser } from "@/lib/auth";
import { mapSearch, mapSnapshot } from "@/lib/map-data";
import { database } from "@/lib/server";

const STATUSES = ["Proposed", "Approved", "Planted"];

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

// Approving or marking an area planted is for arborists and admins.
export async function PATCH(request: Request) {
  const { denied } = await requireUser(request, "Admin", "Arborist");
  if (denied) return denied;
  try {
    const body = (await request.json()) as { id?: unknown; Status?: unknown };
    const id = Number(body.id), status = typeof body.Status === "string" ? body.Status : "";
    if (!Number.isInteger(id) || !STATUSES.includes(status)) return Response.json({ error: "Choose a site and a valid status." }, { status: 400 });
    const [result] = await database().execute<ResultSetHeader>("UPDATE PlantingSite SET Status=? WHERE SiteID=?", [status, id]);
    if (!result.affectedRows) return Response.json({ error: "Site not found." }, { status: 404 });
    return Response.json({ ok: true, snapshot: await mapSnapshot() });
  } catch (error) {
    console.error("MySQL update:", error);
    return Response.json({ error: "The site could not be updated." }, { status: 503 });
  }
}
