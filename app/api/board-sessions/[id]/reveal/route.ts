import { withApiAuth, parseBody } from "@/lib/api";
import { boardRevealSchema } from "@/lib/validators";
import { revealBoardBlock } from "@/features/lessons/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, boardRevealSchema);
    const { id } = await params;
    return revealBoardBlock(user, id, payload);
  });
}
