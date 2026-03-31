import { withApiAuth } from "@/lib/api";
import { listAvailableContacts } from "@/features/messages/service";

export async function GET(request: Request) {
  return withApiAuth(async (user) => {
    const { searchParams } = new URL(request.url);
    return listAvailableContacts(user, searchParams.get("search") ?? undefined);
  });
}
