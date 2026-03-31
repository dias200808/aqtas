"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/lib/i18n";

export function LessonPublishButton({
  lessonId,
  isPublished,
  locale,
}: {
  lessonId: string;
  isPublished: boolean;
  locale: AppLocale;
}) {
  const router = useRouter();

  const toggle = async () => {
    const response = await fetch(`/api/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !isPublished }),
    });
    const result = await response.json();

    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось обновить публикацию" : "Unable to update publish state"));
      return;
    }

    toast.success(
      !isPublished
        ? locale === "ru"
          ? "Урок опубликован для доски"
          : "Lesson published to board"
        : locale === "ru"
          ? "Публикация снята"
          : "Lesson unpublished",
    );
    router.refresh();
  };

  return (
    <Button type="button" variant={isPublished ? "secondary" : "outline"} onClick={toggle}>
      {isPublished
        ? locale === "ru"
          ? "Снять с публикации"
          : "Unpublish"
        : locale === "ru"
          ? "Опубликовать для доски"
          : "Publish for board"}
    </Button>
  );
}
