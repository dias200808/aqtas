import Pusher from "pusher";

let pusherServer: Pusher | null = null;

export function getPusherServer() {
  if (pusherServer) return pusherServer;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  pusherServer = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherServer;
}

export async function triggerBoardEvent(sessionId: string, eventName: string, payload: unknown) {
  const pusher = getPusherServer();
  if (!pusher) return;

  await Promise.all([
    pusher.trigger(`private-board-session-${sessionId}`, eventName, payload),
    pusher.trigger(`presence-board-session-${sessionId}`, eventName, payload),
  ]);
}
