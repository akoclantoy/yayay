import { db } from "@/lib/db";
import { AnnouncementManager } from "@/components/admin/announcement-manager";

export default async function AdminAnnouncementsPage() {
  const announcements = await db.announcement.findMany({
    where: { deletedAt: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { name: true } } },
  });

  const serialized = announcements.map((announcement) => ({
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    priority: announcement.priority,
    isPinned: announcement.isPinned,
    createdAt: announcement.createdAt.toISOString(),
    authorName: announcement.author?.name ?? null,
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-muted-foreground">
          {announcements.length} active announcements
        </p>
      </div>

      <AnnouncementManager initial={serialized} />
    </div>
  );
}
