import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalDirectConversationPair,
  canonicalFriendshipPair,
} from "../src/lib/resident-social";

describe("resident social pair keys", () => {
  it("uses the same friendship key regardless of participant order", () => {
    assert.deepEqual(canonicalFriendshipPair("resident-b", "resident-a"), {
      userLowId: "resident-a",
      userHighId: "resident-b",
    });
    assert.deepEqual(canonicalFriendshipPair("resident-a", "resident-b"), {
      userLowId: "resident-a",
      userHighId: "resident-b",
    });
  });

  it("uses the same direct conversation key regardless of participant order", () => {
    assert.deepEqual(canonicalDirectConversationPair("resident-b", "resident-a"), {
      participantLowId: "resident-a",
      participantHighId: "resident-b",
    });
    assert.deepEqual(canonicalDirectConversationPair("resident-a", "resident-b"), {
      participantLowId: "resident-a",
      participantHighId: "resident-b",
    });
  });
});
