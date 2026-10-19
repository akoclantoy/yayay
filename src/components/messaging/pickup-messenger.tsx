"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  content: string | null;
  imageUrl: string | null;
  systemMessage: boolean;
  editedAt: string | null;
  createdAt: string;
  sender: { id: string; name: string | null; role: string };
};

type Conversation = {
  id: string;
  pickup: {
    id: string;
    address: string;
    status: string;
    scheduledDate: string | null;
    user: { id: string; name: string | null };
    assignedStaff: { id: string; name: string | null } | null;
  };
  resident: { id: string; name: string | null };
  staff: { id: string; name: string | null } | null;
  messages: { content: string | null; imageUrl: string | null; createdAt: string }[];
};

type MessageResponse = { conversation: Conversation; messages: Message[] };

function localDate(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PickupMessenger({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [editId, setEditId] = useState("");
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeConversation = conversations.find((item) => item.id === activeId);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/messages", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load pickup conversations.");
    const data = (await response.json()) as Conversation[];
    setConversations(data);
    setActiveId((current) => {
      if (current && data.some((item) => item.id === current)) return current;
      const pickupId = new URLSearchParams(window.location.search).get("pickupId");
      return data.find((item) => item.pickup.id === pickupId)?.id ?? data[0]?.id ?? "";
    });
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const response = await fetch(
      `/api/messages?conversationId=${encodeURIComponent(conversationId)}`,
      { cache: "no-store" }
    );
    if (!response.ok) {
      if (response.status === 404) {
        setMessages([]);
        return;
      }
      throw new Error("Unable to load messages.");
    }
    const data = (await response.json()) as MessageResponse;
    setMessages(data.messages);
  }, []);

  useEffect(() => {
    void loadConversations()
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Unable to load conversations."))
      .finally(() => setLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId).catch((error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Unable to load messages.")
    );
  }, [activeId, loadMessages]);

  useEffect(() => {
    const events = new EventSource("/api/realtime");
    const refresh = () => {
      void loadConversations()
        .then(() => loadMessages(activeId))
        .catch((error: unknown) => {
          console.error("[messenger] Could not refresh conversations:", error);
        });
    };
    events.addEventListener("invalidate", refresh);
    return () => {
      events.removeEventListener("invalidate", refresh);
      events.close();
    };
  }, [activeId, loadConversations, loadMessages]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || (!content.trim() && !image)) return;
    setSending(true);
    try {
      const form = new FormData();
      form.set("conversationId", activeId);
      if (content.trim()) form.set("content", content.trim());
      if (image) form.set("image", image);
      const response = await fetch("/api/messages", { method: "POST", body: form });
      const data = (await response.json()) as Message | { error?: string };
      if (!response.ok) throw new Error("error" in data ? data.error ?? "Message could not be sent." : "Message could not be sent.");
      setMessages((previous) => [...previous, data as Message]);
      setContent("");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
      void loadConversations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(messageId: string) {
    try {
      const response = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, content: editContent }),
      });
      const data = (await response.json()) as Message | { error?: string };
      if (!response.ok) throw new Error("error" in data ? data.error ?? "Could not edit message." : "Could not edit message.");
      setMessages((previous) => previous.map((message) => (message.id === messageId ? (data as Message) : message)));
      setEditId("");
      setEditContent("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not edit message.");
    }
  }

  async function removeMessage(messageId: string) {
    if (!window.confirm("Delete this message for everyone in the conversation?")) return;
    try {
      const response = await fetch("/api/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not delete message.");
      setMessages((previous) => previous.filter((message) => message.id !== messageId));
      void loadConversations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete message.");
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-emerald-950 to-emerald-800 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-200">Pickup support</p>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-lime-200" /> Messenger
          </CardTitle>
          <p className="text-sm text-emerald-100/80">Talk with the staff assigned to your collection.</p>
        </CardHeader>
        <CardContent className="max-h-[72vh] space-y-2 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading conversations
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-12 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 font-medium">No pickup conversations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a pickup request or wait for a staff member to be assigned.</p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const otherName =
                conversation.resident.id === userId
                  ? conversation.staff?.name ?? "Awaiting staff"
                  : conversation.resident.name ?? "Resident";
              const preview = conversation.messages[0];
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    activeId === conversation.id
                      ? "border-emerald-700/30 bg-emerald-50 dark:bg-emerald-950/40"
                      : "hover:bg-muted/70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate font-semibold">{otherName}</span>
                    <Badge variant="secondary">{conversation.pickup.status}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{conversation.pickup.address}</p>
                  <p className="mt-2 truncate text-sm text-muted-foreground">
                    {preview?.content ?? (preview?.imageUrl ? "Photo attachment" : "No messages yet")}
                  </p>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="flex min-h-[560px] flex-col overflow-hidden">
        {activeConversation ? (
          <>
            <CardHeader className="border-b bg-card/80">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">
                    {activeConversation.resident.id === userId
                      ? activeConversation.staff?.name ?? "Pickup support"
                      : activeConversation.resident.name ?? "Resident"}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{activeConversation.pickup.address}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <Badge variant="outline">{activeConversation.pickup.status}</Badge>
                  {activeConversation.pickup.scheduledDate && (
                    <p className="mt-2">{localDate(activeConversation.pickup.scheduledDate)}</p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col p-0">
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="grid h-full min-h-48 place-items-center text-center text-sm text-muted-foreground">
                    <div><MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />Say hello about this pickup.</div>
                  </div>
                ) : (
                  messages.map((message) => {
                    const own = message.sender.id === userId;
                    return (
                      <div key={message.id} className={cn("flex", own ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[78%]",
                          message.systemMessage
                            ? "w-full border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                            : own
                              ? "rounded-br-md bg-emerald-800 text-white"
                              : "rounded-bl-md border bg-card"
                        )}>
                          {!own && <p className="mb-1 text-xs font-semibold opacity-70">{message.sender.name ?? message.sender.role}</p>}
                          {message.imageUrl && (
                            <a href={message.imageUrl} target="_blank" rel="noreferrer" className="mb-2 block">
                              {/* User-uploaded images are hosted externally and do not use Next image optimization. */}
                              <img src={message.imageUrl} alt="Image shared in pickup conversation" className="max-h-72 max-w-full rounded-xl object-contain" />
                            </a>
                          )}
                          {editId === message.id ? (
                            <div className="space-y-2">
                              <Textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={5000} />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => void saveEdit(message.id)}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditId("")}>Cancel</Button>
                              </div>
                            </div>
                          ) : message.content ? (
                            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between gap-4 text-[10px] opacity-70">
                            <span>{localDate(message.createdAt)}{message.editedAt ? " · edited" : ""}</span>
                            {own && !message.systemMessage && editId !== message.id && (
                              <span className="flex gap-2">
                                {message.content && <button type="button" onClick={() => { setEditId(message.id); setEditContent(message.content ?? ""); }} aria-label="Edit message"><Pencil className="h-3 w-3" /></button>}
                                <button type="button" onClick={() => void removeMessage(message.id)} aria-label="Delete message"><Trash2 className="h-3 w-3" /></button>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form onSubmit={sendMessage} className="space-y-2 border-t bg-muted/20 p-3 sm:p-4">
                {image && (
                  <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs">
                    <span className="truncate">{image.name}</span>
                    <button type="button" className="ml-3 text-destructive" onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ""; }}>Remove</button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                  />
                  <Button type="button" variant="outline" size="icon" aria-label="Attach image" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                  <Textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Write a message…"
                    maxLength={5000}
                    rows={1}
                    className="max-h-32 min-h-10 resize-y bg-background"
                  />
                  <Button type="submit" size="icon" disabled={sending || (!content.trim() && !image)} aria-label="Send message">
                    {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Image attachments up to 5 MB. Messages are visible to the pickup resident and assigned staff.</p>
              </form>
            </CardContent>
          </>
        ) : (
          <CardContent className="grid flex-1 place-items-center p-10 text-center text-muted-foreground">
            Select a pickup conversation to start messaging.
          </CardContent>
        )}
      </Card>
    </div>
  );
}
