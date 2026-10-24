"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "react-qr-code";
import { ArrowLeft, Check, Forward, ImagePlus, MessageCircle, Palette, Paperclip, Pencil, Plus, QrCode, Send, Settings2, SmilePlus, Trash2, Users, Wallet, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageMedia } from "@/components/messaging/message-media";
import { ResidentQrShareDialog } from "@/components/messaging/resident-qr-share-dialog";
import { cn } from "@/lib/utils";

type Resident = { id: string; name: string | null; image: string | null };
type GroupSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  theme: string;
  themeImageUrl?: string | null;
  unread: boolean;
  lastMessage: { senderId: string; content: string; mediaUrl: string | null; mediaType: string | null; createdAt: string } | null;
};
type GroupMember = {
  userId: string;
  nickname: string | null;
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
  themeImageUrl: string | null;
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

function displayMemberName(member: GroupMember) {
  return member.nickname?.trim() || displayName(member.user);
}

function renderMessageContent(content: string) {
  const parts = content.split(/(@\[[^\]]+\])/g);
  return parts.map((part, index) =>
    /^@\[.+\]$/.test(part)
      ? <span key={`${part}-${index}`} className="font-semibold underline decoration-current/50">{part}</span>
      : part,
  );
}

function getGroupQrCode(content: string) {
  return content.startsWith("ERGROUPQR:") ? content.slice("ERGROUPQR:".length) : null;
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
  ownQrCode,
  residentName,
  initialGroupId = null,
  onClose,
  onForward,
}: {
  residentId: string;
  friends: Resident[];
  ownQrCode: string | null;
  residentName: string;
  initialGroupId?: string | null;
  onClose: () => void;
  onForward: (messageId: string) => void;
}) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [details, setDetails] = useState<GroupDetails | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<keyof typeof THEMES>("forest");
  const [photo, setPhoto] = useState<File | null>(null);
  const [themePhoto, setThemePhoto] = useState<File | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [qrTarget, setQrTarget] = useState<{ qrCode: string; name: string } | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferBalance, setTransferBalance] = useState<number | null>(null);
  const [transferConfirmation, setTransferConfirmation] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareQrOpen, setShareQrOpen] = useState(false);
  const [editMessageId, setEditMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const reactionHoldTimerRef = useRef<number | null>(null);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const latestGroupMessageId = details?.messages.at(-1)?.id;
  const currentMember = details?.members.find((member) => member.userId === residentId) ?? null;
  const isGroupAdmin = Boolean(currentMember?.isAdmin);
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
    shouldAutoScrollRef.current = true;
    setShareQrOpen(false);
    setEditMessageId(null);
    setEditMessageText("");
  }, [selectedGroupId]);

  useEffect(() => {
    if (details?.id !== selectedGroupId || !shouldAutoScrollRef.current) return;
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [details?.id, details?.messages.length, latestGroupMessageId, selectedGroupId]);

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
    let refreshInFlight = false;
    const refresh = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const group = await loadDetails(selectedGroupId);
        if (!active) return;
        const latest = group.messages.at(-1);
        const myMember = group.members.find((member) => member.userId === residentId);
        if (latest && latest.senderId !== residentId &&
          (!myMember?.lastReadAt || new Date(latest.createdAt) > new Date(myMember.lastReadAt))) {
          void requestJson("/api/resident/groups", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "read", groupId: selectedGroupId }),
          }).catch((cause: unknown) => {
            console.error("[group-chat] Failed to mark group as read:", cause);
          });
        }
        setGroups((current) => current.map((item) =>
          item.id === selectedGroupId ? { ...item, unread: false } : item,
        ));
      } finally {
        refreshInFlight = false;
      }
    };
    void refresh().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to refresh this group.");
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to refresh this group."));
      }
    }, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadDetails, residentId, selectedGroupId]);

  const groupFriends = useMemo(() => friends.filter((friend) =>
    memberIds.includes(friend.id),
  ), [friends, memberIds]);
  const mentionMatches = mentionQuery === null
    ? []
    : (details?.members ?? [])
        .filter((member) => member.userId !== residentId &&
          displayMemberName(member).toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 5);

  function addMention(member: GroupMember) {
    const input = messageInputRef.current;
    if (!input) return;
    const cursor = input.selectionStart;
    const mentionStart = message.slice(0, cursor).lastIndexOf("@");
    if (mentionStart < 0) return;
    const mention = `@[${displayMemberName(member)}] `;
    const updated = `${message.slice(0, mentionStart)}${mention}${message.slice(cursor)}`;
    setMessage(updated);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      input.focus();
      const nextPosition = mentionStart + mention.length;
      input.setSelectionRange(nextPosition, nextPosition);
    });
  }

  function openGroupSettings() {
    if (!selectedGroup) return;
    setName(details?.name ?? selectedGroup.name);
    setTheme((details?.theme ?? selectedGroup.theme) as keyof typeof THEMES);
    setNickname(currentMember?.nickname ?? "");
    setPhoto(null);
    setThemePhoto(null);
    setSelectedMemberIds([]);
    setSettingsOpen(true);
  }

  async function shareQr() {
    if (!selectedGroupId || sendingMessage) return;
    setSendingMessage(true);
    setError(null);
    try {
      const result = await requestJson<{ message: GroupMessage }>("/api/resident/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share_qr", groupId: selectedGroupId }),
      });
      setDetails((current) => current
        ? { ...current, messages: [...current.messages, result.message] }
        : current);
      setGroups((current) => current.map((item) => item.id === selectedGroupId
        ? { ...item, unread: false, lastMessage: result.message }
        : item));
      setShareQrOpen(false);
      setNotice("Your QR code was shared in this group.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to share your QR code.");
    } finally {
      setSendingMessage(false);
    }
  }

  async function saveGroupMessage(messageId: string) {
    if (!selectedGroupId || !editMessageText.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const result = await requestJson<{ message: GroupMessage }>("/api/resident/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_message",
          groupId: selectedGroupId,
          messageId,
          content: editMessageText,
        }),
      });
      setDetails((current) => current
        ? { ...current, messages: current.messages.map((item) => item.id === messageId ? result.message : item) }
        : current);
      setEditMessageId(null);
      setEditMessageText("");
      void loadGroups().catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to refresh your group list.");
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to edit this message.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteGroupMessage(messageId: string) {
    if (!selectedGroupId || !window.confirm("Delete this message for everyone in the group?")) return;
    setWorking(true);
    setError(null);
    try {
      await requestJson("/api/resident/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_message",
          groupId: selectedGroupId,
          messageId,
        }),
      });
      setDetails((current) => current
        ? { ...current, messages: current.messages.filter((item) => item.id !== messageId) }
        : current);
      if (editMessageId === messageId) {
        setEditMessageId(null);
        setEditMessageText("");
      }
      void loadGroups().catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to refresh your group list.");
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete this message.");
    } finally {
      setWorking(false);
    }
  }

  async function openGroupTransfer(qrCode: string, name: string) {
    if (!selectedGroupId) return;
    setQrTarget({ qrCode, name });
    setTransferAmount("");
    setTransferConfirmation(false);
    try {
      const result = await requestJson<{ balance: number }>("/api/resident/points-transfer");
      setTransferBalance(result.balance);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your points balance.");
      setQrTarget(null);
    }
  }

  async function confirmGroupTransfer() {
    if (!qrTarget || !selectedGroupId) return;
    const amount = Number(transferAmount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10_000 ||
      transferBalance === null || amount > transferBalance) {
      setError("Enter a whole number from 1 to 10,000 within your available balance.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await requestJson("/api/resident/points-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientQrCode: qrTarget.qrCode, amount, groupId: selectedGroupId }),
      });
      setTransferBalance((balance) => balance === null ? null : balance - amount);
      setNotice(`${amount.toLocaleString("en-US")} points sent to ${qrTarget.name}.`);
      setQrTarget(null);
      setTransferConfirmation(false);
      setTransferAmount("");
      await loadDetails(selectedGroupId);
      await loadGroups();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to transfer points.");
    } finally {
      setWorking(false);
    }
  }

  async function addMembers() {
    if (!selectedGroupId || !selectedMemberIds.length) return;
    setWorking(true);
    setError(null);
    try {
      await requestJson("/api/resident/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_members",
          groupId: selectedGroupId,
          memberIds: selectedMemberIds,
        }),
      });
      setSelectedMemberIds([]);
      await loadDetails(selectedGroupId);
      await loadGroups();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add group members.");
    } finally {
      setWorking(false);
    }
  }

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
    setSendingMessage(true);
    setError(null);
    try {
      const result = attachment
        ? await (() => {
        const form = new FormData();
        form.set("action", "message");
        form.set("groupId", selectedGroupId);
        form.set("content", message);
        form.set("media", attachment);
        return requestJson<{ message: GroupMessage }>("/api/resident/groups", { method: "POST", body: form });
      })()
        : await requestJson<{ message: GroupMessage }>("/api/resident/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "message", groupId: selectedGroupId, content: message }),
        });
      setDetails((current) => current
        ? { ...current, messages: [...current.messages, result.message] }
        : current);
      setGroups((current) => current.map((item) => item.id === selectedGroupId
        ? { ...item, unread: false, lastMessage: result.message }
        : item));
      setMessage("");
      setAttachment(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send message.");
    } finally {
      setSendingMessage(false);
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
      if (themePhoto) form.set("themePhoto", themePhoto);
      await requestJson("/api/resident/groups", { method: "PATCH", body: form });
      setSettingsOpen(false);
      setPhoto(null);
      setThemePhoto(null);
      await loadDetails(selectedGroupId);
      await loadGroups();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save group settings.");
    } finally {
      setWorking(false);
    }
  }

  async function saveNickname() {
    if (!selectedGroupId) return;
    setWorking(true);
    setError(null);
    try {
      const result = await requestJson<{ member: { userId: string; nickname: string | null } }>("/api/resident/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_nickname", groupId: selectedGroupId, nickname }),
      });
      setDetails((current) => current
        ? {
            ...current,
            members: current.members.map((member) =>
              member.userId === result.member.userId
                ? { ...member, nickname: result.member.nickname }
                : member,
            ),
          }
        : current);
      setNotice(result.member.nickname ? "Your group nickname was updated." : "Your group nickname was removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your group nickname.");
    } finally {
      setWorking(false);
    }
  }

  function startReactionHold(messageId: string) {
    if (reactionHoldTimerRef.current !== null) window.clearTimeout(reactionHoldTimerRef.current);
    reactionHoldTimerRef.current = window.setTimeout(() => {
      setActiveReactionMessageId(messageId);
      reactionHoldTimerRef.current = null;
    }, 450);
  }

  function cancelReactionHold() {
    if (reactionHoldTimerRef.current !== null) {
      window.clearTimeout(reactionHoldTimerRef.current);
      reactionHoldTimerRef.current = null;
    }
  }

  function openReactionPicker(messageId: string) {
    cancelReactionHold();
    setActiveReactionMessageId((current) => current === messageId ? null : messageId);
  }

  async function reactToMessage(messageId: string, kind: string) {
    if (!selectedGroupId) return;
    setError(null);
    const previous = details?.messages.find((item) => item.id === messageId)?.reactions ?? [];
    const currentReaction = previous.find((item) => item.userId === residentId);
    const optimistic = currentReaction?.kind === kind
      ? previous.filter((item) => item.userId !== residentId)
      : [...previous.filter((item) => item.userId !== residentId), { userId: residentId, kind }];
    setDetails((current) => current
      ? {
          ...current,
          messages: current.messages.map((item) =>
            item.id === messageId ? { ...item, reactions: optimistic } : item,
          ),
        }
      : current);
    try {
      const result = await requestJson<{ reactions: { userId: string; kind: string }[] }>("/api/resident/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "react", groupId: selectedGroupId, messageId, reaction: kind }),
      });
      setDetails((current) => current
        ? {
            ...current,
            messages: current.messages.map((item) =>
              item.id === messageId ? { ...item, reactions: result.reactions } : item,
            ),
          }
        : current);
    } catch (cause) {
      setDetails((current) => current
        ? {
            ...current,
            messages: current.messages.map((item) =>
              item.id === messageId ? { ...item, reactions: previous } : item,
            ),
          }
        : current);
      setError(cause instanceof Error ? cause.message : "Unable to react to this message.");
    } finally {
      setActiveReactionMessageId(null);
    }
  }

  useEffect(() => () => {
    if (reactionHoldTimerRef.current !== null) window.clearTimeout(reactionHoldTimerRef.current);
  }, []);

  return (
    <main className="fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-white/95 px-4 shadow-sm sm:px-7">
        <Button variant="ghost" size="icon" aria-label="Back to messages" onClick={onClose}><ArrowLeft className="h-5 w-5" /></Button>
        {selectedGroupId ? (
          <>
            <GroupAvatar imageUrl={details?.imageUrl ?? selectedGroup?.imageUrl ?? null} name={details?.name ?? selectedGroup?.name ?? "Group conversation"} size="h-10 w-10" />
            <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-bold">{details?.name ?? selectedGroup?.name ?? "Opening conversation…"}</h1><p className="text-xs text-muted-foreground">{details?.members.length ?? 0} group members</p></div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Share your QR code in this group"
              title="Share your QR code"
              onClick={() => setShareQrOpen(true)}
              disabled={sendingMessage || !currentMember}
              className="h-10 gap-2 rounded-full border border-[#cfe4ff] bg-[#e7f3ff] px-3 text-[#0866ff] shadow-sm transition hover:bg-[#d9ebff] hover:text-[#075ce5] focus-visible:ring-2 focus-visible:ring-[#0866ff] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#cfe4ff]">
                <QrCode className="h-[17px] w-[17px]" strokeWidth={2.4} />
                <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0866ff] text-[10px] font-bold leading-none text-white ring-2 ring-[#e7f3ff]">+</span>
              </span>
              <span className="hidden text-sm font-semibold sm:inline">Share QR</span>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Group settings" onClick={openGroupSettings} disabled={!currentMember || !selectedGroup}><Settings2 className="h-5 w-5" /></Button>
          </>
        ) : (
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
            <div className="flex-1"><h1 className="text-base font-bold">Group chats</h1><p className="text-xs text-muted-foreground">Bring your recycling community together</p></div>
            <Button onClick={() => { setName(""); setMemberIds([]); setTheme("forest"); setPhoto(null); setCreateOpen(true); }}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Create group</span></Button>
          </>
        )}
      </header>

      {selectedGroupId ? selectedGroup ? (
        <section
          className="flex min-h-0 flex-1 flex-col"
          style={{
            background: currentTheme.background,
            ...(details?.themeImageUrl
              ? {
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.84)), url("${details.themeImageUrl}")`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }
              : {}),
          }}
        >
          <div
            ref={historyRef}
            onScroll={(event) => {
              const viewport = event.currentTarget;
              shouldAutoScrollRef.current =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120;
            }}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-8"
          >
            <div className="mx-auto mb-5 rounded-full bg-white/80 px-4 py-2 text-center text-xs text-muted-foreground shadow-sm">
              <span className="font-semibold text-foreground">{details?.members.length ?? 0} members</span> · Messages are visible to everyone in the group.
              {isGroupAdmin && <button type="button" onClick={openGroupSettings} className="ml-3 inline-flex items-center gap-1 font-semibold text-primary hover:underline"><Users className="h-3.5 w-3.5" />Add members</button>}
            </div>
            {details?.messages.map((item) => {
              const senderMember = details.members.find((member) => member.userId === item.senderId);
              const sender = senderMember?.user;
              const qrCode = getGroupQrCode(item.content);
              const mine = item.senderId === residentId;
              const seenBy = mine ? details.members.filter((member) =>
                member.userId !== residentId && member.lastReadAt && new Date(member.lastReadAt) >= new Date(item.createdAt),
              ) : [];
              return (
                <div key={item.id} className={cn("mb-4 flex w-full items-end gap-2", mine && "flex-row-reverse")}>
                  {!mine && <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={sender?.image ?? undefined} /><AvatarFallback>{displayName(sender ?? { id: item.senderId, name: null, image: null }).slice(0, 1)}</AvatarFallback></Avatar>}
                  <div className={cn("max-w-[min(82%,560px)]", mine ? "items-end" : "items-start")}>
                    {!mine && <p className="mb-1 ml-1 text-[10px] font-semibold text-muted-foreground">{senderMember ? displayMemberName(senderMember) : "Group member"}</p>}
                    <div
                      className={cn("relative rounded-2xl border-0 px-4 py-3 shadow-sm touch-manipulation", mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-white/90 text-foreground")}
                      onPointerDown={() => startReactionHold(item.id)}
                      onPointerUp={cancelReactionHold}
                      onPointerCancel={cancelReactionHold}
                      onPointerLeave={cancelReactionHold}
                      onContextMenu={(event) => { event.preventDefault(); openReactionPicker(item.id); }}
                    >
                      <AnimatePresence>
                        {activeReactionMessageId === item.id && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.8, rotateX: -18 }}
                            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                            exit={{ opacity: 0, y: 8, scale: 0.85 }}
                            transition={{ type: "spring", stiffness: 420, damping: 24 }}
                            className="absolute -top-14 right-0 z-20 flex origin-bottom-right items-center gap-1 rounded-full border border-white/80 bg-white/95 p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.2)] [transform-style:preserve-3d]"
                            role="group"
                            aria-label="Choose a reaction"
                          >
                            {REACTIONS.map((reaction) => (
                              <motion.button
                                key={reaction.kind}
                                type="button"
                                whileHover={{ scale: 1.22, rotate: -8, z: 12 }}
                                whileTap={{ scale: 0.86 }}
                                title={`React ${reaction.emoji}`}
                                aria-label={`React ${reaction.emoji}`}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => void reactToMessage(item.id, reaction.kind)}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                {reaction.emoji}
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {editMessageId === item.id ? (
                        <div className="min-w-[min(72vw,360px)] space-y-3" onPointerDown={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-primary">Edit group message</span>
                            <span className="text-[11px] text-muted-foreground">{editMessageText.length}/2000</span>
                          </div>
                          <textarea
                            autoFocus
                            aria-label="Edit group message"
                            maxLength={2000}
                            rows={4}
                            value={editMessageText}
                            onChange={(event) => setEditMessageText(event.target.value)}
                            className="min-h-28 w-full resize-y rounded-xl border border-border/70 bg-white px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                          />
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => { setEditMessageId(null); setEditMessageText(""); }}>
                              Cancel
                            </Button>
                            <Button type="button" size="sm" disabled={!editMessageText.trim() || working} onClick={() => void saveGroupMessage(item.id)}>
                              {working ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : qrCode ? (
                        <button
                          type="button"
                          disabled={mine}
                          onClick={() => void openGroupTransfer(qrCode, senderMember ? displayMemberName(senderMember) : "group member")}
                          className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 text-center text-foreground transition hover:shadow-md disabled:cursor-default"
                        >
                          <QRCode value={qrCode} size={176} />
                          <span className="text-xs font-semibold text-primary">{mine ? "Your shared QR code" : "Tap to transfer points"}</span>
                        </button>
                      ) : <>
                        {item.mediaUrl && <MessageMedia src={item.mediaUrl} type={item.mediaType} alt="Group message attachment" />}
                        {item.content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{renderMessageContent(item.content)}</p>}
                      </>}
                      <p className={cn("mt-2 text-right text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>{new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(item.createdAt))}</p>
                    </div>
                    <div className={cn("mt-1 flex items-center gap-1", mine && "justify-end")}>
                      {mine && !qrCode && item.content && !item.mediaUrl && editMessageId !== item.id && (
                        <button
                          type="button"
                          title="Edit message"
                          aria-label="Edit group message"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => { setEditMessageId(item.id); setEditMessageText(item.content); }}
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        ><Pencil className="h-3.5 w-3.5" /></button>
                      )}
                      {mine && editMessageId !== item.id && (
                        <button
                          type="button"
                          title="Delete message"
                          aria-label="Delete group message"
                          disabled={working}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => void deleteGroupMessage(item.id)}
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                        ><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                      <button type="button" title="Forward message" aria-label="Forward message" onClick={() => onForward(item.id)} className="mr-1 rounded-lg p-1.5 text-muted-foreground transition hover:bg-white hover:text-primary"><Forward className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Add a reaction" aria-label="Add a reaction" onClick={() => openReactionPicker(item.id)} className="mr-1 rounded-lg p-1.5 text-muted-foreground transition hover:bg-white hover:text-primary"><SmilePlus className="h-3.5 w-3.5" /></button>
                      {REACTIONS.map((reaction) => {
                        const count = item.reactions.filter((entry) => entry.kind === reaction.kind).length;
                        const selected = item.reactions.some((entry) => entry.kind === reaction.kind && entry.userId === residentId);
                        if (count === 0) return null;
                        return (
                          <button key={reaction.kind} type="button" title={`${count} reaction${count === 1 ? "" : "s"}${selected ? ", including yours" : ""}`} onClick={() => openReactionPicker(item.id)} className={cn("rounded-full px-1.5 py-0.5 text-xs transition hover:scale-110", selected || count ? "bg-white shadow-sm" : "opacity-40 hover:opacity-100")}>
                            {reaction.emoji}{count > 0 && <span className="ml-1 text-[10px]">{count}</span>}
                          </button>
                        );
                      })}
                      {mine && seenBy.map((member) => <Avatar key={member.userId} title={`Seen by ${displayMemberName(member)}`} className="h-5 w-5 border border-white"><AvatarImage src={member.user.image ?? undefined} /><AvatarFallback className="text-[8px]">{displayMemberName(member).slice(0, 1)}</AvatarFallback></Avatar>)}
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
            <div className="relative min-w-0 flex-1">
              {mentionMatches.length > 0 && <div className="absolute bottom-full left-0 z-20 mb-2 max-h-48 w-full overflow-y-auto rounded-2xl border border-border bg-white p-2 shadow-xl">{mentionMatches.map((member) => <button key={member.userId} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addMention(member)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-primary/5"><Avatar className="h-8 w-8"><AvatarImage src={member.user.image ?? undefined} /><AvatarFallback>{displayMemberName(member).slice(0, 1)}</AvatarFallback></Avatar><span className="truncate">{displayMemberName(member)}</span></button>)}</div>}
              <textarea ref={messageInputRef} value={message} onChange={(event) => {
                setMessage(event.target.value);
                const beforeCursor = event.target.value.slice(0, event.target.selectionStart);
                const match = beforeCursor.match(/@([^\s@]*)$/);
                setMentionQuery(match ? match[1] : null);
              }} onKeyDown={(event) => { if (event.key === "Escape") setMentionQuery(null); if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={2000} rows={1} placeholder={`Message ${selectedGroup.name}… Use @ to mention a member`} className="max-h-28 min-h-11 w-full resize-y rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </div>
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={(!message.trim() && !attachment) || sendingMessage} aria-label="Send group message"><Send className="h-4 w-4" /></Button>
            </div>
          </form>
        </section>
      ) : (
        <section className="flex min-h-0 flex-1 items-center justify-center bg-slate-50/70 p-6" aria-live="polite">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white px-5 py-4 text-sm text-muted-foreground shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Opening group conversation…
          </div>
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

      {qrTarget && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="group-transfer-title"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wallet className="h-5 w-5" /></div><button type="button" aria-label="Close points transfer" onClick={() => { setQrTarget(null); setTransferConfirmation(false); }} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><h2 id="group-transfer-title" className="mt-3 text-lg font-bold">{transferConfirmation ? "Confirm points transfer" : "Send points"}</h2><p className="mt-1 text-sm text-muted-foreground">To {qrTarget.name} · verified from their QR shared in this group.</p>{transferConfirmation ? <div className="mt-5 rounded-2xl bg-primary/5 p-4 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">You are sending</p><p className="mt-2 text-3xl font-bold text-primary">{Number(transferAmount).toLocaleString("en-US")} pts</p><p className="mt-1 text-sm text-muted-foreground">This transfer cannot be undone.</p></div> : <div className="mt-5 space-y-3"><div className="rounded-xl bg-muted/60 p-3 text-sm"><span className="text-muted-foreground">Available balance</span><strong className="float-right text-primary">{transferBalance?.toLocaleString("en-US") ?? "Loading..."} pts</strong></div><label className="block text-left text-xs font-medium">Points to send<input type="number" min="1" max="10000" step="1" required value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" placeholder="Maximum 10,000" /></label><p className="text-xs text-muted-foreground">Transfers are limited to group members and up to 10,000 points.</p></div>}<div className="mt-5 space-y-2"><Button className="w-full" disabled={working || transferBalance === null || (!transferConfirmation && (!transferAmount || Number(transferAmount) > (transferBalance ?? 0)))} onClick={() => transferConfirmation ? void confirmGroupTransfer() : setTransferConfirmation(true)}>{working ? "Sending..." : transferConfirmation ? "Confirm and send points" : "Review transfer"}</Button>{transferConfirmation && <Button type="button" variant="outline" className="w-full" disabled={working} onClick={() => setTransferConfirmation(false)}>Go back</Button>}</div></div></div>}

      <ResidentQrShareDialog
        open={shareQrOpen}
        qrCode={ownQrCode}
        residentName={residentName}
        recipientName={details?.name ?? selectedGroup?.name ?? "this group"}
        audienceText={`Your QR code will be sent as a message in ${details?.name ?? selectedGroup?.name ?? "this group"}. Every group member can view and scan it to identify you for a points transfer.`}
        busy={sendingMessage}
        onClose={() => setShareQrOpen(false)}
        onConfirm={() => void shareQr()}
      />

      {(error || notice) && <div role={error ? "alert" : "status"} className={cn("fixed bottom-5 left-1/2 z-[95] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-xl", error ? "bg-danger" : "bg-primary")}><span>{error ?? notice}</span><button type="button" aria-label="Dismiss message" onClick={() => { setError(null); setNotice(null); }}><X className="h-4 w-4" /></button></div>}

      <AnimatePresence>
        {(createOpen || settingsOpen) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="group-form-title">
            <motion.form initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} onSubmit={(event) => { if (createOpen) void createGroup(event); else if (isGroupAdmin) void saveSettings(event); else event.preventDefault(); }} className="max-h-[90dvh] w-full max-w-lg space-y-5 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between"><div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{createOpen ? <Users className="h-5 w-5" /> : <Settings2 className="h-5 w-5" />}</span><h2 id="group-form-title" className="mt-3 text-lg font-bold">{createOpen ? "Create your group" : "Group settings"}</h2><p className="mt-1 text-sm text-muted-foreground">{createOpen ? "Invite at least three resident friends to get started." : "Make this conversation feel like your group."}</p></div><button type="button" aria-label="Close group form" onClick={() => { setCreateOpen(false); setSettingsOpen(false); }} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div>
              {(createOpen || isGroupAdmin) && <label className="block text-sm font-medium">Group name<input required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="The Green Team" className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-primary/50" /></label>}
              {(createOpen || isGroupAdmin) && <div><p className="mb-2 flex items-center gap-2 text-sm font-medium"><Palette className="h-4 w-4 text-primary" />Shared theme</p><div className="grid grid-cols-5 gap-2">{Object.entries(THEMES).map(([key, option]) => <button key={key} type="button" aria-label={`${option.label} theme`} title={option.label} onClick={() => setTheme(key as keyof typeof THEMES)} className={cn("h-10 rounded-xl border-2 transition hover:scale-105", theme === key ? "border-primary" : "border-white shadow")} style={{ background: option.background }} />)}</div></div>}
              {(createOpen || isGroupAdmin) && <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-3 py-3 transition hover:border-primary/40"><ImagePlus className="h-5 w-5 text-primary" /><span className="min-w-0 flex-1 truncate text-sm">{photo?.name ?? (details?.imageUrl ? "Change group picture (optional)" : "Add a group picture (optional)")}</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>}
              {!createOpen && <section className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4"><div><p className="text-sm font-semibold">Your nickname in this group</p><p className="text-xs text-muted-foreground">Only you can set your nickname. Leave it blank to use your account name.</p></div><label className="sr-only" htmlFor="group-nickname">Your group nickname</label><input id="group-nickname" maxLength={32} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder={currentMember ? displayName(currentMember.user) : "Your nickname"} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50" /><Button type="button" variant="outline" className="w-full" disabled={working || nickname.trim() === (currentMember?.nickname ?? "")} onClick={() => void saveNickname()}>{working ? "Saving..." : "Save my nickname"}</Button></section>}
              {!createOpen && isGroupAdmin && <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-3 transition hover:border-primary/50"><ImagePlus className="h-5 w-5 text-primary" /><span className="min-w-0 flex-1 truncate text-sm">{themePhoto?.name ?? (details?.themeImageUrl ? "Replace custom theme picture" : "Upload a custom theme picture")}</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setThemePhoto(event.target.files?.[0] ?? null)} /></label>}
              {createOpen && <div><p className="mb-2 text-sm font-semibold">Invite friends <span className="font-normal text-muted-foreground">· {memberIds.length} selected, 3 required</span></p><div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/70 p-2">{friends.map((friend) => {
                const checked = memberIds.includes(friend.id);
                return <button key={friend.id} type="button" onClick={() => setMemberIds((current) => checked ? current.filter((id) => id !== friend.id) : [...current, friend.id])} className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition", checked ? "bg-primary/10" : "hover:bg-muted/60")}><Avatar className="h-9 w-9"><AvatarImage src={friend.image ?? undefined} /><AvatarFallback>{displayName(friend).slice(0, 1)}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(friend)}</span><span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", checked ? "border-primary bg-primary text-white" : "border-border")}>{checked && <Check className="h-3.5 w-3.5" />}</span></button>;
              })}{!friends.length && <p className="p-3 text-center text-sm text-muted-foreground">Add resident friends before creating a group.</p>}</div></div>}
              {!createOpen && isGroupAdmin && details && <section className="space-y-2 rounded-2xl border border-border/70 p-3"><div><p className="text-sm font-semibold">Add group members</p><p className="text-xs text-muted-foreground">Only resident friends can be invited.</p></div><div className="max-h-36 space-y-1 overflow-y-auto">{friends.filter((friend) => !details.members.some((member) => member.userId === friend.id)).map((friend) => {
                const checked = selectedMemberIds.includes(friend.id);
                return <button key={friend.id} type="button" onClick={() => setSelectedMemberIds((current) => checked ? current.filter((id) => id !== friend.id) : [...current, friend.id])} className={cn("flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left", checked ? "bg-primary/10" : "hover:bg-muted/60")}><Avatar className="h-8 w-8"><AvatarImage src={friend.image ?? undefined} /><AvatarFallback>{displayName(friend).slice(0, 1)}</AvatarFallback></Avatar><span className="flex-1 truncate text-sm">{displayName(friend)}</span>{checked && <Check className="h-4 w-4 text-primary" />}</button>;
              })}</div><Button type="button" variant="outline" size="sm" className="w-full" disabled={working || !selectedMemberIds.length} onClick={() => void addMembers()}>{working ? "Adding..." : `Add ${selectedMemberIds.length || ""} selected member${selectedMemberIds.length === 1 ? "" : "s"}`}</Button></section>}
              <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1" disabled={working} onClick={() => { setCreateOpen(false); setSettingsOpen(false); }}>Close</Button>{(createOpen || isGroupAdmin) && <Button type="submit" className="flex-1" disabled={working || name.trim().length < 2 || (createOpen && groupFriends.length < 3)}>{working ? "Saving..." : createOpen ? "Create group" : "Save changes"}</Button>}</div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
