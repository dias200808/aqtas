import { EventType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getRoleContext } from "@/lib/context";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth/session";

export async function listEvents(user: SessionUser, studentId?: string) {
  const context = await getRoleContext(user);
  const classId =
    user.role === Role.STUDENT
      ? context.student?.classId
      : user.role === Role.PARENT
        ? (context.children.find((child) => child.id === studentId) ?? context.children[0])?.classId
        : undefined;

  return db.event.findMany({
    where: classId ? { OR: [{ classId }, { classId: null }] } : undefined,
    include: {
      schoolClass: true,
      createdBy: true,
    },
    orderBy: { startAt: "asc" },
  });
}

export async function createEvent(
  user: SessionUser,
  payload: {
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    type: EventType;
    classId?: string | null;
  },
) {
  if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
    throw new ApiError(403, "You cannot create events");
  }

  return db.event.create({
    data: {
      title: payload.title,
      description: payload.description,
      startAt: new Date(payload.startAt),
      endAt: new Date(payload.endAt),
      type: payload.type,
      classId: payload.classId || null,
      createdByUserId: user.id,
    },
  });
}

export async function updateEvent(
  user: SessionUser,
  id: string,
  payload: Partial<{
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    type: EventType;
    classId?: string | null;
  }>,
) {
  const event = await db.event.findUnique({ where: { id } });
  if (!event) throw new ApiError(404, "Event not found");
  if (user.role !== Role.ADMIN && event.createdByUserId !== user.id) {
    throw new ApiError(403, "You cannot update this event");
  }

  return db.event.update({
    where: { id },
    data: {
      ...payload,
      startAt: payload.startAt ? new Date(payload.startAt) : undefined,
      endAt: payload.endAt ? new Date(payload.endAt) : undefined,
    },
  });
}

export async function deleteEvent(user: SessionUser, id: string) {
  const event = await db.event.findUnique({ where: { id } });
  if (!event) throw new ApiError(404, "Event not found");
  if (user.role !== Role.ADMIN && event.createdByUserId !== user.id) {
    throw new ApiError(403, "You cannot delete this event");
  }

  await db.event.delete({ where: { id } });
  return { id };
}
