import { Role } from "@prisma/client";
import { StudentBoardLive } from "@/components/modules/student-board-live";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { getBoardSessionSnapshot } from "@/features/lessons/service";

export default async function StudentBoardSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireRole([Role.STUDENT]);
  const locale = await getLocale();
  const { sessionId } = await params;
  const session = await getBoardSessionSnapshot(user, sessionId);

  return (
    <div className="space-y-8">
      <PageHeader
        title={locale === "ru" ? "Живой урок" : "Live lesson"}
        description={
          locale === "ru"
            ? "Следуйте за учителем в синхронном режиме и отправляйте ответы прямо во время занятия."
            : "Follow the teacher in sync and submit answers during the lesson."
        }
      />
      <StudentBoardLive initialSession={session} locale={locale} />
    </div>
  );
}
