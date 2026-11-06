// Street address for a map point, via OpenStreetMap's Nominatim reverse geocoder.
// Nominatim asks for at most one request per second and an identifying User-Agent,
// so lookups are throttled and cached here instead of called from the browser.

type Address = Partial<Record<"house_number" | "road" | "pedestrian" | "footway" | "neighbourhood" | "suburb" | "city" | "town" | "village" | "hamlet" | "state", string>>;

const cache = new Map<string, string | null>();
let nextSlot = 0;

async function throttle() {
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(Date.now(), nextSlot) + 1100;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

function label(name: string | undefined, address: Address) {
  const street = address.road ?? address.pedestrian ?? address.footway;
  const line = street ? [address.house_number, street].filter(Boolean).join(" ") : name || address.neighbourhood || address.suburb;
  const place = address.city ?? address.town ?? address.village ?? address.hamlet;
  return [line, place].filter(Boolean).join(", ").slice(0, 150) || null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "Invalid location." }, { status: 400 });
  }
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (!cache.has(key)) {
    try {
      await throttle();
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
        format: "jsonv2", lat: lat.toFixed(6), lon: lng.toFixed(6), zoom: "18", addressdetails: "1",
      })}`, { headers: { "User-Agent": "Treefinder volunteer map (student database project)", "Accept-Language": "en" } });
      if (!response.ok) throw new Error(`Nominatim ${response.status}`);
      const result = (await response.json()) as { name?: string; address?: Address };
      cache.set(key, result.address ? label(result.name, result.address) : null);
    } catch (error) {
      console.error("Reverse geocode:", error);
      return Response.json({ error: "Address lookup is unavailable right now." }, { status: 503 });
    }
  }
  return Response.json({ address: cache.get(key) }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
