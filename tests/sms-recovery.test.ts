import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createRecoveryCode,
  createResetToken,
  hashRecoveryValue,
  isSmsRecoveryConfigured,
  normalizePhilippinePhone,
  recoveryValuesMatch,
  sendRecoverySms,
} from "../src/lib/sms-recovery";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  createStaffSchema,
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

  it("uses SMS_API_KEY directly when the private SMS service settings are missing", async () => {
    const previousUrl = process.env.SMS_SERVICE_URL;
    const previousToken = process.env.SMS_SERVICE_TOKEN;
    const previousApiKey = process.env.SMS_API_KEY;
    const originalFetch = globalThis.fetch;
    delete process.env.SMS_SERVICE_URL;
    delete process.env.SMS_SERVICE_TOKEN;
    delete process.env.SMS_API_KEY;

    try {
      assert.equal(isSmsRecoveryConfigured(), false);
      process.env.SMS_API_KEY = "test-api-key";
      assert.equal(isSmsRecoveryConfigured(), true);

      let requestedUrl = "";
      let requestedBody = "";
      globalThis.fetch = async (input, init) => {
        requestedUrl = String(input);
        requestedBody = String(init?.body);
        return Response.json([{ status: "queued" }]);
      };

      await sendRecoverySms("+639171234567", "Test recovery code");
      assert.equal(requestedUrl, "https://api.semaphore.co/api/v4/messages");
      const params = new URLSearchParams(requestedBody);
      assert.equal(params.get("apikey"), "test-api-key");
      assert.equal(params.get("number"), "+639171234567");
      assert.equal(params.get("message"), "Test recovery code");

      globalThis.fetch = async () => Response.json([{ status: "failed" }]);
      await assert.rejects(
        sendRecoverySms("+639171234567", "Test recovery code"),
        /SMS provider did not accept the recovery message/,
      );
    } finally {
      globalThis.fetch = originalFetch;
      if (previousUrl === undefined) delete process.env.SMS_SERVICE_URL;
      else process.env.SMS_SERVICE_URL = previousUrl;
      if (previousToken === undefined) delete process.env.SMS_SERVICE_TOKEN;
      else process.env.SMS_SERVICE_TOKEN = previousToken;
      if (previousApiKey === undefined) delete process.env.SMS_API_KEY;
      else process.env.SMS_API_KEY = previousApiKey;
    }
  });

  it("prefers SMS_API_KEY over private service settings and accepts sent responses", async () => {
    const previousUrl = process.env.SMS_SERVICE_URL;
    const previousToken = process.env.SMS_SERVICE_TOKEN;
    const previousApiKey = process.env.SMS_API_KEY;
    const originalFetch = globalThis.fetch;
    process.env.SMS_SERVICE_URL = "http://sms-service.internal:10000";
    process.env.SMS_SERVICE_TOKEN = "test-service-token";
    process.env.SMS_API_KEY = "test-api-key";

    try {
      let requestedUrl = "";
      globalThis.fetch = async (input) => {
        requestedUrl = String(input);
        return Response.json([{ status: "Sent" }]);
      };

      await sendRecoverySms("+639171234567", "Test recovery code");
      assert.equal(requestedUrl, "https://api.semaphore.co/api/v4/messages");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousUrl === undefined) delete process.env.SMS_SERVICE_URL;
      else process.env.SMS_SERVICE_URL = previousUrl;
      if (previousToken === undefined) delete process.env.SMS_SERVICE_TOKEN;
      else process.env.SMS_SERVICE_TOKEN = previousToken;
      if (previousApiKey === undefined) delete process.env.SMS_API_KEY;
      else process.env.SMS_API_KEY = previousApiKey;
    }
  });

  it("uses the private SMS service when its token is configured without an API key", async () => {
    const previousUrl = process.env.SMS_SERVICE_URL;
    const previousToken = process.env.SMS_SERVICE_TOKEN;
    const previousApiKey = process.env.SMS_API_KEY;
    const originalFetch = globalThis.fetch;
    process.env.SMS_SERVICE_URL = "http://sms-service.internal:10000";
    process.env.SMS_SERVICE_TOKEN = "test-service-token";
    delete process.env.SMS_API_KEY;

    try {
      let requestedUrl = "";
      let authorization = "";
      globalThis.fetch = async (input, init) => {
        requestedUrl = String(input);
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        return new Response(null, { status: 202 });
      };

      await sendRecoverySms("+639171234567", "Test recovery code");
      assert.equal(requestedUrl, "http://sms-service.internal:10000/sms");
      assert.equal(authorization, "Bearer test-service-token");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousUrl === undefined) delete process.env.SMS_SERVICE_URL;
      else process.env.SMS_SERVICE_URL = previousUrl;
      if (previousToken === undefined) delete process.env.SMS_SERVICE_TOKEN;
      else process.env.SMS_SERVICE_TOKEN = previousToken;
      if (previousApiKey === undefined) delete process.env.SMS_API_KEY;
      else process.env.SMS_API_KEY = previousApiKey;
    }
  });

  it("requires email and password for sign-in, but only requires phone for recovery", () => {
    const phone = "+63 917 123 4567";
    assert.equal(loginSchema.safeParse({ email: "resident@example.com", password: "password123" }).success, true);
    assert.equal(loginSchema.safeParse({ email: "", password: "password123" }).success, false);
    const registration = {
      name: "Resident",
      email: "resident@example.com",
      password: "Password123",
      confirmPassword: "Password123",
    };
    assert.equal(registerSchema.safeParse({ ...registration, phone }).success, true);
    assert.equal(registerSchema.safeParse(registration).success, true);
    const staff = {
      name: "Staff Member",
      email: "staff@example.com",
      password: "Password123",
      confirmPassword: "Password123",
    };
    assert.equal(createStaffSchema.safeParse({ ...staff, phone }).success, true);
    assert.equal(createStaffSchema.safeParse(staff).success, true);
    assert.equal(forgotPasswordSchema.safeParse({ identifier: "resident@example.com", phone }).success, true);
    assert.equal(forgotPasswordSchema.safeParse({ identifier: "ab", phone }).success, false);
    assert.equal(forgotPasswordSchema.safeParse({ identifier: "resident@example.com" }).success, false);
  });

  it("validates the six-digit OTP", () => {
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
