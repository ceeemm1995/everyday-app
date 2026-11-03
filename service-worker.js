const CACHE_NAME = "everyday-v03";

const STATIC_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest"
];

// INSTALL SERVICE WORKER
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_FILES);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error("Service worker installation failed:", error);
        throw error;
      })
  );
});

// ACTIVATE SERVICE WORKER
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// FETCH AND CACHE REQUESTS
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Ignore non-HTTP/HTTPS requests
  if (!["http:", "https:"].includes(url.protocol)) {
    return;
  }

  // Ignore cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Bypass Supabase API and authentication routes
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.includes("/auth/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached response when available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise, fetch from the network
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful same-origin responses
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {
              const responseToCache = networkResponse.clone();

              caches.open(CACHE_NAME)
                .then((cache) => {
                  return cache.put(request, responseToCache);
                })
                .catch((error) => {
                  console.error("Caching failed:", error);
                });
            }

            return networkResponse;
          })
          .catch((error) => {
            console.error("Network request failed:", error);

            // Provide offline fallback for navigation requests
            if (request.mode === "navigate") {
              return caches.match("./index.html");
            }

            // Return an appropriate offline response
            return new Response("You are currently offline.", {
              status: 503,
              statusText: "Service Unavailable",
              headers: {
                "Content-Type": "text/plain"
              }
            });
          });
      })
  );
});
