import { db } from "@/lib/db";
import { normalizePhilippinePhone } from "@/lib/sms-recovery";

export async function findUsersWithPhone(phone: string) {
  const normalizedPhone = normalizePhilippinePhone(phone);
  if (!normalizedPhone) return [];

  const searchableDigits = normalizedPhone.startsWith("+63")
    ? normalizedPhone.slice(3)
    : normalizedPhone.slice(1);
  const users = await db.user.findMany({
    where: {
      phone: { contains: searchableDigits },
      deletedAt: null,
    },
    select: { id: true, phone: true },
    take: 25,
  });

  return users.filter((user) => normalizePhilippinePhone(user.phone) === normalizedPhone);
}

export async function findUserWithPhone(phone: string, excludeUserId?: string) {
  const users = await findUsersWithPhone(phone);
  return users.find((user) => user.id !== excludeUserId) ?? null;
}
