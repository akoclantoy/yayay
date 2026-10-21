import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { changePasswordSchema } from "../src/lib/validators/auth";

describe("change password validation", () => {
  it("accepts the current password and a confirmed strong new password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Current123",
      newPassword: "NewPassword123",
      confirmPassword: "NewPassword123",
    });

    assert.equal(result.success, true);
  });

  it("rejects a missing current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "NewPassword123",
      confirmPassword: "NewPassword123",
    });

    assert.equal(result.success, false);
  });

  it("rejects a mismatched confirmation", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Current123",
      newPassword: "NewPassword123",
      confirmPassword: "DifferentPassword123",
    });

    assert.equal(result.success, false);
  });

  it("requires the same strength as account registration", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Current123",
      newPassword: "newpassword",
      confirmPassword: "newpassword",
    });

    assert.equal(result.success, false);
  });
});
