import Link from "next/link";
import { Role } from "@prisma/client";
import { LessonBlockEditor } from "@/components/forms/lesson-block-editor";
import { LessonPublishButton } from "@/components/forms/lesson-publish-button";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { getLessonDetail } from "@/features/lessons/service";

export default async function LessonStudioDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole([Role.ADMIN, Role.TEACHER]);
  const locale = await getLocale();
  const { lessonId } = await params;
  const lesson = await getLessonDetail(user, lessonId);

  return (
    <div className="space-y-8">
      <PageHeader
        title={lesson.title}
        description={lesson.objective}
        action={
          <div className="flex flex-wrap gap-3">
            <LessonPublishButton lessonId={lesson.id} isPublished={lesson.isPublished} locale={locale} />
            <Button asChild variant="outline">
              <Link href="/board">{locale === "ru" ? "Назад к доске" : "Back to board"}</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <LessonBlockEditor lessonId={lesson.id} locale={locale} initialBlocks={lesson.blocks} />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{locale === "ru" ? "Сводка урока" : "Lesson summary"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>{locale === "ru" ? "Класс" : "Class"}: {lesson.schoolClass?.name ?? "—"}</p>
              <p>{locale === "ru" ? "Предмет" : "Subject"}: {lesson.subject?.name ?? "—"}</p>
              <p>{locale === "ru" ? "Блоков" : "Blocks"}: {lesson.blocks.length}</p>
              <p>{locale === "ru" ? "Длительность" : "Duration"}: {lesson.durationMinutes}m</p>
              <p>{locale === "ru" ? "Режим" : "Mode"}: {lesson.generationMode}</p>
            </CardContent>
          </Card>

          {lesson.summaryText ? (
            <Card>
              <CardHeader>
                <CardTitle>{locale === "ru" ? "Итог" : "Summary"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-700">{lesson.summaryText}</p>
              </CardContent>
            </Card>
          ) : null}

          {lesson.teacherNotes ? (
            <Card>
              <CardHeader>
                <CardTitle>{locale === "ru" ? "Заметки учителя" : "Teacher notes"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-700">{lesson.teacherNotes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
