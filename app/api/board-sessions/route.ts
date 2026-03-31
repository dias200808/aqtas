import { withApiAuth, parseBody } from "@/lib/api";
import { boardSessionSchema } from "@/lib/validators";
import { createBoardSession, listBoardSessions } from "@/features/lessons/service";

export async function GET() {
  return withApiAuth(async (user) => listBoardSessions(user));
}

export async function POST(request: Request) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, boardSessionSchema);
    return createBoardSession(user, payload);
  });
}
