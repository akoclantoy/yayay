import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createRecoveryCode,
  createResetToken,
  hashRecoveryValue,
  normalizePhilippinePhone,
  recoveryValuesMatch,
} from "../src/lib/sms-recovery";
import {
  forgotPasswordSchema,
  resetRecoveredPasswordSchema,
  verifyRecoveryOtpSchema,
} from "../src/lib/validators/auth";

process.env.AUTH_SECRET = "sms-recovery-test-secret";

describe("SMS recovery security helpers", () => {
  it("generates six-digit codes and cryptographically random reset tokens", () => {
    assert.match(createRecoveryCode(), /^\d{6}$/);
    assert.match(createResetToken(), /^[a-f0-9]{64}$/);
  });

  it("stores verifiable hashes instead of recovery values", () => {
    const hash = hashRecoveryValue("code:123456");
    assert.notEqual(hash, "code:123456");
    assert.equal(recoveryValuesMatch("code:123456", hash), true);
    assert.equal(recoveryValuesMatch("code:123457", hash), false);
  });

  it("normalizes Philippine mobile numbers and rejects invalid phone values", () => {
    assert.equal(normalizePhilippinePhone("09171234567"), "+639171234567");
    assert.equal(normalizePhilippinePhone("+639171234567"), "+639171234567");
    assert.equal(normalizePhilippinePhone("not a phone"), null);
    assert.equal(normalizePhilippinePhone(null), null);
  });

  it("validates the account identifier and six-digit OTP", () => {
    assert.equal(forgotPasswordSchema.safeParse({ identifier: "resident@example.com" }).success, true);
    assert.equal(forgotPasswordSchema.safeParse({ identifier: "ab" }).success, false);
    assert.equal(verifyRecoveryOtpSchema.safeParse({ challengeId: "challenge", code: "123456" }).success, true);
    assert.equal(verifyRecoveryOtpSchema.safeParse({ challengeId: "challenge", code: "12345" }).success, false);
  });

  it("requires matching new passwords and a verified recovery token shape", () => {
    const valid = {
      challengeId: "challenge",
      resetToken: "a".repeat(64),
      password: "new-password",
      confirmPassword: "new-password",
    };
    assert.equal(resetRecoveredPasswordSchema.safeParse(valid).success, true);
    assert.equal(resetRecoveredPasswordSchema.safeParse({ ...valid, confirmPassword: "different" }).success, false);
  });
});
