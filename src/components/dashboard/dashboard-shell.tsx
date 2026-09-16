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
  Bot,
  Bell,
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
import { useState } from "react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/enums";

type NavItem = { href: string; label: string; icon: React.ElementType };

const RESIDENT_NAV: NavItem[] = [
  { href: "/resident", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resident/wallet", label: "Reward Wallet", icon: Wallet },
  { href: "/resident/qr-card", label: "QR Card", icon: QrCode },
  { href: "/resident/history", label: "Collection History", icon: History },
  { href: "/resident/pickup", label: "Request Pickup", icon: Truck },
  { href: "/resident/centers", label: "Nearby Centers", icon: MapPin },
  { href: "/resident/schedule", label: "Schedule", icon: Calendar },
  { href: "/resident/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/resident/badges", label: "Badges", icon: Award },
  { href: "/resident/impact", label: "Environmental Impact", icon: Leaf },
  { href: "/resident/assistant", label: "AI Assistant", icon: Bot },
  { href: "/resident/notifications", label: "Notifications", icon: Bell },
  { href: "/resident/profile", label: "Profile", icon: User },
];

const STAFF_NAV: NavItem[] = [
  { href: "/staff", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff/scan", label: "Scan QR", icon: ScanLine },
  { href: "/staff/record", label: "Record Recycling", icon: ClipboardList },
  { href: "/staff/pickups", label: "Manage Pickups", icon: Truck },
  { href: "/staff/routes", label: "Routes", icon: MapPin },
  { href: "/staff/reports", label: "Reports", icon: History },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/barangays", label: "Barangays", icon: Building2 },
  { href: "/admin/centers", label: "Collection Centers", icon: MapPin },
  { href: "/admin/waste", label: "Waste Categories", icon: Recycle },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
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
  const nav = NAV_BY_ROLE[role] ?? RESIDENT_NAV;

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
          "fixed lg:sticky top-0 z-50 h-screen flex flex-col glass border-r border-border/50 transition-all duration-300",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-border/50">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Recycle className="h-4 w-4 text-primary" />
              </div>
              <span className="font-bold text-sm">{APP_NAME}</span>
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

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {nav.map((item) => {
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

            return (
              <motion.div
                key={item.href}
                whileHover={{ x: 2 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/50">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback>{getInitials(session?.user?.name)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session?.user?.name}</p>
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 glass px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
        </header>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 p-4 lg:p-6 overflow-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
