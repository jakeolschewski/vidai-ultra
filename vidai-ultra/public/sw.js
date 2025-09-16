self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open('vidai-v1').then(c=>c.addAll(['/','/landing','/policies/privacy.html','/policies/terms.html'])));
});
self.addEventListener('activate', e => { self.clients.claim(); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'GET' && (url.origin === location.origin)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
