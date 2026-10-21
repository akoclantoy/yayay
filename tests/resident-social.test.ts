import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalDirectConversationPair,
  canonicalFriendshipPair,
  createResidentQrMessage,
  getSharedResidentQrCode,
  hasUnreadMessage,
} from "../src/lib/resident-social";

describe("resident social pair keys", () => {
  it("uses the same friendship key regardless of participant order", () => {
    assert.deepEqual(canonicalFriendshipPair("resident-b", "resident-a"), {
      userLowId: "resident-a",
      userHighId: "resident-b",
    });

    describe("resident QR messages", () => {
      it("round-trips a resident QR code and ignores ordinary text", () => {
        const message = createResidentQrMessage("resident-qr-code");
        assert.equal(getSharedResidentQrCode(message), "resident-qr-code");
        assert.equal(getSharedResidentQrCode("A regular message"), null);
      });
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

  it("marks an incoming message unread until the resident reads it", () => {
    const messageCreatedAt = new Date("2026-10-21T00:00:00.000Z");
    assert.equal(hasUnreadMessage({
      senderId: "friend",
      residentId: "resident",
      messageCreatedAt,
      readAt: null,
    }), true);
    assert.equal(hasUnreadMessage({
      senderId: "friend",
      residentId: "resident",
      messageCreatedAt,
      readAt: new Date("2026-10-21T00:00:01.000Z"),
    }), false);
    assert.equal(hasUnreadMessage({
      senderId: "resident",
      residentId: "resident",
      messageCreatedAt,
      readAt: null,
    }), false);
  });
});
