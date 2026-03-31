import { AppLanguage, PlanPeriod, PlanStatus, Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { getRoleContext } from "@/lib/context";
import { assertTeacherAssignment } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth/session";

type AcademicPlanPayload = {
  classId?: string | null;
  subjectId?: string | null;
  title: string;
  academicYear: string;
  period: PlanPeriod;
  status: PlanStatus;
  termLabel?: string;
  objective: string;
  expectedOutcomes: string[];
  checkpoints: string[];
  plannedLessons: number;
  completedLessons: number;
  language: AppLanguage;
};

async function getTeacherProfileId(user: SessionUser) {
  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: user.id },
  });

  if (!teacherProfile) throw new ApiError(404, "Teacher profile not found");
  return teacherProfile.id;
}

export async function listAcademicPlans(user: SessionUser) {
  if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
    throw new ApiError(403, "Forbidden");
  }

  const where: Prisma.AcademicPlanWhereInput =
    user.role === Role.ADMIN
      ? {}
      : {
          teacher: {
            userId: user.id,
          },
        };

  return db.academicPlan.findMany({
    where,
    include: {
      schoolClass: true,
      subject: true,
      teacher: { include: { user: true } },
    },
    orderBy: [{ academicYear: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createAcademicPlan(user: SessionUser, payload: AcademicPlanPayload) {
  if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
    throw new ApiError(403, "Forbidden");
  }

  if (user.role === Role.TEACHER && payload.classId && payload.subjectId) {
    const allowed = await assertTeacherAssignment(user, {
      classId: payload.classId,
      subjectId: payload.subjectId,
    });

    if (!allowed) {
      throw new ApiError(403, "You are not assigned to this class and subject");
    }
  }

  const teacherId =
    user.role === Role.ADMIN
      ? (await db.teacherProfile.findFirstOrThrow({ orderBy: { employeeCode: "asc" } })).id
      : await getTeacherProfileId(user);

  return db.academicPlan.create({
    data: {
      teacherId,
      classId: payload.classId || null,
      subjectId: payload.subjectId || null,
      title: payload.title,
      academicYear: payload.academicYear,
      period: payload.period,
      status: payload.status,
      termLabel: payload.termLabel || null,
      objective: payload.objective,
      expectedOutcomes: payload.expectedOutcomes,
      checkpoints: payload.checkpoints,
      plannedLessons: payload.plannedLessons,
      completedLessons: payload.completedLessons,
      language: payload.language,
    },
  });
}

export async function updateAcademicPlan(
  user: SessionUser,
  id: string,
  payload: Partial<AcademicPlanPayload>,
) {
  const plan = await db.academicPlan.findUnique({
    where: { id },
    include: { teacher: { include: { user: true } } },
  });

  if (!plan) throw new ApiError(404, "Academic plan not found");

  if (user.role !== Role.ADMIN && plan.teacher.userId !== user.id) {
    throw new ApiError(403, "Forbidden");
  }

  return db.academicPlan.update({
    where: { id },
    data: {
      title: payload.title,
      academicYear: payload.academicYear,
      period: payload.period,
      status: payload.status,
      termLabel: payload.termLabel,
      objective: payload.objective,
      expectedOutcomes: payload.expectedOutcomes,
      checkpoints: payload.checkpoints,
      plannedLessons: payload.plannedLessons,
      completedLessons: payload.completedLessons,
      language: payload.language,
    },
  });
}

export async function buildPlanningOptions(user: SessionUser) {
  const context = await getRoleContext(user);

  if (user.role === Role.ADMIN) {
    const [classes, subjects] = await Promise.all([
      db.schoolClass.findMany({ orderBy: { name: "asc" } }),
      db.subject.findMany({ orderBy: { name: "asc" } }),
    ]);

    return { classes, subjects };
  }

  if (user.role !== Role.TEACHER) {
    throw new ApiError(403, "Forbidden");
  }

  return {
    classes: [...new Map((context.teacher?.assignments ?? []).map((item) => [item.schoolClass.id, item.schoolClass])).values()],
    subjects: [...new Map((context.teacher?.assignments ?? []).map((item) => [item.subject.id, item.subject])).values()],
  };
}
