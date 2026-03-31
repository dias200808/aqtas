import { withApiAuth, parseBody } from "@/lib/api";
import { profileUpdateSchema } from "@/lib/validators";
import { updateOwnProfile } from "@/features/account/service";

export async function PATCH(request: Request) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, profileUpdateSchema);
    return updateOwnProfile(user, payload);
  });
}
