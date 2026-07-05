/* sw.js — Service Worker: rende l'app disponibile OFFLINE
   Cambia CACHE_VERSION ad ogni aggiornamento per forzare il refresh dei file. */
const CACHE_VERSION = 'test-atletici-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/data.js',
  './js/audio.js',
  './js/engines.js',
  './js/calc.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_VERSION).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_VERSION).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  if(e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      return cached || fetch(e.request).then(res=>{
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c=>c.put(e.request, copy)).catch(()=>{});
        return res;
      }).catch(()=> cached);
    })
  );
});
