self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? "" };
  }

  const title = typeof payload.title === "string" ? payload.title : "EcoRewards";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new update.",
    icon: "/push-notification-icon.svg",
    badge: "/push-notification-icon.svg",
    tag: typeof payload.tag === "string" ? payload.tag : "ecorewards-notification",
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    data: { url: typeof payload.url === "string" ? payload.url : "/resident/notifications" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url ?? "/resident/notifications", self.location.origin);
  const target = destination.origin === self.location.origin ? destination.href : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && new URL(client.url).origin === self.location.origin) {
          return client.navigate(target).then(() => client.focus());
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
