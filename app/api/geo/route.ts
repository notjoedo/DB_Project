import { distance } from "@/lib/data";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (
    !p.has("lat") ||
    !p.has("lng") ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return Response.json(
      { error: "Valid coordinates are required." },
      { status: 400 },
    );
  try {
    const url = new URL(
      "https://data.cityofnewyork.us/resource/uvpi-gqnh.json",
    );
    url.searchParams.set(
      "$select",
      "tree_id,spc_common,latitude,longitude,health,status",
    );
    url.searchParams.set(
      "$where",
      `latitude between ${lat - 0.0032} and ${lat + 0.0032} AND longitude between ${lng - 0.0043} and ${lng + 0.0043}`,
    );
    url.searchParams.set("$limit", "500");
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("Census service unavailable");
    const trees = (await r.json()) as any[];
    const nearby = trees.filter(
      (t) =>
        distance(lat, lng, Number(t.latitude), Number(t.longitude)) <= 0.25,
    );
    const summary = {
      radius: 250,
      count: nearby.length,
      alive: nearby.filter((t) => t.status === "Alive").length,
      deadOrStump: nearby.filter((t) => ["Dead", "Stump"].includes(t.status))
        .length,
      capped: trees.length === 500,
    };
    return Response.json(
      {
        trees,
        summary,
        sourceUrl:
          "https://data.cityofnewyork.us/Environment/2015-Street-Tree-Census-Tree-Data/uvpi-gqnh",
        source: "NYC Parks 2015 Street Tree Census",
        year: 2015,
        limit: 500,
      },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "The NYC census layer is temporarily unavailable. Planting sites are still available.",
      },
      { status: 503 },
    );
  }
}
