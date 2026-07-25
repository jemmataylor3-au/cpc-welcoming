// Service worker for CPC Welcoming — handles incoming push notifications.
// Must live at the site root (/sw.js) so its scope covers the whole app.

self.addEventListener("push", (event) => {
  let data = { title: "CPC Welcoming", body: "You have a new notification." };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // Fall back to default text if the payload isn't valid JSON.
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Tapping the notification opens (or focuses) the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
