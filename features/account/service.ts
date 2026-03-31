import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";

export async function updateOwnProfile(
  user: SessionUser,
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  },
) {
  return db.user.update({
    where: { id: user.id },
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone || null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
    },
  });
}
