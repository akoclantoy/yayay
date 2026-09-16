import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnnouncementForm } from "@/components/admin/announcement-form";

export default async function AdminAnnouncementsPage() {
  const announcements = await db.announcement.findMany({
    where: { deletedAt: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { name: true } } },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-muted-foreground">
          {announcements.length} active announcements
        </p>
      </div>

      <AnnouncementForm />

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No announcements yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  {a.isPinned && <Badge variant="secondary">Pinned</Badge>}
                  <Badge>{a.priority}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {a.content}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.author?.name ?? "System"} · {a.createdAt.toLocaleString()}
                  {a.expiresAt && ` · Expires ${a.expiresAt.toLocaleDateString()}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
