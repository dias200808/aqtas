import { withApiAuth, parseBody } from "@/lib/api";
import { academicPlanSchema } from "@/lib/validators";
import { createAcademicPlan, listAcademicPlans } from "@/features/planning/service";

export async function GET() {
  return withApiAuth(async (user) => listAcademicPlans(user));
}

export async function POST(request: Request) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, academicPlanSchema);
    return createAcademicPlan(user, payload);
  });
}
