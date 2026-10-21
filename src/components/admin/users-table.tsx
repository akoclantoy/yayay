"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, STAFF_PROFILE_IMAGE } from "@/lib/constants";
import { formatDate, getInitials } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/enums";
import { RemoveStaffButton } from "@/components/admin/remove-staff-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type User = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
};

export function UsersTable({ users }: { users: User[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        [user.name, user.email, ROLE_LABELS[user.role]].some((value) =>
          value?.toLowerCase().includes(normalizedQuery)
        )
      ),
    [normalizedQuery, users]
  );

  return (
    <CardContent>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, or role"
            aria-label="Search users by name, email, or role"
            className="h-10 rounded-xl border-border/70 bg-background/70 pl-9 pr-10 shadow-sm transition-all placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:ring-primary/20"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setQuery("")}
              aria-label="Clear user search"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {normalizedQuery
            ? `${filteredUsers.length} of ${users.length} users`
            : `${users.length} users`}
        </p>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
          <Search className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
          <p className="font-medium">No users found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different name, email, or role.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/35">
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredUsers.map((user) => {
                const isStaff =
                  user.role === "COLLECTION_STAFF" ||
                  user.role === "BARANGAY_STAFF";
                const photo = isStaff ? STAFF_PROFILE_IMAGE : user.image;

                return (
                  <tr
                    key={user.id}
                    className="group transition-colors hover:bg-muted/25"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-11 w-11 border-2 border-background shadow-sm ring-1 ring-border/70">
                          <AvatarImage
                            src={photo ?? undefined}
                            alt={`${user.name ?? user.email}'s profile picture`}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                            {getInitials(user.name ?? user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {user.name ?? "Name not provided"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={user.role === "ADMIN" ? "default" : "secondary"}
                        className="whitespace-nowrap"
                      >
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={user.isActive ? "success" : "warning"}>
                        <span
                          aria-hidden="true"
                          className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                            user.isActive ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {isStaff && (
                        <RemoveStaffButton
                          userId={user.id}
                          name={user.name ?? user.email}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CardContent>
  );
}