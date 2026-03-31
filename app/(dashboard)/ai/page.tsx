import { AssistantWorkspace } from "@/components/ai/assistant-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { listStudents } from "@/features/students/service";

export default async function AIPage() {
  const user = await requireSession();
  const locale = await getLocale();
  const students = await listStudents(user);

  return (
    <div className="space-y-8">
      <PageHeader
        title={locale === "ru" ? "AI-помощник" : "AI Assistant"}
        description={
          locale === "ru"
            ? "Только проверенная поддержка. Каждая сводка, план, сигнал риска и черновик строятся на живых данных платформы, а не на выдуманном контексте."
            : "Grounded support only. Every summary, plan, risk alert, and draft is generated from live platform data instead of invented context."
        }
      />
      <AssistantWorkspace
        role={user.role}
        locale={locale}
        studentOptions={students.map((student) => ({
          id: student.id,
          label: `${student.user.firstName} ${student.user.lastName}${student.schoolClass ? ` - ${student.schoolClass.name}` : ""}`,
        }))}
        initialStudentId={students[0]?.id}
      />
    </div>
  );
}
