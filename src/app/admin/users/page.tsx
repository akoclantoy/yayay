import { db } from "@/lib/db";
import { ensureDemoUsers } from "@/lib/bootstrap-users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreateStaffForm } from "@/components/admin/create-staff-form";
import { UsersTable } from "@/components/admin/users-table";

function DatabaseErrorPanel({ message }: { message: string }) {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-destructive">Database not ready</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{message}</p>
        <div className="rounded-xl border border-border/50 bg-background p-4 space-y-2">
          <p className="font-medium">After creating a new Render database:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Open your Render web service → Environment</li>
            <li>Set <code className="text-foreground">DATABASE_URL</code> to the new Internal Database URL</li>
            <li>Redeploy the web service (this runs schema + seed automatically)</li>
            <li>Visit <code className="text-foreground">/api/health</code> to confirm users exist</li>
          </ol>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/api/health">Check database health</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">Back to dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

async function loadUsers() {
  try {
    await ensureDemoUsers();

    const users = await db.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        emailVerified: true,
      },
    });

    return { users, error: null };
  } catch (error) {
    return {
      users: [],
      error: error instanceof Error ? error.message : "Unable to load users from the database.",
    };
  }
}

export default async function AdminUsersPage() {
  const { users, error } = await loadUsers();

  if (error) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <p className="text-muted-foreground">User management is unavailable until the database is connected.</p>
        </div>
        <DatabaseErrorPanel message={error} />
      </div>
    );
  }

  return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <p className="text-muted-foreground">{users.length} registered users</p>
        </div>

        <CreateStaffForm />

        {users.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-muted-foreground">No users found in the database yet.</p>
              <p className="text-sm text-muted-foreground">
                Redeploy on Render or run <code className="text-foreground">npm run db:setup</code> to create demo accounts.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/api/health">Check database health</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>All users</CardTitle></CardHeader>
              <UsersTable users={users} />
          </Card>
        )}

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Demo login accounts</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Admin: admin@example.com / Admin123!</p>
            <p>Staff: staff@example.com / Staff123!</p>
            <p>Resident: resident@example.com / Resident123!</p>
          </CardContent>
        </Card>
      </div>
  );
}
