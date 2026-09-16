import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ResidentQRDisplay } from "@/components/resident/qr-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInitials } from "@/lib/utils";

export default async function QRCardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.residentProfile.findUnique({
    where: { userId: session.user.id },
    include: { barangay: true },
  });

  if (!profile) redirect("/login");

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Digital Recycling Card</h1>
        <p className="text-muted-foreground">
          Show this QR code at collection centers for verification
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary via-secondary to-accent" />
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary mb-3">
            {getInitials(session.user.name)}
          </div>
          <CardTitle>{session.user.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
          {profile.barangay && (
            <p className="text-sm text-primary font-medium mt-1">
              {profile.barangay.name}
            </p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center pb-8">
          <ResidentQRDisplay value={profile.qrCode} />
          <p className="text-xs text-muted-foreground mt-4 font-mono">
            ID: {profile.qrCode.slice(0, 8)}...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
