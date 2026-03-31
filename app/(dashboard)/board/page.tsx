import Link from "next/link";
import { Role } from "@prisma/client";
import { BoardSessionLauncher } from "@/components/forms/board-session-launcher";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { listBoardSessions, listLessons } from "@/features/lessons/service";

export default async function BoardPage() {
  const user = await requireRole([Role.ADMIN, Role.TEACHER]);
  const locale = await getLocale();
  const [sessions, lessons] = await Promise.all([listBoardSessions(user), listLessons(user)]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={locale === "ru" ? "Интерактивная доска" : "Interactive board"}
        description={
          locale === "ru"
            ? "Запускайте живые уроки, синхронизируйте класс, следите за ответами и переносите результаты в оценки."
            : "Launch live lessons, sync the class, watch responses, and promote selected results into grades."
        }
      />

      <BoardSessionLauncher
        locale={locale}
        lessons={lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          schoolClass: lesson.schoolClass ? { id: lesson.schoolClass.id, name: lesson.schoolClass.name } : null,
          subject: lesson.subject ? { id: lesson.subject.id, name: lesson.subject.name } : null,
        }))}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{locale === "ru" ? "Живые и запланированные сессии" : "Live and scheduled sessions"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessions.length ? (
              sessions.map((session) => (
                <div key={session.id} className="rounded-3xl border bg-white/85 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{session.lesson.title}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {session.schoolClass?.name ?? "Класс"} · {session.subject?.name ?? "Предмет"} · {session.teacher.fullName}
                      </p>
                    </div>
                    <Badge variant={session.status === "LIVE" ? "success" : session.status === "PAUSED" ? "warning" : "info"}>
                      {session.status}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border bg-slate-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        {locale === "ru" ? "Текущий блок" : "Current block"}
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {session.currentBlock ? `${session.currentBlockIndex + 1}. ${session.currentBlock.title}` : "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-slate-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        {locale === "ru" ? "Подключено" : "Connected"}
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {session.participants.filter((item) => item.connectionState === "ONLINE").length}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-slate-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        {locale === "ru" ? "Ответов" : "Responses"}
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {session.responseSummary.submittedCount}/{session.responseSummary.totalParticipants}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href={`/board/teach/${session.id}`}>
                        {locale === "ru" ? "Открыть live-режим" : "Open live mode"}
                      </Link>
                    </Button>
                    {session.status === "LIVE" || session.status === "PAUSED" ? (
                      <Button asChild variant="outline">
                        <Link href={`/board/join/${session.id}`}>{locale === "ru" ? "Студенческий вид" : "Student view"}</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed bg-white/70 p-10 text-center text-slate-500">
                {locale === "ru" ? "Сессий пока нет. Создайте первую live-сессию выше." : "No sessions yet. Create the first live session above."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{locale === "ru" ? "Готовые уроки" : "Board-ready lessons"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lessons.slice(0, 8).map((lesson) => (
              <div key={lesson.id} className="rounded-2xl border bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{lesson.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {lesson.schoolClass?.name ?? "Класс"} · {lesson.subject?.name ?? "Предмет"} · {lesson.blocks.length} {locale === "ru" ? "блоков" : "blocks"}
                    </p>
                  </div>
                  <Badge variant={lesson.isPublished ? "success" : "neutral"}>
                    {lesson.isPublished ? (locale === "ru" ? "Опубликован" : "Published") : locale === "ru" ? "Черновик" : "Draft"}
                  </Badge>
                </div>
                <div className="mt-4">
                  <Button asChild variant="outline">
                    <Link href={`/lesson-studio/${lesson.id}`}>{locale === "ru" ? "Открыть редактор" : "Open editor"}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
