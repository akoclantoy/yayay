import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldUseMockAuth } from "../src/lib/mock-auth";

const originalMockAuth = process.env.MOCK_AUTH;

afterEach(() => {
  if (originalMockAuth === undefined) {
    delete process.env.MOCK_AUTH;
  } else {
    process.env.MOCK_AUTH = originalMockAuth;
  }
});

describe("mock authentication configuration", () => {
  it("is disabled by default in development", () => {
    delete process.env.MOCK_AUTH;
    assert.equal(shouldUseMockAuth(), false);
  });

  it("is enabled only when explicitly requested", () => {
    process.env.MOCK_AUTH = "true";
    assert.equal(shouldUseMockAuth(), true);

    process.env.MOCK_AUTH = "false";
    assert.equal(shouldUseMockAuth(), false);
  });
});
