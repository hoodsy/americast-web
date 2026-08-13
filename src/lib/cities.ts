/**
 * Major California cities, as labels only — no marks. They are here to orient
 * the reader on a map that has no basemap, not to add data. The set is chosen
 * for spread rather than population: a dozen dots around Los Angeles would
 * anchor nothing, while Redding, Eureka and El Centro tell you where you are.
 *
 * `tier` 1 shows at every zoom; tier 2 appears once there is room for it.
 */
export interface City {
  name: string;
  longitude: number;
  latitude: number;
  tier: 1 | 2;
}

export const CITIES: City[] = [
  { name: 'Los Angeles', longitude: -118.2437, latitude: 34.0522, tier: 1 },
  { name: 'San Diego', longitude: -117.1611, latitude: 32.7157, tier: 1 },
  { name: 'San Francisco', longitude: -122.4194, latitude: 37.7749, tier: 1 },
  { name: 'San Jose', longitude: -121.8863, latitude: 37.3382, tier: 1 },
  { name: 'Sacramento', longitude: -121.4944, latitude: 38.5816, tier: 1 },
  { name: 'Fresno', longitude: -119.7871, latitude: 36.7378, tier: 1 },
  { name: 'Bakersfield', longitude: -119.0187, latitude: 35.3733, tier: 1 },
  { name: 'Redding', longitude: -122.3917, latitude: 40.5865, tier: 1 },

  { name: 'Eureka', longitude: -124.1637, latitude: 40.8021, tier: 2 },
  { name: 'Stockton', longitude: -121.2908, latitude: 37.9577, tier: 2 },
  { name: 'Modesto', longitude: -120.9969, latitude: 37.6391, tier: 2 },
  { name: 'San Luis Obispo', longitude: -120.6596, latitude: 35.2828, tier: 2 },
  { name: 'Santa Barbara', longitude: -119.6982, latitude: 34.4208, tier: 2 },
  { name: 'Barstow', longitude: -117.0173, latitude: 34.8958, tier: 2 },
  { name: 'Riverside', longitude: -117.3962, latitude: 33.9533, tier: 2 },
  { name: 'Palm Springs', longitude: -116.5453, latitude: 33.8303, tier: 2 },
  { name: 'El Centro', longitude: -115.5631, latitude: 32.792, tier: 2 },
];
