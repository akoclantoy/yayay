import { auth } from "@/auth";
import {
  hasRealtimeDatabaseUrl,
  subscribeToRealtimeChanges,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const refreshEvent = encoder.encode("event: invalidate\ndata: {}\n\n");
const heartbeat = encoder.encode(": keep-alive\n\n");

function enqueue(
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: Uint8Array
) {
  if (controller.desiredSize === null) return false;
  controller.enqueue(message);
  return true;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasRealtimeDatabaseUrl()) {
    return new Response("Realtime database connection is not configured.", {
      status: 503,
    });
  }

  let unsubscribe: (() => void) | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  function cleanup() {
    unsubscribe?.();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!enqueue(controller, encoder.encode("retry: 3000\n\n"))) return;
      if (!enqueue(controller, refreshEvent)) return;
      unsubscribe = subscribeToRealtimeChanges(() => {
        if (!enqueue(controller, refreshEvent)) cleanup();
      });
      heartbeatTimer = setInterval(() => {
        if (!enqueue(controller, heartbeat)) cleanup();
      }, 20_000);
    },
    cancel: cleanup,
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
