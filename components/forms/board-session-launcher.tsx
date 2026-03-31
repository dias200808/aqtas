"use client";

import { BoardSyncMode } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AppLocale } from "@/lib/i18n";

export function BoardSessionLauncher({
  locale,
  lessons,
}: {
  locale: AppLocale;
  lessons: Array<{
    id: string;
    title: string;
    schoolClass: { id: string; name: string } | null;
    subject: { id: string; name: string } | null;
  }>;
}) {
  const router = useRouter();
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [syncMode, setSyncMode] = useState<BoardSyncMode>(BoardSyncMode.FULLY_SYNCED);
  const [scheduledFor, setScheduledFor] = useState("");
  const [allowLateJoin, setAllowLateJoin] = useState(true);
  const [allowImmediateJoin, setAllowImmediateJoin] = useState(true);
  const [allowFreeNavigation, setAllowFreeNavigation] = useState(false);
  const [showResponsesLive, setShowResponsesLive] = useState(true);
  const [gradedMode, setGradedMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedLesson = lessons.find((lesson) => lesson.id === lessonId) ?? lessons[0];

  const submit = async () => {
    if (!selectedLesson) return;
    setBusy(true);
    const response = await fetch("/api/board-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonPackageId: selectedLesson.id,
        classId: selectedLesson.schoolClass?.id ?? null,
        subjectId: selectedLesson.subject?.id ?? null,
        scheduledFor: scheduledFor || undefined,
        syncMode,
        allowLateJoin,
        allowImmediateJoin,
        allowFreeNavigation,
        showResponsesLive,
        gradedMode,
      }),
    });
    const result = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось создать live-сессию" : "Unable to create board session"));
      return;
    }

    toast.success(locale === "ru" ? "Сессия создана" : "Session created");
    router.push(`/board/teach/${result.data.id}`);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{locale === "ru" ? "Запуск живого урока" : "Launch live lesson"}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="space-y-2">
          <Label>{locale === "ru" ? "Урок" : "Lesson"}</Label>
          <Select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{locale === "ru" ? "Режим синхронизации" : "Sync mode"}</Label>
            <Select value={syncMode} onChange={(event) => setSyncMode(event.target.value as BoardSyncMode)}>
              <option value={BoardSyncMode.FULLY_SYNCED}>{locale === "ru" ? "Полная синхронизация" : "Fully synced"}</option>
              <option value={BoardSyncMode.SEMI_CONTROLLED}>{locale === "ru" ? "Частично управляемый" : "Semi-controlled"}</option>
              <option value={BoardSyncMode.FREE_REVIEW}>{locale === "ru" ? "Свободный обзор" : "Free review"}</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{locale === "ru" ? "Запланировать на" : "Schedule for"}</Label>
            <Input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border bg-slate-50/80 p-4 md:grid-cols-2">
          {[
            {
              checked: allowLateJoin,
              setChecked: setAllowLateJoin,
              labelRu: "Разрешить поздний вход",
              labelEn: "Allow late join",
            },
            {
              checked: allowImmediateJoin,
              setChecked: setAllowImmediateJoin,
              labelRu: "Разрешить вход сразу",
              labelEn: "Allow immediate join",
            },
            {
              checked: allowFreeNavigation,
              setChecked: setAllowFreeNavigation,
              labelRu: "Свободная навигация",
              labelEn: "Allow free navigation",
            },
            {
              checked: showResponsesLive,
              setChecked: setShowResponsesLive,
              labelRu: "Показывать ответы сразу",
              labelEn: "Show live responses",
            },
            {
              checked: gradedMode,
              setChecked: setGradedMode,
              labelRu: "Оценочный режим",
              labelEn: "Graded mode",
            },
          ].map((item) => (
            <label key={item.labelEn} className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) => item.setChecked(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>{locale === "ru" ? item.labelRu : item.labelEn}</span>
            </label>
          ))}
        </div>

        <Button type="button" onClick={submit} disabled={busy || !selectedLesson}>
          {busy
            ? locale === "ru"
              ? "Создание..."
              : "Creating..."
            : locale === "ru"
              ? "Создать live-сессию"
              : "Create live session"}
        </Button>
      </CardContent>
    </Card>
  );
}
