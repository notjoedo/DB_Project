import { obstructionAt } from "@/lib/osm";

// Is a point on a building, sports field, or water? Used by the "Propose area" form.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
    return Response.json({ error: "Invalid location." }, { status: 400 });
  }
  try {
    return Response.json({ obstruction: await obstructionAt(lat, lng) }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (error) {
    console.error("OSM lookup:", error);
    return Response.json({ error: "Map feature lookup is unavailable right now." }, { status: 503 });
  }
}
