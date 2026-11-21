// What OpenStreetMap says is at a point, so planting areas aren't proposed on a roof,
// a sports field, or a pond. NLCD's 30 m squares can't tell those apart from a lawn.
// Parking lots are allowed on purpose: islands and edges are prime planting spots.
// Overpass answers "what areas contain this point" exactly; if it can't be reached,
// Nominatim's nearest feature is used, but only when its outline contains the point.

const SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const USER_AGENT = "Treefinder volunteer map (student database project)";
const FIELDS = "pitch|track|stadium|swimming_pool|ice_rink";

type Element = { tags?: Record<string, string> };
type Ring = [number, number][];
type Geometry = { type: string; coordinates: unknown };

const cache = new Map<string, string | null>();

function describe(tags: Record<string, string>) {
  const name = tags.name ? ` (${tags.name})` : "";
  if (tags.building && tags.building !== "no") return `a building${name}`;
  if (tags.leisure === "pitch") return `a sports field${name}`;
  if (tags.leisure === "track") return `a running track${name}`;
  if (tags.leisure === "stadium") return `a stadium${name}`;
  if (tags.leisure === "swimming_pool") return `a swimming pool${name}`;
  if (tags.leisure === "ice_rink") return `an ice rink${name}`;
  if (tags.natural === "water") return `water${name}`;
  return null;
}

function insideRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point-in-polygon for GeoJSON Polygon/MultiPolygon (outer ring in, holes out). */
function contains(geometry: Geometry | undefined, lat: number, lng: number) {
  const polygons = geometry?.type === "Polygon" ? [geometry.coordinates as Ring[]]
    : geometry?.type === "MultiPolygon" ? (geometry.coordinates as Ring[][]) : [];
  return polygons.some(([outer, ...holes]) => insideRing(lng, lat, outer) && !holes.some((hole) => insideRing(lng, lat, hole)));
}

async function overpass(lat: number, lng: number) {
  const query = `[out:json][timeout:10];
is_in(${lat.toFixed(6)},${lng.toFixed(6)})->.a;
(
  way(pivot.a)[building][building!=no]; rel(pivot.a)[building][building!=no];
  way(pivot.a)[leisure~"^(${FIELDS})$"]; rel(pivot.a)[leisure~"^(${FIELDS})$"];
  way(pivot.a)[natural=water]; rel(pivot.a)[natural=water];
);
out tags;`;
  let lastError: unknown;
  for (const server of SERVERS) {
    try {
      const response = await fetch(server, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const result = (await response.json()) as { elements?: Element[] };
      return (result.elements ?? []).map((element) => describe(element.tags ?? {})).find(Boolean) ?? null;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// Nominatim allows one request per second.
let nextSlot = 0;
async function nominatim(lat: number, lng: number) {
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(Date.now(), nextSlot) + 1100;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
    format: "jsonv2", lat: lat.toFixed(6), lon: lng.toFixed(6), zoom: "18", polygon_geojson: "1", extratags: "1",
  })}`, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const result = (await response.json()) as { category?: string; type?: string; name?: string; geojson?: Geometry; extratags?: Record<string, string> };
  if (!contains(result.geojson, lat, lng) || !result.category || !result.type) return null;
  return describe({ ...result.extratags, [result.category]: result.type, ...(result.name ? { name: result.name } : {}) });
}

/**
 * The building, sports field, or water the point sits inside, as a short phrase
 * ("a building (Blacksburg High School)"), or null if none. Throws if OSM can't be reached.
 */
export async function obstructionAt(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key)!;
  let found: string | null;
  try {
    found = await overpass(lat, lng);
  } catch (error) {
    console.warn("Overpass unavailable, falling back to Nominatim:", error instanceof Error ? error.message : error);
    found = await nominatim(lat, lng);
  }
  cache.set(key, found);
  return found;
}
