INSERT INTO ecorewards."Barangay"
  ("id", "name", "code", "description", "address", "latitude", "longitude", "isActive", "createdAt", "updatedAt")
VALUES
  ('tupi-acmonan', 'Acmonan', 'TUPI-ACMONAN', 'Barangay in the Municipality of Tupi, South Cotabato', 'Acmonan, Tupi, South Cotabato', 6.395, 124.969, true, now(), now()),
  ('tupi-bololmala', 'Bololmala', 'TUPI-BOLOLMALA', 'Barangay in the Municipality of Tupi, South Cotabato', 'Bololmala, Tupi, South Cotabato', 6.294, 124.916, true, now(), now()),
  ('tupi-bunao', 'Bunao', 'TUPI-BUNAO', 'Barangay in the Municipality of Tupi, South Cotabato', 'Bunao, Tupi, South Cotabato', 6.375, 125.005, true, now(), now()),
  ('tupi-cebuano', 'Cebuano', 'TUPI-CEBUANO', 'Barangay in the Municipality of Tupi, South Cotabato', 'Cebuano, Tupi, South Cotabato', 6.303, 124.956, true, now(), now()),
  ('tupi-crossing-rubber', 'Crossing Rubber', 'TUPI-CROSSING-RUBBER', 'Barangay in the Municipality of Tupi, South Cotabato', 'Crossing Rubber, Tupi, South Cotabato', 6.342, 124.933, true, now(), now()),
  ('tupi-juan-loreto-tamayo', 'Juan-Loreto Tamayo', 'TUPI-JUAN-LORETO-TAMAYO', 'Barangay in the Municipality of Tupi, South Cotabato', 'Juan-Loreto Tamayo, Tupi, South Cotabato', 6.306, 124.99, true, now(), now()),
  ('tupi-kablon', 'Kablon', 'TUPI-KABLON', 'Barangay in the Municipality of Tupi, South Cotabato', 'Kablon, Tupi, South Cotabato', 6.363, 124.98, true, now(), now()),
  ('tupi-kalkam', 'Kalkam', 'TUPI-KALKAM', 'Barangay in the Municipality of Tupi, South Cotabato', 'Kalkam, Tupi, South Cotabato', 6.276, 124.959, true, now(), now()),
  ('tupi-linan', 'Linan', 'TUPI-LINAN', 'Barangay in the Municipality of Tupi, South Cotabato', 'Linan, Tupi, South Cotabato', 6.331, 124.909, true, now(), now()),
  ('tupi-lunen', 'Lunen', 'TUPI-LUNEN', 'Barangay in the Municipality of Tupi, South Cotabato', 'Lunen, Tupi, South Cotabato', 6.403, 124.927, true, now(), now()),
  ('tupi-miasong', 'Miasong', 'TUPI-MIASONG', 'Barangay in the Municipality of Tupi, South Cotabato', 'Miasong, Tupi, South Cotabato', 6.288, 125.01, true, now(), now()),
  ('tupi-palian', 'Palian', 'TUPI-PALIAN', 'Barangay in the Municipality of Tupi, South Cotabato', 'Palian, Tupi, South Cotabato', 6.349, 124.9, true, now(), now()),
  ('tupi-poblacion', 'Poblacion', 'TUPI-POBLACION', 'Barangay in the Municipality of Tupi, South Cotabato', 'Poblacion, Tupi, South Cotabato', 6.3313349, 124.9511647, true, now(), now()),
  ('tupi-polonuling', 'Polonuling', 'TUPI-POLONULING', 'Barangay in the Municipality of Tupi, South Cotabato', 'Polonuling, Tupi, South Cotabato', 6.283, 124.898, true, now(), now()),
  ('tupi-simbo', 'Simbo', 'TUPI-SIMBO', 'Barangay in the Municipality of Tupi, South Cotabato', 'Simbo, Tupi, South Cotabato', 6.36, 124.93, true, now(), now()),
  ('tupi-tubeng', 'Tubeng', 'TUPI-TUBENG', 'Barangay in the Municipality of Tupi, South Cotabato', 'Tubeng, Tupi, South Cotabato', 6.315, 124.877, true, now(), now())
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "address" = EXCLUDED."address",
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude",
  "isActive" = true,
  "deletedAt" = NULL,
  "updatedAt" = now();

INSERT INTO ecorewards."CollectionCenter"
  ("id", "name", "description", "address", "barangayId", "latitude", "longitude", "phone", "openHours", "capacityKg", "isActive", "createdAt", "updatedAt")
SELECT
  'seed-center-001',
  'Tupi Municipal Hall Collection Center',
  'Community recycling center at Tupi Municipal Hall.',
  'Municipal Hall, Poblacion, Tupi, South Cotabato',
  barangay."id",
  6.3313349,
  124.9511647,
  '+63-997-937-4225',
  'Mon-Sat 8AM-5PM',
  5000,
  true,
  now(),
  now()
FROM ecorewards."Barangay" AS barangay
WHERE barangay."code" = 'TUPI-POBLACION'
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "address" = EXCLUDED."address",
  "barangayId" = EXCLUDED."barangayId",
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude",
  "phone" = EXCLUDED."phone",
  "openHours" = EXCLUDED."openHours",
  "capacityKg" = EXCLUDED."capacityKg",
  "isActive" = true,
  "deletedAt" = NULL,
  "updatedAt" = now();

INSERT INTO ecorewards."Conversation"
  ("id", "pickupId", "residentId", "createdAt", "updatedAt")
SELECT
  'conv_' || pickup."id",
  pickup."id",
  pickup."userId",
  now(),
  now()
FROM ecorewards."PickupRequest" AS pickup
WHERE NOT EXISTS (
  SELECT 1
  FROM ecorewards."Conversation" AS conversation
  WHERE conversation."pickupId" = pickup."id"
);
