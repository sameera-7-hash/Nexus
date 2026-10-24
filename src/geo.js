// The engine plans on a 10 km x 10 km grid (x east, y south, in km). This lays that grid over Pune so
// every site, rider and pickup pin has a real spot. The only lat/lng <-> grid conversion in NEXUS:
// the coordinator map and the engine both use it. Pure, no DOM.
export const GRID_KM = 10;
const KM_PER_DEG_LAT = 110.6;
const KM_PER_DEG_LNG = 104.9; // at Pune's latitude
// North-west corner of the grid: 5 km north and west of Pune city centre (18.5204, 73.8567).
const NW = { lat: 18.5204 + 5 / KM_PER_DEG_LAT, lng: 73.8567 - 5 / KM_PER_DEG_LNG };

export const toLatLng = ({ x, y }) => [NW.lat - y / KM_PER_DEG_LAT, NW.lng + x / KM_PER_DEG_LNG];
export const toGrid = ({ lat, lng }) => ({ x: (lng - NW.lng) * KM_PER_DEG_LNG, y: (NW.lat - lat) * KM_PER_DEG_LAT });
export const inGrid = ({ x, y }) => x >= 0 && x <= GRID_KM && y >= 0 && y <= GRID_KM;
