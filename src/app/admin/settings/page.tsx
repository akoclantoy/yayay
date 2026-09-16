import { db } from "@/lib/db";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isGeminiConfigured } from "@/lib/gemini";

export default async function AdminSettingsPage() {
  const settings = await db.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  const platformStat = await db.platformStat.findFirst();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Platform configuration overview</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{APP_NAME}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tagline</span>
            <span className="font-medium text-right max-w-xs">{APP_TAGLINE}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Environment</span>
            <Badge variant="secondary">{process.env.NODE_ENV ?? "development"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            { label: "Gemini AI", configured: isGeminiConfigured() },
            { label: "Google OAuth", configured: !!process.env.GOOGLE_CLIENT_ID },
            { label: "SMTP Email", configured: !!process.env.SMTP_HOST },
            { label: "Cloudinary", configured: !!process.env.CLOUDINARY_CLOUD_NAME },
          ].map((item) => (
            <div key={item.label} className="flex justify-between">
              <span className="text-muted-foreground">{item.label}</span>
              <Badge variant={item.configured ? "default" : "secondary"}>
                {item.configured ? "Configured" : "Not configured"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {platformStat && (
        <Card>
          <CardHeader>
            <CardTitle>Public stats (landing page)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total residents</span>
              <span>{platformStat.totalResidents.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total recycled</span>
              <span>{platformStat.totalRecycledKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Points issued</span>
              <span>{platformStat.totalPoints.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {settings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Database settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {settings.map((s) => (
              <div key={s.id} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{s.key}</span>
                <code className="text-xs truncate max-w-xs">
                  {JSON.stringify(s.value)}
                </code>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
