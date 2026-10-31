const CACHE_NAME = 'kath-cft-v282';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ইন্টারনেট ধীর/আটকে গেলে এত মিলিসেকেন্ড পর ফোনে সেভ করা (cache) ফাইল দিয়েই অ্যাপ খুলবে
const NETWORK_TIMEOUT_MS = 3000;

// Install: সব ফাইল ক্যাশে রাখো (একটা ফাইল না পেলেও বাকিগুলো সেভ হবে, install ফেল করবে না)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(ASSETS.map(url => cache.add(url).catch(() => null)))
    )
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

// Fetch: আগে Network, তবে ধীর হলে (৩ সেকেন্ডের বেশি) Cache থেকে দাও
self.addEventListener('fetch', event => {
  const req = event.request;

  // GET ছাড়া অন্য রিকোয়েস্ট (POST ইত্যাদি) এখানে হাত দেওয়া হবে না
  if (req.method !== 'GET') return;

  // অন্য সাইটের রিকোয়েস্ট (Firebase, Google Fonts ইত্যাদি) ব্রাউজারই সামলাবে —
  // সার্ভিস ওয়ার্কার মাঝখানে থেকে আটকে রাখবে না
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(handle(req, event));
});

async function handle(req, event) {
  const networkPromise = fetch(req).then(response => {
    // শুধু সফল (200) রেসপন্স ক্যাশে রাখো
    if (response && response.status === 200 && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => null)
      );
    }
    return response;
  });

  const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));

  try {
    // নেটওয়ার্ক সময়মতো এলে সেটাই, না এলে null
    const first = await Promise.race([networkPromise, timeoutPromise]);
    if (first) return first;

    // ধীর নেট: ক্যাশে থাকলে সাথে সাথে সেটা দাও
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const page = await caches.match('./index.html');
      if (page) return page;
    }
    // ক্যাশে কিছু নেই — নেটওয়ার্কের জন্য অপেক্ষা করো
    return await networkPromise;
  } catch (e) {
    // নেট নেই / ব্যর্থ: ক্যাশ থেকে দাও
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const page = await caches.match('./index.html');
      if (page) return page;
    }
    return Response.error();
  }
}
