// 건광자 서비스 워커: 오프라인에서도 앱 껍데기(HTML/CSS/JS)가 뜨도록 캐싱만 담당.
// 실제 서버 푸시 알림은 아직 없음 — 이건 어디까지나 "설치형 앱처럼 켜지는" 용도.
const CACHE_NAME = "geongwangja-v1";
const CORE_ASSETS = ["/", "/index.html", "/style.css", "/header.js", "/manifest.json"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    return res;
                })
                .catch(() => cached);
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: "window" }).then((clientsArr) => {
            if (clientsArr.length > 0) return clientsArr[0].focus();
            return self.clients.openWindow("/index.html");
        })
    );
});
