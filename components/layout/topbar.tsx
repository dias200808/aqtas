"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { translate, type AppLocale } from "@/lib/i18n";
import { navigationItems } from "@/lib/navigation";
import { useAppStore } from "@/lib/stores/app-store";
import type { SessionUser } from "@/lib/auth/session";

function formatTitle(pathname: string, locale: AppLocale) {
  const matchedItem =
    navigationItems.find((item) => item.href === pathname) ??
    navigationItems.find((item) => pathname.startsWith(`${item.href}/`));

  if (matchedItem) {
    return translate(locale, matchedItem.labelKey);
  }

  if (pathname === "/dashboard") return translate(locale, "nav.dashboard");
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "Dashboard";
  return segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function Topbar({ user, locale }: { user: SessionUser; locale: AppLocale }) {
  const pathname = usePathname();
  const { setMobileNavOpen } = useAppStore();

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/60 bg-[rgba(244,247,251,0.8)] px-4 py-4 backdrop-blur-xl lg:px-8"
    >
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{translate(locale, "topbar.platformLabel")}</p>
          <h1 className="text-xl font-bold text-slate-900">{formatTitle(pathname, locale)}</h1>
        </div>
      </div>

      <div className="hidden max-w-md flex-1 items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 lg:flex">
        <Search className="h-4 w-4 text-[var(--muted)]" />
        <Input className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" placeholder={translate(locale, "topbar.searchPlaceholder")} />
      </div>

      <div className="flex items-center gap-3">
        <Link href="/settings" className="hidden rounded-2xl border bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 md:inline-flex">
          {translate(locale, "topbar.settings")}
        </Link>
        <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-2">
          <Avatar firstName={user.firstName} lastName={user.lastName} src={user.avatarUrl} />
          <div className="hidden text-left md:block">
            <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{user.role}</p>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
