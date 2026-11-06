// Shared by the tile proxy (server) and the map legend (browser), so both use one color scale.

/** Tree canopy % → color. Low canopy on developed land is where trees are needed most. */
export const CANOPY_STOPS: [number, [number, number, number]][] = [
  [0, [178, 50, 38]],
  [15, [222, 105, 52]],
  [30, [240, 178, 70]],
  [45, [214, 214, 110]],
  [60, [120, 176, 96]],
  [100, [36, 110, 58]],
];

export function canopyColor(percent: number): [number, number, number] {
  const p = Math.min(100, Math.max(0, percent));
  for (let i = 1; i < CANOPY_STOPS.length; i++) {
    const [hi, to] = CANOPY_STOPS[i];
    if (p <= hi) {
      const [lo, from] = CANOPY_STOPS[i - 1];
      const t = (p - lo) / (hi - lo);
      return [0, 1, 2].map((c) => Math.round(from[c] + (to[c] - from[c]) * t)) as [number, number, number];
    }
  }
  return CANOPY_STOPS[CANOPY_STOPS.length - 1][1];
}

export const canopyGradient = `linear-gradient(to right, ${CANOPY_STOPS.filter(([p]) => p <= 60)
  .map(([p, [r, g, b]]) => `rgb(${r} ${g} ${b}) ${(p / 60) * 100}%`).join(", ")})`;

/** National Land Cover Database class codes. */
export const LAND_COVER: Record<number, string> = {
  11: "Open water", 12: "Perennial ice/snow",
  21: "Developed, open space", 22: "Developed, low intensity", 23: "Developed, medium intensity", 24: "Developed, high intensity",
  31: "Barren land", 41: "Deciduous forest", 42: "Evergreen forest", 43: "Mixed forest", 52: "Shrub/scrub",
  71: "Grassland", 81: "Pasture/hay", 82: "Cultivated crops", 90: "Woody wetlands", 95: "Emergent wetlands",
};
export const isDeveloped = (landCover: number | null) => landCover !== null && landCover >= 21 && landCover <= 24;
