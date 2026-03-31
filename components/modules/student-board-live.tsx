"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BoardBlockView } from "@/components/modules/board-block-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getPusherClient } from "@/lib/realtime/client";
import type { AppLocale } from "@/lib/i18n";

type SessionBlock = {
  id: string;
  blockType: string;
  title: string;
  instructions?: string | null;
  contentJson?: unknown;
  answerKeyJson?: unknown;
  hint?: string | null;
};

type StudentResponse = {
  id: string;
  blockId: string;
  responseJson: unknown;
  isSubmitted: boolean;
  score?: number | null;
  feedback?: string | null;
};

type StudentBoardSnapshot = {
  id: string;
  status: string;
  currentBlockId: string | null;
  currentBlockIndex: number;
  activityState: { isOpen?: boolean; revealAnswer?: boolean };
  timerState: { status?: string; secondsRemaining?: number };
  schoolClass?: { name: string } | null;
  subject?: { name: string } | null;
  teacher: { fullName: string };
  lesson: { title: string; blocks: SessionBlock[] };
  currentBlock: SessionBlock | null;
  responses: StudentResponse[];
};

function isStudentBoardSnapshot(value: unknown): value is StudentBoardSnapshot {
  return typeof value === "object" && value !== null && "id" in value && "lesson" in value;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export function StudentBoardLive({
  initialSession,
  locale,
}: {
  initialSession: StudentBoardSnapshot;
  locale: AppLocale;
}) {
  const [session, setSession] = useState<StudentBoardSnapshot>(initialSession);
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [matchSelections, setMatchSelections] = useState<string[]>([]);
  const [sortSelections, setSortSelections] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const currentBlock = session.currentBlock;
  const revealAnswer = Boolean(session.activityState?.revealAnswer);
  const activityOpen = Boolean(session.activityState?.isOpen);
  const content = (currentBlock?.contentJson ?? {}) as Record<string, unknown>;
  const options = asStringArray(content.options);
  const leftItems = asStringArray(content.leftItems);
  const rightItems = asStringArray(content.rightItems);
  const orderItems = asStringArray(content.items);

  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    setAnswer("");
    setSelected([]);
    setMatchSelections(Array.from({ length: leftItems.length }, () => ""));
    setSortSelections(Array.from({ length: orderItems.length }, () => ""));
  }, [currentBlock?.id, leftItems.length, orderItems.length]);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const privateChannel = pusher.subscribe(`private-board-session-${session.id}`);
    const presenceChannel = pusher.subscribe(`presence-board-session-${session.id}`);
    const onSnapshot = (payload: unknown) => {
      if (isStudentBoardSnapshot(payload)) setSession(payload);
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
    presenceChannel.bind("participant.updated", onSnapshot);

    return () => {
      privateChannel.unbind_all();
      presenceChannel.unbind_all();
      pusher.unsubscribe(`private-board-session-${session.id}`);
      pusher.unsubscribe(`presence-board-session-${session.id}`);
    };
  }, [session.id]);

  const myResponse = useMemo(
    () => session.responses.find((item) => item.blockId === currentBlock?.id) ?? null,
    [session.responses, currentBlock?.id],
  );

  useEffect(() => {
    void fetch(`/api/board-sessions/${session.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionState: "ONLINE" }),
    });

    return () => {
      void fetch(`/api/board-sessions/${session.id}/leave`, { method: "POST" });
    };
  }, [session.id]);

  const submit = async () => {
    if (!currentBlock) return;
    setBusy(true);

    let responseJson: Record<string, unknown> = {};
    if (["single-choice", "poll", "true-false"].includes(currentBlock.blockType)) {
      responseJson =
        currentBlock.blockType === "true-false"
          ? { answer: selected[0] === "true" }
          : { answerIndex: selected.length ? Number(selected[0]) : null };
    } else if (currentBlock.blockType === "multiple-choice") {
      responseJson = { answers: selected.map((item) => Number(item)) };
    } else if (currentBlock.blockType === "matching" || currentBlock.blockType === "connect") {
      responseJson = {
        matches: matchSelections
          .map((value, index) => ({ leftIndex: index, rightIndex: Number(value) }))
          .filter((item) => Number.isInteger(item.rightIndex) && item.rightIndex >= 0),
      };
    } else if (currentBlock.blockType === "sort-order") {
      responseJson = {
        order: sortSelections.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0),
      };
    } else {
      responseJson = { answer };
    }

    const response = await fetch(`/api/board-sessions/${session.id}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: currentBlock.id,
        responseJson,
        isSubmitted: true,
      }),
    });
    const result = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(result.error || (locale === "ru" ? "Не удалось отправить ответ" : "Unable to submit response"));
      return;
    }

    if (isStudentBoardSnapshot(result.data)) {
      setSession(result.data);
    }
    toast.success(locale === "ru" ? "Ответ отправлен" : "Response submitted");
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{session.lesson.title}</CardTitle>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {session.teacher.fullName} · {session.subject?.name ?? "Subject"} · {session.schoolClass?.name ?? "Class"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={session.status === "LIVE" ? "success" : session.status === "PAUSED" ? "warning" : "info"}>
                {session.status}
              </Badge>
              <Badge variant="neutral">
                {locale === "ru" ? "Блок" : "Block"} {session.currentBlockIndex + 1}/{session.lesson.blocks.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <BoardBlockView block={currentBlock} revealAnswer={revealAnswer} />

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader>
                <CardTitle>{locale === "ru" ? "Ваш ответ" : "Your response"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!activityOpen ? (
                  <div className="rounded-2xl border border-dashed bg-slate-50/80 p-6 text-sm text-slate-600">
                    {locale === "ru" ? "Учитель еще не открыл это задание." : "The teacher has not opened this activity yet."}
                  </div>
                ) : currentBlock?.blockType === "single-choice" || currentBlock?.blockType === "poll" ? (
                  <div className="grid gap-3">
                    {options.map((option, index) => (
                      <label key={`${option}-${index}`} className="flex items-center gap-3 rounded-2xl border bg-white/80 p-4">
                        <input type="radio" name="answer" checked={selected[0] === String(index)} onChange={() => setSelected([String(index)])} className="h-4 w-4" />
                        <span className="text-sm text-slate-800">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : currentBlock?.blockType === "true-false" ? (
                  <div className="grid gap-3">
                    {[
                      { value: "true", label: locale === "ru" ? "Верно" : "True" },
                      { value: "false", label: locale === "ru" ? "Неверно" : "False" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-3 rounded-2xl border bg-white/80 p-4">
                        <input type="radio" name="answer" checked={selected[0] === option.value} onChange={() => setSelected([option.value])} className="h-4 w-4" />
                        <span className="text-sm text-slate-800">{option.label}</span>
                      </label>
                    ))}
                  </div>
                ) : currentBlock?.blockType === "multiple-choice" ? (
                  <div className="grid gap-3">
                    {options.map((option, index) => (
                      <label key={`${option}-${index}`} className="flex items-center gap-3 rounded-2xl border bg-white/80 p-4">
                        <input
                          type="checkbox"
                          checked={selected.includes(String(index))}
                          onChange={(event) =>
                            setSelected((prev) => (event.target.checked ? [...prev, String(index)] : prev.filter((item) => item !== String(index))))
                          }
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-slate-800">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : currentBlock?.blockType === "matching" || currentBlock?.blockType === "connect" ? (
                  <div className="grid gap-3">
                    {leftItems.map((item, index) => (
                      <div key={`${item}-${index}`} className="grid gap-2 rounded-2xl border bg-white/80 p-4 md:grid-cols-[1fr_220px] md:items-center">
                        <p className="text-sm font-medium text-slate-800">{item}</p>
                        <Select
                          value={matchSelections[index] ?? ""}
                          onChange={(event) =>
                            setMatchSelections((prev) => prev.map((value, itemIndex) => (itemIndex === index ? event.target.value : value)))
                          }
                        >
                          <option value="">{locale === "ru" ? "Выберите связь" : "Choose match"}</option>
                          {rightItems.map((rightItem, rightIndex) => (
                            <option key={`${rightItem}-${rightIndex}`} value={rightIndex}>
                              {rightItem}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ))}
                  </div>
                ) : currentBlock?.blockType === "sort-order" ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {orderItems.map((item, index) => (
                        <Badge key={`${item}-${index}`} variant="neutral">
                          {item}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid gap-3">
                      {orderItems.map((_, index) => (
                        <div key={index} className="grid gap-2 rounded-2xl border bg-white/80 p-4 md:grid-cols-[120px_1fr] md:items-center">
                          <p className="text-sm font-medium text-slate-700">
                            {locale === "ru" ? `Шаг ${index + 1}` : `Step ${index + 1}`}
                          </p>
                          <Select
                            value={sortSelections[index] ?? ""}
                            onChange={(event) =>
                              setSortSelections((prev) => prev.map((value, itemIndex) => (itemIndex === index ? event.target.value : value)))
                            }
                          >
                            <option value="">{locale === "ru" ? "Выберите элемент" : "Choose item"}</option>
                            {orderItems.map((item, itemIndex) => (
                              <option key={`${item}-${itemIndex}`} value={itemIndex}>
                                {item}
                              </option>
                            ))}
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : currentBlock?.blockType === "short-answer" ? (
                  <Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={locale === "ru" ? "Введите короткий ответ..." : "Enter a short answer..."} />
                ) : (
                  <Input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={locale === "ru" ? "Введите ответ..." : "Enter your answer..."} />
                )}

                <Button type="button" disabled={!activityOpen || busy || Boolean(myResponse?.isSubmitted)} onClick={submit}>
                  {myResponse?.isSubmitted ? (locale === "ru" ? "Ответ отправлен" : "Submitted") : busy ? (locale === "ru" ? "Отправка..." : "Submitting...") : locale === "ru" ? "Отправить" : "Submit"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{locale === "ru" ? "Статус" : "Status"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl border bg-white/80 p-4">
                  {locale === "ru" ? "Таймер" : "Timer"}: {session.timerState?.status ?? "idle"}{" "}
                  {typeof session.timerState?.secondsRemaining === "number" ? `· ${session.timerState.secondsRemaining}s` : ""}
                </div>
                <div className="rounded-2xl border bg-white/80 p-4">
                  {locale === "ru" ? "Подключение" : "Connection"}: {session.status === "LIVE" ? (locale === "ru" ? "В эфире" : "Live") : session.status}
                </div>
                {myResponse ? (
                  <div className="rounded-2xl border bg-emerald-50/80 p-4">
                    <p className="font-semibold text-emerald-900">{locale === "ru" ? "Ваш ответ сохранен" : "Your response is saved"}</p>
                    {typeof myResponse.score === "number" ? <p className="mt-2 text-sm text-emerald-900/80">Score: {myResponse.score}</p> : null}
                    {myResponse.feedback ? <p className="mt-2 text-sm text-emerald-900/80">{myResponse.feedback}</p> : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
