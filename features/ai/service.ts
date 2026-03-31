import { AIInsightType, AttendanceStatus, InsightSeverity, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getRoleContext } from "@/lib/context";
import { ApiError } from "@/lib/api";
import { canAccessStudent } from "@/lib/permissions";
import { generateWithProviderDetailed } from "@/lib/ai/provider";
import { average } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";

type AiResponse = {
  title: string;
  content: string;
  meta: {
    source: "openai" | "gemini" | "fallback";
    model: string;
    providerLabel: "OpenAI" | "Gemini" | "Fallback";
    reason?: string;
  };
};

function formatShortDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function averageGrade(values: number[]) {
  return average(values).toFixed(1);
}

async function getStudentContext(user: SessionUser, studentId?: string) {
  const context = await getRoleContext(user);

  if (user.role === Role.STUDENT && context.student) {
    return context.student;
  }

  if (user.role === Role.PARENT) {
    return context.children.find((child) => child.id === studentId) ?? context.children[0] ?? null;
  }

  if ((user.role === Role.TEACHER || user.role === Role.ADMIN) && studentId) {
    const allowed = user.role === Role.ADMIN ? true : await canAccessStudent(user, studentId);
    if (!allowed) throw new ApiError(403, "Forbidden");
    return db.studentProfile.findUnique({
      where: { id: studentId },
      include: { user: true, schoolClass: true },
    });
  }

  return null;
}

