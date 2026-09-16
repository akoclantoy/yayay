import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getGcashRewardMetadata,
  sanitizeGcashNumber,
} from "../src/lib/gcash-redemption";

describe("GCash redemption helpers", () => {
  it("sanitizes a mobile number for GCash requests", () => {
    assert.equal(sanitizeGcashNumber("+63 917 123 4567"), "09171234567");
    assert.equal(sanitizeGcashNumber(" 0917-123-4567  "), "09171234567");
  });

  it("provides a fixed GCash reward identity for approval flows", () => {
    const reward = getGcashRewardMetadata();
    assert.equal(reward.name, "GCash Redemption");
    assert.equal(reward.imageUrl, "/gcash.svg");
    assert.equal(reward.type, "CASH");
  });
});
