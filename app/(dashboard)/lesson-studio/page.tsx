import Link from "next/link";
import { Role } from "@prisma/client";
import { LessonPackageForm } from "@/components/forms/lesson-package-form";
import { LessonPublishButton } from "@/components/forms/lesson-publish-button";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { buildLessonStudioOptions, listLessons } from "@/features/lessons/service";

export default async function LessonStudioPage() {
  const user = await requireRole([Role.ADMIN, Role.TEACHER]);
  const locale = await getLocale();
  const [options, lessons] = await Promise.all([buildLessonStudioOptions(user), listLessons(user)]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={locale === "ru" ? "AI-конструктор уроков" : "AI lesson studio"}
        description={
          locale === "ru"
            ? "Генерируйте структурированные уроки, редактируйте блоки, публикуйте их для интерактивной доски и запускайте live-сессии."
            : "Generate structured lessons, edit blocks, publish them for the board, and launch live sessions."
        }
      />

      <LessonPackageForm
        classes={options.classes.map((item) => ({ id: item.id, name: item.name }))}
        subjects={options.subjects.map((item) => ({ id: item.id, name: item.name }))}
        locale={locale}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {lessons.map((lesson) => (
          <Card key={lesson.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{lesson.title}</CardTitle>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {lesson.topic} · {lesson.schoolClass?.name ?? "Класс"} · {lesson.subject?.name ?? "Предмет"}
                  </p>
                </div>
                <Badge variant={lesson.isPublished ? "success" : "warning"}>
                  {lesson.isPublished ? (locale === "ru" ? "Опубликован" : "Published") : locale === "ru" ? "Черновик" : "Draft"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-700">{lesson.objective}</p>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border bg-slate-50/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{locale === "ru" ? "Блоки" : "Blocks"}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{lesson.blocks.length}</p>
                </div>
                <div className="rounded-2xl border bg-slate-50/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{locale === "ru" ? "Интерактив" : "Interactive"}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {lesson.blocks.filter((block) => ["single-choice", "multiple-choice", "true-false", "short-answer", "poll"].includes(block.blockType)).length}
                  </p>
                </div>
                <div className="rounded-2xl border bg-slate-50/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{locale === "ru" ? "Длительность" : "Duration"}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{lesson.durationMinutes}m</p>
                </div>
              </div>

              {lesson.homeworkText ? (
                <div className="rounded-2xl border bg-blue-50/70 p-4">
                  <p className="text-sm font-semibold text-blue-900">{locale === "ru" ? "Домашнее задание" : "Homework"}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-900/80">{lesson.homeworkText}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <LessonPublishButton lessonId={lesson.id} isPublished={lesson.isPublished} locale={locale} />
                <Button asChild variant="outline">
                  <Link href={`/lesson-studio/${lesson.id}`}>{locale === "ru" ? "Открыть редактор" : "Open editor"}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/board">{locale === "ru" ? "К запуску на доске" : "Send to board"}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
