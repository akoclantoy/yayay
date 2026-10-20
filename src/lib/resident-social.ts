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
