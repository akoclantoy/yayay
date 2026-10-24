import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { canonicalFriendshipPair } from "@/lib/resident-social";

const signalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("OFFER"),
    payload: z.object({
      type: z.literal("offer"),
      sdp: z.string().min(1).max(100_000),
    }),
  }),
  z.object({
    kind: z.literal("ANSWER"),
    payload: z.object({
      type: z.literal("answer"),
      sdp: z.string().min(1).max(100_000),
    }),
  }),
  z.object({
    kind: z.literal("ICE"),
    payload: z.object({
      candidate: z.string().max(8_192),
      sdpMid: z.string().max(256).nullable().optional(),
      sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
      usernameFragment: z.string().max(256).nullable().optional(),
    }),
  }),
]);

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    conversationId: z.string().min(1),
    kind: z.enum(["AUDIO", "VIDEO"]),
  }),
  z.object({
    action: z.literal("accept"),
    callId: z.string().min(1),
  }),
  z.object({
    action: z.literal("decline"),
    callId: z.string().min(1),
  }),
  z.object({
    action: z.literal("end"),
    callId: z.string().min(1),
  }),
  z.object({
    action: z.literal("signal"),
    callId: z.string().min(1),
    signal: signalSchema,
  }),
]);

const ACTIVE_STATUSES = ["RINGING", "ACCEPTED"] as const;
const RING_TIMEOUT_MS = 45_000;
const CALL_MAX_DURATION_MS = 3 * 60 * 60_000;
const SIGNAL_LIMIT = 300;

