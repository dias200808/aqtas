import { withApiAuth } from "@/lib/api";
import { leaveBoardSession } from "@/features/lessons/service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const { id } = await params;
    return leaveBoardSession(user, id);
  });
}
