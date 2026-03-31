import { Role } from "@prisma/client";
import Link from "next/link";
import {
  BellRing,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  GraduationCap,
  MessageSquareText,
  Users,
} from "lucide-react";
import { TrendChart, DonutChart } from "@/components/dashboard/charts";
import { ChildSwitcher } from "@/components/forms/child-switcher";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { formatDate, formatRelativeDay, timeAgo } from "@/lib/utils";
import { getDashboardData } from "@/features/dashboard/service";

type StudentDashboardData = {
  todayLessons: Array<{
    id: string;
    subject: { name: string };
    teacher: { user: { firstName: string; lastName: string } };
    startTime: string;
    endTime: string;
  }>;
  homework: Array<{ id: string; title: string; dueDate: Date; subject: { name: string } }>;
  grades: Array<{ id: string; subject: { name: string }; value: number; dateAssigned: Date }>;
  notifications: Array<{ id: string }>;
  attendanceSummary: { present: number; absent: number; late: number };
  insights: Array<{ id: string; title: string; content: string }>;
  liveSession: {
    id: string;
    status: string;
    lessonPackage: { title: string };
    subject: { name: string } | null;
    teacher: { user: { firstName: string; lastName: string } };
  } | null;
};

type ParentDashboardData = {
  selectedChild: { user: { firstName: string } } | null;
  messagesCount: number;
  homework: Array<{ dueDate: Date }>;
  announcements: Array<{ id: string }>;
  attendance: Array<{ status: string }>;
  insights: Array<{ id: string; title: string; content: string }>;
  subjectAverages: Array<{ subject: string; average: number }>;
};

type TeacherDashboardData = {
  todayLessons: Array<{
    id: string;
    subject: { name: string };
    schoolClass: { name: string };
    room: string;
    startTime: string;
  }>;
  homeworkReview: Array<{ id: string }>;
  messagesCount: number;
  attendanceCount: number;
  riskStudents: Array<{ studentId: string; _count: { _all: number } }>;
  liveBoardSessions: Array<{
    id: string;
    status: string;
    lessonPackage: { title: string };
    schoolClass: { name: string } | null;
    subject: { name: string } | null;
  }>;
};

