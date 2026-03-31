import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessBoardSession } from "@/features/lessons/service";
import { getPusherServer } from "@/lib/realtime/server";

function extractSessionId(channelName: string) {
  const match = channelName.match(/^(?:private|presence)-board-session-(.+)$/);
  return match?.[1] ?? null;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const formData = await request.formData();
  const socketId = String(formData.get("socket_id") ?? "");
  const channelName = String(formData.get("channel_name") ?? "");
  const sessionId = extractSessionId(channelName);

  if (!socketId || !channelName || !sessionId) {
    return NextResponse.json({ error: "Invalid realtime authorization payload" }, { status: 400 });
  }

  const allowed = await canAccessBoardSession(user, sessionId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return NextResponse.json({ error: "Realtime is not configured" }, { status: 503 });
  }

  const authResponse = channelName.startsWith("presence-")
    ? pusher.authorizeChannel(socketId, channelName, {
        user_id: user.id,
        user_info: {
          name: user.fullName,
          role: user.role,
        },
      })
    : pusher.authorizeChannel(socketId, channelName);

  return NextResponse.json(authResponse);
}
