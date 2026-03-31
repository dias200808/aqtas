import { withApiAuth, parseBody } from "@/lib/api";
import { boardTimerSchema } from "@/lib/validators";
import { updateBoardTimer } from "@/features/lessons/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, boardTimerSchema);
    const { id } = await params;
    return updateBoardTimer(user, id, payload);
  });
}
