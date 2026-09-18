const CACHE_NAME = 'kath-cft-v241';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: সব ফাইল ক্যাশে রাখো
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: পুরনো ক্যাশ মুছে দাও
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: আগে Network থেকে নাও, না পেলে Cache থেকে দাও
self.addEventListener('fetch', event => {
  // GET ছাড়া অন্য রিকোয়েস্ট (POST ইত্যাদি) ক্যাশ করার চেষ্টা করলে এরর হয়, তাই স্কিপ করো
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Network থেকে পেলে Cache-ও update করো
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Network না থাকলে Cache থেকে দাও
        return caches.match(event.request).then(cached => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
