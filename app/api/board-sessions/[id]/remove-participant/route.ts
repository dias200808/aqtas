import { z } from "zod";
import { withApiAuth, parseBody } from "@/lib/api";
import { removeBoardParticipant } from "@/features/lessons/service";

const removeParticipantSchema = z.object({
  studentId: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, removeParticipantSchema);
    const { id } = await params;
    return removeBoardParticipant(user, id, payload.studentId);
  });
}
