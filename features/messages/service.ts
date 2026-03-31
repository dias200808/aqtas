import { MessageThreadType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth/session";

type AccessibleMeta = {
  relationLabel?: string;
  classNames: Set<string>;
  subjectNames: Set<string>;
};

function getFullName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Unknown user";
}

function titleCaseRole(role: Role) {
  switch (role) {
    case Role.ADMIN:
      return "Administrator";
    case Role.TEACHER:
      return "Teacher";
    case Role.PARENT:
      return "Parent";
    case Role.STUDENT:
      return "Student";
    default:
      return "User";
  }
}

function upsertMeta(
  map: Map<string, AccessibleMeta>,
  userId: string,
  next?: {
    relationLabel?: string;
    classNames?: string[];
    subjectNames?: string[];
  },
) {
  const current = map.get(userId) ?? {
    relationLabel: undefined,
    classNames: new Set<string>(),
    subjectNames: new Set<string>(),
  };

  if (!current.relationLabel && next?.relationLabel) {
    current.relationLabel = next.relationLabel;
  }

  next?.classNames?.forEach((item) => current.classNames.add(item));
  next?.subjectNames?.forEach((item) => current.subjectNames.add(item));
  map.set(userId, current);
}

async function assertThreadParticipant(userId: string, threadId: string) {
  const participant = await db.messageParticipant.findUnique({
    where: {
      threadId_userId: {
        threadId,
        userId,
      },
    },
  });

  if (!participant) throw new ApiError(403, "Forbidden");
}

