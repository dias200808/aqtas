"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileUpdateSchema } from "@/lib/validators";

type FormValues = z.input<typeof profileUpdateSchema>;

export function ProfileForm({
  user,
}: {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string;
  };
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const response = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();

    if (!response.ok) {
      toast.error(result.error || "Unable to update profile");
      return;
    }

    toast.success("Profile updated");
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input {...form.register("firstName")} />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input {...form.register("lastName")} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...form.register("phone")} placeholder="+7 700 000 00 00" />
            </div>
          </div>
          <div className="rounded-2xl border bg-white/70 p-4 text-sm text-[var(--muted)]">
            Role: <span className="font-semibold text-slate-900">{user.role}</span>
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
