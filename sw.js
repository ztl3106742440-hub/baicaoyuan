const CACHE_PREFIX = "kaoyan-english";
const SHELL_CACHE = `${CACHE_PREFIX}-shell-v7-0`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-v7-0`;
const scopeUrl = new URL(self.registration.scope);
const shellPaths = [
  "./",
  "./index.html",
  "./writing/part-a/",
  "./writing/part-a/index.html",
  "./writing/part-b/",
  "./writing/part-b/index.html",
  "./vocabulary/",
  "./vocabulary/index.html",
  "./vocabulary/networks/",
  "./vocabulary/networks/index.html",
  "./vocabulary/reading/",
  "./vocabulary/reading/index.html",
  "./manifest.webmanifest",
  "./assets/css/writing.css",
  "./assets/css/vocabulary.css",
  "./assets/css/study-materials.css",
  "./assets/js/storage.js",
  "./assets/js/vocabulary-data.js",
  "./assets/js/vocabulary-app.js",
  "./assets/js/word-scheduler.js",
  "./assets/js/study-data.js",
  "./assets/js/learning-shell.js",
  "./assets/js/networks-app.js",
  "./assets/js/reading-app.js",
  "./assets/js/writing-data.js",
  "./assets/js/writing-overlays.js",
  "./assets/js/writing-theme-body.js",
  "./assets/js/writing-app.js",
  "./assets/icons/app-icon.svg",
  "./assets/icons/app-icon-192.png",
  "./assets/icons/app-icon-512.png",
  "./assets/icons/app-icon-maskable.svg",
  "./assets/icons/app-icon-maskable-512.png",
  "./assets/illustrations/nature-reader.svg",
  "./assets/illustrations/newspaper-chart.svg",
  "./assets/illustrations/editorial-collage.svg",
  "./demo/writing-demo.json"
];
const shellUrls = shellPaths.map((path) => new URL(path, scopeUrl).href);
const publishedManifests = [
  { path: "./version.json", dataKey: "wordData" },
  { path: "./version.preview.json", dataKey: "wordData" },
  { path: "./writing-version.json", dataKey: "writingData" },
  { path: "./writing-version.preview.json", dataKey: "writingData" },
  { path: "./study-version.json", dataKey: "studyData" },
];

async function cachePublishedData(runtime, descriptor) {
  const manifestUrl = new URL(descriptor.path, scopeUrl);
  const manifestResponse = await fetch(new Request(manifestUrl, { cache: "no-store" }));
  if (manifestResponse.status === 404) return;
  if (!manifestResponse.ok) throw new Error(`Could not cache ${manifestUrl.pathname}`);
  const manifest = await manifestResponse.clone().json();
  const relativeDataUrl = manifest?.[descriptor.dataKey]?.url;
  if (typeof relativeDataUrl !== "string" || relativeDataUrl.length === 0) {
    throw new Error(`Invalid ${descriptor.dataKey} manifest`);
  }
  const dataUrl = new URL(relativeDataUrl, manifestUrl);
  const dataResponse = await fetch(new Request(dataUrl, { cache: "no-store" }));
  if (!dataResponse.ok) throw new Error(`Could not cache ${dataUrl.pathname}`);
  await Promise.all([
    runtime.put(manifestUrl.href, manifestResponse),
    runtime.put(dataUrl.href, dataResponse),
  ]);
}

async function precachePublishedData() {
  const runtime = await caches.open(RUNTIME_CACHE);
  const results = await Promise.allSettled(
    publishedManifests.map((descriptor) => cachePublishedData(runtime, descriptor)),
  );
  for (const result of results) {
    if (result.status === "rejected") console.warn("Published study data was not precached", result.reason);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(shellUrls);
    await precachePublishedData();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, RUNTIME_CACHE].includes(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) ?? (await caches.match(request));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

function navigationFallbackPath(pathname) {
  const relativePath = pathname.startsWith(scopeUrl.pathname)
    ? pathname.slice(scopeUrl.pathname.length)
    : pathname.replace(/^\/+/, "");
  if (relativePath.startsWith("writing/part-a")) return "./writing/part-a/index.html";
  if (relativePath.startsWith("writing/part-b")) return "./writing/part-b/index.html";
  if (relativePath.startsWith("vocabulary/networks")) return "./vocabulary/networks/index.html";
  if (relativePath.startsWith("vocabulary/reading")) return "./vocabulary/reading/index.html";
  if (relativePath.startsWith("vocabulary")) return "./vocabulary/index.html";
  return "./index.html";
}

async function navigationNetworkFirst(request, url) {
  try {
    return await networkFirst(request);
  } catch {
    const exactRoute = await caches.match(request, { ignoreSearch: true });
    if (exactRoute) return exactRoute;
    const fallbackUrl = new URL(navigationFallbackPath(url.pathname), scopeUrl);
    return (await caches.match(fallbackUrl, { ignoreSearch: true }))
      ?? (await caches.match(new URL("./index.html", scopeUrl), { ignoreSearch: true }));
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;
  const isVersionManifest = /(?:^|\/)(?:writing-|study-)?version(?:\.preview)?\.json$/u.test(url.pathname);
  if (isVersionManifest) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(request, url));
    return;
  }
  const isImmutableData = /\/data\/(?:words|writing|study)(?:\.preview)?\.[a-f0-9]{64}\.json$/u.test(url.pathname);
  if (isImmutableData || request.destination === "image" || request.destination === "font") {
    event.respondWith(cacheFirst(request));
    return;
  }
  const isMutableAppAsset = ["script", "style", "manifest", "worker"].includes(request.destination)
    || /\.(?:html|js|css|webmanifest)$/u.test(url.pathname);
  event.respondWith(isMutableAppAsset ? networkFirst(request) : cacheFirst(request));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
