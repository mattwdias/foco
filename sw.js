// Service worker do Foco — o que torna o site instalável como app e o deixa abrir offline.
//
// Estratégia: REDE PRIMEIRO, cache só como rede de segurança. O contrário (cache primeiro)
// seria mais rápido, mas este projeto já foi mordido por conteúdo velho servido como se
// fosse novo — o data.json ficou oito dias parado sem ninguém perceber. Um app que guarda
// o HTML antigo repete isso na mão de quem usa, e sem botão fácil de limpar. Então: com
// rede, sempre o atual; sem rede, a última versão que funcionou.
const CACHE = 'foco-v1';
const ESSENCIAIS = ['./', './index.html', './config.js', './data.json',
                    './icone-192.png', './icone-512.png', './manifest.json'];

self.addEventListener('install', e => {
  // addAll é tudo-ou-nada: um 404 aborta a instalação inteira, então cada um por si
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ESSENCIAIS.map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // YouTube, thumbnails e proxies passam direto: resposta opaca não serve de cache útil
  if (new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then(r => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
        return r;
      })
      .catch(() => caches.match(req)
        .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
