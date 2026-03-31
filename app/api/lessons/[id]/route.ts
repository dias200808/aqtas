import { z } from "zod";
import { withApiAuth, parseBody } from "@/lib/api";
import { getLessonDetail, updateLesson } from "@/features/lessons/service";

const lessonUpdateSchema = z.object({
  classId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  topic: z.string().min(3).optional(),
  title: z.string().min(3).optional(),
  objective: z.string().min(10).optional(),
  durationMinutes: z.coerce.number().int().min(20).max(180).optional(),
  complexityLevel: z.string().min(2).optional(),
  language: z.enum(["RU", "EN"]).optional(),
  generationMode: z.enum(["QUICK", "FULL", "QUIZ", "WORKSHEET", "HOMEWORK", "REVISION", "TEST_PREP", "BOARD"]).optional(),
  lessonStyle: z.string().optional().nullable(),
  activityCount: z.coerce.number().int().min(1).max(10).optional(),
  includeQuiz: z.boolean().optional(),
  includeWorksheet: z.boolean().optional(),
  includeHomework: z.boolean().optional(),
  includeSummary: z.boolean().optional(),
  includeSlides: z.boolean().optional(),
  teacherNotes: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const { id } = await params;
    return getLessonDetail(user, id);
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, lessonUpdateSchema);
    const { id } = await params;
    return updateLesson(user, id, payload);
  });
}