async function collectStudentSnapshot(user: SessionUser, studentId?: string) {
  const student = await getStudentContext(user, studentId);
  if (!student) throw new ApiError(404, "Student context not available");

  const [grades, attendance, homework, events] = await Promise.all([
    db.grade.findMany({
      where: { studentId: student.id },
      include: { subject: true },
      orderBy: { dateAssigned: "desc" },
      take: 12,
    }),
    db.attendance.findMany({
      where: { studentId: student.id },
      include: {
        timetableEntry: { include: { subject: true } },
      },
      orderBy: { date: "desc" },
      take: 20,
    }),
    db.homework.findMany({
      where: { classId: student.classId ?? undefined },
      include: {
        subject: true,
        submissions: { where: { studentId: student.id } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    db.event.findMany({
      where: {
        OR: [{ classId: student.classId ?? undefined }, { classId: null }],
        startAt: { gte: new Date() },
      },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
  ]);

  return { student, grades, attendance, homework, events };
}

async function getTeacherSnapshot(user: SessionUser) {
  if (user.role !== Role.TEACHER) throw new ApiError(403, "Teacher only");

  const context = await getRoleContext(user);
  const classIds = [...new Set(context.teacher?.assignments.map((item) => item.classId) ?? [])];
  const subjectNames = [...new Set(context.teacher?.assignments.map((item) => item.subject.name) ?? [])];

  const [students, homeworkReviewCount, recentHomework] = await Promise.all([
    db.studentProfile.findMany({
      where: { classId: { in: classIds } },
      include: {
        user: true,
        schoolClass: true,
        grades: true,
        attendances: true,
      },
    }),
    db.homeworkSubmission.count({
      where: {
        status: "SUBMITTED",
        homework: {
          classId: { in: classIds },
        },
      },
    }),
    db.homework.findMany({
      where: { classId: { in: classIds } },
      include: { schoolClass: true, subject: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ]);

  return {
    classIds,
    subjectNames,
    students,
    homeworkReviewCount,
    recentHomework,
  };
}

async function persistInsight(
  user: SessionUser,
  studentId: string | null,
  type: AIInsightType,
  title: string,
  content: string,
  severity: InsightSeverity = InsightSeverity.MEDIUM,
) {
  await db.aIInsight.create({
    data: {
      userId: user.id,
      studentId,
      type,
      title,
      content,
      severity,
    },
  });
}

async function groundedGeneration({
  type,
  title,
  user,
  studentId,
  facts,
  fallback,
  severity,
  persist = true,
  systemPrompt,
}: {
  type: AIInsightType;
  title: string;
  user: SessionUser;
  studentId: string | null;
  facts: string[];
  fallback: string;
  severity?: InsightSeverity;
  persist?: boolean;
  systemPrompt?: string;
}): Promise<AiResponse> {
  const prompt = `Use only these verified school facts. If information is missing, say so.\n\n${facts
    .map((fact, index) => `${index + 1}. ${fact}`)
    .join("\n")}\n\nReturn a concise practical answer.`;

  const providerResult = await generateWithProviderDetailed({
    system:
      systemPrompt ||
      "You are an education assistant. Never invent grades, attendance, homework, or events. Use only the provided facts.",
    prompt,
    temperature: 0.35,
  });

  const content = providerResult.content || fallback;
  if (persist) {
    await persistInsight(user, studentId, type, title, content, severity);
  }

  return {
    title,
    content,
    meta: {
      source: providerResult.content ? providerResult.source : "fallback",
      model: providerResult.model,
      providerLabel: providerResult.content ? providerResult.providerLabel : "Fallback",
      reason: providerResult.content ? undefined : providerResult.reason,
    },
  };
}

function buildGeneralAssistantSystemPrompt(user: SessionUser) {
  const roleGuidance =
    user.role === Role.PARENT
      ? "Explain things in very simple parent-friendly language."
      : user.role === Role.STUDENT
        ? "Explain things clearly for a student and include simple examples when useful."
        : user.role === Role.TEACHER
          ? "Answer like a strong teaching assistant: clear, practical, and accurate."
          : "Answer clearly and professionally.";

  return [
    "You are a helpful AI education assistant inside a school platform.",
    "You may answer normal educational questions, study questions, definitions, math concepts, exam explanations, and practical learning advice.",
    "Do not repeat boilerplate. Do not mention missing school facts unless the user is clearly asking about student records, grades, homework, attendance, or school events.",
    "For general knowledge questions, answer directly and naturally.",
    "Respond in the same language as the user unless they ask for another language.",
    roleGuidance,
  ].join(" ");
}

function looksLikeSchoolDataQuestion(question: string) {
  const normalized = question.toLowerCase();
  const schoolKeywords = [
    "grade",
    "grades",
    "attendance",
    "absent",
    "late",
    "homework",
    "assignment",
    "schedule",
    "calendar",
    "event",
    "school",
    "class",
    "student",
    "teacher",
    "parent",
    "risk",
    "diary",
    "report",
    "my child",
    "my son",
    "my daughter",
    "my class",
    "my student",
    "оцен",
    "посещ",
    "опозд",
    "домаш",
    "задан",
    "распис",
    "календар",
    "событ",
    "школ",
    "класс",
    "ученик",
    "учениц",
    "учител",
    "родител",
    "риск",
    "отчет",
    "дневник",
    "мой ребенок",
    "моя дочь",
    "мой сын",
    "мой класс",
    "мой ученик",
  ];

  return schoolKeywords.some((keyword) => normalized.includes(keyword));
}

async function generalGeneration({
  title,
  user,
  prompt,
  fallback,
}: {
  title: string;
  user: SessionUser;
  prompt: string;
  fallback: string;
}): Promise<AiResponse> {
  const providerResult = await generateWithProviderDetailed({
    system: buildGeneralAssistantSystemPrompt(user),
    prompt,
    temperature: 0.8,
  });

  return {
    title,
    content: providerResult.content || fallback,
    meta: {
      source: providerResult.content ? providerResult.source : "fallback",
      model: providerResult.model,
      providerLabel: providerResult.content ? providerResult.providerLabel : "Fallback",
      reason: providerResult.content ? undefined : providerResult.reason,
    },
  };
}

function buildStudentQuestionFallback(
  snapshot: Awaited<ReturnType<typeof collectStudentSnapshot>>,
  question: string,
  role: Role,
) {
  const lowerQuestion = question.toLowerCase();
  const recentAverage = averageGrade(snapshot.grades.map((item) => item.value));
  const overdue = snapshot.homework.filter((item) => {
    const submission = item.submissions[0];
    return new Date(item.dueDate) < new Date() && submission?.status !== "SUBMITTED";
  });
  const upcomingHomework = snapshot.homework
    .filter((item) => new Date(item.dueDate) >= new Date())
    .slice(0, 3);
  const absences = snapshot.attendance.filter((item) => item.status === AttendanceStatus.ABSENT).length;
  const lates = snapshot.attendance.filter((item) => item.status === AttendanceStatus.LATE).length;

  const weakSubjects = Object.values(
    snapshot.grades.reduce<Record<string, { name: string; values: number[] }>>((acc, grade) => {
      if (!acc[grade.subjectId]) acc[grade.subjectId] = { name: grade.subject.name, values: [] };
      acc[grade.subjectId].values.push(grade.value);
      return acc;
    }, {}),
  )
    .map((item) => ({ name: item.name, score: average(item.values) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  const nextEvent = snapshot.events[0];
  const nextHomework = upcomingHomework[0];

  if (lowerQuestion.includes("attendance") || lowerQuestion.includes("absent") || lowerQuestion.includes("late")) {
    return [
      `Attendance for ${snapshot.student.user.firstName}:`,
      `Absences: ${absences}.`,
      `Late marks: ${lates}.`,
      absences || lates
        ? "This should be watched closely so small attendance issues do not become a bigger learning problem."
        : "Attendance looks steady right now.",
    ].join("\n");
  }

  if (lowerQuestion.includes("grade") || lowerQuestion.includes("study") || lowerQuestion.includes("weak")) {
    return [
      `${snapshot.student.user.firstName}'s learning picture:`,
      `Current recent average: ${recentAverage}.`,
      `Weakest subjects right now: ${weakSubjects.map((item) => `${item.name} (${item.score.toFixed(1)})`).join(", ") || "Not enough grade data"}.`,
      nextHomework
        ? `Best next step: finish ${nextHomework.title} for ${nextHomework.subject.name} before ${formatShortDate(nextHomework.dueDate)}.`
        : "There is no active homework to turn into a study plan right now.",
    ].join("\n");
  }

  if (lowerQuestion.includes("event") || lowerQuestion.includes("test") || lowerQuestion.includes("calendar")) {
    return [
      `Upcoming school items for ${snapshot.student.user.firstName}:`,
      nextEvent ? `Next event: ${nextEvent.title} on ${formatShortDate(nextEvent.startAt)}.` : "There are no upcoming events in the calendar right now.",
      upcomingHomework.length
        ? `Next homework deadlines: ${upcomingHomework.map((item) => `${item.title} (${formatShortDate(item.dueDate)})`).join(", ")}.`
        : "There are no upcoming homework deadlines right now.",
    ].join("\n");
  }

  const opening =
    role === Role.PARENT
      ? `Main things for ${snapshot.student.user.firstName} in simple words:`
      : `Main things to know for ${snapshot.student.user.firstName}:`;

  return [
    opening,
    overdue.length
      ? `Urgent: ${overdue.length} homework task${overdue.length === 1 ? " is" : "s are"} overdue.`
      : "No homework is overdue right now.",
    nextHomework
      ? `Next important task: ${nextHomework.title} for ${nextHomework.subject.name}, due ${formatShortDate(nextHomework.dueDate)}.`
      : "There is no new homework due soon.",
    `Recent grade average: ${recentAverage}.`,
    nextEvent ? `Next event: ${nextEvent.title} on ${formatShortDate(nextEvent.startAt)}.` : "No upcoming event is scheduled yet.",
    weakSubjects[0]
      ? `Best focus area: ${weakSubjects[0].name}.`
      : "There is not enough grade data to name a weak subject yet.",
  ].join("\n");
}

function buildTeacherQuestionFallback(
  snapshot: Awaited<ReturnType<typeof getTeacherSnapshot>>,
  question: string,
) {
  const lowerQuestion = question.toLowerCase();
  const atRiskStudents = snapshot.students.filter(
    (student) => average(student.grades.map((grade) => grade.value)) < 70,
  );
  const attendanceConcernStudents = snapshot.students.filter(
    (student) => student.attendances.filter((item) => item.status === AttendanceStatus.ABSENT).length >= 3,
  );

  if (lowerQuestion.includes("study") || lowerQuestion.includes("plan")) {
    return [
      "Teacher study-planning help:",
      `You currently teach ${snapshot.students.length} students across ${snapshot.classIds.length} classes.`,
      snapshot.recentHomework.length
        ? `Recent assignments to build from: ${snapshot.recentHomework.map((item) => `${item.title} (${item.subject.name})`).join(", ")}.`
        : "There are no recent homework records to build a plan from yet.",
      "For an individual study plan, select a student first and run the study-plan action.",
    ].join("\n");
  }

  if (lowerQuestion.includes("review") || lowerQuestion.includes("homework")) {
    return [
      "Homework review picture:",
      `Submissions waiting for review: ${snapshot.homeworkReviewCount}.`,
      snapshot.recentHomework.length
        ? `Closest homework deadlines: ${snapshot.recentHomework.map((item) => `${item.schoolClass.name} - ${item.title} (${formatShortDate(item.dueDate)})`).join(", ")}.`
        : "There are no homework deadlines in the current snapshot.",
    ].join("\n");
  }

  return [
    "Teacher overview:",
    `Classes covered: ${snapshot.classIds.length}. Subjects: ${snapshot.subjectNames.join(", ") || "Not assigned yet"}.`,
    `Students with low grade averages: ${atRiskStudents.length}.`,
    `Students with repeated absences: ${attendanceConcernStudents.length}.`,
    `Homework submissions waiting for review: ${snapshot.homeworkReviewCount}.`,
  ].join("\n");
}

export async function generateDaySummary(user: SessionUser, studentId?: string) {
  const snapshot = await collectStudentSnapshot(user, studentId);
  const todayHomework = snapshot.homework.filter((item) => new Date(item.dueDate) >= new Date());
  const overdue = snapshot.homework.filter((item) => {
    const submission = item.submissions[0];
    return new Date(item.dueDate) < new Date() && submission?.status !== "SUBMITTED";
  });

  const facts = [
    `Student: ${snapshot.student.user.firstName} ${snapshot.student.user.lastName}`,
    `Upcoming homework count: ${todayHomework.length}`,
    `Overdue homework count: ${overdue.length}`,
    `Recent grades average: ${averageGrade(snapshot.grades.map((item) => item.value))}`,
    `Attendance in last 20 records: ${snapshot.attendance.filter((item) => item.status === AttendanceStatus.PRESENT).length} present, ${snapshot.attendance.filter((item) => item.status !== AttendanceStatus.PRESENT).length} not fully present`,
    `Upcoming events count: ${snapshot.events.length}`,
  ];

  const fallback = `Today looks ${overdue.length ? "urgent" : "steady"} for ${snapshot.student.user.firstName}. Prioritize ${overdue.length} overdue tasks, then focus on ${todayHomework.slice(0, 2).map((item) => item.subject.name).join(" and ") || "current assignments"}. Recent performance averages ${averageGrade(snapshot.grades.map((item) => item.value))}.`;

  return groundedGeneration({
    type: AIInsightType.DAY_SUMMARY,
    title: user.role === Role.PARENT ? "Main things today" : "Daily summary",
    user,
    studentId: snapshot.student.id,
    facts,
    fallback,
    systemPrompt:
      user.role === Role.PARENT
        ? "You are a school family assistant. Use very simple plain language for parents. Never invent data. Focus on the most important next actions."
        : undefined,
  });
}

export async function generateWeekSummary(user: SessionUser, studentId?: string) {
  const snapshot = await collectStudentSnapshot(user, studentId);
  const weakSubjects = Object.values(
    snapshot.grades.reduce<Record<string, { subject: string; values: number[] }>>((acc, grade) => {
      if (!acc[grade.subjectId]) acc[grade.subjectId] = { subject: grade.subject.name, values: [] };
      acc[grade.subjectId].values.push(grade.value);
      return acc;
    }, {}),
  )
    .map((item) => ({ subject: item.subject, average: average(item.values) }))
    .sort((a, b) => a.average - b.average)
    .slice(0, 3);

  const facts = [
    `Recent grade average: ${averageGrade(snapshot.grades.map((item) => item.value))}`,
    `Weakest subjects: ${weakSubjects.map((item) => `${item.subject} (${item.average.toFixed(1)})`).join(", ") || "No subject data"}`,
    `Upcoming events: ${snapshot.events.map((item) => item.title).join(", ") || "No upcoming events"}`,
    `Homework due this week: ${snapshot.homework.length}`,
  ];

  const fallback = `This week, focus on ${weakSubjects[0]?.subject || "the lowest-scoring subject"} and keep homework moving before deadlines stack up. There are ${snapshot.homework.length} active assignments and ${snapshot.events.length} upcoming events on the calendar.`;

  return groundedGeneration({
    type: AIInsightType.WEEK_SUMMARY,
    title: user.role === Role.PARENT ? "Weekly family summary" : "Weekly summary",
    user,
    studentId: snapshot.student.id,
    facts,
    fallback,
    systemPrompt:
      user.role === Role.PARENT
        ? "You are a school family assistant. Use very simple plain language for parents. Never invent data. Focus on the most important next actions."
        : undefined,
  });
}

export async function generateRiskAnalysis(user: SessionUser, studentId?: string) {
  const snapshot = await collectStudentSnapshot(user, studentId);
  const recentAverage = average(snapshot.grades.map((item) => item.value));
  const absenceCount = snapshot.attendance.filter((item) => item.status === AttendanceStatus.ABSENT).length;
  const lateCount = snapshot.attendance.filter((item) => item.status === AttendanceStatus.LATE).length;
  const overdueCount = snapshot.homework.filter((item) => {
    const submission = item.submissions[0];
    return new Date(item.dueDate) < new Date() && submission?.status !== "SUBMITTED";
  }).length;

  let severity: InsightSeverity = InsightSeverity.LOW;
  if (recentAverage < 70 || absenceCount >= 3 || overdueCount >= 3) severity = InsightSeverity.HIGH;
  else if (recentAverage < 80 || lateCount >= 3 || overdueCount >= 1) severity = InsightSeverity.MEDIUM;

  const facts = [
    `Average grade: ${recentAverage.toFixed(1)}`,
    `Absences: ${absenceCount}`,
    `Late marks: ${lateCount}`,
    `Overdue homework: ${overdueCount}`,
  ];

  const fallback = `Risk level is ${severity.toLowerCase()}. The biggest signals are average grade ${recentAverage.toFixed(1)}, ${absenceCount} absences, ${lateCount} late marks, and ${overdueCount} overdue assignments.`;

  return groundedGeneration({
    type: AIInsightType.RISK_ANALYSIS,
    title: user.role === Role.PARENT ? "Risk signs" : "Risk analysis",
    user,
    studentId: snapshot.student.id,
    facts,
    fallback,
    severity,
    systemPrompt:
      user.role === Role.PARENT
        ? "You are a school family assistant. Use very simple plain language for parents. Explain risk clearly without panic. Never invent data."
        : undefined,
  });
}

export async function generateStudyPlan(user: SessionUser, studentId?: string) {
  const snapshot = await collectStudentSnapshot(user, studentId);
  const activeHomework = snapshot.homework.slice(0, 5);
  const facts = [
    `Active homework: ${activeHomework.map((item) => `${item.title} (${item.subject.name})`).join(", ") || "None"}`,
    `Upcoming events: ${snapshot.events.map((item) => item.title).join(", ") || "None"}`,
    `Average grade: ${averageGrade(snapshot.grades.map((item) => item.value))}`,
  ];

  const fallback = activeHomework.length
    ? activeHomework
        .map(
          (item, index) =>
            `${index + 1}. ${item.subject.name}: ${item.title} before ${new Date(item.dueDate).toLocaleDateString()}`,
        )
        .join("\n")
    : "There is not enough homework data to build a detailed study plan.";

  return groundedGeneration({
    type: AIInsightType.STUDY_PLAN,
    title: user.role === Role.TEACHER ? "Student study plan" : "Study plan",
    user,
    studentId: snapshot.student.id,
    facts,
    fallback,
    systemPrompt:
      user.role === Role.PARENT
        ? "You are a school family assistant. Use very simple plain language for parents and break the plan into small clear steps. Never invent data."
        : undefined,
  });
}

export async function generateTeacherSummary(user: SessionUser) {
  if (user.role !== Role.TEACHER) throw new ApiError(403, "Teacher only");

  const snapshot = await getTeacherSnapshot(user);
  const facts = [
    `Classes covered: ${snapshot.classIds.length}`,
    `Students covered: ${snapshot.students.length}`,
    `Students with average grade below 70: ${snapshot.students.filter((student) => average(student.grades.map((grade) => grade.value)) < 70).length}`,
    `Students with 3+ absences: ${snapshot.students.filter((student) => student.attendances.filter((item) => item.status === AttendanceStatus.ABSENT).length >= 3).length}`,
    `Homework waiting for review: ${snapshot.homeworkReviewCount}`,
  ];

  const fallback = `You currently cover ${snapshot.classIds.length} classes and ${snapshot.students.length} students. Focus attention on learners with weak grade averages, repeated absences, and the ${snapshot.homeworkReviewCount} homework submission(s) waiting for review.`;

  return groundedGeneration({
    type: AIInsightType.TEACHER_SUMMARY,
    title: "Teacher summary",
    user,
    studentId: null,
    facts,
    fallback,
  });
}

export async function answerAssistantQuestion(user: SessionUser, question?: string, studentId?: string) {
  const cleanQuestion = question?.trim();
  if (!cleanQuestion) throw new ApiError(400, "Please enter a question");

  const shouldUseGeneralKnowledgeMode = !looksLikeSchoolDataQuestion(cleanQuestion);

  if (shouldUseGeneralKnowledgeMode) {
    return generalGeneration({
      title: "AI assistant",
      user,
      prompt: `Answer the user's question directly.\n\nQuestion: ${cleanQuestion}`,
      fallback:
        "The AI provider is unavailable right now. Please try again in a moment. If this keeps happening, check GEMINI_API_KEY in .env.",
    });
  }

  if (user.role === Role.TEACHER && !studentId) {
    const snapshot = await getTeacherSnapshot(user);
    const facts = [
      `Question: ${cleanQuestion}`,
      `Classes covered: ${snapshot.classIds.length}`,
      `Subjects covered: ${snapshot.subjectNames.join(", ") || "None"}`,
      `Students covered: ${snapshot.students.length}`,
      `Students with low grade averages: ${snapshot.students.filter((student) => average(student.grades.map((grade) => grade.value)) < 70).length}`,
      `Students with repeated absences: ${snapshot.students.filter((student) => student.attendances.filter((item) => item.status === AttendanceStatus.ABSENT).length >= 3).length}`,
      `Homework submissions waiting for review: ${snapshot.homeworkReviewCount}`,
      `Recent homework: ${snapshot.recentHomework.map((item) => `${item.schoolClass.name} - ${item.title}`).join(", ") || "None"}`,
    ];

    return groundedGeneration({
      type: AIInsightType.TEACHER_SUMMARY,
      title: "Teacher assistant",
      user,
      studentId: null,
      facts,
      fallback: buildTeacherQuestionFallback(snapshot, cleanQuestion),
      persist: false,
    });
  }

  if (user.role === Role.ADMIN && !studentId) {
    const [studentCount, teacherCount, homeworkCount, eventCount] = await Promise.all([
      db.studentProfile.count(),
      db.teacherProfile.count(),
      db.homework.count({ where: { dueDate: { gte: new Date() } } }),
      db.event.count({ where: { startAt: { gte: new Date() } } }),
    ]);

    const facts = [
      `Question: ${cleanQuestion}`,
      `Total students: ${studentCount}`,
      `Total teachers: ${teacherCount}`,
      `Open homework items: ${homeworkCount}`,
      `Upcoming events: ${eventCount}`,
    ];

    return groundedGeneration({
      type: AIInsightType.TEACHER_SUMMARY,
      title: "Admin assistant",
      user,
      studentId: null,
      facts,
      fallback: `School overview: ${studentCount} students, ${teacherCount} teachers, ${homeworkCount} open homework item(s), and ${eventCount} upcoming event(s). Ask about a specific student if you need a more detailed answer.`,
      persist: false,
    });
  }

  const snapshot = await collectStudentSnapshot(user, studentId);
  const recentAverage = averageGrade(snapshot.grades.map((item) => item.value));
  const overdueCount = snapshot.homework.filter((item) => {
    const submission = item.submissions[0];
    return new Date(item.dueDate) < new Date() && submission?.status !== "SUBMITTED";
  }).length;

  const facts = [
    `Question: ${cleanQuestion}`,
    `Student: ${snapshot.student.user.firstName} ${snapshot.student.user.lastName}`,
    `Class: ${snapshot.student.schoolClass?.name || "Not assigned"}`,
    `Recent grade average: ${recentAverage}`,
    `Overdue homework count: ${overdueCount}`,
    `Upcoming homework: ${snapshot.homework.slice(0, 4).map((item) => `${item.title} (${formatShortDate(item.dueDate)})`).join(", ") || "None"}`,
    `Attendance summary: ${snapshot.attendance.filter((item) => item.status === AttendanceStatus.ABSENT).length} absent, ${snapshot.attendance.filter((item) => item.status === AttendanceStatus.LATE).length} late`,
    `Upcoming events: ${snapshot.events.map((item) => `${item.title} (${formatShortDate(item.startAt)})`).join(", ") || "None"}`,
  ];

  return groundedGeneration({
    type: AIInsightType.WEEK_SUMMARY,
    title: user.role === Role.PARENT ? "Family assistant" : "AI assistant",
    user,
    studentId: snapshot.student.id,
    facts,
    fallback: buildStudentQuestionFallback(snapshot, cleanQuestion, user.role),
    persist: false,
    systemPrompt:
      user.role === Role.PARENT
        ? "You are a school family assistant. Use very simple plain language for older parents. Keep answers short, clear, practical, and based only on the verified facts. Never invent data."
        : "You are an education assistant. Never invent grades, attendance, homework, or events. Use only the provided facts.",
  });
}

export async function generateMessageDraft(user: SessionUser, message?: string) {
  const facts = [
    `Sender role: ${user.role}`,
    `Original message intent: ${message || "Not provided"}`,
  ];

  const fallback = message
    ? `Hello,\n\nI wanted to follow up regarding ${message.toLowerCase()}. Please let me know if you need any clarification.\n\nBest regards,`
    : "There is not enough context to draft a message.";

  return groundedGeneration({
    type: AIInsightType.MESSAGE_DRAFT,
    title: "Message draft",
    user,
    studentId: null,
    facts,
    fallback,
  });
}

export async function explainTopic(user: SessionUser, topic?: string) {
  const cleanTopic = topic?.trim();
  if (!cleanTopic) throw new ApiError(400, "Please enter a topic");

  return generalGeneration({
    title: "Topic explanation",
    user,
    prompt: [
      `Explain this clearly: ${cleanTopic}`,
      "Start with a simple definition.",
      "Then give a short example.",
      "If helpful, add where it is used in study or real life.",
    ].join("\n"),
    fallback:
      "The AI provider is unavailable right now, so I cannot generate a normal topic explanation. Please check GEMINI_API_KEY and try again.",
  });
}
