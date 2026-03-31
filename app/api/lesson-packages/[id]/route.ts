import { z } from "zod";
import { withApiAuth, parseBody } from "@/lib/api";
import { updateLessonPackage } from "@/features/lessons/service";

const lessonPackageUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  objective: z.string().min(10).optional(),
  teacherNotes: z.string().optional(),
  includeQuiz: z.boolean().optional(),
  includeWorksheet: z.boolean().optional(),
  includeHomework: z.boolean().optional(),
  includeSummary: z.boolean().optional(),
  includeSlides: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, lessonPackageUpdateSchema);
    const { id } = await params;
    return updateLessonPackage(user, id, payload);
  });
}
