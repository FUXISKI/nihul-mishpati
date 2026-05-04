/* עבודה ללא רשת אחרי ביקור ראשון — רק כשהאתר נפתח מכתובת https (לא מקובץ מקומי) */
const CACHE = 'nihul-mishpati-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((res) => {
            try {
              if (res && res.status === 200 && res.type === 'basic')
                cache.put(event.request, res.clone());
            } catch (_) {}
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});
