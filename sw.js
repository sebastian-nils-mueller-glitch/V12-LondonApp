const SW_VERSION = 'v1.0.4';
const CACHE_NAME = `london2025-${SW_VERSION}`;
const APP_SHELL = [
  '/V11-LondonApp/',
  '/V11-LondonApp/index.html',
  '/V11-LondonApp/style.css?v=2',
  '/V11-LondonApp/script.js?v=5',
  '/V11-LondonApp/manifest.json',
  '/V11-LondonApp/img/london-morning.jpg',
  '/V11-LondonApp/img/london-day.jpg',
  '/V11-LondonApp/img/london-evening.jpg',
  '/V11-LondonApp/img/london-night.jpg',
  '/V11-LondonApp/icons/icon-192.png',
  '/V11-LondonApp/icons/icon-512.png'
];

const RUNTIME_BLOCKLIST = ['tile.openstreetmap.org','unpkg.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME ? caches.delete(k) : null))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method!=='GET' || url.origin!==self.location.origin || RUNTIME_BLOCKLIST.some(d=>url.hostname.includes(d))) return;
  e.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(req);
      const network = fetch(req).then(res => { if (res && res.status===200 && res.type==='basic') cache.put(req, res.clone()); return res; }).catch(()=>cached);
      return cached || network;
    })
  );
});
