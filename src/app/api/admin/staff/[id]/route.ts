import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  const { id } = await params;

  if (id === authResult.session.user.id) {
    return NextResponse.json(
      { error: "You cannot remove your own account." },
      { status: 400 }
    );
  }

  try {
    const staff = await db.user.findUnique({
      where: { id },
      select: { role: true, deletedAt: true },
    });

    if (!staff || staff.deletedAt) {
      return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
    }

    if (staff.role !== "COLLECTION_STAFF" && staff.role !== "BARANGAY_STAFF") {
      return NextResponse.json(
        { error: "Only staff accounts can be removed." },
        { status: 403 }
      );
    }

    await db.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin:remove-staff]", error);
    return NextResponse.json(
      { error: "Unable to remove the staff account. Please try again." },
      { status: 500 }
    );
  }
}