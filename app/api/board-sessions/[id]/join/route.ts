import { withApiAuth, parseBody } from "@/lib/api";
import { boardJoinSchema } from "@/lib/validators";
import { joinBoardSession } from "@/features/lessons/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, boardJoinSchema);
    const { id } = await params;
    return joinBoardSession(user, id, payload);
  });
}
