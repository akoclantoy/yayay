import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { canonicalFriendshipPair } from "@/lib/resident-social";
import { sendPushToUsers } from "@/lib/push-notifications";

const requestSchema = z.object({
  qrCode: z.string().trim().min(1).max(200),
  connection: z.enum(["REQUEST", "QR_SCAN"]).default("REQUEST"),
});
const updateSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["ACCEPT", "DECLINE"]),
});

export async function GET(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;
  const { searchParams } = new URL(request.url);
  const qrCode = searchParams.get("qr")?.trim();
  const directory = searchParams.get("directory") === "1";

  try {
    if (directory) {
      const query = searchParams.get("search")?.trim() ?? "";
      const page = Math.max(0, Number.parseInt(searchParams.get("page") ?? "0", 10) || 0);
      const pageSize = 30;
      const blocks = await db.residentBlock.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      });
      const blockedIds = blocks.map((block) =>
        block.blockerId === userId ? block.blockedId : block.blockerId,
      );
      const where = {
        id: blockedIds.length
          ? { notIn: [userId, ...blockedIds] }
          : { not: userId },
        isActive: true,
        role: "RESIDENT" as const,
        residentProfile: { isNot: null },
        ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
      };
      const [residents, total] = await Promise.all([
        db.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            image: true,
            residentProfile: { select: { qrCode: true } },
          },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: page * pageSize,
          take: pageSize,
        }),
        db.user.count({ where }),
      ]);
      const residentIds = residents.map((resident) => resident.id);
      const [friendships, requests, conversations, myFriendships] = await Promise.all([
        residentIds.length
          ? db.friendship.findMany({
              where: {
                OR: [
                  { userLowId: userId, userHighId: { in: residentIds } },
                  { userHighId: userId, userLowId: { in: residentIds } },
                ],
              },
              select: { userLowId: true, userHighId: true },
            })
          : Promise.resolve([]),
        residentIds.length
          ? db.friendRequest.findMany({
              where: {
                status: "PENDING",
                OR: [
                  { senderId: userId, recipientId: { in: residentIds } },
                  { recipientId: userId, senderId: { in: residentIds } },
                ],
              },
              select: { id: true, senderId: true, recipientId: true },
            })
          : Promise.resolve([]),
        residentIds.length
          ? db.directConversation.findMany({
              where: {
                OR: [
                  { participantLowId: userId, participantHighId: { in: residentIds } },
                  { participantHighId: userId, participantLowId: { in: residentIds } },
                ],
              },
              select: { id: true, participantLowId: true, participantHighId: true },
            })
          : Promise.resolve([]),
        db.friendship.findMany({
          where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
          select: { userLowId: true, userHighId: true },
        }),
      ]);
      const friendIds = new Set(friendships.map((friendship) =>
        friendship.userLowId === userId ? friendship.userHighId : friendship.userLowId,
      ));
      const friendRequestByPeer = new Map(requests.map((friendRequest) => [
        friendRequest.senderId === userId ? friendRequest.recipientId : friendRequest.senderId,
        friendRequest,
      ]));
      const conversationByPeer = new Map(conversations.map((conversation) => [
        conversation.participantLowId === userId
          ? conversation.participantHighId
          : conversation.participantLowId,
        conversation.id,
      ]));
      const myFriendIds = myFriendships.map((friendship) =>
        friendship.userLowId === userId ? friendship.userHighId : friendship.userLowId,
      );
      const myFriendIdSet = new Set(myFriendIds);
      const residentIdSet = new Set(residentIds);
      const otherFriendships = myFriendIds.length && residentIds.length
        ? await db.friendship.findMany({
            where: {
              OR: [
                { userLowId: { in: myFriendIds }, userHighId: { in: residentIds } },
                { userHighId: { in: myFriendIds }, userLowId: { in: residentIds } },
              ],
            },
            select: { userLowId: true, userHighId: true },
          })
        : [];
      const mutualCounts = new Map<string, number>();
      for (const friendship of otherFriendships) {
        if (
          residentIdSet.has(friendship.userLowId) &&
          myFriendIdSet.has(friendship.userHighId)
        ) {
          mutualCounts.set(
            friendship.userLowId,
            (mutualCounts.get(friendship.userLowId) ?? 0) + 1,
          );
        }
        if (
          residentIdSet.has(friendship.userHighId) &&
          myFriendIdSet.has(friendship.userLowId)
        ) {
          mutualCounts.set(
            friendship.userHighId,
            (mutualCounts.get(friendship.userHighId) ?? 0) + 1,
          );
        }
      }

      return NextResponse.json({
        residents: residents.map((resident) => {
          const friendRequest = friendRequestByPeer.get(resident.id);
          return {
            id: resident.id,
            name: resident.name,
            image: resident.image,
            qrCode: resident.residentProfile?.qrCode,
            isFriend: friendIds.has(resident.id),
            outgoingRequest: friendRequest?.senderId === userId ? friendRequest.id : null,
            incomingRequest: friendRequest?.recipientId === userId ? friendRequest.id : null,
            conversationId: conversationByPeer.get(resident.id) ?? null,
            mutualCount: mutualCounts.get(resident.id) ?? 0,
          };
        }),
        page,
        total,
        hasMore: (page + 1) * pageSize < total,
      });
    }

    if (qrCode) {
      const profile = await db.residentProfile.findUnique({
        where: { qrCode },
        select: {
          qrCode: true,
          user: {
            select: { id: true, name: true, image: true, isActive: true, role: true },
          },
        },
      });
      if (!profile || !profile.user.isActive || profile.user.role !== "RESIDENT") {
        return NextResponse.json({ error: "Resident not found" }, { status: 404 });
      }
      if (profile.user.id === userId) {
        return NextResponse.json({ error: "This is your own QR code" }, { status: 400 });
      }
      const block = await db.residentBlock.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: profile.user.id },
            { blockerId: profile.user.id, blockedId: userId },
          ],
        },
        select: { id: true },
      });
      if (block) return NextResponse.json({ error: "Resident not found" }, { status: 404 });

      const pair = canonicalFriendshipPair(userId, profile.user.id);
      const [friendship, outgoingRequest, incomingRequest] = await Promise.all([
        db.friendship.findUnique({ where: { userLowId_userHighId: pair } }),
        db.friendRequest.findUnique({
          where: { senderId_recipientId: { senderId: userId, recipientId: profile.user.id } },
        }),
        db.friendRequest.findUnique({
          where: { senderId_recipientId: { senderId: profile.user.id, recipientId: userId } },
        }),
      ]);
      const mutualFriends = await db.friendship.findMany({
            where: {
              OR: [
                { userLowId: userId },
                { userHighId: userId },
              ],
            },
            select: { userLowId: true, userHighId: true },
          }).then(async (currentFriends) => {
            const currentIds = currentFriends.map((item) =>
              item.userLowId === userId ? item.userHighId : item.userLowId,
            );
            const targetFriends = await db.friendship.findMany({
              where: {
                OR: [
                  { userLowId: profile.user.id },
                  { userHighId: profile.user.id },
                ],
              },
              select: { userLowId: true, userHighId: true },
            });
            const targetIds = new Set(targetFriends.map((item) =>
              item.userLowId === profile.user.id ? item.userHighId : item.userLowId,
            ));
            const ids = currentIds.filter((id) => targetIds.has(id));
            const users = await db.user.findMany({
              where: { id: { in: ids }, isActive: true },
              select: { id: true, name: true, image: true },
            });
            return users;
          });

      return NextResponse.json({
        profile: {
          id: profile.user.id,
          name: profile.user.name,
          image: profile.user.image,
          qrCode: profile.qrCode,
          isFriend: Boolean(friendship),
          outgoingRequest: outgoingRequest?.status === "PENDING" ? outgoingRequest.id : null,
          incomingRequest: incomingRequest?.status === "PENDING" ? incomingRequest.id : null,
          mutualFriends,
        },
      });
    }

    const [ownProfile, friendships, incomingRequests, outgoingRequests, blocks] = await Promise.all([
      db.residentProfile.findUnique({
        where: { userId },
        select: { qrCode: true, user: { select: { name: true, image: true } } },
      }),
      db.friendship.findMany({
        where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
        include: {
          userLow: {
            select: { id: true, name: true, image: true, isActive: true, residentProfile: { select: { qrCode: true } } },
          },
          userHigh: {
            select: { id: true, name: true, image: true, isActive: true, residentProfile: { select: { qrCode: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.friendRequest.findMany({
        where: { recipientId: userId, status: "PENDING", sender: { isActive: true } },
        include: {
          sender: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.friendRequest.findMany({
        where: { senderId: userId, status: "PENDING", recipient: { isActive: true } },
        include: {
          recipient: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.residentBlock.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: {
          blockerId: true,
          blockedId: true,
          blocked: {
            select: { id: true, name: true, image: true, isActive: true, role: true },
          },
        },
      }),
    ]);
    const blockedIds = new Set(blocks.map((block) =>
      block.blockerId === userId ? block.blockedId : block.blockerId,
    ));

    return NextResponse.json({
      ownProfile,
      friends: friendships
        .map(({ userLow, userHigh, createdAt }) => {
          const friend = userLow.id === userId ? userHigh : userLow;
          return friend.isActive && !blockedIds.has(friend.id)
            ? { id: friend.id, name: friend.name, image: friend.image, qrCode: friend.residentProfile?.qrCode, createdAt }
            : null;
        })
        .filter((friend) => friend !== null),
      incomingRequests: incomingRequests.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        resident: item.sender,
      })),
      outgoingRequests: outgoingRequests.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        resident: item.recipient,
      })),
      blockedResidents: blocks
        .filter((block) =>
          block.blockerId === userId &&
          block.blocked.isActive &&
          block.blocked.role === "RESIDENT",
        )
        .map((block) => ({
          id: block.blocked.id,
          name: block.blocked.name,
          image: block.blocked.image,
        })),
    });
  } catch (error) {
    console.error("Failed to load resident friends", error);
    return NextResponse.json({ error: "Unable to load friends" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;

  try {
    const { qrCode, connection } = requestSchema.parse(await request.json());
    const target = await db.residentProfile.findUnique({
      where: { qrCode },
      select: { userId: true, user: { select: { name: true, isActive: true, role: true } } },
    });
    if (!target || !target.user.isActive || target.user.role !== "RESIDENT") {
      return NextResponse.json({ error: "Resident not found" }, { status: 404 });
    }
    if (target.userId === userId) {
      return NextResponse.json({ error: "You cannot add yourself" }, { status: 400 });
    }
    const block = await db.residentBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: target.userId },
          { blockerId: target.userId, blockedId: userId },
        ],
      },
      select: { id: true },
    });
    if (block) return NextResponse.json({ error: "Resident not found" }, { status: 404 });

    const pair = canonicalFriendshipPair(userId, target.userId);
    const friendship = await db.friendship.findUnique({ where: { userLowId_userHighId: pair } });
    if (friendship) {
      return NextResponse.json({
        isFriend: true,
        connectedNow: false,
        friend: { id: target.userId, name: target.user.name },
      });
    }

    if (connection === "QR_SCAN") {
      await db.$transaction(async (tx) => {
        await tx.friendship.upsert({
          where: { userLowId_userHighId: pair },
          create: pair,
          update: {},
        });
        await tx.friendRequest.updateMany({
          where: {
            status: "PENDING",
            OR: [
              { senderId: userId, recipientId: target.userId },
              { senderId: target.userId, recipientId: userId },
            ],
          },
          data: { status: "ACCEPTED" },
        });
        await tx.notification.create({
          data: {
            userId: target.userId,
            title: "Your Friend Together",
            message: `You and ${authResult.session.user.name ?? "a resident"} connected by QR code. Say hello in your messages!`,
            type: "friend_request",
            link: `/resident/messages?friendId=${encodeURIComponent(userId)}`,
          },
        });
      });
      void sendPushToUsers(target.userId, {
        title: "Your Friend Together",
        body: `You and ${authResult.session.user.name ?? "a resident"} connected by QR code. Say hello in your messages!`,
        url: `/resident/messages?friendId=${encodeURIComponent(userId)}`,
        tag: `friend-connected-${userId}`,
      }).catch((error: unknown) => {
        console.error("[resident-friends] Failed to send QR connection alert:", error);
      });
      return NextResponse.json({
        isFriend: true,
        connectedNow: true,
        friend: { id: target.userId, name: target.user.name },
      }, { status: 201 });
    }

    const incoming = await db.friendRequest.findUnique({
      where: { senderId_recipientId: { senderId: target.userId, recipientId: userId } },
    });
    if (incoming?.status === "PENDING") {
      return NextResponse.json({ error: "This resident already sent you a request", requestId: incoming.id }, { status: 409 });
    }

    const existing = await db.friendRequest.findUnique({
      where: { senderId_recipientId: { senderId: userId, recipientId: target.userId } },
    });
    const friendRequest = existing
      ? await db.friendRequest.update({
          where: { id: existing.id },
          data: { status: "PENDING" },
        })
      : await db.friendRequest.create({
          data: { senderId: userId, recipientId: target.userId },
        });

    await db.notification.create({
      data: {
        userId: target.userId,
        title: "New friend request",
        message: `${authResult.session.user.name ?? "A resident"} sent you a friend request.`,
        type: "friend_request",
        link: "/resident/messages",
      },
    });
    void sendPushToUsers(target.userId, {
      title: "New friend request",
      body: `${authResult.session.user.name ?? "A resident"} sent you a friend request.`,
      url: "/resident/messages",
      tag: `friend-request-${userId}`,
    }).catch((error: unknown) => {
      console.error("[resident-friends] Failed to send friend request alert:", error);
    });
    return NextResponse.json({ requestId: friendRequest.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to send resident friend request", error);
    return NextResponse.json({ error: "Unable to send friend request" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;

  try {
    const { requestId, action } = updateSchema.parse(await request.json());
    const friendRequest = await db.friendRequest.findFirst({
      where: { id: requestId, recipientId: userId, status: "PENDING" },
      select: { id: true, senderId: true },
    });
    if (!friendRequest) return NextResponse.json({ error: "Pending request not found" }, { status: 404 });

    if (action === "DECLINE") {
      await db.friendRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED" },
      });
      return NextResponse.json({ success: true });
    }

    await db.$transaction(async (tx) => {
      const updated = await tx.friendRequest.updateMany({
        where: { id: requestId, recipientId: userId, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });
      if (!updated.count) throw new Error("REQUEST_ALREADY_HANDLED");
      const pair = canonicalFriendshipPair(userId, friendRequest.senderId);
      await tx.friendship.upsert({
        where: { userLowId_userHighId: pair },
        create: pair,
        update: {},
      });
      await tx.notification.create({
        data: {
          userId: friendRequest.senderId,
          title: "Friend request accepted",
          message: `${authResult.session.user.name ?? "A resident"} accepted your friend request.`,
          type: "friend_request",
          link: "/resident/messages",
        },
      });
    });
    void sendPushToUsers(friendRequest.senderId, {
      title: "Friend request accepted",
      body: `${authResult.session.user.name ?? "A resident"} accepted your friend request.`,
      url: "/resident/messages",
      tag: `friend-accepted-${userId}`,
    }).catch((error: unknown) => {
      console.error("[resident-friends] Failed to send acceptance alert:", error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && error.message === "REQUEST_ALREADY_HANDLED") {
      return NextResponse.json({ error: "This request was already handled" }, { status: 409 });
    }
    console.error("Failed to update resident friend request", error);
    return NextResponse.json({ error: "Unable to update friend request" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.session.user.id;

  try {
    const { requestId } = z.object({ requestId: z.string().min(1) }).parse(await request.json());
    const updated = await db.friendRequest.updateMany({
      where: { id: requestId, senderId: userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (!updated.count) return NextResponse.json({ error: "Pending request not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to cancel resident friend request", error);
    return NextResponse.json({ error: "Unable to cancel friend request" }, { status: 500 });
  }
}
