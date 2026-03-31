import { withApiAuth, parseBody } from "@/lib/api";
import { boardSessionUpdateSchema } from "@/lib/validators";
import { getBoardSessionSnapshot, updateBoardSession } from "@/features/lessons/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const { id } = await params;
    return getBoardSessionSnapshot(user, id);
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, boardSessionUpdateSchema);
    const { id } = await params;
    return updateBoardSession(user, id, payload);
  });
}
