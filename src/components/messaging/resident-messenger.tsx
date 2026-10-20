"use client";

import Link from "next/link";
import QRCode from "react-qr-code";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ImagePlus,
  Leaf,
  MessageCircle,
  MoreHorizontal,
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
import { cn } from "@/lib/utils";

type Resident = { id: string; name: string | null; image: string | null; qrCode?: string };
type Friend = Resident & { createdAt?: string };
type FriendRequest = { id: string; resident: Resident; createdAt: string };
type Message = { id: string; senderId: string; content: string; createdAt: string };
type Conversation = {
  id: string;
  theme: string;
  backgroundImageUrl: string | null;
  friend: Resident;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
};
type FriendProfile = Resident & {
  isFriend: boolean;
  outgoingRequest: string | null;
  incomingRequest: string | null;
  mutualFriends: Resident[];
};
type ConversationDetails = Conversation & { messages: Message[] };
type MessengerData = {
  ownProfile: { qrCode: string; user: { name: string | null; image: string | null } } | null;
  friends: Friend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
};
type Tab = "inbox" | "friends" | "requests" | "profile";

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
  residentImage,
}: {
  residentName: string;
  residentImage: string | null;
}) {
  const [tab, setTab] = useState<Tab>("inbox");
  const [data, setData] = useState<MessengerData | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
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
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const activeFriend = useMemo(() => {
    if (details) return details.friend;
    return data?.friends.find((friend) => friend.id === activeFriendId) ?? null;
  }, [activeFriendId, data?.friends, details]);

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
  }, []);

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
    if (!activeConversationId) {
      setDetails(null);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        await loadDetails(activeConversationId);
      } catch (cause) {
        if (active) setError(getErrorMessage(cause));
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeConversationId, loadDetails]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [details?.messages.length]);

  useEffect(() => {
    if (!scannerOpen) return;
    let active = true;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
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
            void lookupQr(decodedText);
            void scanner?.stop();
            setScannerOpen(false);
          },
          () => undefined,
        );
      } catch (cause) {
        if (active) setScannerError(getErrorMessage(cause));
      }
    };
    void startScanner();
    return () => {
      active = false;
      if (scanner) {
        void scanner.stop().catch((cause: unknown) => {
          console.error("[resident-messenger] Could not stop QR scanner:", cause);
        });
        void scanner.clear().catch((cause: unknown) => {
          console.error("[resident-messenger] Could not clear QR scanner:", cause);
        });
      }
    };
  }, [scannerOpen]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return conversations.filter((item) => displayName(item.friend).toLocaleLowerCase().includes(query));
  }, [conversations, search]);

  const filteredFriends = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (data?.friends ?? []).filter((friend) => displayName(friend).toLocaleLowerCase().includes(query));
  }, [data?.friends, search]);

  async function lookupQr(qrCode: string) {
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
  }

  async function updateRequest(requestId: string, action: "ACCEPT" | "DECLINE") {
    setWorking(true);
    setError(null);
    try {
      await requestJson("/api/resident/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      await refresh();
      setNotice(action === "ACCEPT" ? "You are now friends." : "Friend request declined.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function sendFriendRequest() {
    if (!profile?.qrCode) {
      setError("This resident's QR code could not be loaded. Scan their QR code again.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await requestJson("/api/resident/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: profile.qrCode }),
      });
      setProfile({ ...profile, outgoingRequest: "sent" });
      await refresh();
      setNotice("Friend request sent.");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function cancelRequest(requestId: string) {
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
    if (!profile?.qrCode || !profile.isFriend) {
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
      const result = await requestJson<{ balance: number }>("/api/resident/points-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientQrCode: profile.qrCode, amount }),
      });
      setTransferBalance(result.balance);
      setTransferAmount("");
      setTransferMode(false);
      setNotice(`${amount.toLocaleString("en-US")} points sent to ${displayName(profile)}.`);
      setProfile(null);
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

  function openFriend(friend: Friend) {
    const conversation = conversations.find((item) => item.friend.id === friend.id);
    setActiveFriendId(friend.id);
    setActiveConversationId(conversation?.id ?? null);
    setDetails(null);
    setTab("inbox");
  }

  async function startTransferScan() {
    setProfile(null);
    setTransferMode(true);
    setScannerError(null);
    await loadTransferBalance();
    setScannerOpen(true);
  }

  const currentTheme = THEMES[details?.theme ?? "forest"] ?? THEMES.forest;

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-3 text-[var(--foreground)] sm:px-5 sm:py-5">
      <section className="mx-auto flex min-h-[calc(100svh-1.5rem)] max-w-[1600px] flex-col overflow-hidden rounded-[28px] border border-border/80 bg-white/85 shadow-[0_20px_80px_rgba(24,50,42,0.12)] backdrop-blur-xl sm:min-h-[calc(100svh-2.5rem)]">
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-border/70 px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/resident" aria-label="Return to resident dashboard" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition hover:bg-muted hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight sm:text-base">EcoRewards Messenger</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Good conversations grow greener communities</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">Hello, {residentName.split(" ")[0]}</span>
            <ProfileAvatar resident={{ id: "me", name: residentName, image: residentImage }} size="h-9 w-9" />
            <Link href="/resident" aria-label="Return to resident dashboard" title="Back to dashboard" className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-primary transition hover:bg-accent/35">
              <Recycle className="h-5 w-5" />
            </Link>
          </div>
        </header>

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
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </label>
            </div>

            <nav className="grid grid-cols-4 gap-1 px-4 pb-3" aria-label="Messenger sections">
              {([
                ["inbox", "Inbox", MessageCircle],
                ["friends", "Friends", Users],
                ["requests", "Requests", UserPlus],
                ["profile", "My QR", QrCode],
              ] as const).map(([key, label, Icon]) => (
                <button key={key} type="button" onClick={() => { setTab(key); setActiveFriendId(null); setActiveConversationId(null); setDetails(null); setProfile(null); }} className={cn("flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition", tab === key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground")}>
                  <Icon className="h-4 w-4" />
                  {label}
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
                    <button key={item.id} type="button" onClick={() => { setActiveFriendId(item.friend.id); setActiveConversationId(item.id); setDetails(null); }} className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-muted/60", activeConversationId === item.id && "bg-primary/8")}>
                      <ProfileAvatar resident={item.friend} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{displayName(item.friend)}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{item.lastMessage ? dateFormatter.format(new Date(item.lastMessage.createdAt)) : ""}</span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{item.lastMessage?.content ?? "Start a conversation"}</span>
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
                  {data?.outgoingRequests.map((item) => <div key={item.id} className="mb-2 flex items-center gap-3 rounded-2xl px-3 py-2"><ProfileAvatar resident={item.resident} size="h-9 w-9" /><p className="min-w-0 flex-1 truncate text-sm">{displayName(item.resident)}</p><span className="text-[10px] text-muted-foreground">Pending</span></div>)}
                  {!data?.outgoingRequests.length && <p className="px-2 text-xs text-muted-foreground">No sent requests.</p>}
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

          <section className={cn("relative flex min-h-[60svh] min-w-0 flex-col lg:min-h-0", !activeFriend && "hidden lg:flex")}>
            {activeFriend ? (
              <>
                <header className="flex min-h-[78px] items-center justify-between border-b border-border/70 px-4 sm:px-7">
                  <div className="flex min-w-0 items-center gap-3">
                    <button type="button" aria-label="Back to conversations" onClick={() => { setActiveFriendId(null); setActiveConversationId(null); setDetails(null); }} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted lg:hidden"><ArrowLeft className="h-4 w-4" /></button>
                    <ProfileAvatar resident={activeFriend} size="h-11 w-11" />
                    <div className="min-w-0"><p className="truncate text-sm font-bold">{displayName(activeFriend)}</p><p className="mt-0.5 text-xs text-primary">EcoRewards friend</p></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" title="Transfer points by scanning their QR code" onClick={() => void startTransferScan()} className="flex h-10 w-10 items-center justify-center rounded-full text-primary transition hover:bg-primary/10"><Wallet className="h-5 w-5" /></button>
                    <button type="button" title="Conversation appearance" onClick={() => setThemeOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"><Settings2 className="h-5 w-5" /></button>
                    <button type="button" title="View mutual friends" onClick={() => { const friend = data?.friends.find((item) => item.id === activeFriend.id); if (friend?.qrCode) void lookupQr(friend.qrCode); }} className="hidden h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted sm:flex"><MoreHorizontal className="h-5 w-5" /></button>
                  </div>
                </header>

                {themeOpen && <div className="absolute right-4 top-[68px] z-20 w-[min(340px,calc(100%-2rem))] rounded-2xl border border-border bg-white p-4 shadow-xl sm:right-7"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Shared chat appearance</p><button type="button" onClick={() => setThemeOpen(false)} aria-label="Close appearance settings" className="text-muted-foreground"><X className="h-4 w-4" /></button></div><p className="mt-1 text-xs text-muted-foreground">Changes are visible to both friends.</p><div className="mt-3 grid grid-cols-5 gap-2">{Object.entries(THEMES).map(([key, theme]) => <button key={key} type="button" title={theme.label} onClick={() => void saveTheme(key)} className={cn("h-10 rounded-xl border-2 transition hover:scale-105", details?.theme === key ? "border-primary" : "border-white shadow")} style={{ background: theme.background }} />)}</div><label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm hover:border-primary/40"><ImagePlus className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate">{backgroundFile?.name ?? "Upload background image"}</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setBackgroundFile(event.target.files?.[0] ?? null)} /></label>{backgroundFile && <Button size="sm" className="mt-2 w-full" disabled={working} onClick={() => void saveTheme()}>{working ? "Saving..." : "Share background"}</Button>}</div>}

                <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-8" style={{ background: currentTheme.background, ...(details?.backgroundImageUrl ? { backgroundImage: `linear-gradient(rgba(255,255,255,.72), rgba(255,255,255,.72)), url("${details.backgroundImageUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
                  <div className="mx-auto mb-5 max-w-sm text-center"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm"><Leaf className="h-3 w-3" />Your EcoRewards connection</span><p className="mt-2 text-xs text-muted-foreground">Messages are private between friends.</p></div>
                  {details?.messages.map((message) => {
                    const mine = message.senderId !== activeFriend.id;
                    return <div key={message.id} className={cn("mb-3 flex w-full", mine ? "justify-end" : "justify-start")}><div className={cn("max-w-[min(82%,520px)] rounded-2xl px-4 py-2.5 shadow-sm", mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md border border-white/70 bg-white/90 text-foreground")}><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p><div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>{dateFormatter.format(new Date(message.createdAt))}{mine && <CheckCheck className="h-3 w-3" />}</div></div></div>;
                  })}
                  {activeConversationId && !details && <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading conversation…</div>}
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

      {scannerOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="qr-dialog-title"><div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><h2 id="qr-dialog-title" className="text-lg font-bold">{transferMode ? "Transfer points" : "Scan a resident QR code"}</h2><p className="mt-1 text-sm text-muted-foreground">{transferMode ? "Scan your friend's QR code to choose a recipient." : "QR scanning is the only way to discover residents."}</p></div><button type="button" aria-label="Close scanner" onClick={() => setScannerOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div><div id="resident-qr-reader" className="mt-5 min-h-60 overflow-hidden rounded-2xl bg-slate-950" />{scannerError && <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{scannerError}</p>}<p className="mt-3 text-center text-xs text-muted-foreground">Allow camera access and hold the QR code inside the frame.</p></div></div>}

      {profile && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="resident-profile-title"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><div className="flex justify-end"><button type="button" aria-label="Close profile" onClick={() => { setProfile(null); setTransferMode(false); }} className="text-muted-foreground"><X className="h-5 w-5" /></button></div><div className="flex flex-col items-center text-center"><ProfileAvatar resident={profile} size="h-20 w-20" /><h2 id="resident-profile-title" className="mt-3 text-lg font-bold">{displayName(profile)}</h2><p className="text-xs text-muted-foreground">{profile.isFriend ? "Your EcoRewards friend" : "Resident profile"}</p></div>{profile.mutualFriends.length > 0 && <div className="mt-5 rounded-2xl bg-muted/50 p-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">Mutual friends · {profile.mutualFriends.length}</p><div className="flex flex-wrap gap-2">{profile.mutualFriends.map((friend) => <span key={friend.id} title={displayName(friend)}><ProfileAvatar resident={friend} size="h-8 w-8" /></span>)}</div></div>}{transferMode && profile.isFriend ? <form onSubmit={(event) => void submitTransfer(event)} className="mt-5 space-y-3"><div className="rounded-xl bg-primary/5 p-3 text-sm"><span className="text-muted-foreground">Your balance</span><strong className="float-right text-primary">{transferBalance.toLocaleString("en-US")} pts</strong></div><label className="block text-left text-xs font-medium">Points to send<input type="number" min="1" max="10000" step="1" required value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50" placeholder="Maximum 10,000" /></label><p className="text-xs text-muted-foreground">No fee. Up to 10,000 points per transfer. The transfer cannot be undone.</p><Button type="submit" className="w-full" disabled={working || !transferAmount || Number(transferAmount) > transferBalance}><Wallet className="h-4 w-4" />{working ? "Sending..." : `Confirm and send${transferAmount ? ` ${Number(transferAmount).toLocaleString("en-US")} pts` : ""}`}</Button></form> : <div className="mt-5 space-y-2">{profile.incomingRequest ? <Button className="w-full" disabled={working} onClick={() => void updateRequest(profile.incomingRequest!, "ACCEPT")}><Check className="h-4 w-4" />Accept friend request</Button> : profile.isFriend ? <><Button className="w-full" onClick={() => { const friend = data?.friends.find((item) => item.id === profile.id); if (friend) openFriend(friend); setProfile(null); }}><MessageCircle className="h-4 w-4" />Message friend</Button><Button variant="outline" className="w-full" onClick={() => { setTransferMode(true); void loadTransferBalance(); }}><Wallet className="h-4 w-4" />Transfer points</Button></> : profile.outgoingRequest ? <Button variant="secondary" className="w-full" disabled={working} onClick={() => void cancelRequest(profile.outgoingRequest!)}><X className="h-4 w-4" />Cancel friend request</Button> : <Button className="w-full" disabled={working} onClick={() => void sendFriendRequest()}><UserPlus className="h-4 w-4" />Send friend request</Button>}</div>}</div></div>}

      {loading && <span className="sr-only" aria-live="polite">Loading messenger</span>}
    </main>
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
