import { withApiAuth, parseBody } from "@/lib/api";
import { lessonPackageSchema } from "@/lib/validators";
import { createLesson, listLessons } from "@/features/lessons/service";

export async function GET() {
  return withApiAuth(async (user) => listLessons(user));
}

export async function POST(request: Request) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, lessonPackageSchema);
    return createLesson(user, payload);
  });
}
