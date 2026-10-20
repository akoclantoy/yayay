"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Recycle,
  LayoutDashboard,
  Wallet,
  History,
  MapPin,
  Calendar,
  Truck,
  Gift,
  Trophy,
  Award,
  Leaf,
  Bell,
  MessageCircle,
  User,
  QrCode,
  ScanLine,
  ClipboardList,
  Users,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { APP_NAME, ROLE_LABELS } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { FriendTogetherCelebration, type FriendTogetherProfile } from "@/components/messaging/friend-together-celebration";
import type { UserRole } from "@/generated/prisma/enums";

type NavItem = { href: string; label: string; icon: React.ElementType };
type FriendTogetherNotification = {
  id: string;
  title: string;
  link: string | null;
  read: boolean;
};

const RESIDENT_NAV: NavItem[] = [
  { href: "/resident", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resident/wallet", label: "Reward Wallet", icon: Wallet },
  { href: "/resident/qr-card", label: "QR Card", icon: QrCode },
  { href: "/resident/centers", label: "Nearby Center", icon: MapPin },
  { href: "/resident/history", label: "Collection History", icon: History },
  { href: "/resident/pickup", label: "Request Pickup", icon: Truck },
  { href: "/resident/schedule", label: "Schedule", icon: Calendar },
  { href: "/resident/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/resident/badges", label: "Badges", icon: Award },
  { href: "/resident/impact", label: "Environmental Impact", icon: Leaf },
  { href: "/resident/notifications", label: "Notifications", icon: Bell },
  { href: "/resident/profile", label: "Profile", icon: User },
];

const STAFF_NAV: NavItem[] = [
  { href: "/staff", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff/scan", label: "Scan QR", icon: ScanLine },
  { href: "/staff/record", label: "Record Recycling", icon: ClipboardList },
  { href: "/staff/pickups", label: "Manage Pickups", icon: Truck },
  { href: "/staff/messages", label: "Messenger", icon: MessageCircle },
  { href: "/staff/reports", label: "Reports", icon: History },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/barangays", label: "Barangays", icon: Building2 },
  { href: "/admin/centers", label: "Collection Centers", icon: MapPin },
  { href: "/admin/waste", label: "Waste Categories", icon: Recycle },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/badges", label: "Badges & bonuses", icon: Award },
  { href: "/admin/pickups", label: "Pickup Requests", icon: Truck },
  { href: "/admin/redemptions", label: "Redemptions", icon: Wallet },
  { href: "/admin/announcements", label: "Announcements", icon: Bell },
  { href: "/admin/reports", label: "Reports", icon: ClipboardList },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  RESIDENT: RESIDENT_NAV,
  COLLECTION_STAFF: STAFF_NAV,
  BARANGAY_STAFF: STAFF_NAV,
  ADMIN: ADMIN_NAV,
  GUEST: [],
};

const ROLE_CONTEXT: Record<UserRole, { label: string; eyebrow: string }> = {
  RESIDENT: { label: "Resident portal", eyebrow: "Your sustainability journey" },
  COLLECTION_STAFF: { label: "Operations portal", eyebrow: "Collection operations" },
  BARANGAY_STAFF: { label: "Operations portal", eyebrow: "Barangay operations" },
  ADMIN: { label: "Admin portal", eyebrow: "Platform control center" },
  GUEST: { label: "EcoRewards", eyebrow: "Community recycling" },
};

export function DashboardShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: UserRole;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [unreadByLink, setUnreadByLink] = useState<Record<string, number>>({});
  const [friendTogether, setFriendTogether] = useState<FriendTogetherProfile | null>(null);
  const processedFriendNotificationsRef = useRef(new Set<string>());
  const friendCelebrationTimerRef = useRef<number | null>(null);
  const nav = NAV_BY_ROLE[role] ?? RESIDENT_NAV;
  const context = ROLE_CONTEXT[role] ?? ROLE_CONTEXT.RESIDENT;
  const activeItem = nav.find((item) => pathname === item.href || (item.href !== "/resident" && item.href !== "/staff" && item.href !== "/admin" && pathname.startsWith(item.href)));
  const activeHref = activeItem?.href;
  const refreshUnreadActivity = useCallback(async () => {
    const response = await fetch("/api/notifications?unreadByLink=1", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Could not load unread activity.");
    }
    const activity: unknown = await response.json();
    if (typeof activity !== "object" || activity === null || Array.isArray(activity)) {
      throw new Error("Unread activity response was invalid.");
    }
    setUnreadByLink(activity as Record<string, number>);
  }, []);

  const refreshFriendTogether = useCallback(async () => {
    const notificationsResponse = await fetch("/api/notifications", { cache: "no-store" });
    if (!notificationsResponse.ok) {
      throw new Error("Could not load friend connection activity.");
    }
    const notifications = (await notificationsResponse.json()) as FriendTogetherNotification[];
    const notification = notifications.find(
      (item) =>
        !item.read &&
        item.title === "Your Friend Together" &&
        !processedFriendNotificationsRef.current.has(item.id) &&
        item.link,
    );
    if (!notification?.link) return;

    const friendId = new URL(notification.link, window.location.origin).searchParams.get("friendId");
    if (!friendId) return;
    const friendsResponse = await fetch("/api/resident/friends", { cache: "no-store" });
    if (!friendsResponse.ok) {
      throw new Error("Could not load your new friend.");
    }
    const friendData = (await friendsResponse.json()) as {
      friends: FriendTogetherProfile[];
    };
    const friend = friendData.friends.find((item) => item.id === friendId);
    if (!friend || processedFriendNotificationsRef.current.has(notification.id)) return;

    processedFriendNotificationsRef.current.add(notification.id);
    setFriendTogether(friend);
    if (friendCelebrationTimerRef.current !== null) {
      window.clearTimeout(friendCelebrationTimerRef.current);
    }
    friendCelebrationTimerRef.current = window.setTimeout(() => {
      setFriendTogether(null);
      friendCelebrationTimerRef.current = null;
    }, 3000);

    const readResponse = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notification.id }),
    });
    if (!readResponse.ok) {
      throw new Error("Could not mark the friend connection notification as viewed.");
    }
  }, []);

  useEffect(() => {
    if (role !== "RESIDENT" || !session?.user?.id) return;
    const refresh = () => {
      void refreshFriendTogether().catch((error: unknown) => {
        console.error("[dashboard] Could not refresh friend connection activity:", error);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => window.clearInterval(timer);
  }, [refreshFriendTogether, role, session?.user?.id]);

  useEffect(() => () => {
    if (friendCelebrationTimerRef.current !== null) {
      window.clearTimeout(friendCelebrationTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    const events = new EventSource("/api/realtime");
    const refresh = () => {
      void refreshUnreadActivity().catch((error: unknown) => {
        console.error("[dashboard] Could not refresh unread activity:", error);
      });
      if (role === "RESIDENT") {
        void refreshFriendTogether().catch((error: unknown) => {
          console.error("[dashboard] Could not refresh friend connection activity:", error);
        });
      }
    };
    events.addEventListener("open", refresh);
    events.addEventListener("invalidate", refresh);
    return () => {
      events.removeEventListener("open", refresh);
      events.removeEventListener("invalidate", refresh);
      events.close();
    };
  }, [refreshFriendTogether, refreshUnreadActivity, role, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !activeHref) return;
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link: activeHref }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not clear section activity.");
        return refreshUnreadActivity();
      })
      .catch((error: unknown) => {
        console.error("[dashboard] Could not mark section activity as viewed:", error);
      });
  }, [activeHref, refreshUnreadActivity, session?.user?.id]);

  if (role === "RESIDENT" && pathname === "/resident/messages") {
    return (
      <>
        {children}
        <FriendTogetherCelebration
          resident={{
            id: session?.user?.id ?? "",
            name: session?.user?.name ?? "Resident",
            image: session?.user?.image ?? null,
          }}
          friend={friendTogether}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen flex flex-col glass border-r border-border/50 transition-all duration-300",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
          <div className="flex h-20 items-center justify-between px-4 border-b border-border/70">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <Recycle className="h-4 w-4" />
                {role === "RESIDENT" && (
                  <FriendTogetherCelebration
                    resident={{
                      id: session?.user?.id ?? "",
                      name: session?.user?.name ?? "Resident",
                      image: session?.user?.image ?? null,
                    }}
                    friend={friendTogether}
                  />
                )}
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight">{APP_NAME}</span>
                <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{context.label}</span>
              </div>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden h-8 w-8 flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {nav.map((item) => {
            const hasUnreadActivity = (unreadByLink[item.href] ?? 0) > 0;
            const active =
              pathname === item.href ||
              (item.href !== `/${role.toLowerCase().replace("_", "")}` &&
                item.href !== "/resident" &&
                item.href !== "/staff" &&
                item.href !== "/admin" &&
                pathname.startsWith(item.href));
            const isRoot =
              item.href === "/resident" ||
              item.href === "/staff" ||
              item.href === "/admin";
            const isActive = isRoot ? pathname === item.href : active;
            const NavigationLink =
              item.href === "/resident/badges" ? "a" : Link;

            return (
              <motion.div
                key={item.href}
                whileHover={{ x: 2 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                <NavigationLink
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.98]",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  aria-label={collapsed ? `${item.label}${hasUnreadActivity ? ", new activity" : ""}` : undefined}
                  title={collapsed && hasUnreadActivity ? `${item.label} has new activity` : undefined}
                >
                  <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                    <item.icon className="h-4 w-4" />
                    {hasUnreadActivity && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background shadow-[0_0_10px_rgba(239,68,68,0.45)]"
                      />
                    )}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </NavigationLink>
              </motion.div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/50">
          <div className={cn("flex items-center gap-3 rounded-xl bg-muted/60 p-2", collapsed && "justify-center bg-transparent p-0")}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback>{getInitials(session?.user?.name)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session?.user?.name}</p>
                <p className="text-xs text-primary truncate">
                  {role === "COLLECTION_STAFF" || role === "BARANGAY_STAFF" ? "Staff" : ROLE_LABELS[role]}
                </p>
                <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 justify-start text-muted-foreground"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[margin] duration-300",
          collapsed ? "lg:ml-[72px]" : "lg:ml-64"
        )}
      >
        <header className="sticky top-0 z-30 flex min-h-20 items-center gap-4 border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{context.eyebrow}</p>
            <p className="truncate text-sm font-semibold">{activeItem?.label ?? context.label}</p>
          </div>
          {role === "RESIDENT" && (
            <>
              <Link href="/resident/messages" aria-label="Open messenger">
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <span className="relative">
                    <MessageCircle />
                    {(unreadByLink["/resident/messages"] ?? 0) > 0 && (
                      <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                    )}
                  </span>
                </Button>
              </Link>
              <Link href="/resident/notifications" aria-label="View notifications">
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <span className="relative">
                    <Bell />
                    {(unreadByLink["/resident/notifications"] ?? 0) > 0 && (
                      <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                    )}
                  </span>
                </Button>
              </Link>
            </>
          )}
          {(role === "COLLECTION_STAFF" || role === "BARANGAY_STAFF") && (
            <Link href="/staff/messages" aria-label="Open messenger">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <span className="relative">
                  <MessageCircle />
                  {(unreadByLink["/staff/messages"] ?? 0) > 0 && (
                    <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                  )}
                </span>
              </Button>
            </Link>
          )}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-xs font-medium text-muted-foreground">Live</span>
          </div>
        </header>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 overflow-auto bg-gradient-to-b from-background to-muted/30 p-4 lg:p-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
