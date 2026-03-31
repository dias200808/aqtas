import { AttendanceStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { average } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { canAccessStudent } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth/session";

export async function buildStudentReport(user: SessionUser, studentId: string) {
  const allowed = await canAccessStudent(user, studentId);
  if (!allowed) throw new ApiError(403, "Forbidden");

  const student = await db.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      schoolClass: true,
      grades: { include: { subject: true } },
      attendances: true,
      submissions: { include: { homework: { include: { subject: true } } } },
    },
  });

  if (!student) throw new ApiError(404, "Student not found");

  const subjectAverages = Object.values(
    student.grades.reduce<Record<string, { subject: string; values: number[] }>>((acc, grade) => {
      const key = grade.subjectId;
      if (!acc[key]) acc[key] = { subject: grade.subject.name, values: [] };
      acc[key].values.push(grade.value);
      return acc;
    }, {}),
  ).map((item) => ({
    subject: item.subject,
    average: average(item.values),
  }));

  const attendanceSummary = {
    present: student.attendances.filter((item) => item.status === AttendanceStatus.PRESENT).length,
    absent: student.attendances.filter((item) => item.status === AttendanceStatus.ABSENT).length,
    late: student.attendances.filter((item) => item.status === AttendanceStatus.LATE).length,
    excused: student.attendances.filter((item) => item.status === AttendanceStatus.EXCUSED).length,
  };

  return {
    student,
    subjectAverages,
    attendanceSummary,
  };
}

export async function buildClassReport(user: SessionUser, classId: string) {
  if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
    throw new ApiError(403, "Forbidden");
  }

  const schoolClass = await db.schoolClass.findUnique({
    where: { id: classId },
    include: {
      students: {
        include: {
          user: true,
          grades: true,
          attendances: true,
        },
      },
    },
  });

  if (!schoolClass) throw new ApiError(404, "Class not found");

  return {
    schoolClass,
    students: schoolClass.students.map((student) => ({
      id: student.id,
      fullName: `${student.user.firstName} ${student.user.lastName}`,
      averageGrade: average(student.grades.map((grade) => grade.value)),
      absences: student.attendances.filter((attendance) => attendance.status === AttendanceStatus.ABSENT).length,
    })),
  };
}

export async function buildAdminOverview(user: SessionUser) {
  if (user.role !== Role.ADMIN) throw new ApiError(403, "Forbidden");

  const [userCount, studentCount, teacherCount, parentCount, announcementCount, eventCount, lessonPackageCount, boardSessionCount, academicPlanCount] =
    await Promise.all([
      db.user.count(),
      db.studentProfile.count(),
      db.teacherProfile.count(),
      db.parentProfile.count(),
      db.announcement.count(),
      db.event.count(),
      db.lessonPackage.count(),
      db.boardSession.count(),
      db.academicPlan.count(),
    ]);

  return {
    userCount,
    studentCount,
    teacherCount,
    parentCount,
    announcementCount,
    eventCount,
    lessonPackageCount,
    boardSessionCount,
    academicPlanCount,
  };
}
