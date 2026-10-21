const RESIDENT_QR_MESSAGE_PREFIX = "ecorewards:resident-qr:";

export function createResidentQrMessage(qrCode: string) {
  return `${RESIDENT_QR_MESSAGE_PREFIX}${qrCode}`;
}

export function getSharedResidentQrCode(content: string) {
  return content.startsWith(RESIDENT_QR_MESSAGE_PREFIX)
    ? content.slice(RESIDENT_QR_MESSAGE_PREFIX.length)
    : null;
}

export function canonicalFriendshipPair(firstId: string, secondId: string) {
  const [userLowId, userHighId] = firstId < secondId
    ? [firstId, secondId]
    : [secondId, firstId];
  return { userLowId, userHighId };
}

export function canonicalDirectConversationPair(firstId: string, secondId: string) {
  const [participantLowId, participantHighId] = firstId < secondId
    ? [firstId, secondId]
    : [secondId, firstId];
  return { participantLowId, participantHighId };
}

export function hasUnreadMessage({
  senderId,
  residentId,
  messageCreatedAt,
  readAt,
}: {
  senderId: string;
  residentId: string;
  messageCreatedAt: Date;
  readAt: Date | null;
}) {
  return senderId !== residentId && (!readAt || messageCreatedAt > readAt);
}
