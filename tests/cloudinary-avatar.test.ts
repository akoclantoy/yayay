import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/media/cloudinary-avatar/route";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Cloudinary avatar proxy", () => {
  it("rejects URLs outside the Cloudinary image host", async () => {
    const url = new URL("https://app.test/api/media/cloudinary-avatar");
    url.searchParams.set("url", "https://example.com/avatar.jpg");

    const response = await GET(new Request(url));

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Unsupported image URL" });
  });

  it("serves validated images with cache headers", async () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "test-cloud";
    const imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/v123/community-recycling/resident-avatars/test.jpg`;
    const url = new URL("https://app.test/api/media/cloudinary-avatar");
    url.searchParams.set("url", imageUrl);
    globalThis.fetch = async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/jpeg", "content-length": "3" },
      });

    const response = await GET(new Request(url));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.match(response.headers.get("cache-control") ?? "", /max-age=86400/);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  });
});
