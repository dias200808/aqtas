import { Role } from "@prisma/client";
import { UserForm } from "@/components/forms/user-form";
import { UserManagementTable } from "@/components/forms/user-management-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { listUsers } from "@/features/admin/service";

export default async function UsersPage() {
  const user = await requireRole([Role.ADMIN]);
  const users = await listUsers(user);

  return (
    <div className="space-y-8">
      <PageHeader title="Users" description="Manage accounts across the school platform with role-aware provisioning." />
      <UserForm />
      <Card>
        <CardHeader>
          <CardTitle>Edit users</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <UserManagementTable
            users={users.map((record) => ({
              id: record.id,
              firstName: record.firstName,
              lastName: record.lastName,
              email: record.email,
              phone: record.phone,
              role: record.role,
              isActive: record.isActive,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
