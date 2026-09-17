import { ndviLayer } from "@/lib/national";
let cache: { expires: number; value: unknown } | null = null;
// Resolve NASA's current published date rather than assuming today's imagery exists.
export async function GET() {
  try {
    if (cache && cache.expires > Date.now())
      return Response.json(cache.value, {
        headers: { "Cache-Control": "public, max-age=21600" },
      });
    const r = await fetch(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities",
      { signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) throw new Error();
    const xml = await r.text();
    const layer = xml
      .split("<Layer>")
      .find((part) =>
        part.includes(`<ows:Identifier>${ndviLayer}</ows:Identifier>`),
      )
      ?.split("</Layer>")[0];
    const date = layer?.match(/<Default>(\d{4}-\d{2}-\d{2})<\/Default>/)?.[1];
    const ranges = [
      ...(layer ?? "").matchAll(
        /<Value>(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})\/P1D<\/Value>/g,
      ),
    ].map((m) => ({ start: m[1], end: m[2] }));
    if (!date || !ranges.length) throw new Error();
    const value = {
      date,
      ranges,
      resolution: 250,
      period: "Rolling 8-day",
      source: "NASA GIBS · MODIS Terra",
    };
    cache = { expires: Date.now() + 21600000, value };
    return Response.json(value, {
      headers: { "Cache-Control": "public, max-age=21600" },
    });
  } catch {
    return Response.json(
      { error: "NASA's imagery dates are temporarily unavailable. Try again." },
      { status: 503 },
    );
  }
}
