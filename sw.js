/* ============================================================
 *  sw.js —— 离线缓存（PWA）
 *  页面：network-first（保证更新及时生效），失败回退缓存
 *  静态资源：stale-while-revalidate（秒开 + 后台静默更新）
 *  大文件 wiki.js（百科全文）运行时按需缓存
 * ============================================================ */
var VER = 'botc-v20261021-1';
var CORE = [
  './', 'index.html', 'styles.css', 'manifest.json',
  'core.js', 'qrcode.js', 'qr.js', 'ability.js', 'game.js',
  'draw.js', 'analyze.js', 'qa.js', 'share.js', 'app.js',
  'icon-192.png', 'icon-512.png', 'icon-180.png', 'favicon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VER).then(function (c) {
      return Promise.all(CORE.map(function (f) {
        return c.add(f).catch(function () { /* 单个失败不阻塞安装 */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VER; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* 页面导航：网络优先 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var cp = res.clone();
        caches.open(VER).then(function (c) { c.put('./', cp); c.put('index.html', cp.clone()); });
        return res;
      }).catch(function () {
        return caches.match('./').then(function (r) { return r || caches.match('index.html'); });
      })
    );
    return;
  }

  /* 静态资源：先用缓存，同时后台更新 */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var cp = res.clone();
          caches.open(VER).then(function (c) { c.put(req, cp); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
