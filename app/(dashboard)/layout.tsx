import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSession();
  const locale = await getLocale();
  return <DashboardShell user={user} locale={locale}>{children}</DashboardShell>;
}
