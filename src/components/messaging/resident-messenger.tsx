"use client";

import Link from "next/link";
import QRCode from "react-qr-code";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ImagePlus,
  MessageCircle,
  MapPin,
  MoreHorizontal,
  Ban,
  Pencil,
  Trash2,
  UserRoundX,
  Recycle,
  Search,
  Send,
  Settings2,
  UserPlus,
  Users,
  Wallet,
  X,
  QrCode,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PickupMessenger } from "@/components/messaging/pickup-messenger";
import { cn } from "@/lib/utils";

type Resident = { id: string; name: string | null; image: string | null; qrCode?: string };
type Friend = Resident & { createdAt?: string };
type DirectoryResident = Resident & {
  qrCode: string;
  isFriend: boolean;
  outgoingRequest: string | null;
  incomingRequest: string | null;
  conversationId: string | null;
  mutualCount: number;
};
type FriendRequest = { id: string; resident: Resident; createdAt: string };
type ReactionKind = "LIKE" | "HEART" | "FUNNY" | "ANGRY";
type Reaction = { userId: string; kind: ReactionKind };
type Message = {
  id: string;
  senderId: string;
  content: string;
  systemMessage: boolean;
  editedAt: string | null;
  createdAt: string;
  reactions: Reaction[];
};
type Conversation = {
  id: string | null;
  theme: string;
  backgroundImageUrl: string | null;
  friend: Resident;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
    systemMessage: boolean;
  } | null;
  unread: boolean;
};
type FriendProfile = Resident & {
  isFriend: boolean;
  outgoingRequest: string | null;
  incomingRequest: string | null;
  mutualFriends: Resident[];
};
type ConversationDetails = {
  id: string;
  theme: string;
  backgroundImageUrl: string | null;
  friend: Resident;
  messages: Message[];
  readAt: string | null;
};
type MessengerData = {
  ownProfile: { qrCode: string; user: { name: string | null; image: string | null } } | null;
  friends: Friend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
};
type Tab = "inbox" | "friends" | "requests" | "directory" | "profile";

const THEMES: Record<string, { label: string; background: string; accent: string }> = {
  forest: { label: "Forest", background: "linear-gradient(145deg, #eaf4e9, #f9fcf7)", accent: "#28754e" },
  ocean: { label: "Ocean", background: "linear-gradient(145deg, #e7f2f7, #f8fbfd)", accent: "#26758e" },
  sunset: { label: "Sunset", background: "linear-gradient(145deg, #fff0e8, #fffaf6)", accent: "#bd6543" },
  lavender: { label: "Lavender", background: "linear-gradient(145deg, #f2edfb, #fcfaff)", accent: "#7a5ba7" },
  midnight: { label: "Midnight", background: "linear-gradient(145deg, #23352f, #17231f)", accent: "#8bd5a9" },
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "LIKE", emoji: "👍", label: "Like" },
  { kind: "HEART", emoji: "❤️", label: "Heart" },
  { kind: "FUNNY", emoji: "😂", label: "Funny" },
  { kind: "ANGRY", emoji: "😡", label: "Angry" },
];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
  return result;
}

function displayName(resident: Resident) {
  return resident.name?.trim() || "EcoRewards resident";
}

