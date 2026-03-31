import Link from "next/link";
import { Role } from "@prisma/client";
import { ChildSwitcher } from "@/components/forms/child-switcher";
import { ScheduleGrid } from "@/components/modules/schedule-grid";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { getRoleContext } from "@/lib/context";
import { getScheduleView } from "@/features/schedule/service";
import { listEvents } from "@/features/calendar/service";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const user = await requireSession();
  const { studentId } = await searchParams;
  const context = await getRoleContext(user);
  const entries = await getScheduleView(user, studentId);
  const events = await listEvents(user, studentId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Schedule"
        description="Navigate the week with clear lesson timing, teacher context, rooms, and class assignments."
        action={
          <>
            {user.role === Role.PARENT && context.children.length ? (
              <ChildSwitcher
                options={context.children.map((child) => ({
                  id: child.id,
                  label: `${child.user.firstName} ${child.user.lastName}`,
                }))}
              />
            ) : null}
            {user.role === Role.ADMIN ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/timetable">Manage lessons</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/calendar">Manage events</Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <ScheduleGrid entries={entries} events={events} />
    </div>
  );
}
