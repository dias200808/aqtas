import { Role } from "@prisma/client";
import { TeacherBoardLive } from "@/components/modules/teacher-board-live";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { getBoardSessionSnapshot } from "@/features/lessons/service";

export default async function TeacherBoardSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireRole([Role.ADMIN, Role.TEACHER]);
  const locale = await getLocale();
  const { sessionId } = await params;
  const session = await getBoardSessionSnapshot(user, sessionId);

  return (
    <div className="space-y-8">
      <PageHeader
        title={locale === "ru" ? "Live-урок" : "Live lesson"}
        description={
          locale === "ru"
            ? "Учительский режим: управление блоками, синхронизация класса, ответы и перенос результатов в журнал."
            : "Teacher mode: control the board, sync the class, monitor responses, and promote results."
        }
      />
      <TeacherBoardLive initialSession={session} locale={locale} />
    </div>
  );
}
