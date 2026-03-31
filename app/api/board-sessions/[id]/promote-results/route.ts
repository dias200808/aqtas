import { withApiAuth, parseBody } from "@/lib/api";
import { boardPromotionSchema } from "@/lib/validators";
import { promoteBoardResults } from "@/features/lessons/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, boardPromotionSchema);
    const { id } = await params;
    return promoteBoardResults(user, id, payload);
  });
}
