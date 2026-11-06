import { crc32, deflateSync, inflateSync } from "node:zlib";
import { canopyColor } from "./canopy";

// MRLC hosts the National Land Cover Database (NLCD) for the lower 48 states.
const WMS = "https://www.mrlc.gov/geoserver/mrlc_display/wms";
export const CANOPY_LAYER = "nlcd_tcc_conus_2021_v2021-4";
export const LAND_COVER_LAYER = "NLCD_2021_Land_Cover_L48";
const EDGE = 20037508.342789244;
const TILE = 256;
const NO_DATA = 101;

// Developed land-cover classes as MRLC colors them in rendered tiles.
const DEVELOPED_RGB = new Set(["221,201,201", "216,147,130", "237,0,0", "170,0,0"]);

function wmsUrl(params: Record<string, string>) {
  return `${WMS}?${new URLSearchParams({ service: "WMS", version: "1.1.1", srs: "EPSG:3857", styles: "", ...params })}`;
}

/** Web Mercator bounds of a slippy-map tile. */
export function tileBounds(z: number, x: number, y: number) {
  const size = (2 * EDGE) / 2 ** z;
  const minX = -EDGE + x * size, maxY = EDGE - y * size;
  return [minX, maxY - size, minX + size, maxY];
}

/** A small box around a lat/lng in Web Mercator, for point queries. */
export function pointBounds(lat: number, lng: number, meters = 15) {
  const x = (lng * EDGE) / 180;
  const y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * (EDGE / Math.PI);
  return [x - meters, y - meters, x + meters, y + meters];
}

async function fetchTile(layer: string, bbox: number[]) {
  const response = await fetch(wmsUrl({
    request: "GetMap", layers: layer, bbox: bbox.join(","), width: String(TILE), height: String(TILE), format: "image/png", transparent: "true",
  }));
  if (!response.ok || response.headers.get("content-type") !== "image/png") throw new Error(`MRLC ${layer} ${response.status}`);
  return decodeIndexedPng(Buffer.from(await response.arrayBuffer()));
}

/** Raw pixel value (canopy % or land-cover class) at a point. */
export async function pointValue(layer: string, lat: number, lng: number) {
  const response = await fetch(wmsUrl({
    request: "GetFeatureInfo", layers: layer, query_layers: layer, bbox: pointBounds(lat, lng).join(","),
    width: "3", height: "3", x: "1", y: "1", info_format: "application/json",
  }));
  if (!response.ok) throw new Error(`MRLC ${layer} ${response.status}`);
  const result = (await response.json()) as { features?: { properties?: { PALETTE_INDEX?: number } }[] };
  const value = result.features?.[0]?.properties?.PALETTE_INDEX;
  return typeof value === "number" ? value : null;
}

/**
 * Canopy tile recolored as "where trees are needed": developed land is colored by its
 * canopy %, everything else (forest, farmland, water, outside the US) is transparent.
 */
export async function plantingNeedTile(z: number, x: number, y: number) {
  const bbox = tileBounds(z, x, y);
  const [canopy, landCover] = await Promise.all([fetchTile(CANOPY_LAYER, bbox), fetchTile(LAND_COVER_LAYER, bbox)]);
  const developed = new Set<number>();
  landCover.palette.forEach((rgb, index) => { if (DEVELOPED_RGB.has(rgb.join(","))) developed.add(index); });
  const pixels = Buffer.alloc(TILE * TILE, NO_DATA);
  for (let i = 0; i < pixels.length; i++) {
    // In the canopy tiles, palette index N is N% canopy (0–100).
    if (developed.has(landCover.pixels[i]) && canopy.pixels[i] <= 100) pixels[i] = canopy.pixels[i];
  }
  return encodeIndexedPng(pixels);
}

export const EMPTY_TILE = () => encodeIndexedPng(Buffer.alloc(TILE * TILE, NO_DATA));

// --- Minimal 8-bit palette PNG codec (MRLC serves paletted PNGs) ---

function decodeIndexedPng(png: Buffer) {
  let offset = 8, width = 0, height = 0, palette: number[][] = [];
  const data: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset), type = png.toString("ascii", offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 3 || body[12] !== 0) throw new Error("Unsupported PNG format");
    } else if (type === "PLTE") {
      palette = Array.from({ length: length / 3 }, (_, i) => [body[i * 3], body[i * 3 + 1], body[i * 3 + 2]]);
    } else if (type === "IDAT") data.push(body);
    offset += 12 + length;
  }
  if (width !== TILE || height !== TILE) throw new Error("Unexpected tile size");
  const raw = inflateSync(Buffer.concat(data));
  const pixels = Buffer.alloc(width * height);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (width + 1)], start = row * (width + 1) + 1, out = row * width;
    for (let col = 0; col < width; col++) {
      const left = col ? pixels[out + col - 1] : 0, up = row ? pixels[out - width + col] : 0, upLeft = row && col ? pixels[out - width + col - 1] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft, pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      pixels[out + col] = (raw[start + col] + predictor) & 255;
    }
  }
  return { palette, pixels };
}

function chunk(type: string, body: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
  return Buffer.concat([head, body, crc]);
}

const HEADER = (() => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(TILE, 0); ihdr.writeUInt32BE(TILE, 4);
  ihdr[8] = 8; ihdr[9] = 3;
  const palette = Buffer.alloc((NO_DATA + 1) * 3), alpha = Buffer.alloc(NO_DATA + 1, 255);
  for (let p = 0; p <= 100; p++) palette.set(canopyColor(p), p * 3);
  alpha[NO_DATA] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("PLTE", palette), chunk("tRNS", alpha)]);
})();

function encodeIndexedPng(pixels: Buffer) {
  const raw = Buffer.alloc(TILE * (TILE + 1));
  for (let row = 0; row < TILE; row++) pixels.copy(raw, row * (TILE + 1) + 1, row * TILE, (row + 1) * TILE);
  return Buffer.concat([HEADER, chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
