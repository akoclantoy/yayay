import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

const preferenceSchema = z.object({
  theme: z.enum(["LIGHT", "DARK"]),
});

export async function GET() {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const user = await db.user.findUnique({
      where: { id: authResult.session.user.id },
      select: { messengerTheme: true },
    });
    if (!user) return NextResponse.json({ error: "Resident not found" }, { status: 404 });
    return NextResponse.json({ theme: user.messengerTheme });
  } catch (error) {
    console.error("[messenger-preferences:read]", error);
    return NextResponse.json({ error: "Unable to load messaging preferences." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const parsed = preferenceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a valid messaging theme." }, { status: 400 });
    }
    const user = await db.user.update({
      where: { id: authResult.session.user.id },
      data: { messengerTheme: parsed.data.theme },
      select: { messengerTheme: true },
    });
    return NextResponse.json({ theme: user.messengerTheme });
  } catch (error) {
    console.error("[messenger-preferences:update]", error);
    return NextResponse.json({ error: "Unable to save messaging preferences." }, { status: 500 });
  }
}
