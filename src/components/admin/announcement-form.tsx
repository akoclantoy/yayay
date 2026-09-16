"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [expiresAt, setExpiresAt] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  async function publishAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          priority,
          isPinned,
          expiresAt: expiresAt || null,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to publish announcement");
      }

      setTitle("");
      setContent("");
      setPriority("NORMAL");
      setExpiresAt("");
      setIsPinned(false);
      toast.success(`Announcement published to ${data.recipientCount} residents`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to publish announcement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish announcement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={publishAnnouncement} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="announcement-title" className="text-sm font-medium">Title</label>
            <input
              id="announcement-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={160}
              placeholder="Announcement title"
              className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="announcement-content" className="text-sm font-medium">Description</label>
            <textarea
              id="announcement-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              maxLength={5000}
              rows={5}
              placeholder="Write the announcement description residents should receive"
              className="flex min-h-28 w-full rounded-xl border border-border/80 bg-white/80 px-4 py-3 text-sm dark:bg-white/5"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="announcement-priority" className="text-sm font-medium">Priority</label>
              <select
                id="announcement-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="announcement-expires" className="text-sm font-medium">Expires (optional)</label>
              <input
                id="announcement-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} />
            Pin this announcement
          </label>

          <Button type="submit" disabled={loading}>
            {loading ? "Publishing..." : "Publish to residents"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
