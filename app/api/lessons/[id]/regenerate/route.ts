import { z } from "zod";
import { withApiAuth, parseBody } from "@/lib/api";
import { regenerateLesson } from "@/features/lessons/service";

const regenerateSchema = z.object({
  target: z.enum(["all", "interactive", "summary", "homework", "block"]).default("all"),
  blockId: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, regenerateSchema);
    const { id } = await params;
    return regenerateLesson(user, id, payload);
  });
}
