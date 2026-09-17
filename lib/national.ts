/** Approximate state centers for navigation, not boundaries or planting assessments. */
export const stateViews = [
  ["AL", "Alabama", 32.8, -86.8, 6],
  ["AK", "Alaska", 64, -152, 4],
  ["AZ", "Arizona", 34.2, -111.7, 6],
  ["AR", "Arkansas", 34.9, -92.4, 6],
  ["CA", "California", 37.2, -119.5, 5],
  ["CO", "Colorado", 39, -105.5, 6],
  ["CT", "Connecticut", 41.6, -72.7, 8],
  ["DE", "Delaware", 39, -75.5, 8],
  ["FL", "Florida", 28, -82, 6],
  ["GA", "Georgia", 32.6, -83.4, 6],
  ["HI", "Hawaii", 20.8, -156.4, 6],
  ["ID", "Idaho", 44.4, -114.6, 5],
  ["IL", "Illinois", 40, -89.2, 6],
  ["IN", "Indiana", 40, -86.2, 6],
  ["IA", "Iowa", 42.1, -93.5, 6],
  ["KS", "Kansas", 38.5, -98, 6],
  ["KY", "Kentucky", 37.5, -85.3, 6],
  ["LA", "Louisiana", 31, -92, 6],
  ["ME", "Maine", 45.2, -69, 6],
  ["MD", "Maryland", 39, -76.7, 7],
  ["MA", "Massachusetts", 42.3, -71.8, 7],
  ["MI", "Michigan", 44.3, -85.6, 6],
  ["MN", "Minnesota", 46, -94.5, 6],
  ["MS", "Mississippi", 32.7, -89.7, 6],
  ["MO", "Missouri", 38.5, -92.5, 6],
  ["MT", "Montana", 47, -110, 5],
  ["NE", "Nebraska", 41.5, -99.8, 6],
  ["NV", "Nevada", 39.4, -116.6, 5],
  ["NH", "New Hampshire", 43.8, -71.6, 7],
  ["NJ", "New Jersey", 40.1, -74.6, 7],
  ["NM", "New Mexico", 34.5, -106, 6],
  ["NY", "New York", 43, -75.5, 6],
  ["NC", "North Carolina", 35.5, -79.8, 6],
  ["ND", "North Dakota", 47.5, -100.5, 6],
  ["OH", "Ohio", 40.4, -82.8, 6],
  ["OK", "Oklahoma", 35.5, -97.5, 6],
  ["OR", "Oregon", 44, -120.5, 6],
  ["PA", "Pennsylvania", 41, -77.5, 6],
  ["RI", "Rhode Island", 41.7, -71.5, 9],
  ["SC", "South Carolina", 33.8, -80.9, 7],
  ["SD", "South Dakota", 44.4, -100.2, 6],
  ["TN", "Tennessee", 35.8, -86.3, 6],
  ["TX", "Texas", 31.5, -99.3, 5],
  ["UT", "Utah", 39.3, -111.7, 6],
  ["VT", "Vermont", 44, -72.7, 7],
  ["VA", "Virginia", 37.5, -79, 6],
  ["WA", "Washington", 47.4, -120.7, 6],
  ["WV", "West Virginia", 38.6, -80.6, 7],
  ["WI", "Wisconsin", 44.5, -89.8, 6],
  ["WY", "Wyoming", 43, -107.5, 6],
  ["DC", "District of Columbia", 38.9, -77.04, 11],
].map(([code, name, lat, lng, zoom]) => ({
  code: String(code),
  name: String(name),
  lat: Number(lat),
  lng: Number(lng),
  zoom: Number(zoom),
}));
export type MapTarget = {
  lat: number;
  lng: number;
  zoom: number;
  label: string;
};
export const nationalView: MapTarget = {
  lat: 38.5,
  lng: -97,
  zoom: 4,
  label: "United States",
};
export const ndviLayer = "MODIS_Terra_NDVI_8Day";
export const ndviTileUrl = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${ndviLayer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;
