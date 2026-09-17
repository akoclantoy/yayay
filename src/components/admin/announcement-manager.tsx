"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  isPinned: boolean;
  createdAt: string;
  authorName: string | null;
};

type FormState = Omit<Announcement, "id" | "createdAt" | "authorName">;

const emptyForm: FormState = {
  title: "",
  content: "",
  priority: "NORMAL",
  isPinned: false,
};

export function AnnouncementManager({ initial }: { initial: Announcement[] }) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState(initial);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(announcement: Announcement) {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      isPinned: announcement.isPinned,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/announcements", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to save announcement");

      if (editingId) {
        setAnnouncements((current) => current.map((announcement) => (
          announcement.id === editingId ? { ...announcement, ...form } : announcement
        )));
        toast.success("Announcement updated");
      } else {
        setAnnouncements((current) => [{
          ...data.announcement,
          createdAt: data.announcement.createdAt,
          authorName: "You",
        }, ...current]);
        toast.success(`Announcement published to ${data.recipientCount} residents`);
      }
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save announcement");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAnnouncement(id: string) {
    if (!window.confirm("Delete this announcement?")) return;
    const response = await fetch("/api/announcements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(data?.error ?? "Unable to delete announcement");
      return;
    }
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== id));
    if (editingId === id) resetForm();
    toast.success("Announcement deleted");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{editingId ? "Update announcement" : "Publish announcement"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveAnnouncement} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="announcement-title" className="text-sm font-medium">Title</label>
              <input id="announcement-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={160} placeholder="Announcement title" className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5" />
            </div>
            <div className="space-y-2">
              <label htmlFor="announcement-content" className="text-sm font-medium">Description</label>
              <textarea id="announcement-content" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required maxLength={5000} rows={5} placeholder="Write the announcement description residents should receive" className="flex min-h-28 w-full rounded-xl border border-border/80 bg-white/80 px-4 py-3 text-sm dark:bg-white/5" />
            </div>
            <div className="space-y-2">
              <label htmlFor="announcement-priority" className="text-sm font-medium">Priority</label>
              <select id="announcement-priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as FormState["priority"] })} className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5">
                <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPinned} onChange={(event) => setForm({ ...form, isPinned: event.target.checked })} />Pin this announcement</label>
            <div className="flex gap-2"><Button type="submit" disabled={loading}>{loading ? "Saving..." : editingId ? "Update announcement" : "Publish to residents"}</Button>{editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}</div>
          </form>
        </CardContent>
      </Card>

      {announcements.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">No announcements yet</CardContent></Card> : <div className="space-y-3">{announcements.map((announcement) => <Card key={announcement.id}><CardHeader className="pb-2"><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-base">{announcement.title}</CardTitle>{announcement.isPinned && <Badge variant="secondary">Pinned</Badge>}<Badge>{announcement.priority}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm"><p className="whitespace-pre-wrap text-muted-foreground">{announcement.content}</p><p className="text-xs text-muted-foreground">{announcement.authorName ?? "System"} · {new Date(announcement.createdAt).toLocaleString()}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(announcement)}>Edit</Button><Button size="sm" variant="destructive" onClick={() => void deleteAnnouncement(announcement.id)}>Delete</Button></div></CardContent></Card>)}</div>}
    </div>
  );
}