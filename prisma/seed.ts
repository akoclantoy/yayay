import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { DEFAULT_WASTE_CATEGORIES } from "../src/lib/constants";

config({ path: ".env.local" });
config();

async function withRetry(label: string, operation: () => Promise<void>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
      const message = String(error instanceof Error ? error.message : error ?? "");
      const isTransient = /pool timeout|P2039|ECONN|timed out|Can't reach database|connection.*pool/i.test(message);

      if (!isTransient || attempt === 5) {
        throw error;
      }

      console.warn(`[seed] ${label} failed (attempt ${attempt}/5); retrying in 3s...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw lastError;
}

async function main() {
  console.log("Seeding database...");

  await withRetry("waste category seed", async () => {
    for (const cat of DEFAULT_WASTE_CATEGORIES) {
      await db.wasteCategory.upsert({
        where: { type: cat.type },
        update: {
          name: cat.name,
          pointsPerKg: cat.pointsPerKg,
          carbonFactorKg: cat.carbonFactorKg,
        },
        create: {
          type: cat.type,
          name: cat.name,
          pointsPerKg: cat.pointsPerKg,
          carbonFactorKg: cat.carbonFactorKg,
        },
      });
    }
  });

  // Barangays
  const barangay = await db.barangay.upsert({
    where: { code: "BRGY-SJ-001" },
    update: {},
    create: {
      name: "Barangay San Jose",
      code: "BRGY-SJ-001",
      address: "San Jose, Metro City",
      latitude: 14.5995,
      longitude: 120.9842,
      population: 12500,
    },
  });

  // Collection center
  const center = await db.collectionCenter.upsert({
    where: { id: "seed-center-001" },
    update: {},
    create: {
      id: "seed-center-001",
      name: "San Jose Eco Hub",
      address: "123 Green Street, Barangay San Jose",
      barangayId: barangay.id,
      latitude: 14.5995,
      longitude: 120.9842,
      phone: "+63 2 8123 4567",
      openHours: "Mon-Sat 8AM-5PM",
      capacityKg: 5000,
    },
  });

  // Admin user
  const adminHash = await bcrypt.hash("Admin123!", 12);
  const admin = await db.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      passwordHash: adminHash,
      emailVerified: new Date(),
      isActive: true,
      deletedAt: null,
    },
    create: {
      name: "System Admin",
      email: "admin@example.com",
      passwordHash: adminHash,
      emailVerified: new Date(),
      role: "ADMIN",
    },
  });

  // Staff user
  const staffHash = await bcrypt.hash("Staff123!", 12);
  await db.user.upsert({
    where: { email: "staff@example.com" },
    update: {
      passwordHash: staffHash,
      emailVerified: new Date(),
      isActive: true,
      deletedAt: null,
    },
    create: {
      name: "Collection Staff",
      email: "staff@example.com",
      passwordHash: staffHash,
      emailVerified: new Date(),
      role: "COLLECTION_STAFF",
      staffProfile: {
        create: {
          employeeId: "EMP-001",
          assignedCenterId: center.id,
        },
      },
    },
  });

  // Demo resident
  const residentHash = await bcrypt.hash("Resident123!", 12);
  await db.user.upsert({
    where: { email: "resident@example.com" },
    update: {
      passwordHash: residentHash,
      emailVerified: new Date(),
      isActive: true,
      deletedAt: null,
    },
    create: {
      name: "Juan Dela Cruz",
      email: "resident@example.com",
      passwordHash: residentHash,
      emailVerified: new Date(),
      role: "RESIDENT",
      phone: "+63 912 345 6789",
      residentProfile: {
        create: {
          barangayId: barangay.id,
          address: "456 Rizal Avenue",
          environmentalScore: 250,
          recyclingStreak: 7,
          totalWeightKg: 45.5,
          carbonSavedKg: 112.3,
          wallet: { create: { balance: 450, lifetime: 1250 } },
        },
      },
    },
  });

  // Rewards
  const rewards = [
    { name: "₱100 Grocery Voucher", type: "VOUCHER" as const, pointsCost: 500, cashValue: 100, stock: 50 },
    { name: "₱50 Mobile Load", type: "VOUCHER" as const, pointsCost: 250, cashValue: 50, stock: 100 },
    { name: "Eco Bag Set", type: "GIFT" as const, pointsCost: 300, stock: 30 },
  ];

  for (const r of rewards) {
    const existing = await db.reward.findFirst({ where: { name: r.name } });
    if (!existing) {
      await db.reward.create({ data: r });
    }
  }

  await db.reward.updateMany({
    where: { name: "10% Partner Discount", deletedAt: null },
    data: { isActive: false, deletedAt: new Date() },
  });

  // Badges
  const badges = [
    { name: "First Recycle", description: "Complete your first recycling", icon: "🌱", points: 10 },
    { name: "Week Warrior", description: "7-day recycling streak", icon: "🔥", points: 50 },
    { name: "Eco Champion", description: "Recycle 100kg total", icon: "🏆", points: 200 },
  ];

  for (const b of badges) {
    await db.badge.upsert({
      where: { name: b.name },
      update: {},
      create: b,
    });
  }

  // Platform stats
  const existingStat = await db.platformStat.findFirst();
  if (existingStat) {
    await db.platformStat.update({
      where: { id: existingStat.id },
      data: {
        totalResidents: 1250,
        totalRecycledKg: 48200,
        totalPoints: 1250000,
        carbonSavedKg: 98500,
      },
    });
  } else {
    await db.platformStat.create({
      data: {
        totalResidents: 1250,
        totalRecycledKg: 48200,
        totalPoints: 1250000,
        carbonSavedKg: 98500,
      },
    });
  }

  // Announcement
  const existingAnnouncement = await db.announcement.findFirst({
    where: { title: "Welcome to EcoRewards!" },
  });
  if (!existingAnnouncement) {
    await db.announcement.create({
      data: {
        title: "Welcome to EcoRewards!",
        content:
          "Join our community recycling program and start earning rewards for every kilogram you recycle. Visit your nearest collection center with your QR card today!",
        priority: "NORMAL",
        isPinned: true,
        authorId: admin.id,
      },
    });
  }

  // Unverified accounts cannot sign in when SMTP is configured; on Render there is
  // no mail server, so mark existing accounts verified after deploy.
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    await db.user.updateMany({
      where: { emailVerified: null },
      data: { emailVerified: new Date() },
    });
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
