// Static [lng, lat] for the metros used by the seed loadboard. Keeping this
// local (rather than calling a geocoder at runtime) makes the lane map work
// offline and inside the private deployment with zero external dependencies.
// Keys match the `origin`/`destination` strings stored on loads ("City, ST").
export const CITY_COORDS: Record<string, [number, number]> = {
  "Atlanta, GA": [-84.388, 33.749],
  "Boston, MA": [-71.0589, 42.3601],
  "Chicago, IL": [-87.6298, 41.8781],
  "Dallas, TX": [-96.797, 32.7767],
  "Denver, CO": [-104.9903, 39.7392],
  "Houston, TX": [-95.3698, 29.7604],
  "Kansas City, MO": [-94.5786, 39.0997],
  "Los Angeles, CA": [-118.2437, 34.0522],
  "Memphis, TN": [-90.049, 35.1495],
  "Miami, FL": [-80.1918, 25.7617],
  "Minneapolis, MN": [-93.265, 44.9778],
  "Nashville, TN": [-86.7816, 36.1627],
  "Newark, NJ": [-74.1724, 40.7357],
  "Phoenix, AZ": [-112.074, 33.4484],
  "Portland, OR": [-122.6765, 45.5231],
  "Salt Lake City, UT": [-111.891, 40.7608],
  "Seattle, WA": [-122.3321, 47.6062],
  "St. Louis, MO": [-90.1994, 38.627],
};

/** Short "City" label without the state suffix, for compact lane labels. */
export const cityShort = (name: string) => name.split(",")[0];
