"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/lib/i18n";

export function PlanProgressButton({
  planId,
  completedLessons,
  plannedLessons,
  locale,
}: {
  planId: string;
  completedLessons: number;
  plannedLessons: number;
  locale: AppLocale;
}) {
  const router = useRouter();

  const increment = async () => {
    const nextCompleted = Math.min(plannedLessons, completedLessons + 1);
    const response = await fetch(`/api/academic-plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedLessons: nextCompleted }),
    });
    const result = await response.json();

    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось обновить прогресс" : "Unable to update progress"));
      return;
    }

    toast.success(locale === "ru" ? "Прогресс обновлен" : "Progress updated");
    router.refresh();
  };

  return (
    <Button type="button" variant="outline" onClick={increment} disabled={completedLessons >= plannedLessons}>
      {locale === "ru" ? "Отметить проведенный урок" : "Mark lesson completed"}
    </Button>
  );
}
