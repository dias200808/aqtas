import { AttendanceStatus, BoardSessionStatus, HomeworkSubmissionStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getRoleContext } from "@/lib/context";
import { average } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";

export async function getDashboardData(user: SessionUser, studentId?: string) {
  const context = await getRoleContext(user);
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();

  if (user.role === Role.STUDENT && context.student) {
    const [todayLessons, homework, grades, attendance, events, notifications, insights, liveSession] =
      await Promise.all([
        db.timetableEntry.findMany({
          where: { classId: context.student.classId ?? undefined, dayOfWeek },
          include: { subject: true, teacher: { include: { user: true } } },
          orderBy: { startTime: "asc" },
        }),
        db.homework.findMany({
          where: { classId: context.student.classId ?? undefined },
          include: {
            subject: true,
            submissions: { where: { studentId: context.student.id } },
          },
          orderBy: { dueDate: "asc" },
          take: 6,
        }),
        db.grade.findMany({
          where: { studentId: context.student.id },
          include: { subject: true },
          orderBy: { dateAssigned: "desc" },
          take: 5,
        }),
        db.attendance.findMany({
          where: { studentId: context.student.id },
          orderBy: { date: "desc" },
          take: 30,
        }),
        db.event.findMany({
          where: {
            OR: [{ classId: context.student.classId ?? undefined }, { classId: null }],
            startAt: { gte: today },
          },
          orderBy: { startAt: "asc" },
          take: 5,
        }),
        db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        db.aIInsight.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
        db.boardSession.findFirst({
          where: {
            classId: context.student.classId ?? undefined,
            status: { in: [BoardSessionStatus.LIVE, BoardSessionStatus.PAUSED, BoardSessionStatus.SCHEDULED] },
          },
          include: {
            lessonPackage: true,
            subject: true,
            teacher: { include: { user: true } },
          },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
      ]);

    return {
      role: user.role,
      todayLessons,
      homework,
      grades,
      attendanceSummary: {
        present: attendance.filter((item) => item.status === AttendanceStatus.PRESENT).length,
        absent: attendance.filter((item) => item.status === AttendanceStatus.ABSENT).length,
        late: attendance.filter((item) => item.status === AttendanceStatus.LATE).length,
      },
      events,
      notifications,
      insights,
      liveSession,
    };
  }

  if (user.role === Role.PARENT) {
    const selectedChild =
      context.children.find((child) => child.id === studentId) ?? context.children[0];

    if (!selectedChild) {
      return { role: user.role, children: [], selectedChild: null };
    }

    const [grades, attendance, homework, messages, announcements, insights] =
      await Promise.all([
        db.grade.findMany({
          where: { studentId: selectedChild.id },
          include: { subject: true },
          orderBy: { dateAssigned: "desc" },
          take: 6,
        }),
        db.attendance.findMany({
          where: { studentId: selectedChild.id },
          include: { timetableEntry: { include: { subject: true } } },
          orderBy: { date: "desc" },
          take: 10,
        }),
        db.homework.findMany({
          where: { classId: selectedChild.classId ?? undefined },
          include: {
            subject: true,
            submissions: { where: { studentId: selectedChild.id } },
          },
          orderBy: { dueDate: "asc" },
          take: 8,
        }),
        db.messageThread.count({
          where: {
            participants: {
              some: { userId: user.id },
            },
          },
        }),
        db.announcement.findMany({
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
          take: 5,
        }),
        db.aIInsight.findMany({
          where: { userId: user.id, studentId: selectedChild.id },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
      ]);

    const subjectAverages = Object.values(
      grades.reduce<Record<string, { subject: string; values: number[] }>>((acc, grade) => {
        if (!acc[grade.subjectId]) acc[grade.subjectId] = { subject: grade.subject.name, values: [] };
        acc[grade.subjectId].values.push(grade.value);
        return acc;
      }, {}),
    ).map((item) => ({
      subject: item.subject,
      average: average(item.values),
    }));

    return {
      role: user.role,
      children: context.children,
      selectedChild,
      grades,
      attendance,
      homework,
      messagesCount: messages,
      announcements,
      insights,
      subjectAverages,
    };
  }

  if (user.role === Role.TEACHER && context.teacher) {
    const classIds = [...new Set(context.teacher.assignments.map((item) => item.classId))];
    const studentIds = (
      await db.studentProfile.findMany({
        where: { classId: { in: classIds } },
        select: { id: true },
      })
    ).map((student) => student.id);

    const [todayLessons, homeworkReview, messagesCount, attendanceCount, grades, absenceRisks, liveBoardSessions] =
      await Promise.all([
        db.timetableEntry.findMany({
          where: { teacherId: context.teacher.id, dayOfWeek },
          include: { subject: true, schoolClass: true },
          orderBy: { startTime: "asc" },
        }),
        db.homeworkSubmission.findMany({
          where: {
            homework: { teacherId: context.teacher.id },
            status: { in: [HomeworkSubmissionStatus.SUBMITTED, HomeworkSubmissionStatus.LATE] },
          },
          include: {
            homework: { include: { subject: true } },
            student: { include: { user: true, schoolClass: true } },
          },
          take: 8,
        }),
        db.messageThread.count({
          where: {
            participants: {
              some: { userId: user.id },
            },
          },
        }),
        db.attendance.count({
          where: {
            timetableEntry: { teacherId: context.teacher.id },
            date: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) },
          },
        }),
        db.grade.findMany({
          where: { studentId: { in: studentIds } },
          include: { student: { include: { user: true } }, subject: true },
        }),
        db.attendance.groupBy({
          by: ["studentId"],
          where: {
            studentId: { in: studentIds },
            status: { in: [AttendanceStatus.ABSENT, AttendanceStatus.LATE] },
          },
          _count: { _all: true },
        }),
        db.boardSession.findMany({
          where: {
            teacherId: context.teacher.id,
            status: { in: [BoardSessionStatus.SCHEDULED, BoardSessionStatus.LIVE, BoardSessionStatus.PAUSED] },
          },
          include: {
            lessonPackage: true,
            schoolClass: true,
            subject: true,
          },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          take: 4,
        }),
      ]);

    const riskStudents = absenceRisks
      .filter((item) => item._count._all >= 3)
      .slice(0, 5);

    return {
      role: user.role,
      todayLessons,
      homeworkReview,
      messagesCount,
      attendanceCount,
      grades,
      riskStudents,
      liveBoardSessions,
    };
  }

  const [users, students, teachers, announcements, attendance, grades, auditLogs] = await Promise.all([
    db.user.count(),
    db.studentProfile.count(),
    db.teacherProfile.count(),
    db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.attendance.groupBy({ by: ["status"], _count: { _all: true } }),
    db.grade.findMany({ include: { subject: true }, take: 30, orderBy: { dateAssigned: "desc" } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return {
    role: Role.ADMIN,
    users,
    students,
    teachers,
    announcements,
    attendance,
    grades,
    auditLogs,
  };
}
