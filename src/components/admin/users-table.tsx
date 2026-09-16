"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/generated/prisma/enums";
import { RemoveStaffButton } from "@/components/admin/remove-staff-button";

type User = {
  id: string;
  name: string | null;
  email: string;
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Joined</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-4 font-medium">
                    <div>{user.name ?? "—"}</div>
                    {(user.role === "COLLECTION_STAFF" || user.role === "BARANGAY_STAFF") && (
                      <div className="text-xs font-normal text-primary">Staff</div>
                    )}
                  </td>
                  <td className="py-3 pr-4">{user.email}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={user.isActive ? "success" : "warning"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 text-right">
                    {(user.role === "COLLECTION_STAFF" || user.role === "BARANGAY_STAFF") && (
                      <RemoveStaffButton userId={user.id} name={user.name ?? user.email} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardContent>
  );
}