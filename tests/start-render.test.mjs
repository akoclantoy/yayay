import test from "node:test";
import assert from "node:assert/strict";

import { assertRenderRuntimeConfig } from "../scripts/start-render.mjs";

test("production startup requires a valid database url", () => {
  assert.throws(
    () =>
      assertRenderRuntimeConfig({
        RENDER: "true",
        NODE_ENV: "production",
        PORT: "3000",
        AUTH_SECRET: "test-secret",
        NEXTAUTH_URL: "https://example.onrender.com",
      }),
    /DATABASE_URL/
  );
});

test("production startup accepts valid render config", () => {
  assert.doesNotThrow(() =>
    assertRenderRuntimeConfig({
      RENDER: "true",
      NODE_ENV: "production",
      PORT: "3000",
      AUTH_SECRET: "test-secret",
      NEXTAUTH_URL: "https://example.onrender.com",
      DATABASE_URL: "mysql://user:pass@db.example.com:3306/ecorewards",
    })
  );
});
