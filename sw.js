const V='spese-v4-personal-dragon';
const FILES=['./','./index.html','./finance-core.js','./finance-ui.js','./finance.css','./personal-core.js','./personal-ui.js','./dragon.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('spese-')&&k!==V).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;e.respondWith(caches.match(r).then(c=>c||fetch(r)));});
