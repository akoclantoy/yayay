export const TUPI_CENTER: [number, number] = [6.3313349, 124.9511647];

export const TUPI_BOUNDS: [[number, number], [number, number]] = [
  [6.2382124, 124.8680091],
  [6.4610003, 125.1198653],
];

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
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= south &&
    latitude <= north &&
    longitude >= west &&
    longitude <= east
  );
}

export function tupiBarangayCode(name: string) {
  return `TUPI-${name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}