function getIceServers(userId: string): RTCIceServer[] {
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const turnUrl = process.env.TURN_SERVER_URL?.trim();
  const turnSecret = process.env.TURN_SHARED_SECRET;
  if (turnUrl && turnSecret) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${userId}`;
    const credential = createHmac("sha1", turnSecret).update(username).digest("base64");
    iceServers.push({ urls: turnUrl.split(",").map((url) => url.trim()), username, credential });
  }
  return iceServers;
}

function serializeCall(call: {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  kind: "AUDIO" | "VIDEO";
  status: "RINGING" | "ACCEPTED" | "DECLINED" | "MISSED" | "ENDED";
  createdAt: Date;
  caller: { id: string; name: string | null; image: string | null };
  callee: { id: string; name: string | null; image: string | null };
}, userId: string) {
  const peer = call.callerId === userId ? call.callee : call.caller;
  return {
    id: call.id,
    conversationId: call.conversationId,
    callerId: call.callerId,
    calleeId: call.calleeId,
    kind: call.kind,
    status: call.status,
    createdAt: call.createdAt,
    peer,
  };
}

const callInclude = {
  caller: { select: { id: true, name: true, image: true } },
  callee: { select: { id: true, name: true, image: true } },
} as const;

async function canCallBetween(firstId: string, secondId: string) {
  const pair = canonicalFriendshipPair(firstId, secondId);
  const [friendship, block, activeResidents] = await Promise.all([
    db.friendship.findUnique({ where: { userLowId_userHighId: pair }, select: { userLowId: true } }),
    db.residentBlock.findFirst({
      where: {
        OR: [
          { blockerId: firstId, blockedId: secondId },
          { blockerId: secondId, blockedId: firstId },
        ],
      },
      select: { id: true },
    }),
    db.user.findMany({
      where: {
        id: { in: [firstId, secondId] },
        role: "RESIDENT",
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    }),
  ]);
  return Boolean(friendship && !block && activeResidents.length === 2);
}

export async function GET(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("callId");

  try {
    const now = new Date();
    await db.residentCallSession.updateMany({
      where: { status: "RINGING", expiresAt: { lte: now } },
      data: { status: "MISSED" },
    });
    await db.residentCallSession.updateMany({
      where: { status: "ACCEPTED", expiresAt: { lte: now } },
      data: { status: "ENDED" },
    });

    if (callId) {
      const call = await db.residentCallSession.findFirst({
        where: {
          id: callId,
          OR: [{ callerId: userId }, { calleeId: userId }],
        },
        include: {
          ...callInclude,
          signals: {
            where: { senderId: { not: userId } },
            orderBy: { createdAt: "asc" },
            take: SIGNAL_LIMIT,
            select: { id: true, senderId: true, kind: true, payload: true, createdAt: true },
          },
        },
      });
      if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });
      if (
        (call.status === "RINGING" || call.status === "ACCEPTED") &&
        !(await canCallBetween(call.callerId, call.calleeId))
      ) {
        await db.residentCallSession.updateMany({
          where: { id: call.id, status: { in: [...ACTIVE_STATUSES] } },
          data: { status: "ENDED", expiresAt: now },
        });
        return NextResponse.json({ error: "Call not found." }, { status: 404 });
      }
      return NextResponse.json({
        call: serializeCall(call, userId),
        signals: call.signals.map((signal) => ({
          ...signal,
          payload: JSON.parse(signal.payload) as Record<string, unknown>,
        })),
        iceServers: getIceServers(userId),
      });
    }

    const calls = await db.residentCallSession.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        expiresAt: { gt: now },
        OR: [{ callerId: userId }, { calleeId: userId }],
      },
      include: callInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const availableCalls = await Promise.all(
      calls.map(async (call) => {
        if (await canCallBetween(call.callerId, call.calleeId)) return call;
        await db.residentCallSession.updateMany({
          where: { id: call.id, status: { in: [...ACTIVE_STATUSES] } },
          data: { status: "ENDED", expiresAt: now },
        });
        return null;
      }),
    );
    return NextResponse.json({
      calls: availableCalls
        .filter((call) => call !== null)
        .map((call) => serializeCall(call, userId)),
      iceServers: getIceServers(userId),
    });
  } catch (error) {
    console.error("[resident-calls:read]", error);
    return NextResponse.json({ error: "Unable to load calls." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;

  try {
    const input = postSchema.parse(await request.json());
    const now = new Date();

    if (input.action === "start") {
      const conversation = await db.directConversation.findFirst({
        where: {
          id: input.conversationId,
          OR: [
            { participantLowId: userId, hiddenAtLow: null },
            { participantHighId: userId, hiddenAtHigh: null },
          ],
        },
        select: { id: true, participantLowId: true, participantHighId: true },
      });
      if (!conversation) {
        return NextResponse.json({ error: "Open a direct conversation before calling." }, { status: 404 });
      }
      const peerId = conversation.participantLowId === userId
        ? conversation.participantHighId
        : conversation.participantLowId;
      if (!(await canCallBetween(userId, peerId))) {
        return NextResponse.json({ error: "Calling is available to active friends only." }, { status: 403 });
      }

      await db.residentCallSession.updateMany({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          expiresAt: { lte: now },
          OR: [{ callerId: userId }, { calleeId: userId }],
        },
        data: { status: "ENDED" },
      });
      const activeCall = await db.residentCallSession.findFirst({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          expiresAt: { gt: now },
          OR: [
            { callerId: userId },
            { calleeId: userId },
            { callerId: peerId },
            { calleeId: peerId },
          ],
        },
        select: { id: true },
      });
      if (activeCall) {
        return NextResponse.json({ error: "You or this resident is already on a call." }, { status: 409 });
      }

      await db.residentCallSession.deleteMany({
        where: { createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60_000) } },
      });
      const call = await db.residentCallSession.create({
        data: {
          conversationId: conversation.id,
          callerId: userId,
          calleeId: peerId,
          kind: input.kind,
          expiresAt: new Date(now.getTime() + RING_TIMEOUT_MS),
        },
        include: callInclude,
      });
      return NextResponse.json({
        call: serializeCall(call, userId),
        iceServers: getIceServers(userId),
      }, { status: 201 });
    }

    const call = await db.residentCallSession.findFirst({
      where: {
        id: input.callId,
        OR: [{ callerId: userId }, { calleeId: userId }],
      },
      include: callInclude,
    });
    if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });
    const isCaller = call.callerId === userId;
    if (
      input.action !== "end" &&
      (call.status === "RINGING" || call.status === "ACCEPTED") &&
      !(await canCallBetween(call.callerId, call.calleeId))
    ) {
      await db.residentCallSession.updateMany({
        where: { id: call.id, status: { in: [...ACTIVE_STATUSES] } },
        data: { status: "ENDED", expiresAt: now },
      });
      return NextResponse.json({ error: "Calling is no longer available." }, { status: 403 });
    }

    if (input.action === "accept") {
      if (isCaller || call.status !== "RINGING" || call.expiresAt <= now) {
        return NextResponse.json({ error: "This call is no longer available." }, { status: 409 });
      }
      const updated = await db.residentCallSession.updateMany({
        where: { id: call.id, calleeId: userId, status: "RINGING", expiresAt: { gt: now } },
        data: {
          status: "ACCEPTED",
          expiresAt: new Date(now.getTime() + CALL_MAX_DURATION_MS),
        },
      });
      if (!updated.count) return NextResponse.json({ error: "This call is no longer available." }, { status: 409 });
    } else if (input.action === "decline") {
      if (isCaller || call.status !== "RINGING") {
        return NextResponse.json({ error: "This call cannot be declined." }, { status: 409 });
      }
      await db.residentCallSession.updateMany({
        where: { id: call.id, calleeId: userId, status: "RINGING" },
        data: { status: "DECLINED", expiresAt: now },
      });
    } else if (input.action === "end") {
      if (call.status !== "RINGING" && call.status !== "ACCEPTED") {
        return NextResponse.json({ error: "This call has already ended." }, { status: 409 });
      }
      await db.residentCallSession.updateMany({
        where: { id: call.id, OR: [{ callerId: userId }, { calleeId: userId }], status: { in: [...ACTIVE_STATUSES] } },
        data: { status: "ENDED", expiresAt: now },
      });
    } else {
      const signal = input.signal;
      const authorized =
        (signal.kind === "OFFER" && isCaller && (call.status === "RINGING" || call.status === "ACCEPTED")) ||
        (signal.kind === "ANSWER" && !isCaller && call.status === "ACCEPTED") ||
        (signal.kind === "ICE" && (call.status === "ACCEPTED" || (isCaller && call.status === "RINGING")));
      if (!authorized || call.expiresAt <= now) {
        return NextResponse.json({ error: "Call signaling is not available." }, { status: 409 });
      }
      const signalCount = await db.residentCallSignal.count({ where: { callId: call.id } });
      if (signalCount >= SIGNAL_LIMIT) {
        return NextResponse.json({ error: "The call has reached its signaling limit." }, { status: 429 });
      }
      await db.residentCallSignal.create({
        data: {
          callId: call.id,
          senderId: userId,
          kind: signal.kind,
          payload: JSON.stringify(signal.payload),
        },
      });
    }

    const updatedCall = await db.residentCallSession.findUnique({
      where: { id: call.id },
      include: callInclude,
    });
    return NextResponse.json({
      call: updatedCall ? serializeCall(updatedCall, userId) : null,
      iceServers: getIceServers(userId),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid call request." }, { status: 400 });
    }
    console.error("[resident-calls:write]", error);
    return NextResponse.json({ error: "Unable to update the call." }, { status: 500 });
  }
}
