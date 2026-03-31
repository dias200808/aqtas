"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BoardBlockView } from "@/components/modules/board-block-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPusherClient } from "@/lib/realtime/client";
import type { AppLocale } from "@/lib/i18n";

type BoardParticipant = {
  id: string;
  studentId: string;
  fullName: string;
  connectionState: string;
};

type SessionBlock = {
  id: string;
  orderIndex: number;
  blockType: string;
  title: string;
  instructions?: string | null;
  contentJson?: unknown;
  answerKeyJson?: unknown;
  hint?: string | null;
  estimatedSeconds?: number | null;
};

type TeacherResponse = {
  id: string;
  studentName: string;
  responseJson: unknown;
  score?: number | null;
  isSubmitted: boolean;
};

type TeacherBoardSnapshot = {
  id: string;
  status: string;
  currentBlockId: string | null;
  currentBlockIndex: number;
  activityState: { revealAnswer?: boolean };
  timerState: { status?: string };
  schoolClass?: { id?: string; name: string } | null;
  subject?: { name: string } | null;
  teacher: { fullName: string };
  lesson: { title: string; blocks: SessionBlock[] };
  currentBlock: SessionBlock | null;
  participants: BoardParticipant[];
  responseSummary: {
    submittedCount: number;
    totalParticipants: number;
    latestResponses: TeacherResponse[];
  };
};

function isTeacherBoardSnapshot(value: unknown): value is TeacherBoardSnapshot {
  return typeof value === "object" && value !== null && "id" in value && "lesson" in value;
}

function formatTeacherResponse(value: unknown) {
  if (typeof value !== "object" || value === null) return String(value ?? "");

  const payload = value as Record<string, unknown>;
  if (typeof payload.answer === "string") return payload.answer;
  if (typeof payload.answer === "boolean") return payload.answer ? "True" : "False";
  if (typeof payload.answerIndex === "number") return `Option ${payload.answerIndex + 1}`;
  if (Array.isArray(payload.answers)) {
    return `Options: ${payload.answers.map((item) => Number(item) + 1).join(", ")}`;
  }
  if (Array.isArray(payload.matches)) {
    return payload.matches
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;
        const pair = item as Record<string, unknown>;
        return `${Number(pair.leftIndex) + 1}->${Number(pair.rightIndex) + 1}`;
      })
      .filter(Boolean)
      .join(" | ");
  }
  if (Array.isArray(payload.order)) {
    return `Order: ${payload.order.map((item) => Number(item) + 1).join(" -> ")}`;
  }

  return JSON.stringify(value);
}

