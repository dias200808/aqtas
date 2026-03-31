import {
  AppLanguage,
  BoardConnectionState,
  BoardParticipantStatus,
  BoardSessionStatus,
  BoardSyncMode,
  GradeType,
  LessonGenerationMode,
  NotificationType,
  Role,
} from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assertTeacherAssignment } from "@/lib/permissions";
import { generateWithProvider } from "@/lib/ai/provider";
import { triggerBoardEvent } from "@/lib/realtime/server";

const interactiveBlockTypes = new Set([
  "single-choice",
  "multiple-choice",
  "true-false",
  "short-answer",
  "poll",
  "matching",
  "connect",
  "sort-order",
]);

const generatedLessonSchema = z.object({
  title: z.string().min(3),
  objective: z.string().min(10),
  keyTerms: z.array(z.string()).default([]),
  summaryText: z.string().optional(),
  homeworkText: z.string().optional(),
  teacherNotes: z.string().optional(),
  blocks: z
    .array(
      z.object({
        blockType: z.string().min(2),
        title: z.string().min(2),
        instructions: z.string().optional(),
        contentJson: z.any(),
        settingsJson: z.any().optional(),
        answerKeyJson: z.any().optional(),
        hint: z.string().optional(),
        teacherNote: z.string().optional(),
        estimatedSeconds: z.number().int().min(0).optional(),
        isGradable: z.boolean().optional(),
        isPracticeOnly: z.boolean().optional(),
      }),
    )
    .min(3),
});

const boardRegenerationSchema = z.object({
  target: z.enum(["all", "interactive", "summary", "homework", "block"]).default("all"),
  blockId: z.string().optional(),
});

type LessonPayload = {
  classId?: string | null;
  subjectId?: string | null;
  topic: string;
  title: string;
  objective: string;
  durationMinutes: number;
  complexityLevel: string;
  language: AppLanguage;
  generationMode: LessonGenerationMode;
  lessonStyle?: string | null;
  activityCount: number;
  includeQuiz: boolean;
  includeWorksheet: boolean;
  includeHomework: boolean;
  includeSummary: boolean;
  includeSlides: boolean;
  teacherNotes?: string | null;
};

type LessonBlockPayload = {
  orderIndex: number;
  blockType: string;
  title: string;
  instructions?: string;
  contentJson: unknown;
  settingsJson?: unknown;
  answerKeyJson?: unknown;
  hint?: string;
  teacherNote?: string;
  estimatedSeconds?: number;
  isGradable?: boolean;
  isPracticeOnly?: boolean;
};

type BoardSessionPayload = {
  lessonPackageId: string;
  classId?: string | null;
  subjectId?: string | null;
  timetableEntryId?: string | null;
  scheduledFor?: string;
  syncMode: BoardSyncMode;
  allowLateJoin: boolean;
  allowImmediateJoin: boolean;
  allowFreeNavigation: boolean;
  showResponsesLive: boolean;
  gradedMode: boolean;
};

type BoardUpdatePayload = {
  status?: BoardSessionStatus;
  currentBlockId?: string | null;
  currentBlockIndex?: number;
  syncMode?: BoardSyncMode;
  allowLateJoin?: boolean;
  allowImmediateJoin?: boolean;
  allowFreeNavigation?: boolean;
  showResponsesLive?: boolean;
  gradedMode?: boolean;
  activityStateJson?: unknown;
  timerStateJson?: unknown;
  revealedHints?: string[];
};

type BoardJoinPayload = {
  connectionState?: "ONLINE" | "RECONNECTING" | "OFFLINE";
};

type BoardResponsePayload = {
  blockId: string;
  responseJson: unknown;
  isSubmitted: boolean;
};

type BoardRevealPayload = {
  blockId: string;
  reveal: boolean;
  hint?: string;
};

type BoardTimerPayload = {
  action: "start" | "stop" | "reset";
  seconds?: number;
};

type BoardPromotionPayload = {
  responseIds: string[];
  type: GradeType;
  weight: number;
  comment?: string;
};

type LessonWithBlocks = Awaited<ReturnType<typeof getLessonById>>;
type SessionWithRelations = Awaited<ReturnType<typeof getSessionById>>;

function ensureTeacherLike(user: SessionUser) {
  if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
    throw new ApiError(403, "Teacher or admin access required");
  }
}

async function getTeacherProfileId(user: SessionUser) {
  if (user.role === Role.ADMIN) {
    const firstTeacher = await db.teacherProfile.findFirst({ select: { id: true } });
    if (!firstTeacher) throw new ApiError(400, "No teacher profile is available");
    return firstTeacher.id;
  }

  const teacher = await db.teacherProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!teacher) throw new ApiError(404, "Teacher profile not found");
  return teacher.id;
}

async function assertLessonScope(user: SessionUser, params: { classId?: string | null; subjectId?: string | null }) {
  if (user.role === Role.ADMIN) return;
  if (!params.classId) throw new ApiError(400, "Class is required for teacher lessons");

  const allowed = await assertTeacherAssignment(user, {
    classId: params.classId,
    subjectId: params.subjectId ?? undefined,
  });

  if (!allowed) {
    throw new ApiError(403, "You are not assigned to this class and subject");
  }
}

