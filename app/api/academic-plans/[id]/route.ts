import { withApiAuth, parseBody } from "@/lib/api";
import { academicPlanSchema } from "@/lib/validators";
import { updateAcademicPlan } from "@/features/planning/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, academicPlanSchema.partial());
    const { id } = await params;
    return updateAcademicPlan(user, id, payload);
  });
}