export function TeacherBoardLive({
  initialSession,
  locale,
}: {
  initialSession: TeacherBoardSnapshot;
  locale: AppLocale;
}) {
  const router = useRouter();
  const [session, setSession] = useState<TeacherBoardSnapshot>(initialSession);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedResponseIds, setSelectedResponseIds] = useState<string[]>([]);
  const currentBlock = session.currentBlock;
  const revealAnswer = Boolean(session.activityState?.revealAnswer);

  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const privateChannel = pusher.subscribe(`private-board-session-${session.id}`);
    const presenceChannel = pusher.subscribe(`presence-board-session-${session.id}`);
    const onSnapshot = (payload: unknown) => {
      if (isTeacherBoardSnapshot(payload)) setSession(payload);
    };

    privateChannel.bind("session.state", onSnapshot);
    privateChannel.bind("session.started", onSnapshot);
    privateChannel.bind("session.paused", onSnapshot);
    privateChannel.bind("session.resumed", onSnapshot);
    privateChannel.bind("session.ended", onSnapshot);
    privateChannel.bind("participant.updated", onSnapshot);
    privateChannel.bind("response.submitted", onSnapshot);
    privateChannel.bind("activity.revealed", onSnapshot);
    privateChannel.bind("timer.updated", onSnapshot);
    privateChannel.bind("results.promoted", onSnapshot);
    presenceChannel.bind("participant.updated", onSnapshot);

    return () => {
      privateChannel.unbind_all();
      presenceChannel.unbind_all();
      pusher.unsubscribe(`private-board-session-${session.id}`);
      pusher.unsubscribe(`presence-board-session-${session.id}`);
    };
  }, [session.id]);

  const requestJson = async (url: string, method: "POST" | "PATCH", body?: Record<string, unknown>) => {
    setBusy(url);
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    setBusy(null);

    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось обновить сессию" : "Unable to update session"));
      return;
    }

    const nextSnapshot = isTeacherBoardSnapshot(result.data) ? result.data : result.data?.session;
    if (isTeacherBoardSnapshot(nextSnapshot)) {
      setSession(nextSnapshot);
    }
    router.refresh();
  };

  const responseOptions = useMemo(
    () => session.responseSummary.latestResponses.filter((item) => item.isSubmitted),
    [session.responseSummary.latestResponses],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <Card className="xl:sticky xl:top-24 xl:h-fit">
        <CardHeader>
          <CardTitle>{locale === "ru" ? "Структура урока" : "Lesson outline"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.lesson.blocks.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => requestJson(`/api/board-sessions/${session.id}`, "PATCH", { currentBlockId: block.id, currentBlockIndex: block.orderIndex })}
              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                block.id === session.currentBlockId
                  ? "border-[var(--primary)] bg-[rgba(20,86,194,0.07)]"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{block.blockType}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{block.title}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-[linear-gradient(180deg,rgba(20,86,194,0.05),rgba(255,255,255,0.85))]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{session.lesson.title}</CardTitle>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {session.schoolClass?.name ?? "Класс"} · {session.subject?.name ?? "Предмет"} · {session.teacher.fullName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={session.status === "LIVE" ? "success" : session.status === "PAUSED" ? "warning" : "info"}>
                  {session.status}
                </Badge>
                <Badge variant="neutral">
                  {locale === "ru" ? "Подключено" : "Connected"}: {session.participants.filter((item) => item.connectionState === "ONLINE").length}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <BoardBlockView block={currentBlock} revealAnswer={revealAnswer} />

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" disabled={busy !== null || session.currentBlockIndex <= 0} onClick={() => requestJson(`/api/board-sessions/${session.id}`, "PATCH", { currentBlockIndex: session.currentBlockIndex - 1 })}>
                {locale === "ru" ? "Назад" : "Previous"}
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null || session.currentBlockIndex >= session.lesson.blocks.length - 1} onClick={() => requestJson(`/api/board-sessions/${session.id}`, "PATCH", { currentBlockIndex: session.currentBlockIndex + 1 })}>
                {locale === "ru" ? "Далее" : "Next"}
              </Button>
              {session.status === "DRAFT" || session.status === "SCHEDULED" ? (
                <Button type="button" disabled={busy === `/api/board-sessions/${session.id}/start`} onClick={() => requestJson(`/api/board-sessions/${session.id}/start`, "POST")}>
                  {locale === "ru" ? "Начать урок" : "Start lesson"}
                </Button>
              ) : null}
              {session.status === "LIVE" ? (
                <Button type="button" variant="outline" onClick={() => requestJson(`/api/board-sessions/${session.id}/pause`, "POST")}>
                  {locale === "ru" ? "Пауза" : "Pause"}
                </Button>
              ) : null}
              {session.status === "PAUSED" ? (
                <Button type="button" variant="outline" onClick={() => requestJson(`/api/board-sessions/${session.id}/resume`, "POST")}>
                  {locale === "ru" ? "Продолжить" : "Resume"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={!currentBlock}
                onClick={() =>
                  requestJson(`/api/board-sessions/${session.id}/reveal`, "POST", {
                    blockId: currentBlock?.id,
                    reveal: !revealAnswer,
                    hint: currentBlock?.hint ?? undefined,
                  })
                }
              >
                {revealAnswer ? (locale === "ru" ? "Скрыть ответ" : "Hide answer") : locale === "ru" ? "Показать ответ" : "Reveal answer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  requestJson(`/api/board-sessions/${session.id}/timer`, "POST", {
                    action: session.timerState?.status === "running" ? "stop" : "start",
                    seconds: currentBlock?.estimatedSeconds ?? 90,
                  })
                }
              >
                {session.timerState?.status === "running" ? (locale === "ru" ? "Стоп таймер" : "Stop timer") : locale === "ru" ? "Старт таймер" : "Start timer"}
              </Button>
              <Button type="button" variant="danger" onClick={() => requestJson(`/api/board-sessions/${session.id}/end`, "POST")}>
                {locale === "ru" ? "Завершить" : "End session"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{locale === "ru" ? "Интеграции" : "Integrations"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={`/attendance?sessionId=${session.id}&classId=${session.schoolClass?.id ?? ""}`}>
                {locale === "ru" ? "Открыть посещаемость" : "Open attendance"}
              </Link>
            </Button>
            {currentBlock?.blockType === "homework" ? (
              <Button asChild variant="outline">
                <Link href="/homework">{locale === "ru" ? "Перейти в домашние задания" : "Go to homework"}</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{locale === "ru" ? "Участники" : "Participants"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {session.participants.map((participant) => (
              <div key={participant.id} className="rounded-2xl border bg-white/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{participant.fullName}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{participant.connectionState}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => requestJson(`/api/board-sessions/${session.id}/remove-participant`, "POST", { studentId: participant.studentId })}>
                    {locale === "ru" ? "Убрать" : "Remove"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{locale === "ru" ? "Ответы" : "Responses"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border bg-slate-50/80 p-4 text-sm text-slate-700">
              {locale === "ru" ? "Сдано" : "Submitted"}: {session.responseSummary.submittedCount} / {session.responseSummary.totalParticipants}
            </div>
            {responseOptions.map((response) => (
              <label key={response.id} className="flex items-start gap-3 rounded-2xl border bg-white/80 p-4">
                <input
                  type="checkbox"
                  checked={selectedResponseIds.includes(response.id)}
                  onChange={(event) =>
                    setSelectedResponseIds((prev) =>
                      event.target.checked ? [...prev, response.id] : prev.filter((item) => item !== response.id),
                    )
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{response.studentName}</p>
                  <p className="mt-1 break-words text-sm text-[var(--muted)]">{formatTeacherResponse(response.responseJson)}</p>
                  {typeof response.score === "number" ? <p className="mt-2 text-sm font-medium text-emerald-700">Score: {response.score}</p> : null}
                </div>
              </label>
            ))}
            <Button
              type="button"
              disabled={!selectedResponseIds.length}
              onClick={() =>
                requestJson(`/api/board-sessions/${session.id}/promote-results`, "POST", {
                  responseIds: selectedResponseIds,
                  type: "QUIZ",
                  weight: 1,
                })
              }
            >
              {locale === "ru" ? "Перенести в оценки" : "Promote to grades"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
