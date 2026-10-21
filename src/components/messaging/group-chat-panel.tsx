"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Forward, ImagePlus, MessageCircle, Palette, Paperclip, Plus, Send, Settings2, Users, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageMedia } from "@/components/messaging/message-media";
import { cn } from "@/lib/utils";

type Resident = { id: string; name: string | null; image: string | null };
type GroupSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  theme: string;
  unread: boolean;
  lastMessage: { senderId: string; content: string; mediaUrl: string | null; mediaType: string | null; createdAt: string } | null;
};
type GroupMember = {
  userId: string;
  isAdmin: boolean;
  lastReadAt: string | null;
  user: Resident & { lastSeenAt: string | null };
};
type GroupMessage = {
  id: string;
  senderId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
  reactions: { userId: string; kind: string }[];
};
type GroupDetails = {
  id: string;
  name: string;
  imageUrl: string | null;
  theme: string;
  createdById: string;
  members: GroupMember[];
  messages: GroupMessage[];
};

const THEMES = {
  forest: { label: "Forest", background: "linear-gradient(145deg, #eaf4e9, #f9fcf7)" },
  ocean: { label: "Ocean", background: "linear-gradient(145deg, #e7f2f7, #f8fbfd)" },
  sunset: { label: "Sunset", background: "linear-gradient(145deg, #fff0e8, #fffaf6)" },
  lavender: { label: "Lavender", background: "linear-gradient(145deg, #f2edfb, #fcfaff)" },
  midnight: { label: "Midnight", background: "linear-gradient(145deg, #23352f, #17231f)" },
} as const;

const REACTIONS = [
  { kind: "LIKE", emoji: "👍" },
  { kind: "HEART", emoji: "❤️" },
  { kind: "FUNNY", emoji: "😂" },
  { kind: "ANGRY", emoji: "😡" },
];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
  return result;
}

function displayName(user: Resident) {
  return user.name?.trim() || "EcoRewards resident";
}

function GroupAvatar({ imageUrl, name, size = "h-12 w-12" }: { imageUrl: string | null; name: string; size?: string }) {
  return (
    <Avatar className={cn("border-2 border-white shadow-sm", size)}>
      <AvatarImage src={imageUrl ?? undefined} alt={name} />
      <AvatarFallback><Users className="h-4 w-4" /></AvatarFallback>
    </Avatar>
  );
}