async function getAccessibleParticipantMeta(user: SessionUser) {
  if (user.role === Role.ADMIN) {
    const users = await db.user.findMany({
      where: {
        isActive: true,
        id: { not: user.id },
      },
      select: { id: true },
    });

    return new Map(
      users.map((candidate) => [
        candidate.id,
        {
          relationLabel: undefined,
          classNames: new Set<string>(),
          subjectNames: new Set<string>(),
        },
      ]),
    );
  }

  const map = new Map<string, AccessibleMeta>();

  if (user.role === Role.PARENT) {
    const profile = await db.parentProfile.findUnique({
      where: { userId: user.id },
      include: {
        children: {
          include: {
            student: {
              include: {
                user: true,
                schoolClass: {
                  include: {
                    assignments: {
                      include: {
                        subject: true,
                        teacher: {
                          include: {
                            user: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const relation of profile?.children ?? []) {
      const className = relation.student.schoolClass?.name;
      const childName = getFullName(relation.student.user.firstName, relation.student.user.lastName);

      for (const assignment of relation.student.schoolClass?.assignments ?? []) {
        upsertMeta(map, assignment.teacher.user.id, {
          relationLabel: `Teacher for ${childName}`,
          classNames: className ? [className] : [],
          subjectNames: [assignment.subject.name],
        });
      }
    }

    const admins = await db.user.findMany({
      where: {
        isActive: true,
        role: Role.ADMIN,
        id: { not: user.id },
      },
      select: { id: true },
    });

    admins.forEach((admin) => upsertMeta(map, admin.id, { relationLabel: "School administration" }));
    return map;
  }

  if (user.role === Role.TEACHER) {
    const profile = await db.teacherProfile.findUnique({
      where: { userId: user.id },
      include: {
        assignments: {
          include: {
            subject: true,
            schoolClass: {
              include: {
                students: {
                  include: {
                    user: true,
                    parents: {
                      include: {
                        parent: {
                          include: {
                            user: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const assignment of profile?.assignments ?? []) {
      const className = assignment.schoolClass.name;
      const subjectName = assignment.subject.name;

      for (const student of assignment.schoolClass.students) {
        const studentName = getFullName(student.user.firstName, student.user.lastName);

        upsertMeta(map, student.user.id, {
          relationLabel: `Student in ${className}`,
          classNames: [className],
          subjectNames: [subjectName],
        });

        for (const parentRelation of student.parents) {
          upsertMeta(map, parentRelation.parent.user.id, {
            relationLabel: `Parent of ${studentName}`,
            classNames: [className],
            subjectNames: [subjectName],
          });
        }
      }
    }

    const admins = await db.user.findMany({
      where: {
        isActive: true,
        role: Role.ADMIN,
      },
      select: { id: true },
    });

    admins.forEach((admin) => upsertMeta(map, admin.id, { relationLabel: "School administration" }));

    const teachers = await db.user.findMany({
      where: {
        isActive: true,
        role: Role.TEACHER,
        id: { not: user.id },
      },
      select: { id: true },
    });

    teachers.forEach((teacher) => upsertMeta(map, teacher.id, { relationLabel: "Teaching staff" }));
    return map;
  }

  if (user.role === Role.STUDENT) {
    const profile = await db.studentProfile.findUnique({
      where: { userId: user.id },
      include: {
        schoolClass: {
          include: {
            assignments: {
              include: {
                subject: true,
                teacher: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const assignment of profile?.schoolClass?.assignments ?? []) {
      upsertMeta(map, assignment.teacher.user.id, {
        relationLabel: `Teacher for ${assignment.subject.name}`,
        classNames: profile?.schoolClass?.name ? [profile.schoolClass.name] : [],
        subjectNames: [assignment.subject.name],
      });
    }

    const admins = await db.user.findMany({
      where: {
        isActive: true,
        role: Role.ADMIN,
      },
      select: { id: true },
    });

    admins.forEach((admin) => upsertMeta(map, admin.id, { relationLabel: "School administration" }));
    return map;
  }

  return map;
}

async function getAccessibleParticipantIds(user: SessionUser) {
  return new Set((await getAccessibleParticipantMeta(user)).keys());
}

async function assertCanInvite(user: SessionUser, payload: { type: MessageThreadType; participantIds: string[] }) {
  const participantIds = payload.participantIds.filter((id) => id !== user.id);
  if (!participantIds.length) {
    throw new ApiError(400, "Pick at least one participant");
  }

  if (payload.type === MessageThreadType.DIRECT && participantIds.length !== 1) {
    throw new ApiError(400, "Direct chats can only have one recipient");
  }

  if (payload.type !== MessageThreadType.DIRECT && user.role === Role.PARENT) {
    throw new ApiError(403, "Parents can only create direct chats");
  }

  if (payload.type === MessageThreadType.CLASS && user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
    throw new ApiError(403, "Only teachers and administrators can create class groups");
  }

  if (user.role === Role.ADMIN) return;

  const allowedIds = await getAccessibleParticipantIds(user);
  const invalidId = participantIds.find((id) => !allowedIds.has(id));

  if (invalidId) {
    throw new ApiError(403, "One or more participants are not allowed");
  }
}

async function findReusableDirectThread(userId: string, participantId: string) {
  const existing = await db.messageThread.findMany({
    where: {
      type: MessageThreadType.DIRECT,
      participants: {
        some: {
          userId,
        },
      },
    },
    include: {
      participants: true,
    },
  });

  return (
    existing.find((thread) => {
      const ids = thread.participants.map((participant) => participant.userId).sort();
      return ids.length === 2 && ids[0] !== ids[1] && ids.includes(userId) && ids.includes(participantId);
    }) ?? null
  );
}

function formatThreadTitle(
  thread: {
    type: MessageThreadType;
    title: string | null;
    participants: Array<{
      userId: string;
      user: {
        firstName: string;
        lastName: string;
        role: Role;
      };
    }>;
  },
  userId: string,
) {
  if (thread.title?.trim()) return thread.title;

  const others = thread.participants.filter((participant) => participant.userId !== userId);

  if (thread.type === MessageThreadType.DIRECT) {
    const user = others[0]?.user;
    return user ? getFullName(user.firstName, user.lastName) : "Conversation";
  }

  if (!others.length) return "Group chat";
  return others
    .slice(0, 3)
    .map((participant) => getFullName(participant.user.firstName, participant.user.lastName))
    .join(", ");
}

export async function listThreads(user: SessionUser) {
  const threads = await db.messageThread.findMany({
    where: {
      participants: {
        some: { userId: user.id },
      },
    },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: true },
      },
    },
  });

  const unreadCounts = await db.message.findMany({
    where: {
      thread: {
        participants: {
          some: { userId: user.id },
        },
      },
      senderId: { not: user.id },
      readStates: {
        none: { userId: user.id },
      },
    },
    select: { threadId: true },
  });

  const unreadByThread = unreadCounts.reduce<Record<string, number>>((acc, item) => {
    acc[item.threadId] = (acc[item.threadId] || 0) + 1;
    return acc;
  }, {});

  return threads
    .map((thread) => {
      const lastMessage = thread.messages[0] ?? null;
      return {
        id: thread.id,
        type: thread.type,
        title: thread.title,
        displayTitle: formatThreadTitle(thread, user.id),
        unreadCount: unreadByThread[thread.id] || 0,
        createdAt: thread.createdAt,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
              senderName: getFullName(lastMessage.sender.firstName, lastMessage.sender.lastName),
            }
          : null,
        participants: thread.participants.map((participant) => ({
          userId: participant.userId,
          isPinned: participant.isPinned,
          user: {
            id: participant.user.id,
            firstName: participant.user.firstName,
            lastName: participant.user.lastName,
            email: participant.user.email,
            phone: participant.user.phone,
            avatarUrl: participant.user.avatarUrl,
            role: participant.user.role,
          },
        })),
      };
    })
    .sort((a, b) => {
      const aDate = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
      const bDate = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
      return bDate - aDate;
    });
}

export async function createThread(
  user: SessionUser,
  payload: {
    type: MessageThreadType;
    title?: string;
    participantIds: string[];
  },
) {
  const participantIds = [...new Set([user.id, ...payload.participantIds])];
  await assertCanInvite(user, {
    type: payload.type,
    participantIds,
  });

  if (payload.type === MessageThreadType.DIRECT) {
    const recipientId = participantIds.find((id) => id !== user.id);
    if (!recipientId) throw new ApiError(400, "Recipient is required");
    const existing = await findReusableDirectThread(user.id, recipientId);
    if (existing) return existing;
  }

  return db.messageThread.create({
    data: {
      type: payload.type,
      title: payload.title?.trim() || null,
      participants: {
        createMany: {
          data: participantIds.map((participantId) => ({ userId: participantId })),
        },
      },
    },
  });
}

export async function getThreadMessages(user: SessionUser, threadId: string) {
  await assertThreadParticipant(user.id, threadId);

  const thread = await db.messageThread.findUnique({
    where: { id: threadId },
    include: {
      participants: {
        include: {
          user: {
            include: {
              teacherProfile: {
                include: {
                  assignments: {
                    include: {
                      subject: true,
                      schoolClass: true,
                    },
                  },
                },
              },
              studentProfile: {
                include: {
                  schoolClass: true,
                },
              },
              parentProfile: {
                include: {
                  children: {
                    include: {
                      student: {
                        include: {
                          user: true,
                          schoolClass: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      messages: {
        include: {
          sender: true,
          readStates: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!thread) throw new ApiError(404, "Thread not found");

  const unreadMessages = thread.messages.filter(
    (message) =>
      message.senderId !== user.id &&
      !message.readStates.some((state) => state.userId === user.id),
  );

  if (unreadMessages.length) {
    await db.messageReadState.createMany({
      data: unreadMessages.map((message) => ({
        messageId: message.id,
        userId: user.id,
        readAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  return {
    id: thread.id,
    type: thread.type,
    title: thread.title,
    displayTitle: formatThreadTitle(thread, user.id),
    participants: thread.participants.map((participant) => ({
      userId: participant.userId,
      isPinned: participant.isPinned,
      user: {
        id: participant.user.id,
        firstName: participant.user.firstName,
        lastName: participant.user.lastName,
        email: participant.user.email,
        phone: participant.user.phone,
        avatarUrl: participant.user.avatarUrl,
        role: participant.user.role,
      },
      classes:
        participant.user.teacherProfile?.assignments.map((assignment) => assignment.schoolClass.name) ??
        (participant.user.studentProfile?.schoolClass ? [participant.user.studentProfile.schoolClass.name] : []),
      subjects: participant.user.teacherProfile?.assignments.map((assignment) => assignment.subject.name) ?? [],
      children:
        participant.user.parentProfile?.children.map((relation) =>
          getFullName(relation.student.user.firstName, relation.student.user.lastName),
        ) ?? [],
    })),
    messages: thread.messages.map((message) => ({
      id: message.id,
      content: message.content,
      attachmentUrl: message.attachmentUrl,
      createdAt: message.createdAt,
      isEdited: message.isEdited,
      senderId: message.senderId,
      sender: {
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        role: message.sender.role,
      },
    })),
  };
}

export async function listAvailableContacts(user: SessionUser, search?: string) {
  const participantMeta = await getAccessibleParticipantMeta(user);
  const ids = [...participantMeta.keys()];

  if (!ids.length) return [];

  const users = await db.user.findMany({
    where: {
      id: { in: ids },
      isActive: true,
      OR: search?.trim()
        ? [
            { firstName: { contains: search.trim(), mode: "insensitive" } },
            { lastName: { contains: search.trim(), mode: "insensitive" } },
            { email: { contains: search.trim(), mode: "insensitive" } },
          ]
        : undefined,
    },
    include: {
      teacherProfile: {
        include: {
          assignments: {
            include: {
              subject: true,
              schoolClass: true,
            },
          },
        },
      },
      studentProfile: {
        include: {
          schoolClass: true,
        },
      },
      parentProfile: {
        include: {
          children: {
            include: {
              student: {
                include: {
                  user: true,
                  schoolClass: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  });

  return users.map((candidate) => {
    const meta = participantMeta.get(candidate.id);
    const classes = new Set(meta?.classNames ?? []);
    const subjects = new Set(meta?.subjectNames ?? []);

    candidate.teacherProfile?.assignments.forEach((assignment) => {
      classes.add(assignment.schoolClass.name);
      subjects.add(assignment.subject.name);
    });

    if (candidate.studentProfile?.schoolClass?.name) {
      classes.add(candidate.studentProfile.schoolClass.name);
    }

    const children =
      candidate.parentProfile?.children.map((relation) =>
        getFullName(relation.student.user.firstName, relation.student.user.lastName),
      ) ?? [];

    return {
      id: candidate.id,
      fullName: getFullName(candidate.firstName, candidate.lastName),
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      avatarUrl: candidate.avatarUrl,
      role: candidate.role,
      roleLabel: titleCaseRole(candidate.role),
      relationLabel: meta?.relationLabel ?? undefined,
      classes: [...classes],
      subjects: [...subjects],
      children,
      canCreateDirect: true,
      canCreateGroup: user.role === Role.ADMIN || user.role === Role.TEACHER,
    };
  });
}

export async function sendMessage(
  user: SessionUser,
  payload: {
    threadId: string;
    content: string;
    attachmentUrl?: string;
  },
) {
  await assertThreadParticipant(user.id, payload.threadId);

  return db.message.create({
    data: {
      threadId: payload.threadId,
      senderId: user.id,
      content: payload.content,
      attachmentUrl: payload.attachmentUrl || null,
    },
    include: {
      sender: true,
    },
  });
}
