import { LAND_COVER, isDeveloped } from "@/lib/canopy";
import { CANOPY_LAYER, LAND_COVER_LAYER, pointValue } from "@/lib/mrlc";

// Tree canopy % and land cover at one point, from the National Land Cover Database.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
    return Response.json({ error: "Invalid location." }, { status: 400 });
  }
  try {
    const [canopy, landCover] = await Promise.all([pointValue(CANOPY_LAYER, lat, lng), pointValue(LAND_COVER_LAYER, lat, lng)]);
    const covered = landCover !== null && landCover in LAND_COVER;
    return Response.json({
      canopy: covered && canopy !== null && canopy <= 100 ? canopy : null,
      landCover: covered ? LAND_COVER[landCover] : null,
      developed: isDeveloped(landCover),
    }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (error) {
    console.error("Canopy lookup:", error);
    return Response.json({ error: "Tree canopy data is unavailable right now." }, { status: 503 });
  }
}
