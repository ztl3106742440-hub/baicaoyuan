const appRoot = new URL("../../", import.meta.url);

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url.pathname}`);
  return response.json();
}

export async function loadStudyData() {
  const versionUrl = new URL("study-version.json", appRoot);
  const version = await fetchJson(versionUrl, { cache: "no-store" });
  const dataPath = version?.studyData?.url;
  if (typeof dataPath !== "string" || dataPath.length === 0) throw new Error("专题版本索引缺少 studyData.url");
  const bundle = await fetchJson(new URL(dataPath, versionUrl));
  if (!Array.isArray(bundle?.networks) || !Array.isArray(bundle?.modules)) throw new Error("专题数据包结构不完整");
  return { version, bundle, networks: bundle.networks, modules: bundle.modules };
}

export function textNode(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

export function saveLocalSet(key, values) {
  try { localStorage.setItem(key, JSON.stringify([...values])); } catch {}
}

export function loadLocalSet(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}
