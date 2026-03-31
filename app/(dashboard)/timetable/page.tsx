import { Role } from "@prisma/client";
import { TimetableManager } from "@/components/forms/timetable-manager";
import { PageHeader } from "@/components/shared/page-header";
import { ScheduleGrid } from "@/components/modules/schedule-grid";
import { requireRole } from "@/lib/auth/session";
import { getAdminCollections } from "@/features/admin/service";
import { listEvents } from "@/features/calendar/service";

export default async function TimetablePage() {
  const user = await requireRole([Role.ADMIN]);
  const data = await getAdminCollections(user);
  const events = await listEvents(user);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Timetable"
        description="Create, edit, and remove lessons while keeping the visual weekly schedule in sync."
      />

      <TimetableManager
        classes={data.classes.map((item) => ({ id: item.id, name: item.name }))}
        subjects={data.subjects.map((item) => ({ id: item.id, name: item.name }))}
        teachers={data.teachers.map((item) => ({
          id: item.id,
          name: `${item.user.firstName} ${item.user.lastName}`,
        }))}
        entries={data.timetable.map((item) => ({
          id: item.id,
          classId: item.classId,
          subjectId: item.subjectId,
          teacherId: item.teacherId,
          room: item.room,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          schoolClass: { name: item.schoolClass.name },
          subject: { name: item.subject.name },
          teacher: { user: { firstName: item.teacher.user.firstName, lastName: item.teacher.user.lastName } },
        }))}
      />

      <ScheduleGrid entries={data.timetable} events={events} />
    </div>
  );
}
