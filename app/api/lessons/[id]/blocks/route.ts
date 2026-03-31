import { withApiAuth, parseBody } from "@/lib/api";
import { lessonBlockSchema } from "@/lib/validators";
import { addLessonBlock } from "@/features/lessons/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, lessonBlockSchema);
    const { id } = await params;
    return addLessonBlock(user, id, payload);
  });
}
