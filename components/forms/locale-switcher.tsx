"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

export function LocaleSwitcher({
  locale,
}: {
  locale: AppLocale;
}) {
  const router = useRouter();

  const updateLocale = async (nextLocale: AppLocale) => {
    const response = await fetch("/api/settings/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });

    if (!response.ok) {
      toast.error(translate(locale, "settings.saveError"));
      return;
    }

    toast.success(translate(nextLocale, "settings.saveSuccess"));
    router.refresh();
  };

  const options: Array<{ value: AppLocale; label: string }> = [
    { value: "ru", label: translate(locale, "settings.russian") },
    { value: "en", label: translate(locale, "settings.english") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-[var(--primary)]" />
          {translate(locale, "settings.languageTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-[var(--muted)]">{translate(locale, "settings.languageDescription")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {options.map((option) => {
            const active = locale === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateLocale(option.value)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-[var(--primary)] bg-[rgba(20,86,194,0.07)] shadow-sm"
                    : "border-slate-200 bg-white/85 hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  {active ? translate(locale, "settings.active") : option.value.toUpperCase()}
                </p>
              </button>
            );
          })}
        </div>
        <Button type="button" variant="outline" className="w-full md:w-auto" onClick={() => updateLocale(locale === "ru" ? "en" : "ru")}>
          {locale === "ru" ? translate(locale, "settings.english") : translate(locale, "settings.russian")}
        </Button>
      </CardContent>
    </Card>
  );
}
