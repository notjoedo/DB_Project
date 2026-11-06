import { EMPTY_TILE, plantingNeedTile } from "@/lib/mrlc";

const headers = (maxAge: number) => ({ "Content-Type": "image/png", "Cache-Control": `public, max-age=${maxAge}` });

export async function GET(_request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await params;
  const [zoom, col, row] = [z, x, y].map(Number);
  if (![zoom, col, row].every(Number.isInteger) || zoom < 0 || zoom > 18 || col < 0 || row < 0 || col >= 2 ** zoom || row >= 2 ** zoom) {
    return new Response("Bad tile", { status: 400 });
  }
  try {
    return new Response(new Uint8Array(await plantingNeedTile(zoom, col, row)), { headers: headers(7 * 24 * 3600) });
  } catch (error) {
    console.error("Canopy tile:", error);
    // A blank tile keeps the map usable if MRLC is slow or down; retry soon.
    return new Response(new Uint8Array(EMPTY_TILE()), { headers: headers(60) });
  }
}
