import {
  AppLanguage,
  AIInsightType,
  AnnouncementTargetRole,
  AttendanceStatus,
  BoardSessionStatus,
  EventType,
  GradeType,
  HomeworkSubmissionStatus,
  InsightSeverity,
  LessonGenerationMode,
  MessageThreadType,
  NotificationType,
  PlanPeriod,
  PlanStatus,
  RelationType,
  Role,
} from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { subDays, addDays, setHours, setMinutes } from "date-fns";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword("Demo123!");

  await prisma.messageReadState.deleteMany();
  await prisma.message.deleteMany();
  await prisma.messageParticipant.deleteMany();
  await prisma.messageThread.deleteMany();
  await prisma.boardSession.deleteMany();
  await prisma.lessonPackage.deleteMany();
  await prisma.academicPlan.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.aIInsight.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.homeworkSubmission.deleteMany();
  await prisma.homeworkAttachment.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.event.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.teacherSubjectClass.deleteMany();
  await prisma.parentStudentRelation.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.parentProfile.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.schoolClass.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      firstName: "Amina",
      lastName: "Sarsen",
      email: "admin@aqtas.school",
      role: Role.ADMIN,
      phone: "+7 700 100 1000",
      passwordHash,
      isActive: true,
    },
  });

  const teacherSeeds = [
    { firstName: "Dana", lastName: "Kairat", email: "teacher1@aqtas.school", code: "T-1001" },
    { firstName: "Marat", lastName: "Yessen", email: "teacher2@aqtas.school", code: "T-1002" },
    { firstName: "Aliya", lastName: "Nurgali", email: "teacher3@aqtas.school", code: "T-1003" },
  ];

  const parentSeeds = [
    { firstName: "Samat", lastName: "Bekov", email: "parent1@aqtas.school" },
    { firstName: "Kamila", lastName: "Aubakirova", email: "parent2@aqtas.school" },
    { firstName: "Ruslan", lastName: "Akhmet", email: "parent3@aqtas.school" },
    { firstName: "Zarina", lastName: "Tolegen", email: "parent4@aqtas.school" },
    { firstName: "Yelena", lastName: "Orman", email: "parent5@aqtas.school" },
  ];

  const studentSeeds = Array.from({ length: 10 }).map((_, index) => ({
    firstName: ["Arman", "Aruzhan", "Miras", "Aisha", "Dias", "Nazerke", "Aslan", "Malika", "Timur", "Dina"][index],
    lastName: ["Bek", "Sapar", "Nur", "Aman", "Erkin", "Talgat", "Serik", "Ismail", "Aset", "Kenzhe"][index],
    email: `student${index + 1}@aqtas.school`,
    studentCode: `ST-${1000 + index + 1}`,
  }));

  const teachers = [];
  for (const seed of teacherSeeds) {
    const user = await prisma.user.create({
      data: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        role: Role.TEACHER,
        phone: "+7 700 200 2000",
        passwordHash,
        isActive: true,
      },
    });

    const profile = await prisma.teacherProfile.create({
      data: {
        userId: user.id,
        employeeCode: seed.code,
      },
      include: { user: true },
    });

    teachers.push(profile);
  }

  const parents = [];
  for (const seed of parentSeeds) {
    const user = await prisma.user.create({
      data: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        role: Role.PARENT,
        phone: "+7 700 300 3000",
        passwordHash,
        isActive: true,
      },
    });

    const profile = await prisma.parentProfile.create({
      data: { userId: user.id },
      include: { user: true },
    });

    parents.push(profile);
  }

  const classes = await Promise.all([
    prisma.schoolClass.create({ data: { name: "5A", gradeLevel: 5, academicYear: "2025/2026" } }),
    prisma.schoolClass.create({ data: { name: "6B", gradeLevel: 6, academicYear: "2025/2026" } }),
  ]);

  const subjects = await Promise.all([
    prisma.subject.create({ data: { name: "Mathematics", code: "MATH", color: "#1456c2" } }),
    prisma.subject.create({ data: { name: "English", code: "ENG", color: "#0f766e" } }),
    prisma.subject.create({ data: { name: "Physics", code: "PHY", color: "#ca8a04" } }),
    prisma.subject.create({ data: { name: "Biology", code: "BIO", color: "#16a34a" } }),
    prisma.subject.create({ data: { name: "History", code: "HIS", color: "#7c3aed" } }),
    prisma.subject.create({ data: { name: "Informatics", code: "IT", color: "#db2777" } }),
  ]);

  const students = [];
  for (const [index, seed] of studentSeeds.entries()) {
    const user = await prisma.user.create({
      data: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        role: Role.STUDENT,
        phone: "+7 700 400 4000",
        passwordHash,
        isActive: true,
      },
    });

    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        classId: index < 5 ? classes[0].id : classes[1].id,
        studentCode: seed.studentCode,
        birthDate: subDays(new Date("2014-01-01"), index * 45),
        enrollmentDate: new Date("2022-09-01"),
      },
      include: {
        user: true,
        schoolClass: true,
      },
    });

    students.push(profile);
  }

  for (const [index, student] of students.entries()) {
    const parent = parents[index % parents.length];
    await prisma.parentStudentRelation.create({
      data: {
        parentId: parent.id,
        studentId: student.id,
        relationType: index % 2 === 0 ? RelationType.MOTHER : RelationType.FATHER,
      },
    });
  }

  const assignments = [
    { teacherId: teachers[0].id, classId: classes[0].id, subjectId: subjects[0].id },
    { teacherId: teachers[0].id, classId: classes[1].id, subjectId: subjects[0].id },
    { teacherId: teachers[1].id, classId: classes[0].id, subjectId: subjects[1].id },
    { teacherId: teachers[1].id, classId: classes[1].id, subjectId: subjects[4].id },
    { teacherId: teachers[2].id, classId: classes[0].id, subjectId: subjects[5].id },
    { teacherId: teachers[2].id, classId: classes[1].id, subjectId: subjects[2].id },
    { teacherId: teachers[2].id, classId: classes[1].id, subjectId: subjects[3].id },
  ];

  for (const assignment of assignments) {
    await prisma.teacherSubjectClass.create({ data: assignment });
  }

  const timetableEntries = [];
  const slotTemplates = [
    { startTime: "08:30", endTime: "09:15" },
    { startTime: "09:25", endTime: "10:10" },
    { startTime: "10:25", endTime: "11:10" },
    { startTime: "11:20", endTime: "12:05" },
  ];

  for (const schoolClass of classes) {
    for (let day = 1; day <= 5; day += 1) {
      const dayAssignments = assignments.filter((assignment) => assignment.classId === schoolClass.id);
      for (const [index, slot] of slotTemplates.entries()) {
        const assignment = dayAssignments[index % dayAssignments.length];
        const entry = await prisma.timetableEntry.create({
          data: {
            classId: schoolClass.id,
            subjectId: assignment.subjectId,
            teacherId: assignment.teacherId,
            room: `${200 + day}${String.fromCharCode(65 + index)}`,
            dayOfWeek: day,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
          include: {
            subject: true,
            schoolClass: true,
            teacher: { include: { user: true } },
          },
        });
        timetableEntries.push(entry);
      }
    }
  }

  const homeworks = [];
  for (const [index, assignment] of assignments.entries()) {
    const homework = await prisma.homework.create({
      data: {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        title: `Week ${index + 1} practice set`,
        description: `Complete the assigned exercises, show your working clearly, and prepare one question to discuss in class.`,
        dueDate: addDays(new Date(), index - 2),
      },
      include: {
        subject: true,
        schoolClass: true,
      },
    });
    homeworks.push(homework);
  }

  for (const homework of homeworks) {
    const classStudents = students.filter((student) => student.classId === homework.classId);
    for (const [index, student] of classStudents.entries()) {
      await prisma.homeworkSubmission.create({
        data: {
          homeworkId: homework.id,
          studentId: student.id,
          submittedAt: index % 3 === 0 ? subDays(new Date(), 1) : null,
          status:
            index % 4 === 0
              ? HomeworkSubmissionStatus.REVIEWED
              : index % 3 === 0
                ? HomeworkSubmissionStatus.SUBMITTED
                : HomeworkSubmissionStatus.NOT_SUBMITTED,
          content: index % 3 === 0 ? "Completed the exercises and attached short notes." : null,
          teacherComment: index % 4 === 0 ? "Good work, but explain step 3 more clearly." : null,
        },
      });
    }
  }

  for (const student of students) {
    const classAssignments = assignments.filter((assignment) => assignment.classId === student.classId);
    for (const assignment of classAssignments) {
      for (let i = 0; i < 3; i += 1) {
        await prisma.grade.create({
          data: {
            studentId: student.id,
            subjectId: assignment.subjectId,
            teacherId: assignment.teacherId,
            value: 65 + Math.round(Math.random() * 30),
            weight: i === 2 ? 1.5 : 1,
            type: [GradeType.HOMEWORK, GradeType.QUIZ, GradeType.TEST][i % 3],
            comment: i === 2 ? "Assessment showed good improvement." : "Keep practicing key concepts.",
            dateAssigned: subDays(new Date(), i * 7 + (student.user.firstName.length % 4)),
          },
        });
      }
    }
  }

  const recentEntries = timetableEntries.filter((entry) => entry.dayOfWeek <= 5).slice(0, 10);
  for (const student of students) {
    for (const [index, entry] of recentEntries
      .filter((item) => item.classId === student.classId)
      .slice(0, 6)
      .entries()) {
      await prisma.attendance.create({
        data: {
          studentId: student.id,
          timetableEntryId: entry.id,
          date: subDays(new Date(), index + 1),
          status:
            index % 6 === 0
              ? AttendanceStatus.ABSENT
              : index % 5 === 0
                ? AttendanceStatus.LATE
                : AttendanceStatus.PRESENT,
          reason: index % 6 === 0 ? "Reported ill" : null,
          note: index % 5 === 0 ? "Joined after the opening activity" : null,
          markedByUserId: teachers.find((teacher) => teacher.id === entry.teacherId)?.userId || admin.id,
        },
      });
    }
  }

  const threads = [];
  for (let i = 0; i < 4; i += 1) {
    const thread = await prisma.messageThread.create({
      data: {
        type: MessageThreadType.DIRECT,
        participants: {
          createMany: {
            data: [
              { userId: parents[i].userId },
              { userId: teachers[i % teachers.length].userId },
            ],
          },
        },
      },
    });
    threads.push(thread);

    const firstMessage = await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: parents[i].userId,
        content: "Hello, I wanted to ask about recent homework progress and whether anything urgent needs attention.",
      },
    });

    const secondMessage = await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: teachers[i % teachers.length].userId,
        content: "Thank you for reaching out. I recommend focusing on recent missed tasks and checking the grade trend in the dashboard.",
      },
    });

    await prisma.messageReadState.createMany({
      data: [
        { messageId: firstMessage.id, userId: teachers[i % teachers.length].userId, readAt: new Date() },
        { messageId: secondMessage.id, userId: parents[i].userId, readAt: new Date() },
      ],
    });
  }

  await prisma.announcement.createMany({
    data: [
      {
        title: "Parent conference week",
        content: "Parent-teacher conferences will be held next Thursday from 16:00 to 19:00.",
        authorId: admin.id,
        targetRole: AnnouncementTargetRole.ALL,
        isPinned: true,
      },
      {
        title: "Grade 5 science fair prep",
        content: "Students in 5A should finalize project boards and bring materials by Wednesday.",
        authorId: teachers[2].userId,
        targetRole: AnnouncementTargetRole.STUDENT,
        classId: classes[0].id,
        isPinned: false,
      },
      {
        title: "Attendance reminders",
        content: "Parents should submit absence explanations in advance when possible.",
        authorId: admin.id,
        targetRole: AnnouncementTargetRole.PARENT,
        isPinned: false,
      },
    ],
  });

  await prisma.event.createMany({
    data: [
      {
        title: "School assembly",
        description: "Monthly school-wide assembly in the main hall.",
        startAt: setMinutes(setHours(addDays(new Date(), 1), 9), 0),
        endAt: setMinutes(setHours(addDays(new Date(), 1), 10), 0),
        type: EventType.SCHOOL,
        createdByUserId: admin.id,
      },
      {
        title: "Mathematics checkpoint",
        description: "Class 6B mathematics checkpoint assessment.",
        startAt: setMinutes(setHours(addDays(new Date(), 2), 11), 20),
        endAt: setMinutes(setHours(addDays(new Date(), 2), 12), 5),
        type: EventType.TEST,
        classId: classes[1].id,
        createdByUserId: teachers[0].userId,
      },
      {
        title: "History project deadline",
        description: "Final project submission deadline for history portfolios.",
        startAt: setMinutes(setHours(addDays(new Date(), 4), 15), 0),
        endAt: setMinutes(setHours(addDays(new Date(), 4), 16), 0),
        type: EventType.DEADLINE,
        classId: classes[1].id,
        createdByUserId: teachers[1].userId,
      },
    ],
  });

  const lessonPackages = await Promise.all([
    prisma.lessonPackage.create({
      data: {
        teacherId: teachers[0].id,
        classId: classes[0].id,
        subjectId: subjects[0].id,
        title: "Линейные уравнения: от правила к задаче",
        topic: "Линейные уравнения",
        objective: "Ученики понимают, как решать линейные уравнения и применять их в коротких текстовых задачах.",
        durationMinutes: 45,
        complexityLevel: "Базовый",
        language: AppLanguage.RU,
        generationMode: LessonGenerationMode.FULL,
        lessonStyle: "Интерактивный",
        activityCount: 3,
        includeQuiz: true,
        includeWorksheet: true,
        includeHomework: true,
        includeSummary: true,
        includeSlides: true,
        keyTerms: ["линейное уравнение", "неизвестное", "проверка ответа"],
        lessonPlan: [
          { title: "Разогрев", minutes: 5, goal: "Вспомнить базовые действия с равенствами." },
          { title: "Объяснение", minutes: 15, goal: "Показать алгоритм решения уравнения по шагам." },
          { title: "Практика", minutes: 15, goal: "Решить 3 уравнения в парах и обсудить ошибки." },
          { title: "Итог", minutes: 10, goal: "Закрепить ключевое правило и задать домашнюю работу." },
        ],
        slides: [
          { type: "TITLE", title: "Линейные уравнения", body: "Математика · 5A · цель урока и план работы", hint: "Спросите, что уже помнят об уравнениях." },
          { type: "EXPLANATION", title: "Алгоритм решения", body: "Переносим известные числа, приводим подобные, находим неизвестное.", hint: "Покажите решение на одном примере у доски." },
          { type: "ACTIVITY", title: "Практика в парах", body: "Решите 3 уравнения и обменяйтесь тетрадями для проверки.", hint: "Отметьте типичную ошибку до начала работы." },
          { type: "QUIZ", title: "Быстрый квиз", body: "2 вопроса на понимание и 1 вопрос на применение.", hint: "Попросите учеников объяснить выбор ответа." },
          { type: "HOMEWORK", title: "Домашнее задание", body: "Решить 4 уравнения и одну текстовую задачу.", hint: "Напомните формат записи решения." },
        ],
        quiz: [
          { type: "single-choice", question: "Что нужно сделать первым при решении уравнения x + 5 = 12?", options: ["Вычесть 5 из обеих частей", "Прибавить 5", "Разделить на 5"], answerIndex: 0 },
          { type: "true-false", question: "Ответ нужно проверить подстановкой.", answer: true },
        ],
        worksheet: [
          { type: "fill-in-the-blank", task: "Заполните шаги решения уравнения x - 3 = 8." },
          { type: "match-pairs", task: "Соотнесите уравнение и его решение." },
        ],
        homeworkText: "1. Решить 4 линейных уравнения.\n2. Проверить каждый ответ.\n3. Подготовить один собственный пример.",
        summaryText: "К концу урока ученик умеет решить базовое линейное уравнение и проверить ответ.",
        teacherNotes: "Сделайте акцент на проверке ответа и переносе слагаемых без потери знака.",
        isPublished: true,
      },
    }),
    prisma.lessonPackage.create({
      data: {
        teacherId: teachers[1].id,
        classId: classes[1].id,
        subjectId: subjects[4].id,
        title: "Причины и последствия исторических реформ",
        topic: "Исторические реформы",
        objective: "Ученики сравнивают причины реформ и объясняют их влияние на общество.",
        durationMinutes: 40,
        complexityLevel: "Средний",
        language: AppLanguage.RU,
        generationMode: LessonGenerationMode.BOARD,
        lessonStyle: "Дискуссионный",
        activityCount: 4,
        includeQuiz: true,
        includeWorksheet: true,
        includeHomework: true,
        includeSummary: true,
        includeSlides: true,
        keyTerms: ["реформа", "причина", "последствие", "источник"],
        lessonPlan: [
          { title: "Вводный вопрос", minutes: 5, goal: "Активировать знания о причинах изменений в обществе." },
          { title: "Работа с источником", minutes: 15, goal: "Выделить ключевые причины реформ." },
          { title: "Обсуждение", minutes: 10, goal: "Сравнить последствия реформ для разных групп." },
          { title: "Рефлексия", minutes: 10, goal: "Сформулировать итог в 2-3 тезисах." },
        ],
        slides: [
          { type: "TITLE", title: "Исторические реформы", body: "История · 6B · причины и последствия", hint: "Попросите назвать знакомый пример реформы." },
          { type: "TEXT_IMAGE", title: "Работа с источником", body: "Прочитайте короткий источник и выделите аргументы за реформу.", hint: "Подчеркните дату, участника и ключевое решение." },
          { type: "POLL", title: "Мини-опрос", body: "Кто выиграл от реформы больше всего?", hint: "Соберите 3 разные позиции класса." },
          { type: "SUMMARY", title: "Итог", body: "Назовите одну причину и одно последствие реформы.", hint: "Сравните ответы в парах." },
        ],
        quiz: [
          { type: "single-choice", question: "Что лучше всего показывает причину реформы?", options: ["Проблема, которую хотели решить", "Цвет флага", "Имя свидетеля"], answerIndex: 0 },
        ],
        worksheet: [
          { type: "short-answer", task: "Назовите две причины реформы и один итог." },
        ],
        homeworkText: "Подготовить мини-таблицу: причина реформы, действие, последствие.",
        summaryText: "Ученики различают причины и последствия реформ и опираются на источник.",
        teacherNotes: "Поддержите слабых учеников шаблоном ответа: причина -> действие -> итог.",
        isPublished: false,
      },
    }),
  ]);

  await prisma.boardSession.createMany({
    data: [
      {
        lessonPackageId: lessonPackages[0].id,
        teacherId: teachers[0].id,
        classId: classes[0].id,
        subjectId: subjects[0].id,
        status: BoardSessionStatus.LIVE,
        currentBlockIndex: 2,
        activityStateJson: { isOpen: true, revealAnswer: false },
        timerStateJson: { status: "running", secondsRemaining: 90 },
        revealedHints: ["Покажите решение на одном примере у доски."],
      },
      {
        lessonPackageId: lessonPackages[1].id,
        teacherId: teachers[1].id,
        classId: classes[1].id,
        subjectId: subjects[4].id,
        status: BoardSessionStatus.PAUSED,
        currentBlockIndex: 1,
        activityStateJson: { isOpen: false, revealAnswer: false },
        timerStateJson: { status: "stopped", secondsRemaining: 120 },
        revealedHints: ["Подчеркните дату, участника и ключевое решение."],
      },
    ],
  });

  await prisma.academicPlan.createMany({
    data: [
      {
        teacherId: teachers[0].id,
        classId: classes[0].id,
        subjectId: subjects[0].id,
        title: "Годовой план по математике для 5A",
        academicYear: "2025/2026",
        period: PlanPeriod.ANNUAL,
        status: PlanStatus.ACTIVE,
        termLabel: "2025/2026",
        objective: "Построить устойчивую математическую базу по числам, выражениям, уравнениям и задачам.",
        expectedOutcomes: [
          "Ученики уверенно выполняют базовые вычисления",
          "Ученики решают линейные уравнения и объясняют шаги",
          "Ученики применяют математику в текстовых задачах",
        ],
        checkpoints: [
          "Квиз после каждого раздела",
          "Практическая работа в конце четверти",
          "Промежуточная диагностика в середине года",
        ],
        plannedLessons: 68,
        completedLessons: 21,
        language: AppLanguage.RU,
      },
      {
        teacherId: teachers[1].id,
        classId: classes[1].id,
        subjectId: subjects[4].id,
        title: "План 1 четверти по истории для 6B",
        academicYear: "2025/2026",
        period: PlanPeriod.QUARTER,
        status: PlanStatus.ACTIVE,
        termLabel: "1 четверть",
        objective: "Провести блок по реформам и развитию общества с опорой на работу с источниками.",
        expectedOutcomes: [
          "Ученики называют причины исторических реформ",
          "Ученики сравнивают последствия для разных групп",
        ],
        checkpoints: [
          "Мини-эссе по реформам",
          "Устный опрос по работе с источником",
        ],
        plannedLessons: 18,
        completedLessons: 6,
        language: AppLanguage.RU,
      },
    ],
  });

  const notifications = [];
  for (const student of students.slice(0, 5)) {
    notifications.push({
      userId: student.userId,
      type: NotificationType.HOMEWORK,
      title: "Homework due soon",
      body: "One of your assignments is due tomorrow. Check the homework board.",
      link: "/homework",
    });
  }

  notifications.push(
    {
      userId: admin.id,
      type: NotificationType.SYSTEM,
      title: "Demo environment ready",
      body: "Seed data finished successfully and the demo workspace is populated.",
      link: "/analytics",
    },
    {
      userId: teachers[0].userId,
      type: NotificationType.AI,
      title: "AI insight available",
      body: "A new class risk summary is ready to review.",
      link: "/ai",
    },
  );

  await prisma.notification.createMany({ data: notifications });

  await prisma.aIInsight.createMany({
    data: [
      {
        userId: students[0].userId,
        studentId: students[0].id,
        type: AIInsightType.DAY_SUMMARY,
        title: "Daily focus",
        content: "Prioritize mathematics homework first, then review English vocabulary for tomorrow.",
        severity: InsightSeverity.MEDIUM,
      },
      {
        userId: parents[0].userId,
        studentId: students[0].id,
        type: AIInsightType.RISK_ANALYSIS,
        title: "Watch attendance trend",
        content: "There are repeated late arrivals in recent records, so a morning routine check may help.",
        severity: InsightSeverity.MEDIUM,
      },
      {
        userId: teachers[0].userId,
        type: AIInsightType.TEACHER_SUMMARY,
        title: "Class summary",
        content: "Homework completion is strongest in 5A, while 6B needs closer follow-up on missed work.",
        severity: InsightSeverity.LOW,
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "seed.completed",
        entityType: "System",
        entityId: "seed",
        payloadJson: { users: 19, students: 10, teachers: 3 },
      },
      {
        userId: teachers[0].userId,
        action: "homework.created",
        entityType: "Homework",
        entityId: homeworks[0].id,
        payloadJson: { title: homeworks[0].title },
      },
      {
        userId: teachers[1].userId,
        action: "announcement.created",
        entityType: "Announcement",
        entityId: "bulk",
        payloadJson: { targetRole: "PARENT" },
      },
    ],
  });

  console.log("Seed complete");
  console.log("Admin: admin@aqtas.school / Demo123!");
  console.log("Teacher: teacher1@aqtas.school / Demo123!");
  console.log("Parent: parent1@aqtas.school / Demo123!");
  console.log("Student: student1@aqtas.school / Demo123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
