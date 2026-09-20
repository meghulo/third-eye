/* ═══════════════════════════════════════════════
   Third Eye by Meghulo — Service Worker
   Cache-first strategy for offline support
   ═══════════════════════════════════════════════ */

const CACHE_NAME = 'thirdeye-v1.0.0';
const RUNTIME_CACHE = 'thirdeye-runtime-v1';

/* যে ফাইলগুলো প্রি-ক্যাশ হবে */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

/* ─── Install ─── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(PRECACHE_ASSETS).catch(err => {
          console.warn('[SW] Some assets failed to precache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

/* ─── Activate ─── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/* ─── Fetch ─── */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // শুধু GET রিকোয়েস্ট হ্যান্ডল করি
  if (req.method !== 'GET') return;

  // chrome-extension ইত্যাদি বাদ
  if (!req.url.startsWith('http')) return;

  // Google Fonts — cache-first
  if (req.url.includes('fonts.googleapis.com') || req.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // নেভিগেশন রিকোয়েস্ট — index.html fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // বাকি সব — cache-first, তারপর network
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // শুধু সফল রেসপন্স ক্যাশ করি
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() => {
        // ছবি হলে প্লেসহোল্ডার
        if (req.destination === 'image') {
          return caches.match('./icon-192.svg');
        }
      });
    })
  );
});

/* ─── মেসেজ হ্যান্ডল ─── */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    );
  }
});