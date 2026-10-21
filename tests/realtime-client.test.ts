import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  notifyRealtimeChanges,
  subscribeToRealtimeChanges,
} from "../src/lib/realtime-client";

describe("shared realtime notifications", () => {
  it("notifies subscribers when a database change arrives", () => {
    let notifications = 0;
    const unsubscribe = subscribeToRealtimeChanges(() => {
      notifications += 1;
    });

    notifyRealtimeChanges();
    unsubscribe();

    assert.equal(notifications, 1);
  });

  it("stops notifying after a subscriber unsubscribes", () => {
    let notifications = 0;
    const unsubscribe = subscribeToRealtimeChanges(() => {
      notifications += 1;
    });
    unsubscribe();

    notifyRealtimeChanges();

    assert.equal(notifications, 0);
  });
});
