export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const lat = Number(p.get("lat")),
    lng = Number(p.get("lng"));
  const date = p.get("date") ?? "";
  if (
    !p.has("lat") ||
    !p.has("lng") ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 18 ||
    lat > 72 ||
    !((lng >= -180 && lng <= -65) || (lng >= 172 && lng <= 180)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
    new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date
  ) {
    return Response.json(
      { error: "Choose a valid date and a location in the United States." },
      { status: 400 },
    );
  }
  try {
    const end = new Date(date + "T23:59:59Z"),
      start = new Date(end.getTime() - 60 * 86400000);
    const url = new URL("https://earth-search.aws.element84.com/v1/search");
    url.searchParams.set("collections", "sentinel-2-c1-l2a");
    url.searchParams.set(
      "bbox",
      [
        Math.max(-180, lng - 0.01),
        lat - 0.01,
        Math.min(180, lng + 0.01),
        lat + 0.01,
      ].join(","),
    );
    url.searchParams.set(
      "datetime",
      `${start.toISOString()}/${end.toISOString()}`,
    );
    url.searchParams.set("limit", "8");
    url.searchParams.set("sortby", "-properties.datetime");
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error();
    const j = (await r.json()) as any;
    const scenes = (j.features ?? []).map((f: any) => ({
      id: f.id,
      date: f.properties.datetime,
      cloudCover: f.properties["eo:cloud_cover"],
      url: `https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/${encodeURIComponent(f.id)}`,
      assets: {
        red: f.assets.red?.href,
        nir: f.assets.nir?.href,
        scl: f.assets.scl?.href,
      },
    }));
    return Response.json(
      {
        scenes,
        start: start.toISOString().slice(0, 10),
        end: date,
        resolution: 10,
      },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return Response.json(
      { error: "The satellite catalog is temporarily unavailable. Try again." },
      { status: 503 },
    );
  }
}
