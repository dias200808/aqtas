import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { AppLocale } from "@/lib/i18n";
import type { SessionUser } from "@/lib/auth/session";

export function DashboardShell({
  user,
  locale,
  children,
}: {
  user: SessionUser;
  locale: AppLocale;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} locale={locale} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar user={user} locale={locale} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
