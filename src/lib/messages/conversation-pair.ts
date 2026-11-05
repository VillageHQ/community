export function toConversationPair(firstMemberId: string, secondMemberId: string) {
  return firstMemberId < secondMemberId
    ? { memberLowId: firstMemberId, memberHighId: secondMemberId }
    : { memberLowId: secondMemberId, memberHighId: firstMemberId };
}

type ConversationPair = ReturnType<typeof toConversationPair>;

export function readPeerId({ memberLowId, memberHighId }: ConversationPair, memberId: string) {
  return memberLowId === memberId ? memberHighId : memberLowId;
}
