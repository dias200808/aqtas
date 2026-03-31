"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

type UserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
};

function EditableRow({ user }: { user: UserRecord }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? "",
    role: user.role,
    isActive: user.isActive,
    password: "",
  });

  async function save() {
    setLoading(true);
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        role: form.role,
        isActive: form.isActive,
        password: form.password || undefined,
      }),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(result.error || "Unable to update user");
      return;
    }

    toast.success("User updated");
    setForm((current) => ({ ...current, password: "" }));
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this user?")) return;

    setLoading(true);
    const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.error(result.error || "Unable to delete user");
      return;
    }

    toast.success("User deleted");
    router.refresh();
  }

  return (
    <TR>
      <TD>
        <div className="grid gap-2">
          <Input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
          <Input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
        </div>
      </TD>
      <TD>
        <div className="grid gap-2">
          <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
        </div>
      </TD>
      <TD>
        <Select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as Role }))}>
          {Object.values(Role).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </Select>
      </TD>
      <TD>
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active
          </label>
          <Input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="New password"
          />
        </div>
      </TD>
      <TD className="w-[180px]">
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={loading} onClick={save}>
            {loading ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={remove}>
            Delete
          </Button>
        </div>
      </TD>
    </TR>
  );
}

export function UserManagementTable({ users }: { users: UserRecord[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Contacts</TH>
          <TH>Role</TH>
          <TH>Status / password</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {users.map((record) => (
          <EditableRow key={record.id} user={record} />
        ))}
      </TBody>
    </Table>
  );
}
