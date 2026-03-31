import { db } from "@/lib/db";
import { ProfileForm } from "@/components/forms/profile-form";
import { LocaleSwitcher } from "@/components/forms/locale-switcher";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function SettingsPage() {
  const user = await requireSession();
  const locale = await getLocale();
  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={translate(locale, "settings.title")}
        description={translate(locale, "settings.description")}
      />
      <LocaleSwitcher locale={locale} />
      {profile ? <ProfileForm user={profile} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>{translate(locale, "settings.profile")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-900">{translate(locale, "settings.name")}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{user.fullName}</p>
          </div>
          <div className="rounded-2xl border bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-900">{translate(locale, "settings.email")}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{profile?.email ?? user.email}</p>
          </div>
          <div className="rounded-2xl border bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Phone</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{profile?.phone || "Not set yet"}</p>
          </div>
          <div className="rounded-2xl border bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-900">{translate(locale, "settings.role")}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{user.role}</p>
          </div>
          <div className="rounded-2xl border bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-900">{translate(locale, "settings.session")}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "settings.sessionDescription")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
