import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  houseNumber: z.string().optional(),
  barangayId: z.string().optional(),
});

export async function PATCH(request: Request) {
  const authResult = await requireSession();
  if ("error" in authResult) return authResult.error;

  try {
    const data = schema.parse(await request.json());
    const userId = authResult.session.user.id;

    if (data.name || data.phone) {
      await db.user.update({
        where: { id: userId },
        data: {
          name: data.name,
          phone: data.phone,
        },
      });
    }

    await db.residentProfile.upsert({
      where: { userId },
      update: {
        address: data.address,
        houseNumber: data.houseNumber,
        barangayId: data.barangayId || null,
      },
      create: {
        userId,
        address: data.address,
        houseNumber: data.houseNumber,
        barangayId: data.barangayId || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