async function getLessonById(lessonId: string) {
  const lesson = await db.lessonPackage.findUnique({
    where: { id: lessonId },
    include: {
      schoolClass: true,
      subject: true,
      teacher: { include: { user: true } },
      lessonBlocks: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!lesson) throw new ApiError(404, "Lesson not found");
  return lesson;
}

async function getSessionById(sessionId: string) {
  let session = await db.boardSession.findUnique({
    where: { id: sessionId },
    include: {
      schoolClass: true,
      subject: true,
      timetableEntry: {
        include: {
          subject: true,
          schoolClass: true,
        },
      },
      teacher: { include: { user: true } },
      lessonPackage: {
        include: {
          schoolClass: true,
          subject: true,
          lessonBlocks: { orderBy: { orderIndex: "asc" } },
        },
      },
      currentBlock: true,
      participants: {
        include: {
          student: {
            include: {
              user: true,
              schoolClass: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      responses: {
        include: {
          student: { include: { user: true } },
          block: true,
        },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!session) throw new ApiError(404, "Board session not found");
  if (!session.lessonPackage.lessonBlocks.length) {
    await ensureBlocksExist(session.lessonPackage as LessonWithBlocks);
    session = await db.boardSession.findUnique({
      where: { id: sessionId },
      include: {
        schoolClass: true,
        subject: true,
        timetableEntry: {
          include: {
            subject: true,
            schoolClass: true,
          },
        },
        teacher: { include: { user: true } },
        lessonPackage: {
          include: {
            schoolClass: true,
            subject: true,
            lessonBlocks: { orderBy: { orderIndex: "asc" } },
          },
        },
        currentBlock: true,
        participants: {
          include: {
            student: {
              include: {
                user: true,
                schoolClass: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        responses: {
          include: {
            student: { include: { user: true } },
            block: true,
          },
          orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
  }

  if (!session) throw new ApiError(404, "Board session not found");
  return session;
}

function normalizeLegacyBlockType(type?: string | null) {
  const value = (type ?? "").toLowerCase();
  if (value.includes("quiz")) return "single-choice";
  if (value.includes("poll")) return "poll";
  if (value.includes("homework")) return "homework";
  if (value.includes("summary")) return "summary";
  if (value.includes("discussion")) return "discussion";
  if (value.includes("activity")) return "discussion";
  if (value.includes("title")) return "intro";
  return "explanation";
}

function blocksFromLegacySlides(lesson: {
  slides: unknown;
  quiz: unknown;
  worksheet: unknown;
  homeworkText: string | null;
  summaryText: string | null;
  teacherNotes: string | null;
}) {
  const blocks: LessonBlockPayload[] = [];
  const slides = Array.isArray(lesson.slides) ? lesson.slides : [];
  for (const [index, slide] of slides.entries()) {
    const item = slide as Record<string, unknown>;
    blocks.push({
      orderIndex: index,
      blockType: normalizeLegacyBlockType(typeof item.type === "string" ? item.type : null),
      title: typeof item.title === "string" ? item.title : `Блок ${index + 1}`,
      instructions: typeof item.body === "string" ? item.body : undefined,
      contentJson: { body: typeof item.body === "string" ? item.body : "" },
      hint: typeof item.hint === "string" ? item.hint : undefined,
      teacherNote: lesson.teacherNotes ?? undefined,
      isGradable: false,
      isPracticeOnly: true,
    });
  }

  const quizItems = Array.isArray(lesson.quiz) ? lesson.quiz : [];
  for (const [index, item] of quizItems.entries()) {
    const question = item as Record<string, unknown>;
    blocks.push({
      orderIndex: blocks.length + index,
      blockType: typeof question.type === "string" ? question.type : "single-choice",
      title: typeof question.question === "string" ? question.question : `Вопрос ${index + 1}`,
      contentJson: {
        question: typeof question.question === "string" ? question.question : "",
        options: Array.isArray(question.options) ? question.options : [],
      },
      answerKeyJson: {
        answerIndex: question.answerIndex,
        answer: question.answer,
      },
      isGradable: true,
      isPracticeOnly: false,
    });
  }

  const worksheetItems = Array.isArray(lesson.worksheet) ? lesson.worksheet : [];
  for (const item of worksheetItems) {
    const task = item as Record<string, unknown>;
    blocks.push({
      orderIndex: blocks.length,
      blockType: typeof task.type === "string" ? task.type : "discussion",
      title: typeof task.task === "string" ? task.task : "Практика",
      contentJson: { task: typeof task.task === "string" ? task.task : "" },
      isGradable: false,
      isPracticeOnly: true,
    });
  }

  if (lesson.summaryText) {
    blocks.push({
      orderIndex: blocks.length,
      blockType: "summary",
      title: "Итог урока",
      contentJson: { body: lesson.summaryText },
      isGradable: false,
      isPracticeOnly: true,
    });
  }

  if (lesson.homeworkText) {
    blocks.push({
      orderIndex: blocks.length,
      blockType: "homework",
      title: "Домашнее задание",
      contentJson: { body: lesson.homeworkText },
      isGradable: false,
      isPracticeOnly: true,
    });
  }

  return blocks;
}

function toLegacySlides(blocks: Array<{ blockType: string; title: string; contentJson: unknown; hint?: string | null }>) {
  return blocks.map((block) => {
    const content = (block.contentJson ?? {}) as Record<string, unknown>;
    return {
      type: block.blockType.toUpperCase(),
      title: block.title,
      body:
        typeof content.body === "string"
          ? content.body
          : typeof content.question === "string"
            ? content.question
            : typeof content.task === "string"
              ? content.task
              : "",
      hint: block.hint ?? undefined,
    };
  });
}

function summarizeLessonArtifacts(blocks: Array<{ blockType: string; title: string; contentJson: unknown; answerKeyJson?: unknown }>) {
  const keyTerms: string[] = [];
  const quiz = blocks
    .filter((block) => interactiveBlockTypes.has(block.blockType))
    .map((block) => {
      const content = (block.contentJson ?? {}) as Record<string, unknown>;
      const answer = (block.answerKeyJson ?? {}) as Record<string, unknown>;
      return {
        type: block.blockType,
        question: typeof content.question === "string" ? content.question : block.title,
        options: Array.isArray(content.options) ? content.options : [],
        answerIndex: answer.answerIndex,
        answer: answer.answer,
      };
    });

  const worksheet = blocks
    .filter((block) => ["discussion", "short-answer", "matching", "connect", "sort-order"].includes(block.blockType))
    .map((block) => {
      const content = (block.contentJson ?? {}) as Record<string, unknown>;
      return {
        type: block.blockType,
        task:
          typeof content.task === "string"
            ? content.task
            : typeof content.question === "string"
              ? content.question
              : block.title,
      };
    });

  const summaryBlock = blocks.find((block) => block.blockType === "summary");
  const homeworkBlock = blocks.find((block) => block.blockType === "homework");

  for (const block of blocks) {
    const content = (block.contentJson ?? {}) as Record<string, unknown>;
    if (Array.isArray(content.keyTerms)) {
      for (const item of content.keyTerms) {
        if (typeof item === "string") keyTerms.push(item);
      }
    }
  }

  return {
    keyTerms: [...new Set(keyTerms)],
    slides: toLegacySlides(blocks),
    quiz,
    worksheet,
    homeworkText:
      homeworkBlock && typeof (homeworkBlock.contentJson as Record<string, unknown>)?.body === "string"
        ? ((homeworkBlock.contentJson as Record<string, unknown>).body as string)
        : null,
    summaryText:
      summaryBlock && typeof (summaryBlock.contentJson as Record<string, unknown>)?.body === "string"
        ? ((summaryBlock.contentJson as Record<string, unknown>).body as string)
        : null,
  };
}

function buildFallbackGeneratedLesson(input: LessonPayload, className: string, subjectName: string) {
  const russian = input.language === AppLanguage.RU;
  const introTitle = input.title || input.topic;
  const introText = russian
    ? `${subjectName}, ${className}. Сегодня разбираем тему "${input.topic}" и шаг за шагом идем к практике.`
    : `${subjectName}, ${className}. Today we explore "${input.topic}" through explanation, practice, and reflection.`;

  const blocks: z.infer<typeof generatedLessonSchema>["blocks"] = [
    {
      blockType: "intro",
      title: introTitle,
      instructions: russian ? "Коротко озвучьте цель урока." : "Open the lesson with the objective.",
      contentJson: {
        body: introText,
        keyTerms: russian ? ["тема", "цель урока", "ключевая идея"] : ["topic", "objective", "key idea"],
      },
      hint: russian ? "Попросите класс назвать, что уже знают по теме." : "Ask what the class already knows.",
      estimatedSeconds: 120,
      isGradable: false,
      isPracticeOnly: true,
    },
    {
      blockType: "explanation",
      title: russian ? "Пошаговое объяснение" : "Step-by-step explanation",
      instructions: russian ? "Объясните новый материал на одном понятном примере." : "Explain the new idea through one clear example.",
      contentJson: {
        body: russian
          ? `${input.objective} Покажите один базовый пример, затем один пример сложнее.`
          : `${input.objective} Show one basic example, then one slightly harder one.`,
      },
      hint: russian ? "Остановитесь после примера и попросите учеников объяснить ход мысли." : "Pause after the example and ask students to explain the reasoning.",
      estimatedSeconds: 360,
      isGradable: false,
      isPracticeOnly: true,
    },
    {
      blockType: "single-choice",
      title: russian ? "Проверка понимания" : "Quick check",
      instructions: russian ? "Запустите быстрый вопрос на проверку понимания." : "Launch a quick multiple choice check.",
      contentJson: {
        question: russian
          ? `Какой шаг самый важный при работе с темой "${input.topic}"?`
          : `What is the most important step when working with "${input.topic}"?`,
        options: russian
          ? ["Понять правило", "Угадать ответ", "Пропустить объяснение"]
          : ["Understand the rule", "Guess the answer", "Skip the explanation"],
      },
      answerKeyJson: { answerIndex: 0 },
      hint: russian ? "Обсудите, почему два других ответа слабее." : "Discuss why the other two answers are weaker.",
      estimatedSeconds: 150,
      isGradable: true,
      isPracticeOnly: false,
    },
    {
      blockType: "short-answer",
      title: russian ? "Короткий ответ" : "Short answer",
      instructions: russian ? "Попросите сформулировать правило своими словами." : "Ask students to explain the rule in their own words.",
      contentJson: {
        question: russian
          ? `Своими словами объясните, как применить тему "${input.topic}" в новой задаче.`
          : `In your own words, explain how to apply "${input.topic}" in a new task.`,
      },
      answerKeyJson: {
        acceptedAnswers: russian ? ["объяснение шага", "правило", "пример"] : ["rule", "step", "example"],
      },
      hint: russian ? "Разрешите ответить одним-двумя предложениями." : "One or two sentences are enough.",
      estimatedSeconds: 180,
      isGradable: true,
      isPracticeOnly: false,
    },
    {
      blockType: "discussion",
      title: russian ? "Обсуждение в парах" : "Pair discussion",
      instructions: russian ? "Дайте классу 2 минуты на обсуждение в парах." : "Give the class 2 minutes to discuss in pairs.",
      contentJson: {
        task: russian
          ? `Обсудите, где тема "${input.topic}" встречается в реальной жизни или в других задачах.`
          : `Discuss where "${input.topic}" appears in real life or in other problems.`,
      },
      hint: russian ? "Попросите 2-3 пары поделиться выводами." : "Invite 2-3 pairs to share their ideas.",
      estimatedSeconds: 180,
      isGradable: false,
      isPracticeOnly: true,
    },
  ];

  if (input.includeSummary) {
    blocks.push({
      blockType: "summary",
      title: russian ? "Итог урока" : "Lesson summary",
      instructions: russian ? "Закройте урок тремя ключевыми выводами." : "Close the lesson with three key takeaways.",
      contentJson: {
        body: russian
          ? `Сегодня мы разобрали тему "${input.topic}", отработали базовые шаги и проверили понимание короткими заданиями.`
          : `Today we explored "${input.topic}", practiced the core steps, and checked understanding with short activities.`,
      },
      hint: russian ? "Попросите класс назвать три ключевых вывода." : "Ask the class for three takeaways.",
      estimatedSeconds: 120,
      isGradable: false,
      isPracticeOnly: true,
    });
  }

  if (input.includeHomework) {
    blocks.push({
      blockType: "homework",
      title: russian ? "Домашнее задание" : "Homework",
      instructions: russian ? "Опубликуйте задание сразу после урока." : "Publish the task right after the lesson.",
      contentJson: {
        body: russian
          ? `Повторите тему "${input.topic}", решите 3 задания разного уровня и запишите один вопрос, который остался непонятным.`
          : `Review "${input.topic}", solve three tasks of different difficulty, and write down one remaining question.`,
      },
      hint: russian ? "Напомните формат и срок сдачи." : "Remind students about the submission format and deadline.",
      estimatedSeconds: 60,
      isGradable: false,
      isPracticeOnly: true,
    });
  }

  return {
    title: introTitle,
    objective: input.objective,
    keyTerms: russian ? ["ключевая идея", "правило", "пример"] : ["key idea", "rule", "example"],
    summaryText: input.includeSummary
      ? russian
        ? `Урок по теме "${input.topic}" завершён: базовая логика и практический шаг усвоены.`
        : `Lesson on "${input.topic}" completed: the class reviewed the core logic and a practical step.`
      : undefined,
    homeworkText: input.includeHomework
      ? russian
        ? `Решите 3 задания по теме "${input.topic}" и подготовьте один вопрос к следующему уроку.`
        : `Solve 3 tasks on "${input.topic}" and prepare one question for the next lesson.`
      : undefined,
    teacherNotes: input.teacherNotes ?? undefined,
    blocks,
  };
}

async function generateLessonContent(input: LessonPayload, className: string, subjectName: string) {
  const providerResponse = await generateWithProvider({
    system:
      input.language === AppLanguage.RU
        ? "Ты создаешь структуру школьного урока в формате JSON. Верни только JSON без пояснений."
        : "You create structured school lessons in JSON. Return JSON only with no commentary.",
    prompt:
      input.language === AppLanguage.RU
        ? [
            "Сгенерируй структурированный урок для интерактивной доски.",
            `Класс: ${className}`,
            `Предмет: ${subjectName}`,
            `Тема: ${input.topic}`,
            `Название: ${input.title}`,
            `Цель: ${input.objective}`,
            `Длительность: ${input.durationMinutes} минут`,
            `Сложность: ${input.complexityLevel}`,
            `Стиль: ${input.lessonStyle ?? "Интерактивный"}`,
            `Количество активностей: ${input.activityCount}`,
            `Нужен итог: ${input.includeSummary}`,
            `Нужно домашнее задание: ${input.includeHomework}`,
            "Верни JSON с полями: title, objective, keyTerms, summaryText, homeworkText, teacherNotes, blocks[].",
            "Для blocks[] используй поля: blockType, title, instructions, contentJson, settingsJson, answerKeyJson, hint, teacherNote, estimatedSeconds, isGradable, isPracticeOnly.",
          ].join("\n")
        : [
            "Generate a structured board lesson in JSON.",
            `Class: ${className}`,
            `Subject: ${subjectName}`,
            `Topic: ${input.topic}`,
            `Title: ${input.title}`,
            `Objective: ${input.objective}`,
            `Duration: ${input.durationMinutes} minutes`,
            `Complexity: ${input.complexityLevel}`,
            `Style: ${input.lessonStyle ?? "Interactive"}`,
            `Activity count: ${input.activityCount}`,
            `Include summary: ${input.includeSummary}`,
            `Include homework: ${input.includeHomework}`,
            "Return JSON with: title, objective, keyTerms, summaryText, homeworkText, teacherNotes, blocks[].",
            "Each block must include: blockType, title, instructions, contentJson, settingsJson, answerKeyJson, hint, teacherNote, estimatedSeconds, isGradable, isPracticeOnly.",
          ].join("\n"),
  });

  if (!providerResponse) {
    return buildFallbackGeneratedLesson(input, className, subjectName);
  }

  try {
    return generatedLessonSchema.parse(JSON.parse(providerResponse));
  } catch {
    return buildFallbackGeneratedLesson(input, className, subjectName);
  }
}

async function ensureBlocksExist(lesson: LessonWithBlocks) {
  if (lesson.lessonBlocks.length) return lesson.lessonBlocks;

  const fallbackBlocks = blocksFromLegacySlides(lesson);
  if (!fallbackBlocks.length) return [];

  await db.lessonBlock.createMany({
    data: fallbackBlocks.map((block, index) => ({
      lessonPackageId: lesson.id,
      orderIndex: index,
      blockType: block.blockType,
      title: block.title,
      instructions: block.instructions ?? null,
      contentJson: block.contentJson as never,
      settingsJson: (block.settingsJson ?? null) as never,
      answerKeyJson: (block.answerKeyJson ?? null) as never,
      hint: block.hint ?? null,
      teacherNote: block.teacherNote ?? null,
      estimatedSeconds: block.estimatedSeconds ?? null,
      isGradable: block.isGradable ?? false,
      isPracticeOnly: block.isPracticeOnly ?? true,
    })),
  });

  return db.lessonBlock.findMany({
    where: { lessonPackageId: lesson.id },
    orderBy: { orderIndex: "asc" },
  });
}

async function ensureLessonCollectionsHaveBlocks(lessons: LessonWithBlocks[]) {
  const hydrated: LessonWithBlocks[] = [];
  for (const lesson of lessons) {
    const lessonBlocks = lesson.lessonBlocks.length ? lesson.lessonBlocks : await ensureBlocksExist(lesson);
    hydrated.push({ ...lesson, lessonBlocks } as LessonWithBlocks);
  }
  return hydrated;
}

async function appendBoardEvent(sessionId: string, eventType: string, payloadJson?: unknown) {
  await db.boardSessionEvent.create({
    data: {
      sessionId,
      eventType,
      payloadJson: (payloadJson ?? null) as never,
    },
  });
}

async function createSessionNotifications(session: SessionWithRelations, mode: "scheduled" | "live") {
  if (!session.classId) return;

  const students = await db.studentProfile.findMany({
    where: { classId: session.classId },
    include: { user: true },
  });

  if (!students.length) return;

  const title =
    mode === "live"
      ? `Идёт урок: ${session.lessonPackage.title}`
      : `Запланирован урок: ${session.lessonPackage.title}`;
  const body =
    mode === "live"
      ? `${session.teacher.user.firstName} ${session.teacher.user.lastName} запустил(а) живой урок по предмету ${session.subject?.name ?? session.lessonPackage.subject?.name ?? "предмет"}.`
      : `${session.teacher.user.firstName} ${session.teacher.user.lastName} запланировал(а) живой урок по предмету ${session.subject?.name ?? session.lessonPackage.subject?.name ?? "предмет"}.`;

  await db.notification.createMany({
    data: students.map((student) => ({
      userId: student.userId,
      type: NotificationType.BOARD_SESSION,
      title,
      body,
      link: `/board/join/${session.id}`,
      payloadJson: {
        sessionId: session.id,
        classId: session.classId,
        lessonPackageId: session.lessonPackageId,
      } as never,
    })),
  });
}

function getCurrentBlockFromSession(session: SessionWithRelations) {
  const blocks = session.lessonPackage.lessonBlocks;
  if (!blocks.length) return null;
  if (session.currentBlockId) {
    const current = blocks.find((block) => block.id === session.currentBlockId);
    if (current) return current;
  }
  return blocks[session.currentBlockIndex] ?? blocks[0] ?? null;
}

function buildResponseSummary(session: SessionWithRelations, blockId?: string | null) {
  const targetBlockId = blockId ?? getCurrentBlockFromSession(session)?.id;
  const scopedResponses = session.responses.filter((response) => response.blockId === targetBlockId);
  const submittedStudentIds = new Set(scopedResponses.filter((item) => item.isSubmitted).map((item) => item.studentId));
  const activeParticipants = session.participants.filter((participant) => participant.status !== BoardParticipantStatus.REMOVED);

  return {
    totalParticipants: activeParticipants.length,
    submittedCount: submittedStudentIds.size,
    pendingCount: Math.max(activeParticipants.length - submittedStudentIds.size, 0),
    latestResponses: scopedResponses.slice(0, 12).map((response) => ({
      id: response.id,
      studentId: response.studentId,
      studentName: `${response.student.user.firstName} ${response.student.user.lastName}`,
      submittedAt: response.submittedAt,
      score: response.score,
      feedback: response.feedback,
      responseJson: response.responseJson,
      isSubmitted: response.isSubmitted,
    })),
  };
}

function scoreResponse(block: { blockType: string; answerKeyJson: unknown }, responseJson: unknown) {
  const answerKey = (block.answerKeyJson ?? {}) as Record<string, unknown>;
  const payload = (responseJson ?? {}) as Record<string, unknown>;

  if (block.blockType === "poll") {
    return { score: null, isAutoChecked: false, feedback: null };
  }

  if (block.blockType === "single-choice") {
    const value = payload.answerIndex ?? payload.choiceIndex ?? payload.answer;
    const expected = answerKey.answerIndex ?? answerKey.answer;
    return {
      score: value === expected ? 100 : 0,
      isAutoChecked: expected !== undefined,
      feedback: value === expected ? "Верно" : "Нужно ещё раз проверить выбор",
    };
  }

  if (block.blockType === "true-false") {
    const value = payload.answer;
    const expected = answerKey.answer;
    return {
      score: value === expected ? 100 : 0,
      isAutoChecked: expected !== undefined,
      feedback: value === expected ? "Верно" : "Ответ не совпал с эталоном",
    };
  }

  if (block.blockType === "multiple-choice") {
    const value = Array.isArray(payload.answers) ? payload.answers : [];
    const expected = Array.isArray(answerKey.answers) ? answerKey.answers : [];
    return {
      score: [...value].sort().join("|") === [...expected].sort().join("|") ? 100 : 0,
      isAutoChecked: expected.length > 0,
      feedback: [...value].sort().join("|") === [...expected].sort().join("|") ? "Все варианты выбраны верно" : "Проверьте выбор вариантов",
    };
  }

  if (block.blockType === "short-answer") {
    const rawAnswer =
      typeof payload.answer === "string"
        ? payload.answer
        : typeof payload.text === "string"
          ? payload.text
          : "";
    const normalized = rawAnswer.trim().toLowerCase();
    const accepted = Array.isArray(answerKey.acceptedAnswers)
      ? answerKey.acceptedAnswers
      : typeof answerKey.answer === "string"
        ? [answerKey.answer]
        : [];

    if (!accepted.length) {
      return { score: null, isAutoChecked: false, feedback: "Ожидает проверки учителя" };
    }

    const matched = accepted.some(
      (candidate) => typeof candidate === "string" && normalized.includes(candidate.toLowerCase()),
    );
    return {
      score: matched ? 100 : 0,
      isAutoChecked: true,
      feedback: matched ? "Смысловой ответ принят" : "Нужен более точный ответ",
    };
  }

  if (block.blockType === "matching" || block.blockType === "connect") {
    const submittedMatches = Array.isArray(payload.matches) ? payload.matches : [];
    const expectedMatches = Array.isArray(answerKey.matches) ? answerKey.matches : [];

    if (!expectedMatches.length) {
      return { score: null, isAutoChecked: false, feedback: "Ожидает проверки учителя" };
    }

    const normalizePairs = (value: unknown[]) =>
      value
        .map((item) => {
          const pair = item as Record<string, unknown>;
          return `${Number(pair.leftIndex)}:${Number(pair.rightIndex)}`;
        })
        .sort()
        .join("|");

    const matched = normalizePairs(submittedMatches) === normalizePairs(expectedMatches);
    return {
      score: matched ? 100 : 0,
      isAutoChecked: true,
      feedback: matched ? "Пары соединены верно" : "Проверьте соответствие между колонками",
    };
  }

  if (block.blockType === "sort-order") {
    const submittedOrder = Array.isArray(payload.order) ? payload.order.map((item) => Number(item)) : [];
    const expectedOrder = Array.isArray(answerKey.order) ? answerKey.order.map((item) => Number(item)) : [];

    if (!expectedOrder.length) {
      return { score: null, isAutoChecked: false, feedback: "Ожидает проверки учителя" };
    }

    const matched =
      submittedOrder.length === expectedOrder.length &&
      submittedOrder.every((value, index) => value === expectedOrder[index]);

    return {
      score: matched ? 100 : 0,
      isAutoChecked: true,
      feedback: matched ? "Последовательность собрана верно" : "Порядок шагов пока неверный",
    };
  }

  return { score: null, isAutoChecked: false, feedback: null };
}

export async function canAccessBoardSession(user: SessionUser, sessionId: string) {
  const session = await db.boardSession.findUnique({
    where: { id: sessionId },
    select: {
      classId: true,
      teacher: { select: { userId: true } },
      participants: { where: { student: { userId: user.id } }, select: { id: true } },
    },
  });

  if (!session) return false;
  if (user.role === Role.ADMIN) return true;
  if (user.role === Role.TEACHER) return session.teacher.userId === user.id;
  if (user.role === Role.STUDENT) return session.participants.length > 0;
  return false;
}

async function assertLessonAccess(user: SessionUser, lessonId: string) {
  const lesson = await getLessonById(lessonId);
  if (user.role === Role.ADMIN) return lesson;
  const teacherId = await getTeacherProfileId(user);
  if (lesson.teacherId !== teacherId) {
    throw new ApiError(403, "You do not have access to this lesson");
  }
  return lesson;
}

async function assertSessionAccess(user: SessionUser, sessionId: string) {
  const session = await getSessionById(sessionId);
  if (user.role === Role.ADMIN) return session;

  if (user.role === Role.TEACHER) {
    const teacherId = await getTeacherProfileId(user);
    if (session.teacherId !== teacherId) {
      throw new ApiError(403, "You do not have access to this board session");
    }
    return session;
  }

  if (user.role === Role.STUDENT) {
    const student = await db.studentProfile.findUnique({
      where: { userId: user.id },
      select: { classId: true },
    });
    if (!student || !session.classId || student.classId !== session.classId) {
      throw new ApiError(403, "You cannot access this board session");
    }
    return session;
  }

  throw new ApiError(403, "You cannot access this board session");
}

function mapLesson(lesson: LessonWithBlocks) {
  return {
    id: lesson.id,
    title: lesson.title,
    topic: lesson.topic,
    objective: lesson.objective,
    durationMinutes: lesson.durationMinutes,
    complexityLevel: lesson.complexityLevel,
    language: lesson.language,
    generationMode: lesson.generationMode,
    lessonStyle: lesson.lessonStyle,
    activityCount: lesson.activityCount,
    includeQuiz: lesson.includeQuiz,
    includeWorksheet: lesson.includeWorksheet,
    includeHomework: lesson.includeHomework,
    includeSummary: lesson.includeSummary,
    includeSlides: lesson.includeSlides,
    teacherNotes: lesson.teacherNotes,
    homeworkText: lesson.homeworkText,
    summaryText: lesson.summaryText,
    keyTerms: lesson.keyTerms,
    isPublished: lesson.isPublished,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
    schoolClass: lesson.schoolClass,
    subject: lesson.subject,
    teacher: lesson.teacher,
    blocks: lesson.lessonBlocks.map((block) => ({
      id: block.id,
      orderIndex: block.orderIndex,
      blockType: block.blockType,
      title: block.title,
      instructions: block.instructions,
      contentJson: block.contentJson,
      settingsJson: block.settingsJson,
      answerKeyJson: block.answerKeyJson,
      hint: block.hint,
      teacherNote: block.teacherNote,
      estimatedSeconds: block.estimatedSeconds,
      isGradable: block.isGradable,
      isPracticeOnly: block.isPracticeOnly,
    })),
    legacySlides: lesson.slides,
  };
}

function mapSession(session: SessionWithRelations, user?: SessionUser) {
  const currentBlock = getCurrentBlockFromSession(session);
  const activityState = (session.activityStateJson ?? {}) as Record<string, unknown>;
  const timerState = (session.timerStateJson ?? {}) as Record<string, unknown>;

  return {
    id: session.id,
    status: session.status,
    syncMode: session.syncMode,
    allowLateJoin: session.allowLateJoin,
    allowImmediateJoin: session.allowImmediateJoin,
    allowFreeNavigation: session.allowFreeNavigation,
    showResponsesLive: session.showResponsesLive,
    gradedMode: session.gradedMode,
    currentBlockId: currentBlock?.id ?? null,
    currentBlockIndex: currentBlock?.orderIndex ?? session.currentBlockIndex,
    activityState,
    timerState,
    revealedHints: Array.isArray(session.revealedHints) ? session.revealedHints : [],
    scheduledFor: session.scheduledFor,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    archivedAt: session.archivedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    schoolClass: session.schoolClass ?? session.lessonPackage.schoolClass,
    subject: session.subject ?? session.lessonPackage.subject,
    timetableEntry: session.timetableEntry,
    teacher: {
      id: session.teacher.id,
      userId: session.teacher.userId,
      fullName: `${session.teacher.user.firstName} ${session.teacher.user.lastName}`,
    },
    lesson: mapLesson({ ...session.lessonPackage, lessonBlocks: session.lessonPackage.lessonBlocks } as LessonWithBlocks),
    currentBlock: currentBlock
      ? {
          id: currentBlock.id,
          orderIndex: currentBlock.orderIndex,
          blockType: currentBlock.blockType,
          title: currentBlock.title,
          instructions: currentBlock.instructions,
          contentJson: currentBlock.contentJson,
          settingsJson: currentBlock.settingsJson,
          answerKeyJson:
            user?.role === Role.STUDENT && !Boolean(activityState.revealAnswer)
              ? null
              : currentBlock.answerKeyJson,
          hint: currentBlock.hint,
          teacherNote: currentBlock.teacherNote,
          estimatedSeconds: currentBlock.estimatedSeconds,
          isGradable: currentBlock.isGradable,
          isPracticeOnly: currentBlock.isPracticeOnly,
        }
      : null,
    participants: session.participants.map((participant) => ({
      id: participant.id,
      studentId: participant.studentId,
      fullName: `${participant.student.user.firstName} ${participant.student.user.lastName}`,
      className: participant.student.schoolClass?.name ?? "",
      status: participant.status,
      connectionState: participant.connectionState,
      joinedAt: participant.joinedAt,
      lastSeenAt: participant.lastSeenAt,
      leftAt: participant.leftAt,
      removedAt: participant.removedAt,
    })),
    responseSummary: buildResponseSummary(session, currentBlock?.id),
    responses:
      user?.role === Role.STUDENT
        ? session.responses
            .filter((response) => response.student.userId === user.id)
            .map((response) => ({
              id: response.id,
              blockId: response.blockId,
              responseJson: response.responseJson,
              isSubmitted: response.isSubmitted,
              score: response.score,
              feedback: response.feedback,
              submittedAt: response.submittedAt,
              isAutoChecked: response.isAutoChecked,
            }))
        : session.responses.map((response) => ({
            id: response.id,
            blockId: response.blockId,
            studentId: response.studentId,
            studentName: `${response.student.user.firstName} ${response.student.user.lastName}`,
            responseJson: response.responseJson,
            isSubmitted: response.isSubmitted,
            score: response.score,
            feedback: response.feedback,
            submittedAt: response.submittedAt,
            isAutoChecked: response.isAutoChecked,
          })),
    events: session.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      payloadJson: event.payloadJson,
      createdAt: event.createdAt,
    })),
  };
}

async function emitSessionSnapshot(sessionId: string, eventName: string, user?: SessionUser) {
  const snapshot = mapSession(await getSessionById(sessionId), user);
  await triggerBoardEvent(sessionId, eventName, snapshot);
  return snapshot;
}

export async function listLessons(user: SessionUser) {
  ensureTeacherLike(user);

  if (user.role === Role.ADMIN) {
    const lessons = await db.lessonPackage.findMany({
      include: {
        schoolClass: true,
        subject: true,
        teacher: { include: { user: true } },
        lessonBlocks: { orderBy: { orderIndex: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return (await ensureLessonCollectionsHaveBlocks(lessons as LessonWithBlocks[])).map(mapLesson);
  }

  const teacherId = await getTeacherProfileId(user);
  const lessons = await db.lessonPackage.findMany({
    where: { teacherId },
    include: {
      schoolClass: true,
      subject: true,
      teacher: { include: { user: true } },
      lessonBlocks: { orderBy: { orderIndex: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return (await ensureLessonCollectionsHaveBlocks(lessons as LessonWithBlocks[])).map(mapLesson);
}

export async function listLessonPackages(user: SessionUser) {
  return listLessons(user);
}

export async function getLessonDetail(user: SessionUser, lessonId: string) {
  const lesson = await assertLessonAccess(user, lessonId);
  const blocks = await ensureBlocksExist(lesson);
  return mapLesson({ ...lesson, lessonBlocks: blocks } as LessonWithBlocks);
}

export async function buildLessonStudioOptions(user: SessionUser) {
  ensureTeacherLike(user);
  if (user.role === Role.ADMIN) {
    const [classes, subjects] = await Promise.all([
      db.schoolClass.findMany({ orderBy: [{ gradeLevel: "asc" }, { name: "asc" }] }),
      db.subject.findMany({ orderBy: { name: "asc" } }),
    ]);
    return { classes, subjects };
  }

  const teacher = await db.teacherProfile.findUnique({
    where: { userId: user.id },
    include: {
      assignments: {
        include: {
          schoolClass: true,
          subject: true,
        },
      },
    },
  });

  if (!teacher) throw new ApiError(404, "Teacher profile not found");

  const classes = teacher.assignments
    .map((assignment) => assignment.schoolClass)
    .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => left.gradeLevel - right.gradeLevel || left.name.localeCompare(right.name));
  const subjects = teacher.assignments
    .map((assignment) => assignment.subject)
    .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => left.name.localeCompare(right.name));

  return { classes, subjects };
}

export async function createLesson(user: SessionUser, payload: LessonPayload) {
  ensureTeacherLike(user);
  await assertLessonScope(user, { classId: payload.classId, subjectId: payload.subjectId });

  const teacherId = await getTeacherProfileId(user);
  const schoolClass = payload.classId
    ? await db.schoolClass.findUnique({ where: { id: payload.classId } })
    : null;
  const subject = payload.subjectId
    ? await db.subject.findUnique({ where: { id: payload.subjectId } })
    : null;

  const generated = await generateLessonContent(
    payload,
    schoolClass?.name ?? "Общий класс",
    subject?.name ?? "Общий предмет",
  );

  const lesson = await db.$transaction(async (tx) => {
    const createdLesson = await tx.lessonPackage.create({
      data: {
        teacherId,
        classId: payload.classId ?? null,
        subjectId: payload.subjectId ?? null,
        title: generated.title,
        topic: payload.topic,
        objective: generated.objective,
        durationMinutes: payload.durationMinutes,
        complexityLevel: payload.complexityLevel,
        language: payload.language,
        generationMode: payload.generationMode,
        lessonStyle: payload.lessonStyle ?? null,
        activityCount: payload.activityCount,
        includeQuiz: payload.includeQuiz,
        includeWorksheet: payload.includeWorksheet,
        includeHomework: payload.includeHomework,
        includeSummary: payload.includeSummary,
        includeSlides: payload.includeSlides,
        keyTerms: generated.keyTerms as never,
        lessonPlan: generated.blocks.map((block, index) => ({
          title: block.title,
          blockType: block.blockType,
          orderIndex: index,
        })) as never,
        teacherNotes: generated.teacherNotes ?? payload.teacherNotes ?? null,
        homeworkText: generated.homeworkText ?? null,
        summaryText: generated.summaryText ?? null,
        isPublished: false,
      },
    });

    await tx.lessonBlock.createMany({
      data: generated.blocks.map((block, index) => ({
        lessonPackageId: createdLesson.id,
        orderIndex: index,
        blockType: block.blockType,
        title: block.title,
        instructions: block.instructions ?? null,
        contentJson: block.contentJson as never,
        settingsJson: (block.settingsJson ?? null) as never,
        answerKeyJson: (block.answerKeyJson ?? null) as never,
        hint: block.hint ?? null,
        teacherNote: block.teacherNote ?? null,
        estimatedSeconds: block.estimatedSeconds ?? null,
        isGradable: block.isGradable ?? interactiveBlockTypes.has(block.blockType),
        isPracticeOnly: block.isPracticeOnly ?? !interactiveBlockTypes.has(block.blockType),
      })),
    });

    const lessonBlocks = await tx.lessonBlock.findMany({
      where: { lessonPackageId: createdLesson.id },
      orderBy: { orderIndex: "asc" },
    });
    const artifacts = summarizeLessonArtifacts(lessonBlocks);

    return tx.lessonPackage.update({
      where: { id: createdLesson.id },
      data: {
        slides: artifacts.slides as never,
        quiz: artifacts.quiz as never,
        worksheet: artifacts.worksheet as never,
        homeworkText: artifacts.homeworkText,
        summaryText: artifacts.summaryText,
        keyTerms: artifacts.keyTerms as never,
      },
      include: {
        schoolClass: true,
        subject: true,
        teacher: { include: { user: true } },
        lessonBlocks: { orderBy: { orderIndex: "asc" } },
      },
    });
  });

  return mapLesson(lesson as LessonWithBlocks);
}

export async function createLessonPackage(user: SessionUser, payload: LessonPayload) {
  return createLesson(user, payload);
}

export async function updateLesson(user: SessionUser, lessonId: string, payload: Partial<LessonPayload> & { isPublished?: boolean }) {
  ensureTeacherLike(user);
  const lesson = await assertLessonAccess(user, lessonId);
  await assertLessonScope(user, {
    classId: payload.classId ?? lesson.classId,
    subjectId: payload.subjectId ?? lesson.subjectId,
  });

  const updated = await db.lessonPackage.update({
    where: { id: lessonId },
    data: {
      classId: payload.classId === undefined ? lesson.classId : payload.classId,
      subjectId: payload.subjectId === undefined ? lesson.subjectId : payload.subjectId,
      title: payload.title ?? lesson.title,
      topic: payload.topic ?? lesson.topic,
      objective: payload.objective ?? lesson.objective,
      durationMinutes: payload.durationMinutes ?? lesson.durationMinutes,
      complexityLevel: payload.complexityLevel ?? lesson.complexityLevel,
      language: payload.language ?? lesson.language,
      generationMode: payload.generationMode ?? lesson.generationMode,
      lessonStyle: payload.lessonStyle === undefined ? lesson.lessonStyle : payload.lessonStyle,
      activityCount: payload.activityCount ?? lesson.activityCount,
      includeQuiz: payload.includeQuiz ?? lesson.includeQuiz,
      includeWorksheet: payload.includeWorksheet ?? lesson.includeWorksheet,
      includeHomework: payload.includeHomework ?? lesson.includeHomework,
      includeSummary: payload.includeSummary ?? lesson.includeSummary,
      includeSlides: payload.includeSlides ?? lesson.includeSlides,
      teacherNotes: payload.teacherNotes === undefined ? lesson.teacherNotes : payload.teacherNotes,
      isPublished: payload.isPublished ?? lesson.isPublished,
    },
    include: {
      schoolClass: true,
      subject: true,
      teacher: { include: { user: true } },
      lessonBlocks: { orderBy: { orderIndex: "asc" } },
    },
  });

  return mapLesson(updated as LessonWithBlocks);
}

export async function updateLessonPackage(user: SessionUser, lessonId: string, payload: Partial<LessonPayload> & { isPublished?: boolean }) {
  return updateLesson(user, lessonId, payload);
}

async function refreshLessonArtifacts(lessonId: string) {
  const blocks = await db.lessonBlock.findMany({
    where: { lessonPackageId: lessonId },
    orderBy: { orderIndex: "asc" },
  });
  const artifacts = summarizeLessonArtifacts(blocks);
  await db.lessonPackage.update({
    where: { id: lessonId },
    data: {
      slides: artifacts.slides as never,
      quiz: artifacts.quiz as never,
      worksheet: artifacts.worksheet as never,
      homeworkText: artifacts.homeworkText,
      summaryText: artifacts.summaryText,
      keyTerms: artifacts.keyTerms as never,
    },
  });
}

export async function addLessonBlock(user: SessionUser, lessonId: string, payload: LessonBlockPayload) {
  ensureTeacherLike(user);
  const lesson = await assertLessonAccess(user, lessonId);
  const blocks = await ensureBlocksExist(lesson);
  const nextIndex = Math.min(Math.max(payload.orderIndex, 0), blocks.length);

  const created = await db.$transaction(async (tx) => {
    const shiftedBlocks = await tx.lessonBlock.findMany({
      where: { lessonPackageId: lessonId, orderIndex: { gte: nextIndex } },
      orderBy: { orderIndex: "desc" },
    });

    for (const block of shiftedBlocks) {
      await tx.lessonBlock.update({
        where: { id: block.id },
        data: { orderIndex: block.orderIndex + 1 },
      });
    }

    return tx.lessonBlock.create({
      data: {
        lessonPackageId: lessonId,
        orderIndex: nextIndex,
        blockType: payload.blockType,
        title: payload.title,
        instructions: payload.instructions ?? null,
        contentJson: payload.contentJson as never,
        settingsJson: (payload.settingsJson ?? null) as never,
        answerKeyJson: (payload.answerKeyJson ?? null) as never,
        hint: payload.hint ?? null,
        teacherNote: payload.teacherNote ?? null,
        estimatedSeconds: payload.estimatedSeconds ?? null,
        isGradable: payload.isGradable ?? interactiveBlockTypes.has(payload.blockType),
        isPracticeOnly: payload.isPracticeOnly ?? !interactiveBlockTypes.has(payload.blockType),
      },
    });
  });

  await refreshLessonArtifacts(lessonId);
  return created;
}

export async function updateLessonBlock(user: SessionUser, blockId: string, payload: Partial<LessonBlockPayload>) {
  ensureTeacherLike(user);
  const block = await db.lessonBlock.findUnique({
    where: { id: blockId },
    include: { lessonPackage: true },
  });

  if (!block) throw new ApiError(404, "Lesson block not found");
  await assertLessonAccess(user, block.lessonPackageId);

  const updated = await db.lessonBlock.update({
    where: { id: blockId },
    data: {
      orderIndex: payload.orderIndex ?? block.orderIndex,
      blockType: payload.blockType ?? block.blockType,
      title: payload.title ?? block.title,
      instructions: payload.instructions === undefined ? block.instructions : payload.instructions,
      contentJson:
        payload.contentJson === undefined
          ? block.contentJson === null
            ? undefined
            : (block.contentJson as never)
          : (payload.contentJson as never),
      settingsJson:
        payload.settingsJson === undefined
          ? block.settingsJson === null
            ? undefined
            : (block.settingsJson as never)
          : ((payload.settingsJson ?? null) as never),
      answerKeyJson:
        payload.answerKeyJson === undefined
          ? block.answerKeyJson === null
            ? undefined
            : (block.answerKeyJson as never)
          : ((payload.answerKeyJson ?? null) as never),
      hint: payload.hint === undefined ? block.hint : payload.hint,
      teacherNote: payload.teacherNote === undefined ? block.teacherNote : payload.teacherNote,
      estimatedSeconds: payload.estimatedSeconds === undefined ? block.estimatedSeconds : payload.estimatedSeconds,
      isGradable: payload.isGradable ?? block.isGradable,
      isPracticeOnly: payload.isPracticeOnly ?? block.isPracticeOnly,
    },
  });

  await refreshLessonArtifacts(block.lessonPackageId);
  return updated;
}

export async function deleteLessonBlock(user: SessionUser, blockId: string) {
  ensureTeacherLike(user);
  const block = await db.lessonBlock.findUnique({ where: { id: blockId } });
  if (!block) throw new ApiError(404, "Lesson block not found");
  await assertLessonAccess(user, block.lessonPackageId);

  await db.$transaction(async (tx) => {
    await tx.lessonBlock.delete({ where: { id: blockId } });
    const shiftedBlocks = await tx.lessonBlock.findMany({
      where: { lessonPackageId: block.lessonPackageId, orderIndex: { gt: block.orderIndex } },
      orderBy: { orderIndex: "asc" },
    });

    for (const item of shiftedBlocks) {
      await tx.lessonBlock.update({
        where: { id: item.id },
        data: { orderIndex: item.orderIndex - 1 },
      });
    }
  });

  await refreshLessonArtifacts(block.lessonPackageId);
  return { success: true };
}

export async function regenerateLesson(user: SessionUser, lessonId: string, payload: z.input<typeof boardRegenerationSchema>) {
  ensureTeacherLike(user);
  const lesson = await assertLessonAccess(user, lessonId);
  const parsed = boardRegenerationSchema.parse(payload);
  const regenerated = buildFallbackGeneratedLesson(
    {
      classId: lesson.classId,
      subjectId: lesson.subjectId,
      topic: lesson.topic,
      title: lesson.title,
      objective: lesson.objective,
      durationMinutes: lesson.durationMinutes,
      complexityLevel: lesson.complexityLevel,
      language: lesson.language,
      generationMode: lesson.generationMode,
      lessonStyle: lesson.lessonStyle,
      activityCount: lesson.activityCount,
      includeQuiz: lesson.includeQuiz,
      includeWorksheet: lesson.includeWorksheet,
      includeHomework: lesson.includeHomework,
      includeSummary: lesson.includeSummary,
      includeSlides: lesson.includeSlides,
      teacherNotes: lesson.teacherNotes,
    },
    lesson.schoolClass?.name ?? "Общий класс",
    lesson.subject?.name ?? "Общий предмет",
  );

  if (parsed.target === "all") {
    await db.$transaction(async (tx) => {
      await tx.lessonBlock.deleteMany({ where: { lessonPackageId: lessonId } });
      await tx.lessonBlock.createMany({
        data: regenerated.blocks.map((block, index) => ({
          lessonPackageId: lessonId,
          orderIndex: index,
          blockType: block.blockType,
          title: block.title,
          instructions: block.instructions ?? null,
          contentJson: block.contentJson as never,
          settingsJson: (block.settingsJson ?? null) as never,
          answerKeyJson: (block.answerKeyJson ?? null) as never,
          hint: block.hint ?? null,
          teacherNote: block.teacherNote ?? null,
          estimatedSeconds: block.estimatedSeconds ?? null,
          isGradable: block.isGradable ?? interactiveBlockTypes.has(block.blockType),
          isPracticeOnly: block.isPracticeOnly ?? !interactiveBlockTypes.has(block.blockType),
        })),
      });
    });

    await refreshLessonArtifacts(lessonId);
    return getLessonDetail(user, lessonId);
  }

  const existingBlocks = await db.lessonBlock.findMany({
    where: { lessonPackageId: lessonId },
    orderBy: { orderIndex: "asc" },
  });

  if (parsed.target === "block" && parsed.blockId) {
    const target = existingBlocks.find((block) => block.id === parsed.blockId);
    if (!target) throw new ApiError(404, "Block not found");
    const source = regenerated.blocks.find((block) => block.blockType === target.blockType) ?? regenerated.blocks[0];
    await updateLessonBlock(user, target.id, source);
    return getLessonDetail(user, lessonId);
  }

  const sourceBlocks =
    parsed.target === "interactive"
      ? regenerated.blocks.filter((block) => interactiveBlockTypes.has(block.blockType))
      : parsed.target === "summary"
        ? regenerated.blocks.filter((block) => block.blockType === "summary")
        : regenerated.blocks.filter((block) => block.blockType === "homework");

  for (const source of sourceBlocks) {
    const existing = existingBlocks.find((block) => block.blockType === source.blockType);
    if (existing) {
      await updateLessonBlock(user, existing.id, source);
    } else {
      await addLessonBlock(user, lessonId, {
        orderIndex: existingBlocks.length,
        ...source,
      });
    }
  }

  await refreshLessonArtifacts(lessonId);
  return getLessonDetail(user, lessonId);
}

async function ensureSessionInvites(sessionId: string, classId: string) {
  const students = await db.studentProfile.findMany({
    where: { classId },
    select: { id: true },
  });

  if (!students.length) return;

  await db.boardSessionParticipant.createMany({
    data: students.map((student) => ({
      sessionId,
      studentId: student.id,
      status: BoardParticipantStatus.INVITED,
      connectionState: BoardConnectionState.OFFLINE,
    })),
    skipDuplicates: true,
  });
}

export async function listBoardSessions(user: SessionUser) {
  if (user.role === Role.PARENT) return [];

  if (user.role === Role.STUDENT) {
    const student = await db.studentProfile.findUnique({
      where: { userId: user.id },
      select: { classId: true },
    });
    if (!student?.classId) return [];

    const sessions = await db.boardSession.findMany({
      where: {
        classId: student.classId,
        status: { in: [BoardSessionStatus.SCHEDULED, BoardSessionStatus.LIVE, BoardSessionStatus.PAUSED] },
      },
      include: {
        schoolClass: true,
        subject: true,
        teacher: { include: { user: true } },
        lessonPackage: {
          include: {
            schoolClass: true,
            subject: true,
            lessonBlocks: { orderBy: { orderIndex: "asc" } },
          },
        },
        currentBlock: true,
        participants: { include: { student: { include: { user: true, schoolClass: true } } } },
        responses: { include: { student: { include: { user: true } }, block: true } },
        events: { orderBy: { createdAt: "desc" }, take: 10 },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return sessions.map((session) => mapSession(session as SessionWithRelations, user));
  }

  const where =
    user.role === Role.ADMIN
      ? {}
      : {
          teacherId: await getTeacherProfileId(user),
        };

  const sessions = await db.boardSession.findMany({
    where,
    include: {
      schoolClass: true,
      subject: true,
      teacher: { include: { user: true } },
      lessonPackage: {
        include: {
          schoolClass: true,
          subject: true,
          lessonBlocks: { orderBy: { orderIndex: "asc" } },
        },
      },
      currentBlock: true,
      participants: { include: { student: { include: { user: true, schoolClass: true } } } },
      responses: { include: { student: { include: { user: true } }, block: true } },
      events: { orderBy: { createdAt: "desc" }, take: 10 },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return sessions.map((session) => mapSession(session as SessionWithRelations, user));
}

export async function getBoardSessionSnapshot(user: SessionUser, sessionId: string) {
  return mapSession(await assertSessionAccess(user, sessionId), user);
}

export async function createBoardSession(user: SessionUser, payload: BoardSessionPayload) {
  ensureTeacherLike(user);
  const lesson = await assertLessonAccess(user, payload.lessonPackageId);
  const blocks = await ensureBlocksExist(lesson);
  const classId = payload.classId ?? lesson.classId;
  const subjectId = payload.subjectId ?? lesson.subjectId;

  await assertLessonScope(user, { classId, subjectId });
  const teacherId = user.role === Role.ADMIN ? lesson.teacherId : await getTeacherProfileId(user);

  if (!classId) throw new ApiError(400, "Class is required to launch a board session");

  const activeExisting = await db.boardSession.findFirst({
    where: {
      OR: [{ teacherId }, { classId }],
      status: { in: [BoardSessionStatus.LIVE, BoardSessionStatus.PAUSED] },
    },
    select: { id: true },
  });

  if (activeExisting) {
    throw new ApiError(409, "There is already an active live board session for this class or teacher");
  }

  const session = await db.boardSession.create({
    data: {
      lessonPackageId: lesson.id,
      teacherId,
      classId,
      subjectId,
      timetableEntryId: payload.timetableEntryId ?? null,
      status: payload.scheduledFor ? BoardSessionStatus.SCHEDULED : BoardSessionStatus.DRAFT,
      syncMode: payload.syncMode,
      allowLateJoin: payload.allowLateJoin,
      allowImmediateJoin: payload.allowImmediateJoin,
      allowFreeNavigation: payload.allowFreeNavigation,
      showResponsesLive: payload.showResponsesLive,
      gradedMode: payload.gradedMode,
      currentBlockId: blocks[0]?.id ?? null,
      currentBlockIndex: 0,
      activityStateJson: { isOpen: false, revealAnswer: false } as never,
      timerStateJson: { status: "idle", secondsRemaining: blocks[0]?.estimatedSeconds ?? 0 } as never,
      revealedHints: [] as never,
      scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : null,
    },
    include: {
      schoolClass: true,
      subject: true,
      teacher: { include: { user: true } },
      lessonPackage: {
        include: {
          schoolClass: true,
          subject: true,
          lessonBlocks: { orderBy: { orderIndex: "asc" } },
        },
      },
      currentBlock: true,
      participants: { include: { student: { include: { user: true, schoolClass: true } } } },
      responses: { include: { student: { include: { user: true } }, block: true } },
      events: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  await ensureSessionInvites(session.id, classId);
  const hydrated = await getSessionById(session.id);
  await appendBoardEvent(session.id, "session.created", { status: hydrated.status, classId, subjectId });
  await createSessionNotifications(hydrated, hydrated.status === BoardSessionStatus.SCHEDULED ? "scheduled" : "live");
  return mapSession(await getSessionById(session.id), user);
}

export async function updateBoardSession(user: SessionUser, sessionId: string, payload: BoardUpdatePayload & { currentSlideIndex?: number }) {
  ensureTeacherLike(user);
  const session = await assertSessionAccess(user, sessionId);
  const blocks = session.lessonPackage.lessonBlocks;
  const requestedIndex = payload.currentBlockIndex ?? payload.currentSlideIndex ?? session.currentBlockIndex;
  const boundedIndex = Math.max(0, Math.min(requestedIndex, Math.max(blocks.length - 1, 0)));
  const currentBlock = payload.currentBlockId
    ? blocks.find((block) => block.id === payload.currentBlockId) ?? blocks[boundedIndex] ?? null
    : blocks[boundedIndex] ?? null;

  await db.boardSession.update({
    where: { id: sessionId },
    data: {
      status: payload.status ?? undefined,
      syncMode: payload.syncMode ?? undefined,
      allowLateJoin: payload.allowLateJoin ?? undefined,
      allowImmediateJoin: payload.allowImmediateJoin ?? undefined,
      allowFreeNavigation: payload.allowFreeNavigation ?? undefined,
      showResponsesLive: payload.showResponsesLive ?? undefined,
      gradedMode: payload.gradedMode ?? undefined,
      currentBlockId: currentBlock?.id ?? session.currentBlockId,
      currentBlockIndex: currentBlock?.orderIndex ?? boundedIndex,
      activityStateJson: payload.activityStateJson === undefined ? undefined : ((payload.activityStateJson ?? null) as never),
      timerStateJson: payload.timerStateJson === undefined ? undefined : ((payload.timerStateJson ?? null) as never),
      revealedHints: payload.revealedHints === undefined ? undefined : (payload.revealedHints as never),
    },
  });

  await appendBoardEvent(sessionId, "session.updated", payload);
  return emitSessionSnapshot(sessionId, "session.state", user);
}

export async function startBoardSession(user: SessionUser, sessionId: string) {
  ensureTeacherLike(user);
  await assertSessionAccess(user, sessionId);
  await db.boardSession.update({
    where: { id: sessionId },
    data: {
      status: BoardSessionStatus.LIVE,
      startedAt: new Date(),
      activityStateJson: { isOpen: false, revealAnswer: false } as never,
    },
  });

  const hydrated = await getSessionById(sessionId);
  await appendBoardEvent(sessionId, "session.started", { startedAt: hydrated.startedAt });
  await createSessionNotifications(hydrated, "live");
  return emitSessionSnapshot(sessionId, "session.started", user);
}

export async function pauseBoardSession(user: SessionUser, sessionId: string) {
  ensureTeacherLike(user);
  await assertSessionAccess(user, sessionId);
  await db.boardSession.update({ where: { id: sessionId }, data: { status: BoardSessionStatus.PAUSED } });
  await appendBoardEvent(sessionId, "session.paused");
  return emitSessionSnapshot(sessionId, "session.paused", user);
}

export async function resumeBoardSession(user: SessionUser, sessionId: string) {
  ensureTeacherLike(user);
  await assertSessionAccess(user, sessionId);
  await db.boardSession.update({ where: { id: sessionId }, data: { status: BoardSessionStatus.LIVE } });
  await appendBoardEvent(sessionId, "session.resumed");
  return emitSessionSnapshot(sessionId, "session.resumed", user);
}

export async function endBoardSession(user: SessionUser, sessionId: string) {
  ensureTeacherLike(user);
  await assertSessionAccess(user, sessionId);
  await db.boardSession.update({
    where: { id: sessionId },
    data: {
      status: BoardSessionStatus.ENDED,
      endedAt: new Date(),
      activityStateJson: { isOpen: false, revealAnswer: true } as never,
    },
  });
  await appendBoardEvent(sessionId, "session.ended");
  return emitSessionSnapshot(sessionId, "session.ended", user);
}

export async function joinBoardSession(user: SessionUser, sessionId: string, payload?: BoardJoinPayload) {
  if (user.role !== Role.STUDENT) throw new ApiError(403, "Only students can join board sessions");

  const student = await db.studentProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, classId: true },
  });
  if (!student) throw new ApiError(404, "Student profile not found");

  const session = await getSessionById(sessionId);
  if (!session.classId || session.classId !== student.classId) {
    throw new ApiError(403, "You are not enrolled in this class");
  }
  const joinableStatuses: BoardSessionStatus[] = [
    BoardSessionStatus.LIVE,
    BoardSessionStatus.PAUSED,
    BoardSessionStatus.SCHEDULED,
  ];
  if (!joinableStatuses.includes(session.status)) {
    throw new ApiError(409, "This board session is not joinable");
  }
  if (session.status === BoardSessionStatus.SCHEDULED && !session.allowImmediateJoin) {
    throw new ApiError(409, "Students cannot join this scheduled session yet");
  }

  const existingParticipant = session.participants.find((item) => item.studentId === student.id);
  if (existingParticipant?.status === BoardParticipantStatus.REMOVED) {
    throw new ApiError(403, "You were removed from this board session");
  }

  await db.boardSessionParticipant.upsert({
    where: {
      sessionId_studentId: {
        sessionId,
        studentId: student.id,
      },
    },
    update: {
      status: existingParticipant ? BoardParticipantStatus.RECONNECTED : BoardParticipantStatus.JOINED,
      connectionState: payload?.connectionState
        ? (BoardConnectionState[payload.connectionState] ?? BoardConnectionState.ONLINE)
        : BoardConnectionState.ONLINE,
      joinedAt: existingParticipant ? existingParticipant.joinedAt : new Date(),
      leftAt: null,
      lastSeenAt: new Date(),
      removedAt: null,
    },
    create: {
      sessionId,
      studentId: student.id,
      status: BoardParticipantStatus.JOINED,
      connectionState: payload?.connectionState
        ? (BoardConnectionState[payload.connectionState] ?? BoardConnectionState.ONLINE)
        : BoardConnectionState.ONLINE,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  await appendBoardEvent(sessionId, "participant.joined", { studentId: student.id });
  return emitSessionSnapshot(sessionId, "participant.updated", user);
}

export async function leaveBoardSession(user: SessionUser, sessionId: string) {
  if (user.role !== Role.STUDENT) throw new ApiError(403, "Only students can leave board sessions");

  const student = await db.studentProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) throw new ApiError(404, "Student profile not found");

  await db.boardSessionParticipant.updateMany({
    where: { sessionId, studentId: student.id },
    data: {
      status: BoardParticipantStatus.DISCONNECTED,
      connectionState: BoardConnectionState.OFFLINE,
      leftAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  await appendBoardEvent(sessionId, "participant.left", { studentId: student.id });
  return emitSessionSnapshot(sessionId, "participant.updated", user);
}

export async function removeBoardParticipant(user: SessionUser, sessionId: string, studentId: string) {
  ensureTeacherLike(user);
  await assertSessionAccess(user, sessionId);

  await db.boardSessionParticipant.updateMany({
    where: { sessionId, studentId },
    data: {
      status: BoardParticipantStatus.REMOVED,
      connectionState: BoardConnectionState.OFFLINE,
      removedAt: new Date(),
      leftAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  await appendBoardEvent(sessionId, "participant.removed", { studentId });
  return emitSessionSnapshot(sessionId, "participant.updated", user);
}

export async function submitBoardResponse(user: SessionUser, sessionId: string, payload: BoardResponsePayload) {
  if (user.role !== Role.STUDENT) throw new ApiError(403, "Only students can submit board responses");

  const session = await assertSessionAccess(user, sessionId);
  const student = await db.studentProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) throw new ApiError(404, "Student profile not found");

  const block = session.lessonPackage.lessonBlocks.find((item) => item.id === payload.blockId);
  if (!block) throw new ApiError(404, "Board block not found");

  const activityState = (session.activityStateJson ?? {}) as Record<string, unknown>;
  if (activityState.currentBlockId && activityState.currentBlockId !== block.id) {
    throw new ApiError(409, "This activity is no longer active");
  }

  const lastAttempt = await db.boardSessionResponse.findFirst({
    where: { sessionId, blockId: block.id, studentId: student.id },
    orderBy: { attempt: "desc" },
    select: { attempt: true },
  });

  const scored = scoreResponse(block, payload.responseJson);
  await db.boardSessionResponse.create({
    data: {
      sessionId,
      blockId: block.id,
      studentId: student.id,
      attempt: (lastAttempt?.attempt ?? 0) + 1,
      responseJson: payload.responseJson as never,
      isSubmitted: payload.isSubmitted,
      submittedAt: payload.isSubmitted ? new Date() : null,
      score: scored.score,
      feedback: scored.feedback,
      isAutoChecked: scored.isAutoChecked,
    },
  });

  await db.boardSessionParticipant.updateMany({
    where: { sessionId, studentId: student.id },
    data: {
      status: BoardParticipantStatus.JOINED,
      connectionState: BoardConnectionState.ONLINE,
      lastSeenAt: new Date(),
    },
  });

  await appendBoardEvent(sessionId, "response.submitted", { studentId: student.id, blockId: block.id });
  return emitSessionSnapshot(sessionId, "response.submitted", user);
}

export async function revealBoardBlock(user: SessionUser, sessionId: string, payload: BoardRevealPayload) {
  ensureTeacherLike(user);
  const session = await assertSessionAccess(user, sessionId);
  const revealedHints = Array.isArray(session.revealedHints) ? [...session.revealedHints] : [];
  if (payload.hint && !revealedHints.includes(payload.hint)) {
    revealedHints.push(payload.hint);
  }

  await db.boardSession.update({
    where: { id: sessionId },
    data: {
      activityStateJson: {
        ...((session.activityStateJson ?? {}) as Record<string, unknown>),
        currentBlockId: payload.blockId,
        revealAnswer: payload.reveal,
        isOpen: true,
        hint: payload.hint ?? null,
      } as never,
      revealedHints: revealedHints as never,
    },
  });

  await appendBoardEvent(sessionId, "activity.revealed", payload);
  return emitSessionSnapshot(sessionId, "activity.revealed", user);
}

export async function updateBoardTimer(user: SessionUser, sessionId: string, payload: BoardTimerPayload) {
  ensureTeacherLike(user);
  const session = await assertSessionAccess(user, sessionId);
  const currentTimer = (session.timerStateJson ?? {}) as Record<string, unknown>;
  const secondsRemaining =
    payload.action === "reset"
      ? payload.seconds ?? getCurrentBlockFromSession(session)?.estimatedSeconds ?? 0
      : payload.seconds ?? (typeof currentTimer.secondsRemaining === "number" ? currentTimer.secondsRemaining : 0);

  await db.boardSession.update({
    where: { id: sessionId },
    data: {
      timerStateJson: {
        status: payload.action === "start" ? "running" : payload.action === "stop" ? "stopped" : "idle",
        secondsRemaining,
        updatedAt: new Date().toISOString(),
      } as never,
    },
  });

  await appendBoardEvent(sessionId, `timer.${payload.action}`, payload);
  return emitSessionSnapshot(sessionId, "timer.updated", user);
}

export async function promoteBoardResults(user: SessionUser, sessionId: string, payload: BoardPromotionPayload) {
  ensureTeacherLike(user);
  const session = await assertSessionAccess(user, sessionId);
  const responses = await db.boardSessionResponse.findMany({
    where: { id: { in: payload.responseIds }, sessionId },
    include: { student: true, block: true },
  });

  if (!responses.length) throw new ApiError(404, "No responses selected");
  if (!session.subjectId && !session.lessonPackage.subjectId) {
    throw new ApiError(400, "A subject is required to promote results into grades");
  }

  const subjectId = session.subjectId ?? session.lessonPackage.subjectId!;
  let createdCount = 0;

  for (const response of responses) {
    if (response.score === null || response.score === undefined) continue;
    await db.grade.create({
      data: {
        studentId: response.studentId,
        subjectId,
        teacherId: session.teacherId,
        value: response.score,
        weight: payload.weight,
        type: payload.type,
        comment:
          payload.comment ??
          `Оценка перенесена из живой сессии "${session.lessonPackage.title}" по блоку "${response.block.title}".`,
        dateAssigned: new Date(),
      },
    });
    createdCount += 1;
  }

  await appendBoardEvent(sessionId, "results.promoted", {
    responseIds: payload.responseIds,
    createdCount,
  });

  return {
    createdCount,
    session: await emitSessionSnapshot(sessionId, "results.promoted", user),
  };
}
