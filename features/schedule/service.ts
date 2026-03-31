import { BoardSessionStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getRoleContext } from "@/lib/context";
import type { SessionUser } from "@/lib/auth/session";

export async function getScheduleView(user: SessionUser, studentId?: string) {
  const context = await getRoleContext(user);

  if (user.role === Role.STUDENT && context.student?.classId) {
    return db.timetableEntry.findMany({
      where: { classId: context.student.classId },
      include: {
        subject: true,
        schoolClass: true,
        teacher: { include: { user: true } },
        boardSessions: {
          where: {
            status: { in: [BoardSessionStatus.SCHEDULED, BoardSessionStatus.LIVE, BoardSessionStatus.PAUSED] },
          },
          select: { id: true, status: true },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  if (user.role === Role.PARENT) {
    const selectedChild =
      context.children.find((child) => child.id === studentId) ?? context.children[0];
    if (!selectedChild?.classId) return [];

    return db.timetableEntry.findMany({
      where: { classId: selectedChild.classId },
      include: {
        subject: true,
        schoolClass: true,
        teacher: { include: { user: true } },
        boardSessions: {
          where: {
            status: { in: [BoardSessionStatus.SCHEDULED, BoardSessionStatus.LIVE, BoardSessionStatus.PAUSED] },
          },
          select: { id: true, status: true },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  if (user.role === Role.TEACHER && context.teacher) {
    return db.timetableEntry.findMany({
      where: { teacherId: context.teacher.id },
      include: {
        subject: true,
        schoolClass: true,
        teacher: { include: { user: true } },
        boardSessions: {
          where: {
            status: { in: [BoardSessionStatus.SCHEDULED, BoardSessionStatus.LIVE, BoardSessionStatus.PAUSED] },
          },
          select: { id: true, status: true },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  return db.timetableEntry.findMany({
    include: {
      subject: true,
      schoolClass: true,
      teacher: { include: { user: true } },
      boardSessions: {
        where: {
          status: { in: [BoardSessionStatus.SCHEDULED, BoardSessionStatus.LIVE, BoardSessionStatus.PAUSED] },
        },
        select: { id: true, status: true },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}
