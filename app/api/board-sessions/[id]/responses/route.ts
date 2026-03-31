import { withApiAuth, parseBody } from "@/lib/api";
import { boardResponseSchema } from "@/lib/validators";
import { submitBoardResponse } from "@/features/lessons/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, boardResponseSchema);
    const { id } = await params;
    return submitBoardResponse(user, id, payload);
  });
}