function ProfileAvatar({ resident, size = "h-12 w-12" }: { resident: Resident; size?: string }) {
  return (
    <Avatar className={cn("border-2 border-white/80 shadow-sm", size)}>
      <AvatarImage src={resident.image ?? undefined} alt={displayName(resident)} />
      <AvatarFallback>{displayName(resident).slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function ResidentMessenger({
  residentName,
  residentId,
  onPickupMessages,
}: {
  residentName: string;
  residentId: string;
  onPickupMessages?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("inbox");
  const [data, setData] = useState<MessengerData | null>(null);
  const [directoryResidents, setDirectoryResidents] = useState<DirectoryResident[]>([]);
  const [directoryPage, setDirectoryPage] = useState(0);
  const [directoryHasMore, setDirectoryHasMore] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [editMessageId, setEditMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState("");
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [transferMode, setTransferMode] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferBalance, setTransferBalance] = useState(0);
  const [themeOpen, setThemeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAction, setSettingsAction] = useState<"unfriend" | "block" | "delete" | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressNextMessageClickRef = useRef(false);

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
  }, []);

  const activeFriend = useMemo(() => {
    if (details?.id === activeConversationId) return details.friend;
    return data?.friends.find((friend) => friend.id === activeFriendId) ?? null;
  }, [activeConversationId, activeFriendId, data?.friends, details]);

  const refresh = useCallback(async () => {
    setError(null);
    const [friendsResponse, conversationsResponse] = await Promise.all([
      requestJson<MessengerData>("/api/resident/friends"),
      requestJson<{ conversations: Conversation[] }>("/api/resident/direct-messages"),
    ]);
    setData(friendsResponse);
    setConversations(conversationsResponse.conversations);
  }, []);

  const loadDetails = useCallback(async (conversationId: string) => {
    const response = await requestJson<{ conversation: ConversationDetails }>(
      `/api/resident/direct-messages?conversationId=${encodeURIComponent(conversationId)}`,
    );
    setDetails(response.conversation);
    return response.conversation;
  }, []);

  const refreshOpenConversation = useCallback(async (conversationId: string) => {
    const conversation = await loadDetails(conversationId);
    const latestMessage = conversation.messages.at(-1);
    if (
      latestMessage &&
      latestMessage.senderId !== residentId &&
      (!conversation.readAt || new Date(latestMessage.createdAt) > new Date(conversation.readAt))
    ) {
      const result = await requestJson<{ readAt: string }>("/api/resident/direct-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", conversationId }),
      });
      setDetails((current) =>
        current?.id === conversationId
          ? { ...current, readAt: result.readAt }
          : current,
      );
    }
    await refresh();
  }, [loadDetails, refresh, residentId]);

  const lookupQr = useCallback(async (qrCode: string) => {
    try {
      setError(null);
      const response = await requestJson<{ profile: FriendProfile }>(
        `/api/resident/friends?qr=${encodeURIComponent(qrCode.trim())}`,
      );
      setProfile(response.profile);
      setTab("friends");
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }, []);

  const connectByQr = useCallback(async (qrCode: string) => {
    setWorking(true);
    setError(null);
    try {
      const result = await requestJson<{ isFriend: boolean; connectedNow: boolean; friend: Resident }>(
        "/api/resident/friends",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrCode: qrCode.trim(), connection: "QR_SCAN" }),
        },
      );
      await refresh();
      const conversationResponse = await requestJson<{ conversations: Conversation[] }>(
        "/api/resident/direct-messages",
      );
      setConversations(conversationResponse.conversations);
      setProfile(null);
      setTab("inbox");
      setActiveFriendId(result.friend.id);
      setActiveConversationId(
        conversationResponse.conversations.find(
          (conversation) => conversation.friend.id === result.friend.id,
        )?.id ?? null,
      );
      setDetails(null);
      setNotice(result.connectedNow
        ? `You and ${displayName(result.friend)} are now friends.`
        : `You are already friends with ${displayName(result.friend)}.`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const initialLoad = async () => {
      try {
        await refresh();
      } catch (cause) {
        if (active) setError(getErrorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialLoad();
    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!activeConversationId) return;
    let active = true;
    const load = async () => {
      try {
        await refreshOpenConversation(activeConversationId);
      } catch (cause) {
        if (active) setError(getErrorMessage(cause));
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeConversationId, refreshOpenConversation]);

  useEffect(() => {
    if (tab !== "directory") return;
    let active = true;
    const timer = window.setTimeout(() => {
      setDirectoryLoading(true);
      const params = new URLSearchParams({ directory: "1", search: search.trim(), page: "0" });
      void requestJson<{
        residents: DirectoryResident[];
        page: number;
        hasMore: boolean;
      }>(`/api/resident/friends?${params}`)
        .then((result) => {
          if (!active) return;
          setDirectoryResidents(result.residents);
          setDirectoryPage(result.page);
          setDirectoryHasMore(result.hasMore);
        })
        .catch((cause: unknown) => {
          if (active) setError(getErrorMessage(cause));
        })
        .finally(() => {
          if (active) setDirectoryLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, tab]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const updateOpenConversation = async () => {
        if (activeConversationId) {
          await refreshOpenConversation(activeConversationId);
        } else {
          await refresh();
        }
      };
      void updateOpenConversation().catch((cause: unknown) => {
        setError(getErrorMessage(cause));
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [activeConversationId, refresh, refreshOpenConversation]);

  useEffect(() => {
    const events = new EventSource("/api/realtime");
    const updateMessages = () => {
      if (document.visibilityState !== "visible") return;
      const update = async () => {
        if (activeConversationId) {
          await refreshOpenConversation(activeConversationId);
        } else {
          await refresh();
        }
      };
      void update().catch((cause: unknown) => {
        setError(getErrorMessage(cause));
      });
    };
    events.addEventListener("invalidate", updateMessages);
    return () => {
      events.removeEventListener("invalidate", updateMessages);
      events.close();
    };
  }, [activeConversationId, refresh, refreshOpenConversation]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [details?.messages.length]);

  useEffect(() => {
    if (!scannerOpen) return;
    let active = true;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let scannerStarted = false;
    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!active) return;
        const instance = new Html5Qrcode("resident-qr-reader");
        scanner = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (decodedText: string) => {
            if (transferMode) {
              void lookupQr(decodedText);
            } else {
              void connectByQr(decodedText);
            }
            setScannerOpen(false);
          },
          () => undefined,
        );
        scannerStarted = true;
        if (!active) {
          void instance.stop().then(() => instance.clear()).catch((cause: unknown) => {
            console.error("[resident-messenger] Could not stop QR scanner:", cause);
          });
        }
      } catch (cause) {
        if (active) setScannerError(getErrorMessage(cause));
      }
    };
    void startScanner();
    return () => {
      active = false;
      if (scanner && scannerStarted) {
        void scanner.stop().then(() => scanner?.clear()).catch((cause: unknown) => {
          console.error("[resident-messenger] Could not stop QR scanner:", cause);
        });
      }
    };
  }, [connectByQr, lookupQr, scannerOpen, transferMode]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return conversations.filter((item) => displayName(item.friend).toLocaleLowerCase().includes(query));
  }, [conversations, search]);

  const filteredFriends = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (data?.friends ?? []).filter((friend) => displayName(friend).toLocaleLowerCase().includes(query));
  }, [data?.friends, search]);

  async function updateRequest(
    requestId: string,
    action: "ACCEPT" | "DECLINE",
    residentId?: string,
  ) {
    setWorking(true);
    setError(null);
    try {
      await requestJson("/api/resident/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      await refresh();
      if (residentId) {
        setDirectoryResidents((current) => current.map((resident) =>
          resident.id === residentId
            ? {
                ...resident,
                isFriend: action === "ACCEPT",
                incomingRequest: null,
              }
            : resident,
        ));
      }
      setNotice(action === "ACCEPT" ? "You are now friends." : "Friend request declined.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function sendFriendRequest(qrCode = profile?.qrCode, residentId?: string) {
    if (!qrCode) {
      setError("This resident's QR code could not be loaded. Scan their QR code again.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const response = await requestJson<{ requestId: string }>("/api/resident/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode }),
      });
      setProfile((current) => current?.id === residentId || !residentId
        ? current ? { ...current, outgoingRequest: response.requestId } : current
        : current);
      if (residentId) {
        setDirectoryResidents((current) => current.map((resident) =>
          resident.id === residentId
            ? { ...resident, outgoingRequest: response.requestId }
            : resident,
        ));
      }
      await refresh();
      setNotice("Friend request sent.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function cancelRequest(requestId: string, residentId?: string) {
    setWorking(true);
    setError(null);
    try {
      await requestJson("/api/resident/friends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      await refresh();
      setProfile((current) => current ? { ...current, outgoingRequest: null } : current);
      if (residentId) {
        setDirectoryResidents((current) => current.map((resident) =>
          resident.id === residentId
            ? { ...resident, outgoingRequest: null }
            : resident,
        ));
      }
      setNotice("Friend request cancelled.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeFriend || !messageText.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const response = await requestJson<{ conversation: { id: string } }>("/api/resident/direct-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: activeFriend.id, content: messageText }),
      });
      setMessageText("");
      setActiveFriendId(activeFriend.id);
      setActiveConversationId(response.conversation.id);
      await refresh();
      await loadDetails(response.conversation.id);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function saveDirectMessage(messageId: string) {
    setWorking(true);
    setError(null);
    try {
      const updated = await requestJson<Message>("/api/resident/direct-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_message",
          messageId,
          content: editMessageText,
        }),
      });
      setDetails((current) => current
        ? {
            ...current,
            messages: current.messages.map((message) => message.id === messageId ? updated : message),
          }
        : current);
      setEditMessageId(null);
      setEditMessageText("");
      await refresh();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function deleteDirectMessage(messageId: string) {
    if (!window.confirm("Delete this message for everyone in the conversation?")) return;
    setWorking(true);
    setError(null);
    try {
      await requestJson("/api/resident/direct-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_message", messageId }),
      });
      setDetails((current) => current
        ? { ...current, messages: current.messages.filter((message) => message.id !== messageId) }
        : current);
      await refresh();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function toggleMessageReaction(messageId: string, kind: ReactionKind) {
    setError(null);
    try {
      const result = await requestJson<{ reactions: Reaction[] }>("/api/resident/direct-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "react", messageId, reaction: kind }),
      });
      setDetails((current) => current
        ? {
            ...current,
            messages: current.messages.map((message) =>
              message.id === messageId ? { ...message, reactions: result.reactions } : message,
            ),
          }
        : current);
      await refresh();
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  function startReactionPress(messageId: string, event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    suppressNextMessageClickRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      setReactionPickerId(messageId);
      suppressNextMessageClickRef.current = true;
      longPressTimerRef.current = null;
    }, 450);
  }

  function finishReactionPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function toggleReactionPicker(messageId: string) {
    if (suppressNextMessageClickRef.current) {
      suppressNextMessageClickRef.current = false;
      return;
    }
    setReactionPickerId((current) => current === messageId ? null : messageId);
  }

  async function loadTransferBalance() {
    try {
      const response = await requestJson<{ balance: number }>("/api/resident/points-transfer");
      setTransferBalance(response.balance);
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  async function submitTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipient = profile;
    if (!recipient?.qrCode || !recipient.isFriend) {
      setError("Scan a friend's QR code before starting a points transfer.");
      return;
    }
    const amount = Number(transferAmount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10_000) {
      setError("Enter a whole number from 1 to 10,000 points.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const result = await requestJson<{ balance: number; conversationId: string }>("/api/resident/points-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientQrCode: recipient.qrCode, amount }),
      });
      setTransferBalance(result.balance);
      setTransferAmount("");
      setTransferMode(false);
      setNotice(`${amount.toLocaleString("en-US")} points sent to ${displayName(recipient)}.`);
      setActiveFriendId(recipient.id);
      setActiveConversationId(result.conversationId);
      setDetails(null);
      setTab("inbox");
      setProfile(null);
      await refresh();
      await loadDetails(result.conversationId);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function saveTheme(theme?: string) {
    if (!activeConversationId) {
      setError("Send a message first to start this shared conversation.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("conversationId", activeConversationId);
      if (theme) form.set("theme", theme);
      if (theme) form.set("clearBackground", "true");
      if (backgroundFile) form.set("background", backgroundFile);
      await requestJson("/api/resident/chat-theme", { method: "PATCH", body: form });
      setBackgroundFile(null);
      setThemeOpen(false);
      await loadDetails(activeConversationId);
      await refresh();
      setNotice("Shared conversation appearance updated.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function updateConversation(action: "unfriend" | "block" | "delete") {
    if (!activeFriend) return;
    if (action === "delete" && !activeConversationId) {
      setError("There is no conversation to delete yet.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await requestJson("/api/resident/direct-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          friendId: activeFriend.id,
          ...(activeConversationId ? { conversationId: activeConversationId } : {}),
        }),
      });
      await refresh();
      setActiveFriendId(null);
      setActiveConversationId(null);
      setDetails(null);
      setSettingsOpen(false);
      setSettingsAction(null);
      setNotice(
        action === "unfriend"
          ? `${displayName(activeFriend)} was removed from your friends.`
          : action === "block"
            ? `${displayName(activeFriend)} was blocked.`
            : "Conversation deleted from your inbox.",
      );
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  function openFriend(friend: Friend) {
    const conversation = conversations.find((item) => item.friend.id === friend.id);
    setActiveFriendId(friend.id);
    setActiveConversationId(conversation?.id ?? null);
    setDetails(null);
    setTab("inbox");
  }

  async function loadMoreResidents() {
    if (directoryLoading || !directoryHasMore) return;
    setDirectoryLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        directory: "1",
        search: search.trim(),
        page: String(directoryPage + 1),
      });
      const result = await requestJson<{
        residents: DirectoryResident[];
        page: number;
        hasMore: boolean;
      }>(`/api/resident/friends?${params}`);
      setDirectoryResidents((current) => [...current, ...result.residents]);
      setDirectoryPage(result.page);
      setDirectoryHasMore(result.hasMore);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setDirectoryLoading(false);
    }
  }

  function openDirectoryFriend(friend: DirectoryResident) {
    setTab("inbox");
    setActiveFriendId(friend.id);
    setActiveConversationId(
      friend.conversationId ??
        conversations.find((conversation) => conversation.friend.id === friend.id)?.id ??
        null,
    );
    setDetails(null);
  }

  async function startTransferScan() {
    setProfile(null);
    setTransferMode(true);
    setScannerError(null);
    await loadTransferBalance();
    setScannerOpen(true);
  }

  const currentDetails = details?.id === activeConversationId ? details : null;
  const currentTheme = THEMES[currentDetails?.theme ?? "forest"] ?? THEMES.forest;

  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white/85">
        {!activeFriend && <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-border/70 px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/resident" aria-label="Return to resident dashboard" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition hover:bg-muted hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight sm:text-base">EcoRewards Messenger</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Good conversations grow greener communities</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onPickupMessages && (
              <Button variant="outline" size="sm" onClick={onPickupMessages}>
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Pickup messages</span>
              </Button>
            )}
            <Link href="/resident" aria-label="Return to resident dashboard" title="Back to dashboard" className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-primary transition hover:bg-accent/35">
              <Recycle className="h-5 w-5" />
            </Link>
          </div>
        </header>}

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className={cn("flex min-h-0 flex-col border-r border-border/70 bg-white/55", activeFriend && "hidden lg:flex")}>
            <div className="px-5 pb-3 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight">Messages</h1>
                  <p className="mt-0.5 text-xs text-muted-foreground">Connect with your EcoRewards friends</p>
                </div>
                <button type="button" title="Scan a friend QR code" onClick={() => { setTransferMode(false); setScannerError(null); setScannerOpen(true); }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition hover:bg-primary/15">
                  <QrCode className="h-5 w-5" />
                </button>
              </div>
              <label className="flex h-11 items-center gap-2.5 rounded-xl border border-border/70 bg-background/80 px-3 text-muted-foreground focus-within:border-primary/40">
                <Search className="h-4 w-4 shrink-0" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "directory" ? "Find a resident" : tab === "friends" ? "Search friends" : "Search conversations"} className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </label>
            </div>

            <nav className="grid grid-cols-5 gap-1 px-3 pb-3 sm:px-4" aria-label="Messenger sections">
              {([
                ["inbox", "Inbox", MessageCircle],
                ["friends", "Friends", Users],
                ["requests", "Requests", UserPlus],
                ["directory", "Find Friend", Search],
                ["profile", "My QR", QrCode],
              ] as const).map(([key, label, Icon]) => (
                <button key={key} type="button" onClick={() => { setTab(key); setActiveFriendId(null); setActiveConversationId(null); setDetails(null); setProfile(null); }} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[9px] font-semibold transition sm:text-[10px]", tab === key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground")}>
                  <Icon className="h-4 w-4" />
                  <span className="max-w-full truncate">{label}</span>
                  {key === "requests" && (data?.incomingRequests.length ?? 0) > 0 && <span className="absolute ml-7 -mt-7 h-2 w-2 rounded-full bg-secondary" />}
                </button>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              {loading ? (
                <div className="space-y-3 px-2 pt-3" aria-label="Loading messages">
                  {[1, 2, 3, 4].map((item) => <div key={item} className="h-[72px] animate-pulse rounded-2xl bg-muted/70" />)}
                </div>
              ) : tab === "inbox" ? (
                <div>
                  {filteredConversations.length ? filteredConversations.map((item) => (
                    <button key={item.friend.id} type="button" onClick={() => { setActiveFriendId(item.friend.id); setActiveConversationId(item.id); setDetails(null); setSettingsOpen(false); }} className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-muted/60", activeConversationId === item.id && "bg-primary/8")}>
                      <span className="relative shrink-0">
                        <ProfileAvatar resident={item.friend} />
                        {item.unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-primary" aria-label="Unread message" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm", item.unread ? "font-extrabold text-foreground" : "font-semibold")}>{displayName(item.friend)}</span>
                          <span className={cn("shrink-0 text-[10px]", item.unread ? "font-bold text-primary" : "text-muted-foreground")}>{item.lastMessage ? dateFormatter.format(new Date(item.lastMessage.createdAt)) : ""}</span>
                        </span>
                        <span className={cn("mt-1 block truncate text-xs", item.unread ? "font-bold text-foreground" : "text-muted-foreground")}>{item.lastMessage?.content ?? "Start a conversation"}</span>
                      </span>
                    </button>
                  )) : <EmptyList icon={<MessageCircle />} title="Your inbox is ready" text="Open a friend from your list to start chatting." action="Browse friends" onAction={() => setTab("friends")} />}
                </div>
              ) : tab === "friends" ? (
                <div className="space-y-1">
                  <button type="button" onClick={() => { setScannerError(null); setScannerOpen(true); }} className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-3 py-3 text-left text-sm font-medium text-primary hover:bg-primary/10">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white"><QrCode className="h-5 w-5" /></span>
                    Add a friend by QR code
                  </button>
                  {filteredFriends.map((friend) => (
                    <button key={friend.id} type="button" onClick={() => openFriend(friend)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-muted/60">
                      <ProfileAvatar resident={friend} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{displayName(friend)}</span><span className="text-xs text-muted-foreground">EcoRewards friend</span></span>
                      <MessageCircle className="h-4 w-4 text-primary" />
                    </button>
                  ))}
                  {!filteredFriends.length && <EmptyList icon={<Users />} title="No friends yet" text="Scan a resident's QR code to connect." />}
                </div>
              ) : tab === "requests" ? (
                <div>
                  <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Incoming</p>
                  {data?.incomingRequests.map((item) => (
                    <div key={item.id} className="mb-2 rounded-2xl border border-border/60 bg-white p-3">
                      <div className="flex items-center gap-3"><ProfileAvatar resident={item.resident} size="h-10 w-10" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{displayName(item.resident)}</p><p className="text-[11px] text-muted-foreground">Wants to connect</p></div></div>
                      <div className="mt-3 flex gap-2"><Button size="sm" className="h-8 flex-1" disabled={working} onClick={() => void updateRequest(item.id, "ACCEPT")}><Check className="h-3.5 w-3.5" />Accept</Button><Button size="sm" variant="secondary" className="h-8" disabled={working} onClick={() => void updateRequest(item.id, "DECLINE")}>Decline</Button></div>
                    </div>
                  ))}
                  {!data?.incomingRequests.length && <p className="px-2 pb-5 text-xs text-muted-foreground">No incoming requests.</p>}
                  <p className="px-2 pb-2 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sent</p>
                  {data?.outgoingRequests.map((item) => <div key={item.id} className="mb-2 flex items-center gap-3 rounded-2xl px-3 py-2"><ProfileAvatar resident={item.resident} size="h-9 w-9" /><p className="min-w-0 flex-1 truncate text-sm">{displayName(item.resident)}</p><button type="button" disabled={working} onClick={() => void cancelRequest(item.id)} className="text-[10px] font-semibold text-muted-foreground hover:text-danger">Cancel</button></div>)}
                  {!data?.outgoingRequests.length && <p className="px-2 text-xs text-muted-foreground">No sent requests.</p>}
                </div>
              ) : tab === "directory" ? (
                <div className="space-y-2">
                  <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/15 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm"><Users className="h-5 w-5" /></span>
                      <div><p className="text-sm font-bold">Your EcoRewards community</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Find residents, send a request, or open a chat with a friend.</p></div>
                    </div>
                  </div>
                  {directoryLoading && !directoryResidents.length && <div className="space-y-2 pt-1" aria-label="Loading residents">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-muted/70" />)}</div>}
                  {directoryResidents.map((resident) => (
                    <article key={resident.id} className="rounded-2xl border border-border/60 bg-white p-3 transition hover:border-primary/20 hover:shadow-sm">
                      <div className="flex items-center gap-3">
                        <ProfileAvatar resident={resident} size="h-11 w-11" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{displayName(resident)}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {resident.isFriend ? "EcoRewards friend" : resident.incomingRequest ? "Invited you to connect" : resident.outgoingRequest ? "Request pending" : "EcoRewards resident"}
                            {resident.mutualCount > 0 && ` · ${resident.mutualCount} mutual`}
                          </p>
                        </div>
                        {resident.isFriend && <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">FRIEND</span>}
                      </div>
                      <div className="mt-3 flex gap-2">
                        {resident.isFriend ? (
                          <Button size="sm" className="h-9 flex-1" onClick={() => openDirectoryFriend(resident)}><MessageCircle className="h-4 w-4" />Message</Button>
                        ) : resident.incomingRequest ? (
                          <Button size="sm" className="h-9 flex-1" disabled={working} onClick={() => void updateRequest(resident.incomingRequest!, "ACCEPT", resident.id)}><Check className="h-4 w-4" />Accept request</Button>
                        ) : resident.outgoingRequest ? (
                          <Button size="sm" variant="secondary" className="h-9 flex-1" disabled={working} onClick={() => void cancelRequest(resident.outgoingRequest!, resident.id)}><X className="h-4 w-4" />Cancel request</Button>
                        ) : (
                          <Button size="sm" className="h-9 flex-1" disabled={working} onClick={() => void sendFriendRequest(resident.qrCode, resident.id)}><UserPlus className="h-4 w-4" />Add friend</Button>
                        )}
                      </div>
                    </article>
                  ))}
                  {!directoryLoading && !directoryResidents.length && <EmptyList icon={<Search />} title="No residents found" text={search ? "Try another name or clear your search." : "Resident accounts will appear here once they are registered."} />}
                  {directoryHasMore && <Button variant="outline" className="w-full" disabled={directoryLoading} onClick={() => void loadMoreResidents()}>{directoryLoading ? "Loading..." : "Load more residents"}</Button>}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-white p-4 text-center">
                  {data?.ownProfile?.qrCode ? <div className="mx-auto mb-4 w-fit rounded-2xl bg-white p-3 shadow-sm"><QRCode value={data.ownProfile.qrCode} size={168} /></div> : <div className="mx-auto mb-4 flex h-44 w-44 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><QrCode className="h-10 w-10" /></div>}
                  <h2 className="font-semibold">{data?.ownProfile?.user.name ?? residentName}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Let another resident scan this code to find you.</p>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => { setTransferMode(false); setScannerError(null); setScannerOpen(true); }}><QrCode className="h-4 w-4" />Scan a QR code</Button>
                </div>
              )}
            </div>
          </aside>

          <section className={cn("relative flex min-w-0 flex-col", activeFriend ? "h-full min-h-0" : "h-full min-h-0 lg:flex", !activeFriend && "hidden")}>
            {activeFriend ? (
              <>
                <header className="flex min-h-[78px] items-center justify-between border-b border-border/70 px-4 sm:px-7">
                  <div className="flex min-w-0 items-center gap-3">
                    <button type="button" aria-label="Back to conversations" onClick={() => { setActiveFriendId(null); setActiveConversationId(null); setDetails(null); }} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>
                    <ProfileAvatar resident={activeFriend} size="h-11 w-11" />
                    <div className="min-w-0"><p className="truncate text-sm font-bold">{displayName(activeFriend)}</p><p className="mt-0.5 text-xs text-primary">EcoRewards friend</p></div>
                  </div>
                  <div className="flex items-center gap-1">
                    {onPickupMessages && (
                      <button
                        type="button"
                        title="Pickup support messages"
                        aria-label="Open pickup support messages"
                        onClick={onPickupMessages}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-primary transition hover:bg-primary/10"
                      >
                        <MapPin className="h-5 w-5" />
                      </button>
                    )}
                    <button type="button" title="Transfer points by scanning their QR code" onClick={() => void startTransferScan()} className="flex h-10 w-10 items-center justify-center rounded-full text-primary transition hover:bg-primary/10"><Wallet className="h-5 w-5" /></button>
                    <button type="button" title="Conversation appearance" onClick={() => setThemeOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"><Settings2 className="h-5 w-5" /></button>
                    <button type="button" title="Conversation settings" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen((open) => !open); setThemeOpen(false); }} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"><MoreHorizontal className="h-5 w-5" /></button>
                  </div>
                </header>

                {settingsOpen && <div className="absolute right-4 top-[68px] z-20 w-[min(300px,calc(100%-2rem))] overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-xl sm:right-7"><div className="px-3 pb-2 pt-2"><p className="text-sm font-semibold">Conversation settings</p><p className="mt-0.5 text-xs text-muted-foreground">Manage this connection and your inbox.</p></div><button type="button" onClick={() => setSettingsAction("unfriend")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition hover:bg-muted"><UserRoundX className="h-4 w-4 text-muted-foreground" /><span><span className="block font-medium">Unfriend</span><span className="text-xs text-muted-foreground">Remove from your friends</span></span></button><button type="button" onClick={() => setSettingsAction("block")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition hover:bg-danger/5"><Ban className="h-4 w-4 text-danger" /><span><span className="block font-medium text-danger">Block resident</span><span className="text-xs text-muted-foreground">Hide profiles and stop messages</span></span></button><button type="button" disabled={!activeConversationId} onClick={() => setSettingsAction("delete")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4 text-danger" /><span><span className="block font-medium text-danger">Delete conversation</span><span className="text-xs text-muted-foreground">Remove it from your inbox</span></span></button></div>}

                {themeOpen && <div className="absolute right-4 top-[68px] z-20 w-[min(340px,calc(100%-2rem))] rounded-2xl border border-border bg-white p-4 shadow-xl sm:right-7"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Shared chat appearance</p><button type="button" onClick={() => setThemeOpen(false)} aria-label="Close appearance settings" className="text-muted-foreground"><X className="h-4 w-4" /></button></div><p className="mt-1 text-xs text-muted-foreground">Changes are visible to both friends.</p><div className="mt-3 grid grid-cols-5 gap-2">{Object.entries(THEMES).map(([key, theme]) => <button key={key} type="button" title={theme.label} onClick={() => void saveTheme(key)} className={cn("h-10 rounded-xl border-2 transition hover:scale-105", currentDetails?.theme === key ? "border-primary" : "border-white shadow")} style={{ background: theme.background }} />)}</div><label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm hover:border-primary/40"><ImagePlus className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate">{backgroundFile?.name ?? "Upload background image"}</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setBackgroundFile(event.target.files?.[0] ?? null)} /></label>{backgroundFile && <Button size="sm" className="mt-2 w-full" disabled={working} onClick={() => void saveTheme()}>{working ? "Saving..." : "Share background"}</Button>}</div>}

                <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-8" style={{ background: currentTheme.background, ...(currentDetails?.backgroundImageUrl ? { backgroundImage: `linear-gradient(rgba(255,255,255,.72), rgba(255,255,255,.72)), url("${currentDetails.backgroundImageUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
                  <div className="mx-auto mb-5 max-w-sm text-center"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm"><MessageCircle className="h-3 w-3" />Your EcoRewards connection</span><p className="mt-2 text-xs text-muted-foreground">Messages are private between friends.</p></div>
                  {currentDetails?.messages.map((message) => {
                    const mine = message.senderId === residentId;
                    const reactionCounts = REACTIONS.map((reaction) => ({
                      ...reaction,
                      count: message.reactions.filter((item) => item.kind === reaction.kind).length,
                      selected: message.reactions.some(
                        (item) => item.kind === reaction.kind && item.userId === residentId,
                      ),
                    })).filter((reaction) => reaction.count > 0);
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "group mb-4 flex w-full flex-col",
                          message.systemMessage ? "items-center" : mine ? "items-end" : "items-start",
                        )}
                      >
                        <div
                          onPointerDown={(event) => {
                            if (
                              editMessageId !== message.id &&
                              !(event.target instanceof Element && event.target.closest("button,textarea"))
                            ) {
                              startReactionPress(message.id, event);
                            }
                          }}
                          onPointerUp={finishReactionPress}
                          onPointerCancel={finishReactionPress}
                          onPointerLeave={finishReactionPress}
                          onClick={() => {
                            if (editMessageId !== message.id) toggleReactionPicker(message.id);
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            finishReactionPress();
                            suppressNextMessageClickRef.current = false;
                            setReactionPickerId(message.id);
                          }}
                          onKeyDown={(event) => {
                            if (
                              editMessageId !== message.id &&
                              !(event.target instanceof Element && event.target.closest("button,textarea")) &&
                              (event.key === "Enter" || event.key === " ")
                            ) {
                              event.preventDefault();
                              toggleReactionPicker(message.id);
                            }
                          }}
                          tabIndex={editMessageId === message.id ? undefined : 0}
                          aria-label={editMessageId === message.id ? undefined : "Press to react to this message"}
                          title={editMessageId === message.id ? undefined : "Tap or hold to react"}
                          className={cn(
                          "relative max-w-[min(88%,560px)] rounded-2xl px-4 py-3 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                          message.systemMessage
                            ? "w-full border border-emerald-200/80 bg-white/85 text-foreground shadow-[0_8px_30px_rgba(25,80,54,0.08)]"
                            : mine
                              ? "rounded-br-md bg-primary text-white"
                              : "rounded-bl-md border border-white/70 bg-white/90 text-foreground",
                        )}>
                          {message.systemMessage && (
                            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">
                              <Wallet className="h-3.5 w-3.5" />
                              Points transfer receipt
                            </div>
                          )}
                          {editMessageId === message.id ? (
                            <div className="space-y-2">
                              <textarea
                                autoFocus
                                value={editMessageText}
                                onChange={(event) => setEditMessageText(event.target.value)}
                                onClick={(event) => event.stopPropagation()}
                                maxLength={2000}
                                rows={3}
                                aria-label="Edit message"
                                className="w-full resize-y rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                              />
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setEditMessageId(null); }}>Cancel</Button>
                                <Button size="sm" disabled={!editMessageText.trim() || working} onClick={(event) => { event.stopPropagation(); void saveDirectMessage(message.id); }}>Save</Button>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                          )}
                          <div className={cn(
                            "mt-2 flex items-center justify-end gap-1 text-[10px]",
                            message.systemMessage || !mine ? "text-muted-foreground" : "text-white/70",
                          )}>
                            {message.editedAt && <span className="mr-1">edited ·</span>}
                            {dateFormatter.format(new Date(message.createdAt))}
                            {mine && !message.systemMessage && <CheckCheck className="ml-0.5 h-3 w-3" />}
                            {mine && !message.systemMessage && editMessageId !== message.id && (
                              <span className="ml-2 flex gap-1">
                                <button
                                  type="button"
                                  aria-label="Edit message"
                                  title="Edit message"
                                  onClick={(event) => { event.stopPropagation(); setEditMessageId(message.id); setEditMessageText(message.content); }}
                                  className="rounded p-1 transition hover:bg-white/15"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Delete message"
                                  title="Delete message"
                                  onClick={(event) => { event.stopPropagation(); void deleteDirectMessage(message.id); }}
                                  className="rounded p-1 transition hover:bg-white/15"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            )}
                          </div>
                          <AnimatePresence>
                            {reactionPickerId === message.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.82, y: 8 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.88, y: 5 }}
                                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                                onClick={(event) => event.stopPropagation()}
                                className={cn(
                                  "absolute -top-[3.65rem] z-20 flex gap-1 rounded-2xl border border-border/70 bg-white/95 p-1.5 shadow-[0_12px_34px_rgba(20,45,36,0.2)] backdrop-blur",
                                  mine ? "right-2" : "left-2",
                                  message.systemMessage && "left-1/2 -translate-x-1/2",
                                )}
                              >
                                {REACTIONS.map((reaction) => {
                                  const selected = message.reactions.some(
                                    (item) => item.kind === reaction.kind && item.userId === residentId,
                                  );
                                  return (
                                    <button
                                      key={reaction.kind}
                                      type="button"
                                      aria-label={`${selected ? "Remove" : "React with"} ${reaction.label}`}
                                      title={reaction.label}
                                      onClick={() => {
                                        setReactionPickerId(null);
                                        void toggleMessageReaction(message.id, reaction.kind);
                                      }}
                                      className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-xl text-xl transition duration-150 hover:-translate-y-1 hover:scale-110 hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                        selected && "bg-primary/10 ring-1 ring-primary/30",
                                      )}
                                    >
                                      {reaction.emoji}
                                    </button>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className={cn(
                          "mt-1.5 flex max-w-[min(88%,560px)] flex-wrap items-center gap-1.5",
                          message.systemMessage ? "justify-center" : mine ? "justify-end" : "justify-start",
                        )}>
                          {reactionCounts.map((reaction) => (
                            <span
                              key={reaction.kind}
                              aria-label={`${reaction.label}, ${reaction.count} reactions${reaction.selected ? ", selected by you" : ""}`}
                              title={reaction.label}
                              className={cn(
                                "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs shadow-sm",
                                reaction.selected
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-white/80 bg-white/90 text-foreground",
                              )}
                            >
                              <span aria-hidden="true">{reaction.emoji}</span>
                              <span className="font-semibold">{reaction.count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {activeConversationId && !currentDetails && <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading conversation…</div>}
                  {!activeConversationId && <div className="flex flex-1 flex-col items-center justify-center text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/80 text-primary shadow-sm"><MessageCircle className="h-7 w-7" /></div><p className="font-semibold">Start a conversation</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Send a friendly message to {displayName(activeFriend)}.</p></div>}
                  <div ref={messageEndRef} />
                </div>

                <form onSubmit={(event) => void sendMessage(event)} className="flex items-end gap-2 border-t border-border/70 bg-white/90 px-3 py-3 sm:gap-3 sm:px-6">
                  <button type="button" title="Choose a shared conversation theme" onClick={() => setThemeOpen((open) => !open)} className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10"><ImagePlus className="h-5 w-5" /></button>
                  <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={2000} rows={1} placeholder={`Message ${displayName(activeFriend)}…`} className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                  <Button type="submit" size="icon" className="mb-0.5 h-10 w-10 shrink-0 rounded-full" disabled={!messageText.trim() || working} aria-label="Send message"><Send className="h-4 w-4" /></Button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[32px] bg-primary/10 text-primary"><MessageCircle className="h-10 w-10" /></div>
                <h2 className="text-xl font-bold">Your community, closer</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Choose a friend to start a conversation, or scan a resident QR code to connect.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3"><Button onClick={() => setTab("friends")}><Users className="h-4 w-4" />Browse friends</Button><Button variant="outline" onClick={() => { setScannerError(null); setScannerOpen(true); }}><QrCode className="h-4 w-4" />Scan a QR code</Button></div>
              </div>
            )}
          </section>
        </div>
      </section>

      {(error || notice) && <div role={error ? "alert" : "status"} className={cn("fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-xl", error ? "bg-danger text-white" : "bg-primary text-white")}><span>{error ?? notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => { setError(null); setNotice(null); }}><X className="h-4 w-4" /></button></div>}

      {scannerOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="qr-dialog-title"><div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><h2 id="qr-dialog-title" className="text-lg font-bold">{transferMode ? "Transfer points" : "Scan to connect"}</h2><p className="mt-1 text-sm text-muted-foreground">{transferMode ? "Scan your friend's QR code to choose a recipient." : "Scanning a resident's QR code connects you as friends right away."}</p></div><button type="button" aria-label="Close scanner" onClick={() => setScannerOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div><div id="resident-qr-reader" className="mt-5 min-h-60 overflow-hidden rounded-2xl bg-slate-950" />{scannerError && <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{scannerError}</p>}<p className="mt-3 text-center text-xs text-muted-foreground">Allow camera access and hold the QR code inside the frame.</p></div></div>}

      {profile && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="resident-profile-title"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><div className="flex justify-end"><button type="button" aria-label="Close profile" onClick={() => { setProfile(null); setTransferMode(false); }} className="text-muted-foreground"><X className="h-5 w-5" /></button></div><div className="flex flex-col items-center text-center"><ProfileAvatar resident={profile} size="h-20 w-20" /><h2 id="resident-profile-title" className="mt-3 text-lg font-bold">{displayName(profile)}</h2><p className="text-xs text-muted-foreground">{profile.isFriend ? "Your EcoRewards friend" : "Resident profile"}</p></div>{profile.mutualFriends.length > 0 && <div className="mt-5 rounded-2xl bg-muted/50 p-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">Mutual friends · {profile.mutualFriends.length}</p><div className="flex flex-wrap gap-2">{profile.mutualFriends.map((friend) => <span key={friend.id} title={displayName(friend)}><ProfileAvatar resident={friend} size="h-8 w-8" /></span>)}</div></div>}{transferMode && profile.isFriend ? <form onSubmit={(event) => void submitTransfer(event)} className="mt-5 space-y-3"><div className="rounded-xl bg-primary/5 p-3 text-sm"><span className="text-muted-foreground">Your balance</span><strong className="float-right text-primary">{transferBalance.toLocaleString("en-US")} pts</strong></div><label className="block text-left text-xs font-medium">Points to send<input type="number" min="1" max="10000" step="1" required value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50" placeholder="Maximum 10,000" /></label><p className="text-xs text-muted-foreground">No fee. Up to 10,000 points per transfer. The transfer cannot be undone.</p><Button type="submit" className="w-full" disabled={working || !transferAmount || Number(transferAmount) > transferBalance}><Wallet className="h-4 w-4" />{working ? "Sending..." : `Confirm and send${transferAmount ? ` ${Number(transferAmount).toLocaleString("en-US")} pts` : ""}`}</Button></form> : <div className="mt-5 space-y-2">{profile.incomingRequest ? <Button className="w-full" disabled={working} onClick={() => void updateRequest(profile.incomingRequest!, "ACCEPT")}><Check className="h-4 w-4" />Accept friend request</Button> : profile.isFriend ? <><Button className="w-full" onClick={() => { const friend = data?.friends.find((item) => item.id === profile.id); if (friend) openFriend(friend); setProfile(null); }}><MessageCircle className="h-4 w-4" />Message friend</Button><Button variant="outline" className="w-full" onClick={() => { setTransferMode(true); void loadTransferBalance(); }}><Wallet className="h-4 w-4" />Transfer points</Button></> : profile.outgoingRequest ? <Button variant="secondary" className="w-full" disabled={working} onClick={() => void cancelRequest(profile.outgoingRequest!)}><X className="h-4 w-4" />Cancel friend request</Button> : <Button className="w-full" disabled={working} onClick={() => void sendFriendRequest()}><UserPlus className="h-4 w-4" />Send friend request</Button>}</div>}</div></div>}

      {settingsAction && activeFriend && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="conversation-action-title"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><div className={cn("mx-auto flex h-12 w-12 items-center justify-center rounded-2xl", settingsAction === "delete" ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary")}>{settingsAction === "block" ? <Ban className="h-5 w-5" /> : settingsAction === "delete" ? <Trash2 className="h-5 w-5" /> : <UserRoundX className="h-5 w-5" />}</div><h2 id="conversation-action-title" className="mt-4 text-center text-lg font-bold">{settingsAction === "unfriend" ? "Unfriend this resident?" : settingsAction === "block" ? "Block this resident?" : "Delete this conversation?"}</h2><p className="mt-2 text-center text-sm leading-6 text-muted-foreground">{settingsAction === "unfriend" ? `${displayName(activeFriend)} will be removed from your friends. You can reconnect later by sending a new friend request.` : settingsAction === "block" ? `${displayName(activeFriend)} will be removed from your friends and hidden from your directory. Neither of you can view the other's profile or send messages.` : "This removes the conversation from your inbox. It does not delete the other resident's copy."}</p><div className="mt-6 flex gap-3"><Button type="button" variant="secondary" className="flex-1" disabled={working} onClick={() => setSettingsAction(null)}>Keep</Button><Button type="button" variant={settingsAction === "unfriend" ? "default" : "destructive"} className="flex-1" disabled={working} onClick={() => void updateConversation(settingsAction)}>{working ? "Please wait..." : settingsAction === "unfriend" ? "Unfriend" : settingsAction === "block" ? "Block resident" : "Delete chat"}</Button></div></div></div>}

      {loading && <span className="sr-only" aria-live="polite">Loading messenger</span>}
    </main>
  );
}

export function ResidentMessagingHub({
  residentName,
  residentId,
}: {
  residentName: string;
  residentId: string;
}) {
  const [showPickupMessages, setShowPickupMessages] = useState(false);

  if (showPickupMessages) {
    return (
      <main className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-white/90 px-4 py-3 sm:px-6">
            <div>
              <h1 className="font-semibold">Pickup support messages</h1>
              <p className="text-xs text-muted-foreground">Updates and conversations about your collection requests.</p>
            </div>
            <Button variant="outline" onClick={() => setShowPickupMessages(false)}>
              <MessageCircle className="h-4 w-4" />
              Friend messages
            </Button>
          </header>
          <section className="min-h-0 flex-1">
            <PickupMessenger userId={residentId} role="RESIDENT" fullScreen />
          </section>
      </main>
    );
  }

  return (
    <ResidentMessenger
      residentName={residentName}
      residentId={residentId}
      onPickupMessages={() => setShowPickupMessages(true)}
    />
  );
}

function EmptyList({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return <div className="flex flex-col items-center px-5 py-10 text-center"><span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</span><p className="text-sm font-semibold">{title}</p><p className="mt-1 max-w-[220px] text-xs leading-5 text-muted-foreground">{text}</p>{action && onAction && <button type="button" className="mt-3 text-xs font-semibold text-primary hover:underline" onClick={onAction}>{action}</button>}</div>;
}