export function GroupChatPanel({
  residentId,
  friends,
  onClose,
  onForward,
}: {
  residentId: string;
  friends: Resident[];
  onClose: () => void;
  onForward: (messageId: string) => void;
}) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [details, setDetails] = useState<GroupDetails | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<keyof typeof THEMES>("forest");
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const currentTheme = THEMES[(details?.theme ?? selectedGroup?.theme ?? "forest") as keyof typeof THEMES] ?? THEMES.forest;

  const loadGroups = useCallback(async () => {
    const result = await requestJson<{ groups: GroupSummary[] }>("/api/resident/groups");
    setGroups(result.groups);
  }, []);

  const loadDetails = useCallback(async (groupId: string) => {
    const result = await requestJson<{ group: GroupDetails }>(`/api/resident/groups?groupId=${encodeURIComponent(groupId)}`);
    setDetails(result.group);
    return result.group;
  }, []);

  useEffect(() => {
    let active = true;
    void requestJson<{ groups: GroupSummary[] }>("/api/resident/groups")
      .then((result) => {
        if (active) setGroups(result.groups);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load groups.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    let active = true;
    const refresh = async () => {
      const group = await loadDetails(selectedGroupId);
      if (!active) return;
      const latest = group.messages.at(-1);
      const myMember = group.members.find((member) => member.userId === residentId);
      if (latest && latest.senderId !== residentId &&
        (!myMember?.lastReadAt || new Date(latest.createdAt) > new Date(myMember.lastReadAt))) {
        await requestJson("/api/resident/groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read", groupId: selectedGroupId }),
        });
      }
      await loadGroups();
    };
    void refresh().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to refresh this group.");
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to refresh this group."));
      }
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadDetails, loadGroups, residentId, selectedGroupId]);

  const groupFriends = useMemo(() => friends.filter((friend) =>
    memberIds.includes(friend.id),
  ), [friends, memberIds]);

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (memberIds.length < 3) {
      setError("Invite at least three friends to create a group.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("memberIds", JSON.stringify(memberIds));
      form.set("theme", theme);
      if (photo) form.set("photo", photo);
      const result = await requestJson<{ group: GroupSummary }>("/api/resident/groups", { method: "POST", body: form });
      setCreateOpen(false);
      setName("");
      setMemberIds([]);
      setPhoto(null);
      await loadGroups();
      setSelectedGroupId(result.group.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create group.");
    } finally {
      setWorking(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroupId || (!message.trim() && !attachment)) return;
    setWorking(true);
    setError(null);
    try {
      if (attachment) {
        const form = new FormData();
        form.set("action", "message");
        form.set("groupId", selectedGroupId);
        form.set("content", message);
        form.set("media", attachment);
        await requestJson("/api/resident/groups", { method: "POST", body: form });
      } else {
        await requestJson("/api/resident/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "message", groupId: selectedGroupId, content: message }),
        });
      }
      setMessage("");
      setAttachment(null);
      await loadDetails(selectedGroupId);
      await loadGroups();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send message.");
    } finally {
      setWorking(false);
    }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroupId) return;
    setWorking(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("groupId", selectedGroupId);
      form.set("name", name || details?.name || "");
      form.set("theme", theme);
      if (photo) form.set("photo", photo);
      await requestJson("/api/resident/groups", { method: "PATCH", body: form });
      setSettingsOpen(false);
      setPhoto(null);
      await loadDetails(selectedGroupId);
      await loadGroups();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save group settings.");
    } finally {
      setWorking(false);
    }
  }

  async function reactToMessage(messageId: string, kind: string) {
    if (!selectedGroupId) return;
    setError(null);
    try {
      await requestJson("/api/resident/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "react", groupId: selectedGroupId, messageId, reaction: kind }),
      });
      await loadDetails(selectedGroupId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to react to this message.");
    }
  }

  return (
    <main className="fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-white/95 px-4 shadow-sm sm:px-7">
        <Button variant="ghost" size="icon" aria-label="Back to messages" onClick={onClose}><ArrowLeft className="h-5 w-5" /></Button>
        {selectedGroup ? (
          <>
            <GroupAvatar imageUrl={details?.imageUrl ?? selectedGroup.imageUrl} name={details?.name ?? selectedGroup.name} size="h-10 w-10" />
            <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-bold">{details?.name ?? selectedGroup.name}</h1><p className="text-xs text-muted-foreground">{details?.members.length ?? 0} group members</p></div>
            <Button variant="ghost" size="icon" aria-label="Group settings" onClick={() => {
              setName(details?.name ?? selectedGroup.name);
              setTheme((details?.theme ?? selectedGroup.theme) as keyof typeof THEMES);
              setPhoto(null);
              setSettingsOpen(true);
            }}><Settings2 className="h-5 w-5" /></Button>
          </>
        ) : (
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
            <div className="flex-1"><h1 className="text-base font-bold">Group chats</h1><p className="text-xs text-muted-foreground">Bring your recycling community together</p></div>
            <Button onClick={() => { setName(""); setMemberIds([]); setTheme("forest"); setPhoto(null); setCreateOpen(true); }}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Create group</span></Button>
          </>
        )}
      </header>

      {selectedGroup ? (
        <section className="flex min-h-0 flex-1 flex-col" style={{ background: currentTheme.background }}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-8">
            <div className="mx-auto mb-5 rounded-full bg-white/80 px-4 py-2 text-center text-xs text-muted-foreground shadow-sm">
              <span className="font-semibold text-foreground">{details?.members.length ?? 0} members</span> · Messages are visible to everyone in the group.
            </div>
            {details?.messages.map((item) => {
              const sender = details.members.find((member) => member.userId === item.senderId)?.user;
              const mine = item.senderId === residentId;
              const seenBy = mine ? details.members.filter((member) =>
                member.userId !== residentId && member.lastReadAt && new Date(member.lastReadAt) >= new Date(item.createdAt),
              ) : [];
              return (
                <div key={item.id} className={cn("mb-4 flex w-full items-end gap-2", mine && "flex-row-reverse")}>
                  {!mine && <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={sender?.image ?? undefined} /><AvatarFallback>{displayName(sender ?? { id: item.senderId, name: null, image: null }).slice(0, 1)}</AvatarFallback></Avatar>}
                  <div className={cn("max-w-[min(82%,560px)]", mine ? "items-end" : "items-start")}>
                    {!mine && <p className="mb-1 ml-1 text-[10px] font-semibold text-muted-foreground">{sender ? displayName(sender) : "Group member"}</p>}
                    <div className={cn("rounded-2xl px-4 py-3 shadow-sm", mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md border border-white/70 bg-white/90 text-foreground")}>
                      {item.mediaUrl && <MessageMedia src={item.mediaUrl} type={item.mediaType} alt="Group message attachment" />}
                      {item.content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.content}</p>}
                      <p className={cn("mt-2 text-right text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>{new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(item.createdAt))}</p>
                    </div>
                    <div className={cn("mt-1 flex items-center gap-1", mine && "justify-end")}>
                      <button type="button" title="Forward message" aria-label="Forward message" onClick={() => onForward(item.id)} className="mr-1 rounded-lg p-1.5 text-muted-foreground transition hover:bg-white hover:text-primary"><Forward className="h-3.5 w-3.5" /></button>
                      {REACTIONS.map((reaction) => {
                        const count = item.reactions.filter((entry) => entry.kind === reaction.kind).length;
                        const selected = item.reactions.some((entry) => entry.kind === reaction.kind && entry.userId === residentId);
                        return (
                          <button key={reaction.kind} type="button" title={`React ${reaction.emoji}`} onClick={() => void reactToMessage(item.id, reaction.kind)} className={cn("rounded-full px-1.5 py-0.5 text-xs transition hover:scale-110", selected || count ? "bg-white shadow-sm" : "opacity-40 hover:opacity-100")}>
                            {reaction.emoji}{count > 0 && <span className="ml-1 text-[10px]">{count}</span>}
                          </button>
                        );
                      })}
                      {mine && seenBy.map((member) => <Avatar key={member.userId} title={`Seen by ${displayName(member.user)}`} className="h-5 w-5 border border-white"><AvatarImage src={member.user.image ?? undefined} /><AvatarFallback className="text-[8px]">{displayName(member.user).slice(0, 1)}</AvatarFallback></Avatar>)}
                    </div>
                  </div>
                </div>
              );
            })}
            {!details && <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading group conversation…</div>}
          </div>
          <form onSubmit={(event) => void sendMessage(event)} className="flex flex-col gap-2 border-t border-border/70 bg-white/95 px-3 py-3 sm:px-6">
            {attachment && <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate">{attachment.name} · {(attachment.size / (1024 * 1024)).toFixed(1)} MB</span><button type="button" aria-label="Remove attachment" onClick={() => setAttachment(null)} className="rounded-full p-1 hover:bg-primary/10"><X className="h-3.5 w-3.5" /></button></div>}
            <div className="flex items-end gap-2">
            <input ref={mediaInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              event.currentTarget.value = "";
              if (file && !((file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024) || (file.type.startsWith("video/") && file.size <= 25 * 1024 * 1024))) {
                setError("Choose an image up to 5 MB or a video up to 25 MB.");
                return;
              }
              setAttachment(file);
              setError(null);
            }} />
            <button type="button" title="Attach an image or video" aria-label="Attach an image or video" onClick={() => mediaInputRef.current?.click()} className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary/10"><Paperclip className="h-5 w-5" /></button>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={2000} rows={1} placeholder={`Message ${selectedGroup.name}…`} className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={(!message.trim() && !attachment) || working} aria-label="Send group message"><Send className="h-4 w-4" /></Button>
            </div>
          </form>
        </section>
      ) : (
        <section className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-7">
          <div className="mx-auto max-w-3xl">
            <div className="mb-5 rounded-3xl bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 p-5 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Better together</p>
              <h2 className="mt-2 text-xl font-bold sm:text-2xl">Make room for your whole crew.</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Create a private group with at least three resident friends. Choose a name, group photo, and shared theme.</p>
            </div>
            {groups.length ? <div className="grid gap-3 sm:grid-cols-2">{groups.map((group) => (
              <button key={group.id} type="button" onClick={() => { setDetails(null); setSelectedGroupId(group.id); }} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <span className="relative"><GroupAvatar imageUrl={group.imageUrl} name={group.name} size="h-12 w-12" />{group.unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{group.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{group.lastMessage?.content || (group.lastMessage?.mediaType?.startsWith("video/") ? "Shared a video" : group.lastMessage?.mediaUrl ? "Shared a photo" : "Start your group conversation")}</span></span>
                <MessageCircle className="h-4 w-4 text-primary" />
              </button>
            ))}</div> : <div className="rounded-3xl border border-dashed border-border bg-white p-8 text-center"><Users className="mx-auto h-9 w-9 text-primary/60" /><p className="mt-3 font-semibold">Your group chats start here</p><p className="mt-1 text-sm text-muted-foreground">Create a group and invite three or more friends.</p><Button className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />Create your first group</Button></div>}
          </div>
        </section>
      )}

      {error && <div role="alert" className="fixed bottom-5 left-1/2 z-[80] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-danger px-4 py-3 text-sm text-white shadow-xl"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError(null)}><X className="h-4 w-4" /></button></div>}

      <AnimatePresence>
        {(createOpen || settingsOpen) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="group-form-title">
            <motion.form initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} onSubmit={(event) => { if (createOpen) void createGroup(event); else void saveSettings(event); }} className="max-h-[90dvh] w-full max-w-lg space-y-5 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between"><div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{createOpen ? <Users className="h-5 w-5" /> : <Settings2 className="h-5 w-5" />}</span><h2 id="group-form-title" className="mt-3 text-lg font-bold">{createOpen ? "Create your group" : "Group settings"}</h2><p className="mt-1 text-sm text-muted-foreground">{createOpen ? "Invite at least three resident friends to get started." : "Make this conversation feel like your group."}</p></div><button type="button" aria-label="Close group form" onClick={() => { setCreateOpen(false); setSettingsOpen(false); }} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div>
              <label className="block text-sm font-medium">Group name<input required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="The Green Team" className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-primary/50" /></label>
              <div><p className="mb-2 flex items-center gap-2 text-sm font-medium"><Palette className="h-4 w-4 text-primary" />Shared theme</p><div className="grid grid-cols-5 gap-2">{Object.entries(THEMES).map(([key, option]) => <button key={key} type="button" aria-label={`${option.label} theme`} title={option.label} onClick={() => setTheme(key as keyof typeof THEMES)} className={cn("h-10 rounded-xl border-2 transition hover:scale-105", theme === key ? "border-primary" : "border-white shadow")} style={{ background: option.background }} />)}</div></div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-3 py-3 transition hover:border-primary/40"><ImagePlus className="h-5 w-5 text-primary" /><span className="min-w-0 flex-1 truncate text-sm">{photo?.name ?? (details?.imageUrl ? "Change group picture (optional)" : "Add a group picture (optional)")}</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
              {createOpen && <div><p className="mb-2 text-sm font-semibold">Invite friends <span className="font-normal text-muted-foreground">· {memberIds.length} selected, 3 required</span></p><div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/70 p-2">{friends.map((friend) => {
                const checked = memberIds.includes(friend.id);
                return <button key={friend.id} type="button" onClick={() => setMemberIds((current) => checked ? current.filter((id) => id !== friend.id) : [...current, friend.id])} className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition", checked ? "bg-primary/10" : "hover:bg-muted/60")}><Avatar className="h-9 w-9"><AvatarImage src={friend.image ?? undefined} /><AvatarFallback>{displayName(friend).slice(0, 1)}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(friend)}</span><span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", checked ? "border-primary bg-primary text-white" : "border-border")}>{checked && <Check className="h-3.5 w-3.5" />}</span></button>;
              })}{!friends.length && <p className="p-3 text-center text-sm text-muted-foreground">Add resident friends before creating a group.</p>}</div></div>}
              <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1" disabled={working} onClick={() => { setCreateOpen(false); setSettingsOpen(false); }}>Cancel</Button><Button type="submit" className="flex-1" disabled={working || name.trim().length < 2 || (createOpen && groupFriends.length < 3)}>{working ? "Saving..." : createOpen ? "Create group" : "Save changes"}</Button></div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
