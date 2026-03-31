import { withApiAuth, parseBody } from "@/lib/api";
import { eventSchema } from "@/lib/validators";
import { deleteEvent, updateEvent } from "@/features/calendar/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const payload = await parseBody(request, eventSchema.partial());
    const { id } = await params;
    return updateEvent(user, id, payload);
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(async (user) => {
    const { id } = await params;
    return deleteEvent(user, id);
  });
}
