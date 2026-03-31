"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, School } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Role } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { translate, type AppLocale } from "@/lib/i18n";
import { navigationItems } from "@/lib/navigation";
import { useAppStore } from "@/lib/stores/app-store";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";

const navGroups = [
  { key: "main", labelKey: "groups.main" },
  { key: "admin", labelKey: "groups.admin" },
  { key: "system", labelKey: "groups.system" },
] as const;

function SidebarContent({ user, locale }: { user: SessionUser; locale: AppLocale }) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, setMobileNavOpen } = useAppStore();

  return (
    <div className={cn("flex h-full flex-col text-[var(--sidebar-foreground)]", sidebarCollapsed ? "px-3" : "px-4")}>
      <div className="border-b border-white/10 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 p-3 text-white">
            <School className="h-6 w-6" />
          </div>
          {!sidebarCollapsed ? (
            <div>
              <p className="text-lg font-bold text-white">Aqtas Diary</p>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">
                {translate(locale, "sidebar.productSubtitle")}
              </p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="mt-4 inline-flex rounded-xl border border-white/14 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/12 hover:text-white"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? translate(locale, "sidebar.expand") : translate(locale, "sidebar.collapse")}
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-3xl bg-white/8 p-3">
        <Avatar firstName={user.firstName} lastName={user.lastName} src={user.avatarUrl} className="h-12 w-12" />
        {!sidebarCollapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">{user.role}</p>
          </div>
        ) : null}
      </div>

      <div className="scrollbar-thin mt-6 flex-1 space-y-6 overflow-y-auto pb-6">
        {navGroups.map((group) => {
          const items = navigationItems.filter(
            (item) => item.group === group.key && item.roles.includes(user.role as Role),
          );
          if (!items.length) return null;

          return (
            <div key={group.key}>
              {!sidebarCollapsed ? (
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">
                  {translate(locale, group.labelKey)}
                </p>
              ) : null}
              <div className="mt-3 space-y-1">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                        active
                          ? "bg-[var(--sidebar-active)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                          : "text-[var(--sidebar-foreground)] hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!sidebarCollapsed ? <span>{translate(locale, item.labelKey)}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <form action="/api/auth/logout" method="post" className="pb-6">
        <Button
          type="submit"
          variant="ghost"
          className="w-full justify-start rounded-2xl border border-white/18 bg-white/10 !text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-white/18 hover:!text-white"
        >
          <LogOut className="h-4 w-4" />
          {!sidebarCollapsed ? translate(locale, "sidebar.logout") : null}
        </Button>
      </form>
    </div>
  );
}

export function Sidebar({ user, locale }: { user: SessionUser; locale: AppLocale }) {
  const { mobileNavOpen, setMobileNavOpen } = useAppStore();

  return (
    <>
      <aside className="hidden h-screen w-[290px] shrink-0 border-r border-white/5 bg-[var(--sidebar)] lg:block">
        <SidebarContent user={user} locale={locale} />
      </aside>

      <AnimatePresence>
        {mobileNavOpen ? (
          <>
            <motion.button
              aria-label="Close menu overlay"
              className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[290px] border-r border-white/5 bg-[var(--sidebar)] lg:hidden"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", bounce: 0, duration: 0.32 }}
            >
              <SidebarContent user={user} locale={locale} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
