import { Role } from "@prisma/client";
import { EventManager } from "@/components/forms/event-manager";
import { ChildSwitcher } from "@/components/forms/child-switcher";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getRoleContext } from "@/lib/context";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { listEvents } from "@/features/calendar/service";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const user = await requireSession();
  const { studentId } = await searchParams;
  const context = await getRoleContext(user);
  const events = await listEvents(user, studentId);
  const adminClasses =
    user.role === Role.ADMIN ? await db.schoolClass.findMany({ orderBy: { name: "asc" } }) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Calendar"
        description="Track exams, school events, holidays, meetings, and deadlines with clear timing and scope."
        action={
          user.role === Role.PARENT && context.children.length ? (
            <ChildSwitcher
              options={context.children.map((child) => ({
                id: child.id,
                label: `${child.user.firstName} ${child.user.lastName}`,
              }))}
            />
          ) : null
        }
      />

      {(user.role === Role.TEACHER || user.role === Role.ADMIN) ? (
        <EventManager
          classes={
            user.role === Role.TEACHER
              ? [...new Map((context.teacher?.assignments ?? []).map((item) => [item.schoolClass.id, { id: item.schoolClass.id, name: item.schoolClass.name }])).values()]
              : adminClasses.map((item) => ({ id: item.id, name: item.name }))
          }
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            description: event.description,
            startAt: event.startAt.toISOString(),
            endAt: event.endAt.toISOString(),
            type: event.type,
            classId: event.classId,
            schoolClass: event.schoolClass ? { name: event.schoolClass.name } : null,
          }))}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{event.title}</CardTitle>
                <Badge variant="info">{event.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-6 text-slate-700">{event.description}</p>
              <p className="text-sm text-[var(--muted)]">{formatDateTime(event.startAt)} - {formatDateTime(event.endAt)}</p>
              <p className="text-sm text-[var(--muted)]">{event.schoolClass?.name || "Whole school"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
