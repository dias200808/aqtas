import { withApiAuth } from "@/lib/api";
import { endBoardSession } from "@/features/lessons/service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const { id } = await params;
    return endBoardSession(user, id);
  });
}
