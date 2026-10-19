export const TUPI_CENTER: [number, number] = [6.3313349, 124.9511647];

export const TUPI_BOUNDS: [[number, number], [number, number]] = [
  [6.2382124, 124.8680091],
  [6.4610003, 125.1198653],
];

export const TUPI_BOUNDARY: [number, number][] = [[6.24141,124.945759],[6.241929,124.947322],[6.241008,124.949089],[6.242618,124.949752],[6.242715,124.952591],[6.240555,124.954258],[6.23988,124.955986],[6.238212,124.971805],[6.245298,124.977738],[6.247197,124.975643],[6.245877,124.973575],[6.247274,124.973199],[6.248978,124.974336],[6.251227,124.974149],[6.252597,124.975013],[6.255016,124.973847],[6.257809,124.975982],[6.260513,124.976794],[6.262079,124.979646],[6.275031,124.99413],[6.276599,125.002124],[6.287691,125.009484],[6.360044,125.076181],[6.459606,125.119865],[6.461,125.113256],[6.437468,125.079697],[6.424304,125.064358],[6.416577,125.045597],[6.406988,124.999963],[6.406684,124.995524],[6.409712,124.990926],[6.402205,124.984084],[6.404909,124.973963],[6.406175,124.963904],[6.405664,124.962952],[6.401091,124.960829],[6.39551,124.954195],[6.395681,124.953181],[6.399734,124.95092],[6.397818,124.948308],[6.396678,124.941311],[6.3974,124.940609],[6.396342,124.938255],[6.397257,124.937063],[6.397292,124.934749],[6.399717,124.932367],[6.397783,124.927369],[6.394853,124.92394],[6.393492,124.924185],[6.393167,124.921768],[6.39733,124.921276],[6.398727,124.920285],[6.399078,124.917469],[6.402107,124.914699],[6.402072,124.911383],[6.401606,124.910192],[6.39905,124.90922],[6.396069,124.91032],[6.39517,124.908469],[6.389911,124.907671],[6.391253,124.903965],[6.39067,124.902905],[6.389439,124.902922],[6.388628,124.898849],[6.385802,124.89498],[6.386512,124.882731],[6.385585,124.88078],[6.371811,124.877082],[6.366162,124.873073],[6.357568,124.873931],[6.355414,124.872966],[6.351767,124.868009],[6.337609,124.883709],[6.273335,124.94015],[6.270257,124.941419],[6.262625,124.940481],[6.242323,124.94469],[6.24225,124.94556]];

export const TUPI_BARANGAYS = [
  { name: "Acmonan", latitude: 6.395, longitude: 124.969 },
  { name: "Bololmala", latitude: 6.294, longitude: 124.916 },
  { name: "Bunao", latitude: 6.375, longitude: 125.005 },
  { name: "Cebuano", latitude: 6.303, longitude: 124.956 },
  { name: "Crossing Rubber", latitude: 6.342, longitude: 124.933 },
  { name: "Juan-Loreto Tamayo", latitude: 6.306, longitude: 124.99 },
  { name: "Kablon", latitude: 6.363, longitude: 124.98 },
  { name: "Kalkam", latitude: 6.276, longitude: 124.959 },
  { name: "Linan", latitude: 6.331, longitude: 124.909 },
  { name: "Lunen", latitude: 6.403, longitude: 124.927 },
  { name: "Miasong", latitude: 6.288, longitude: 125.01 },
  { name: "Palian", latitude: 6.349, longitude: 124.9 },
  { name: "Poblacion", latitude: TUPI_CENTER[0], longitude: TUPI_CENTER[1] },
  { name: "Polonuling", latitude: 6.283, longitude: 124.898 },
  { name: "Simbo", latitude: 6.36, longitude: 124.93 },
  { name: "Tubeng", latitude: 6.315, longitude: 124.877 },
] as const;

export function isWithinTupi(latitude: number, longitude: number) {
  const [[south, west], [north, east]] = TUPI_BOUNDS;
  if (!(
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= south &&
    latitude <= north &&
    longitude >= west &&
    longitude <= east
  )) return false;

  let inside = false;
  for (let index = 0, previous = TUPI_BOUNDARY.length - 1; index < TUPI_BOUNDARY.length; previous = index++) {
    const [currentLat, currentLng] = TUPI_BOUNDARY[index];
    const [previousLat, previousLng] = TUPI_BOUNDARY[previous];
    const intersects =
      currentLat > latitude !== previousLat > latitude &&
      longitude <
        ((previousLng - currentLng) * (latitude - currentLat)) /
          (previousLat - currentLat) +
          currentLng;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function tupiBarangayCode(name: string) {
  return `TUPI-${name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}
