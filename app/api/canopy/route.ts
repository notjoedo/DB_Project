import { readPoint } from "@/lib/mrlc";

// Tree canopy %, impervious %, land cover, and planting need at one point
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
    return Response.json({ error: "Invalid location." }, { status: 400 });
  }
  try {
    return Response.json(await readPoint(lat, lng), { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (error) {
    console.error("Canopy lookup:", error);
    return Response.json({ error: "Tree canopy data is unavailable right now." }, { status: 503 });
  }
}
