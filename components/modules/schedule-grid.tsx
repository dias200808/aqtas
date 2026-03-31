import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const weekDays = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export function ScheduleGrid({
  entries,
  events = [],
}: {
  entries: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string;
    subject: { name: string; color: string };
    schoolClass: { name: string };
    teacher: { user: { firstName: string; lastName: string } };
    boardSessions?: Array<{ id: string; status: string }>;
  }>;
  events?: Array<{
    id: string;
    title: string;
    startAt: Date | string;
    endAt: Date | string;
    type: string;
    schoolClass?: { name: string } | null;
  }>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {weekDays.map((day) => {
        const dayEntries = entries.filter((entry) => entry.dayOfWeek === day.value);
        const dayEvents = events.filter((event) => {
          const eventDay = new Date(event.startAt).getDay();
          const normalizedDay = eventDay === 0 ? 7 : eventDay;
          return normalizedDay === day.value;
        });

        return (
          <Card key={day.value} className="xl:col-span-1">
            <CardHeader>
              <CardTitle>{day.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dayEvents.length ? (
                <div className="space-y-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Events</p>
                  {dayEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl bg-white/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                        <Badge variant="info">{event.type}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {new Date(event.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(event.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{event.schoolClass?.name || "Whole school"}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {dayEntries.length ? (
                dayEntries.map((entry) => {
                  const boardSession = entry.boardSessions?.[0];
                  const boardPath =
                    boardSession?.status === "LIVE" || boardSession?.status === "PAUSED"
                      ? `/board/join/${boardSession.id}`
                      : boardSession
                        ? `/board/teach/${boardSession.id}`
                        : null;

                  return (
                    <div key={entry.id} className="rounded-2xl border bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.subject.color }} />
                          <p className="font-semibold">{entry.subject.name}</p>
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{entry.room}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {entry.startTime} - {entry.endTime}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {entry.schoolClass.name} · {entry.teacher.user.firstName} {entry.teacher.user.lastName}
                      </p>
                      {boardPath ? (
                        <Link href={boardPath} className="mt-3 inline-flex text-xs font-semibold text-[var(--primary)]">
                          {boardSession?.status === "LIVE" ? "Live board available" : "Board session planned"}
                        </Link>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--muted)]">No lessons scheduled.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