type AdminDashboardData = {
  users: number;
  students: number;
  teachers: number;
  announcements: Array<{ id: string; title: string; content: string; isPinned: boolean }>;
  grades: Array<{ subject: { name: string }; value: number }>;
  attendance: Array<{ status: string; _count: { _all: number } }>;
  auditLogs: Array<{ id: string; action: string; entityType: string; createdAt: Date }>;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const user = await requireSession();
  const { studentId } = await searchParams;
  const data = await getDashboardData(user, studentId);

  const studentData = data as StudentDashboardData;
  const parentData = data as ParentDashboardData;
  const teacherData = data as TeacherDashboardData;
  const adminData = data as AdminDashboardData;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="A role-aware snapshot of what matters most right now across lessons, attendance, homework, communication, and school operations."
        action={
          user.role === Role.PARENT && "children" in data && data.children?.length ? (
            <ChildSwitcher
              options={data.children.map((child) => ({
                id: child.id,
                label: `${child.user.firstName} ${child.user.lastName}`,
              }))}
            />
          ) : null
        }
      />

      {data.role === Role.STUDENT ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Today lessons" value={`${studentData.todayLessons.length}`} hint="Classes lined up for today" icon={CalendarDays} />
            <StatCard label="Active homework" value={`${studentData.homework.length}`} hint="Assignments on the board" icon={BookOpenCheck} />
            <StatCard label="Recent grades" value={`${studentData.grades.length}`} hint="Latest evaluations tracked" icon={GraduationCap} />
            <StatCard label="Notifications" value={`${studentData.notifications.length}`} hint="Unread school updates" icon={BellRing} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>What to do today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {studentData.homework.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-2xl border bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{item.title}</p>
                      <Badge variant={new Date(item.dueDate) < new Date() ? "danger" : "info"}>
                        {formatRelativeDay(item.dueDate)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">{item.subject.name}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{studentData.liveSession ? "Live lesson" : "Attendance pulse"}</CardTitle>
              </CardHeader>
              <CardContent>
                {studentData.liveSession ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border bg-white/80 p-4">
                      <p className="font-semibold">{studentData.liveSession.lessonPackage.title}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {studentData.liveSession.subject?.name ?? "Subject"} | {studentData.liveSession.teacher.user.firstName} {studentData.liveSession.teacher.user.lastName}
                      </p>
                    </div>
                    <Button asChild>
                      <Link href={`/board/join/${studentData.liveSession.id}`}>Join live lesson</Link>
                    </Button>
                  </div>
                ) : (
                  <DonutChart
                    data={[
                      { label: "Present", value: studentData.attendanceSummary.present },
                      { label: "Absent", value: studentData.attendanceSummary.absent },
                      { label: "Late", value: studentData.attendanceSummary.late },
                    ]}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Today lessons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {studentData.todayLessons.map((lesson) => (
                  <div key={lesson.id} className="rounded-2xl border bg-white/80 p-4">
                    <p className="font-semibold">{lesson.subject.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {lesson.startTime} - {lesson.endTime} | {lesson.teacher.user.firstName} {lesson.teacher.user.lastName}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Latest grades</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {studentData.grades.map((grade) => (
                  <div key={grade.id} className="flex items-center justify-between rounded-2xl border bg-white/80 p-4">
                    <div>
                      <p className="font-semibold">{grade.subject.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(grade.dateAssigned)}</p>
                    </div>
                    <span className="text-2xl font-bold text-[var(--primary)]">{grade.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI summaries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {studentData.insights.map((insight) => (
                  <div key={insight.id} className="rounded-2xl border bg-white/80 p-4">
                    <p className="font-semibold">{insight.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{insight.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {data.role === Role.PARENT ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Selected child" value={parentData.selectedChild ? parentData.selectedChild.user.firstName : "None"} hint="Current child context" icon={Users} />
            <StatCard label="Messages" value={`${parentData.messagesCount ?? 0}`} hint="Parent communication threads" icon={MessageSquareText} />
            <StatCard label="Assignments" value={`${parentData.homework?.length ?? 0}`} hint="Open work for this child" icon={BookOpenCheck} />
            <StatCard label="Announcements" value={`${parentData.announcements?.length ?? 0}`} hint="School-wide and class notices" icon={BellRing} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Academic trend</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={parentData.subjectAverages?.map((item) => ({ label: item.subject, value: item.average })) ?? []} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk indicators</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border bg-white/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">Attendance alerts</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {parentData.attendance?.filter((item) => item.status !== "PRESENT").length ?? 0} recent non-present marks.
                  </p>
                </div>
                <div className="rounded-2xl border bg-white/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">Overdue homework</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {parentData.homework?.filter((item) => new Date(item.dueDate) < new Date()).length ?? 0} items need attention.
                  </p>
                </div>
                {parentData.insights?.map((insight) => (
                  <div key={insight.id} className="rounded-2xl border bg-amber-50/80 p-4">
                    <p className="font-semibold text-amber-900">{insight.title}</p>
                    <p className="mt-2 text-sm leading-6 text-amber-900/80">{insight.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {data.role === Role.TEACHER ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Today lessons" value={`${teacherData.todayLessons.length}`} hint="Live teaching schedule" icon={CalendarDays} />
            <StatCard label="Homework to review" value={`${teacherData.homeworkReview.length}`} hint="Submissions waiting for feedback" icon={BookOpenCheck} />
            <StatCard label="Active threads" value={`${teacherData.messagesCount}`} hint="Current parent and student conversations" icon={MessageSquareText} />
            <StatCard label="Attendance marked" value={`${teacherData.attendanceCount}`} hint="Records captured today" icon={ChartNoAxesCombined} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Classes to teach today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {teacherData.todayLessons.map((lesson) => (
                  <div key={lesson.id} className="rounded-2xl border bg-white/80 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{lesson.subject.name}</p>
                      <p className="text-sm text-[var(--muted)]">{lesson.startTime}</p>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">{lesson.schoolClass.name} | Room {lesson.room}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{teacherData.liveBoardSessions.length ? "Board sessions" : "Students at risk"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {teacherData.liveBoardSessions.length
                  ? teacherData.liveBoardSessions.map((item) => (
                      <div key={item.id} className="rounded-2xl border bg-white/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.lessonPackage.title}</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              {item.schoolClass?.name ?? "Class"} | {item.subject?.name ?? "Subject"}
                            </p>
                          </div>
                          <Badge variant={item.status === "LIVE" ? "success" : item.status === "PAUSED" ? "warning" : "info"}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="mt-3">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/board/teach/${item.id}`}>Open board</Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  : teacherData.riskStudents.map((item) => (
                      <div key={item.studentId} className="flex items-center justify-between rounded-2xl border bg-rose-50/70 p-4">
                        <p className="font-semibold">Student {item.studentId.slice(0, 6)}</p>
                        <Badge variant="danger">{item._count._all} alerts</Badge>
                      </div>
                    ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {data.role === Role.ADMIN ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Users" value={`${adminData.users}`} hint="Active accounts in the system" icon={Users} />
            <StatCard label="Students" value={`${adminData.students}`} hint="Enrolled learner records" icon={GraduationCap} />
            <StatCard label="Teachers" value={`${adminData.teachers}`} hint="Instructional staff onboarded" icon={BookOpenCheck} />
            <StatCard label="Announcements" value={`${adminData.announcements.length}`} hint="Recent broadcast activity" icon={BellRing} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>Recent grade activity</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={adminData.grades.slice(0, 8).map((grade, index) => ({
                    label: `${grade.subject.name.split(" ")[0]} ${index + 1}`,
                    value: grade.value,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attendance distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={adminData.attendance.map((item) => ({
                    label: item.status,
                    value: item._count._all,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Announcements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {adminData.announcements.map((announcement) => (
                  <div key={announcement.id} className="rounded-2xl border bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{announcement.title}</p>
                      {announcement.isPinned ? <Badge variant="info">Pinned</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">{announcement.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {adminData.auditLogs.map((item) => (
                  <div key={item.id} className="rounded-2xl border bg-white/80 p-4">
                    <p className="font-semibold">{item.action}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.entityType} | {timeAgo(item.createdAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
