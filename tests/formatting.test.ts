import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatDate,
  formatDateTime,
  formatNumber,
} from "../src/lib/utils";

describe("stable display formatting", () => {
  it("formats numbers with the same locale on server and client", () => {
    assert.equal(formatNumber(1234.56), "1,234.56");
  });

  it("formats dates with the application timezone", () => {
    const timestamp = "2026-06-14T18:00:00.000Z";

    assert.equal(formatDate(timestamp), "Jun 15, 2026");
    assert.equal(formatDateTime(timestamp), "Jun 15, 2026, 2:00 AM");
  });
});
