import {
  AnnouncementTargetRole,
  AppLanguage,
  AttendanceStatus,
  BoardSessionStatus,
  BoardSyncMode,
  EventType,
  GradeType,
  HomeworkSubmissionStatus,
  LessonGenerationMode,
  MessageThreadType,
  PlanPeriod,
  PlanStatus,
  Role,
} from "@prisma/client";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export const userCreateSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
  password: z.string().min(6),
  isActive: z.boolean().default(true),
});

export const userUpdateSchema = userCreateSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).optional(),
});

export const profileUpdateSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
});

export const homeworkSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(10),
  dueDate: z.string().min(1),
  attachmentName: z.string().optional(),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
});

export const homeworkSubmissionSchema = z.object({
  content: z.string().min(2),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
  status: z.nativeEnum(HomeworkSubmissionStatus).optional(),
});

export const gradeSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  value: z.coerce.number().min(1).max(100),
  weight: z.coerce.number().min(0.1).max(5).default(1),
  type: z.nativeEnum(GradeType),
  comment: z.string().optional(),
  dateAssigned: z.string().min(1),
});

export const attendanceSchema = z.object({
  studentId: z.string().min(1),
  timetableEntryId: z.string().min(1),
  date: z.string().min(1),
  status: z.nativeEnum(AttendanceStatus),
  reason: z.string().optional(),
  note: z.string().optional(),
});

export const classRosterSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
});

export const timetableEntrySchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1),
  room: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(1).max(6),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

export const threadSchema = z.object({
  type: z.nativeEnum(MessageThreadType).default(MessageThreadType.DIRECT),
  title: z.string().optional(),
  participantIds: z.array(z.string()).min(1),
});

export const messageSchema = z.object({
  threadId: z.string().min(1),
  content: z.string().min(1),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
});

export const announcementSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(10),
  targetRole: z.nativeEnum(AnnouncementTargetRole),
  classId: z.string().optional().nullable(),
  isPinned: z.boolean().default(false),
});

export const eventSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  type: z.nativeEnum(EventType),
  classId: z.string().optional().nullable(),
});

export const aiRequestSchema = z.object({
  studentId: z.string().optional(),
  threadId: z.string().optional(),
  topic: z.string().optional(),
  message: z.string().optional(),
  question: z.string().optional(),
});

export const lessonPackageSchema = z.object({
  classId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  topic: z.string().min(3),
  title: z.string().min(3),
  objective: z.string().min(10),
  durationMinutes: z.coerce.number().int().min(20).max(180),
  complexityLevel: z.string().min(2),
  language: z.nativeEnum(AppLanguage).default(AppLanguage.RU),
  generationMode: z.nativeEnum(LessonGenerationMode).default(LessonGenerationMode.FULL),
  lessonStyle: z.string().optional(),
  activityCount: z.coerce.number().int().min(1).max(10).default(3),
  includeQuiz: z.boolean().default(true),
  includeWorksheet: z.boolean().default(true),
  includeHomework: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
  includeSlides: z.boolean().default(true),
  teacherNotes: z.string().optional(),
});

export const lessonBlockSchema = z.object({
  orderIndex: z.coerce.number().int().min(0),
  blockType: z.string().min(2),
  title: z.string().min(2),
  instructions: z.string().optional(),
  contentJson: z.record(z.string(), z.any()).or(z.array(z.any())),
  settingsJson: z.record(z.string(), z.any()).or(z.array(z.any())).optional(),
  answerKeyJson: z.record(z.string(), z.any()).or(z.array(z.any())).optional(),
  hint: z.string().optional(),
  teacherNote: z.string().optional(),
  estimatedSeconds: z.coerce.number().int().min(0).optional(),
  isGradable: z.boolean().default(false),
  isPracticeOnly: z.boolean().default(true),
});

export const academicPlanSchema = z.object({
  classId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  title: z.string().min(3),
  academicYear: z.string().min(4),
  period: z.nativeEnum(PlanPeriod),
  status: z.nativeEnum(PlanStatus).default(PlanStatus.DRAFT),
  termLabel: z.string().optional(),
  objective: z.string().min(10),
  expectedOutcomes: z.array(z.string().min(2)).default([]),
  checkpoints: z.array(z.string().min(2)).default([]),
  plannedLessons: z.coerce.number().int().min(1).max(300),
  completedLessons: z.coerce.number().int().min(0).max(300).default(0),
  language: z.nativeEnum(AppLanguage).default(AppLanguage.RU),
});

export const boardSessionSchema = z.object({
  lessonPackageId: z.string().min(1),
  classId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  timetableEntryId: z.string().optional().nullable(),
  scheduledFor: z.string().optional(),
  syncMode: z.nativeEnum(BoardSyncMode).default(BoardSyncMode.FULLY_SYNCED),
  allowLateJoin: z.boolean().default(true),
  allowImmediateJoin: z.boolean().default(true),
  allowFreeNavigation: z.boolean().default(false),
  showResponsesLive: z.boolean().default(true),
  gradedMode: z.boolean().default(false),
});

export const boardSessionUpdateSchema = z.object({
  status: z.nativeEnum(BoardSessionStatus).optional(),
  currentBlockId: z.string().optional().nullable(),
  currentBlockIndex: z.coerce.number().int().min(0).optional(),
  syncMode: z.nativeEnum(BoardSyncMode).optional(),
  allowLateJoin: z.boolean().optional(),
  allowImmediateJoin: z.boolean().optional(),
  allowFreeNavigation: z.boolean().optional(),
  showResponsesLive: z.boolean().optional(),
  gradedMode: z.boolean().optional(),
  activityStateJson: z.record(z.string(), z.any()).or(z.array(z.any())).optional(),
  timerStateJson: z.record(z.string(), z.any()).or(z.array(z.any())).optional(),
  revealedHints: z.array(z.string()).optional(),
});

export const boardJoinSchema = z.object({
  connectionState: z.enum(["ONLINE", "RECONNECTING", "OFFLINE"]).optional(),
});

export const boardResponseSchema = z.object({
  blockId: z.string().min(1),
  responseJson: z.record(z.string(), z.any()).or(z.array(z.any())),
  isSubmitted: z.boolean().default(true),
});

export const boardRevealSchema = z.object({
  blockId: z.string().min(1),
  reveal: z.boolean().default(true),
  hint: z.string().optional(),
});

export const boardTimerSchema = z.object({
  action: z.enum(["start", "stop", "reset"]),
  seconds: z.coerce.number().int().min(0).optional(),
});

export const boardPromotionSchema = z.object({
  responseIds: z.array(z.string()).min(1),
  type: z.nativeEnum(GradeType).default(GradeType.QUIZ),
  weight: z.coerce.number().min(0.1).max(5).default(1),
  comment: z.string().optional(),
});
