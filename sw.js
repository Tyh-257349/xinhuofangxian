/* 《薪火防线》Service Worker：离线缓存 + 动态提供内嵌图标 */
importScripts('icons-b64.js');

const CACHE = 'xinhuo-v1';
const ASSETS = ['./', 'index.html', 'questions.json', 'manifest.json'];

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // 图标：由 base64 动态生成 PNG 响应
  const name = url.pathname.split('/').pop();
  if (ICONS_B64[name]) {
    e.respondWith(new Response(b64ToBytes(ICONS_B64[name]), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=86400' }
    }));
    return;
  }
  if (e.request.mode === 'navigate') {
    // 页面导航：网络优先，离线回退缓存
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put('index.html', copy));
        return resp;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }
  // 其余资源：缓存优先，后台更新
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
