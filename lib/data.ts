export type Species = {
  id: string;
  name: string;
  latin: string;
  habit: string;
  height: number;
  width: number;
  zone: [number, number];
  sun: string[];
  soil: string[];
  water: string;
  native: string;
  wildlife: string;
  description: string;
  source: string;
};
export const species: Species[] = [
  {
    id: "swamp-oak",
    name: "Swamp white oak",
    latin: "Quercus bicolor",
    habit: "Broad, rounded canopy",
    height: 60,
    width: 60,
    zone: [4, 8],
    sun: ["Full sun"],
    soil: ["Clay", "Loam", "Sand"],
    water: "Moist",
    native: "Eastern North America",
    wildlife:
      "Acorns feed birds and small mammals; oak foliage supports moth and butterfly caterpillars.",
    description:
      "A long-lived shade tree with a broad crown. Adaptable to periodically wet ground, with ample room for roots and a mature canopy.",
    source: "https://plants.ces.ncsu.edu/plants/quercus-bicolor/",
  },
  {
    id: "red-maple",
    name: "Red maple",
    latin: "Acer rubrum",
    habit: "Upright, oval canopy",
    height: 120,
    width: 50,
    zone: [2, 9],
    sun: ["Full sun", "Partial shade"],
    soil: ["Clay", "Loam", "Sand"],
    water: "Moist",
    native: "Eastern North America",
    wildlife:
      "Early flowers support bees; seeds provide food for birds and squirrels.",
    description:
      "A deciduous shade tree known for autumn color. Prefers moist, acidic soil; site and cultivar selection influence performance.",
    source: "https://plants.ces.ncsu.edu/plants/acer-rubrum/",
  },
  {
    id: "redbud",
    name: "Eastern redbud",
    latin: "Cercis canadensis",
    habit: "Small, spreading tree",
    height: 30,
    width: 35,
    zone: [4, 9],
    sun: ["Full sun", "Partial shade"],
    soil: ["Clay", "Loam", "Sand"],
    water: "Moderate",
    native: "Eastern North America",
    wildlife:
      "Spring blossoms attract bees and butterflies; foliage supports specialist caterpillars.",
    description:
      "An understory tree with pink spring flowers. Plant in a sheltered position with well-drained soil and consistent establishment watering.",
    source: "https://plants.ces.ncsu.edu/plants/cercis-canadensis/",
  },
  {
    id: "serviceberry",
    name: "Downy serviceberry",
    latin: "Amelanchier arborea",
    habit: "Small tree or multi-stem shrub",
    height: 25,
    width: 15,
    zone: [4, 9],
    sun: ["Full sun", "Partial shade"],
    soil: ["Loam", "Sand", "Clay"],
    water: "Moderate",
    native: "Eastern North America",
    wildlife:
      "Flowers feed spring pollinators; summer berries attract songbirds.",
    description:
      "A compact native tree with white spring blossoms, summer fruit, and colorful autumn foliage. Suited to smaller, well-drained planting spaces.",
    source: "https://plants.ces.ncsu.edu/plants/amelanchier-arborea/",
  },
  {
    id: "river-birch",
    name: "River birch",
    latin: "Betula nigra",
    habit: "Upright, often multi-stemmed",
    height: 70,
    width: 60,
    zone: [4, 9],
    sun: ["Full sun", "Partial shade"],
    soil: ["Clay", "Loam", "Sand"],
    water: "Moist",
    native: "Eastern United States",
    wildlife: "Seeds feed birds; leaves support butterfly and moth larvae.",
    description:
      "A fast-growing tree with peeling bark. Prefers moist, acidic soil and a generous planting space.",
    source: "https://plants.ces.ncsu.edu/plants/betula-nigra/",
  },
  {
    id: "black-gum",
    name: "Black gum",
    latin: "Nyssa sylvatica",
    habit: "Pyramidal, then rounded",
    height: 70,
    width: 36,
    zone: [4, 9],
    sun: ["Full sun"],
    soil: ["Clay", "Loam", "Sand"],
    water: "Moderate",
    native: "Eastern North America",
    wildlife: "Flowers support bees; fruit is eaten by migratory songbirds.",
    description:
      "A native shade tree with brilliant fall foliage. Prefers acidic, moist but well-drained soils.",
    source: "https://plants.ces.ncsu.edu/plants/nyssa-sylvatica/",
  },
];
export type Site = {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  priority: string;
  soil: string;
  sun: string;
  water: string;
  space: number;
  zone: number;
  canopy: number;
  status: string;
  example?: boolean;
};
export const sites: Site[] = [
  {
    id: "bed-stuy",
    name: "Bedford–Stuyvesant",
    area: "Brooklyn · Street planting",
    lat: 40.6878,
    lng: -73.9412,
    priority: "High",
    soil: "Loam",
    sun: "Full sun",
    water: "Moderate",
    space: 40,
    zone: 7,
    canopy: 12,
    status: "Needs assessment",
    example: true,
  },
  {
    id: "bushwick",
    name: "Bushwick green corridor",
    area: "Brooklyn · Community space",
    lat: 40.6966,
    lng: -73.921,
    priority: "High",
    soil: "Clay",
    sun: "Full sun",
    water: "Moist",
    space: 65,
    zone: 7,
    canopy: 9,
    status: "Needs assessment",
    example: true,
  },
  {
    id: "crown-heights",
    name: "Crown Heights",
    area: "Brooklyn · Street planting",
    lat: 40.6719,
    lng: -73.945,
    priority: "High",
    soil: "Loam",
    sun: "Partial shade",
    water: "Moderate",
    space: 35,
    zone: 7,
    canopy: 14,
    status: "Needs assessment",
    example: true,
  },
  {
    id: "fort-greene",
    name: "Fort Greene neighborhood",
    area: "Brooklyn · Park edge",
    lat: 40.6922,
    lng: -73.9745,
    priority: "Medium",
    soil: "Loam",
    sun: "Partial shade",
    water: "Moderate",
    space: 30,
    zone: 7,
    canopy: 24,
    status: "Needs assessment",
    example: true,
  },
  {
    id: "williamsburg",
    name: "Williamsburg waterfront",
    area: "Brooklyn · Community space",
    lat: 40.713,
    lng: -73.966,
    priority: "Medium",
    soil: "Sand",
    sun: "Full sun",
    water: "Moderate",
    space: 45,
    zone: 7,
    canopy: 20,
    status: "Needs assessment",
    example: true,
  },
  {
    id: "prospect",
    name: "Prospect Park perimeter",
    area: "Brooklyn · Park edge",
    lat: 40.6605,
    lng: -73.9695,
    priority: "Low",
    soil: "Loam",
    sun: "Partial shade",
    water: "Moist",
    space: 65,
    zone: 7,
    canopy: 38,
    status: "Needs assessment",
    example: true,
  },
];
export const opportunities = [
  {
    id: "plant-day",
    title: "Neighborhood planting day",
    org: "Treefinder Community",
    place: "Bedford–Stuyvesant, Brooklyn",
    date: "2026-10-03",
    time: "9:00 AM – 12:00 PM",
    hours: 3,
    type: "Tree planting",
    example: true,
  },
  {
    id: "tree-care",
    title: "Give our street trees a little care",
    org: "Treefinder Community",
    place: "Fort Greene, Brooklyn",
    date: "2026-10-10",
    time: "10:00 AM – 12:00 PM",
    hours: 2,
    type: "Tree care",
    example: true,
  },
  {
    id: "inventory",
    title: "Community tree inventory walk",
    org: "Treefinder Community",
    place: "Crown Heights, Brooklyn",
    date: "2026-10-17",
    time: "9:00 AM – 11:00 AM",
    hours: 2,
    type: "Survey",
    example: true,
  },
];
export const groups = [
  {
    name: "Trees New York",
    focus: "Tree stewardship & education",
    url: "https://treesny.org/",
  },
  {
    name: "NYC Parks Stewardship",
    focus: "Volunteer in local parks and natural areas",
    url: "https://www.nycgovparks.org/events/volunteer",
  },
  {
    name: "New York Restoration Project",
    focus: "Community gardens & urban green spaces",
    url: "https://www.nyrp.org/",
  },
];
export function matchTree(tree: Species, site: Site) {
  const checks = [
    {
      name: "Climate zone",
      ok: site.zone >= tree.zone[0] && site.zone <= tree.zone[1],
    },
    { name: "Sunlight", ok: tree.sun.includes(site.sun) },
    { name: "Soil type", ok: tree.soil.includes(site.soil) },
    { name: "Canopy space", ok: tree.width <= site.space },
    { name: "Water needs", ok: tree.water === site.water },
  ];
  return { score: checks.filter((x) => x.ok).length * 20, checks };
}
export function distance(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((c - a) * rad) / 2) ** 2 +
    Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
