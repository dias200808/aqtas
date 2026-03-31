import { z } from "zod";
import { withApiAuth, parseBody } from "@/lib/api";
import { deleteLessonBlock, updateLessonBlock } from "@/features/lessons/service";

const blockUpdateSchema = z.object({
  orderIndex: z.coerce.number().int().min(0).optional(),
  blockType: z.string().min(2).optional(),
  title: z.string().min(2).optional(),
  instructions: z.string().optional(),
  contentJson: z.any().optional(),
  settingsJson: z.any().optional(),
  answerKeyJson: z.any().optional(),
  hint: z.string().optional(),
  teacherNote: z.string().optional(),
  estimatedSeconds: z.coerce.number().int().min(0).optional(),
  isGradable: z.boolean().optional(),
  isPracticeOnly: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, blockUpdateSchema);
    const { id } = await params;
    return updateLessonBlock(user, id, payload);
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const { id } = await params;
    return deleteLessonBlock(user, id);
  });
}
