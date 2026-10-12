const ROOT_URL = new URL("../../", import.meta.url);

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function isBundle(value) {
  return value && typeof value === "object" && Array.isArray(value.entries);
}

async function loadFromManifest(fileName, mode) {
  const manifestUrl = new URL(fileName, ROOT_URL);
  const manifest = await fetchJson(manifestUrl, { cache: "no-store" });
  const dataUrl = new URL(manifest.writingData.url, manifestUrl);
  const bundle = await fetchJson(dataUrl);
  if (!isBundle(bundle) || bundle.entries.length === 0) throw new Error(`${mode} bundle is empty`);
  return { bundle, mode, manifestUrl: manifestUrl.href, dataUrl: dataUrl.href };
}

export async function loadWritingData() {
  const attempts = [
    ["writing-version.json", "release"],
    ["writing-version.preview.json", "preview"],
  ];
  const failures = [];
  for (const [fileName, mode] of attempts) {
    try {
      return await loadFromManifest(fileName, mode);
    } catch (error) {
      failures.push(`${mode}: ${error.message}`);
    }
  }
  try {
    const dataUrl = new URL("demo/writing-demo.json", ROOT_URL);
    const bundle = await fetchJson(dataUrl);
    if (!isBundle(bundle)) throw new Error("invalid demo bundle");
    return { bundle, mode: "demo", dataUrl: dataUrl.href, failures };
  } catch (error) {
    failures.push(`demo: ${error.message}`);
    return {
      bundle: { schemaVersion: 1, writingContentVersion: null, entries: [], index: {} },
      mode: "empty",
      failures,
    };
  }
}

export function entriesForPart(entries, part) {
  return entries
    .filter((entry) => entry?.examPart === part || entry?.examPart === "both")
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));
}

export function sentencesForPromptParagraph(paragraph) {
  if (Array.isArray(paragraph?.sentences) && paragraph.sentences.length > 0) return paragraph.sentences;
  return [{
    id: `${paragraph?.id ?? "paragraph"}-legacy`,
    en: paragraph?.en ?? "",
    zh: paragraph?.zh ?? "",
    whyZh: paragraph?.commentZh ?? "",
    vocabGlosses: [],
    grammarNote: null,
    riskNote: null,
  }];
}

function collectStringValues(value, output) {
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, output);
    return;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectStringValues(child, output);
  }
}

export function searchTextForEntry(entry) {
  const chunks = [];
  collectStringValues(entry, chunks);
  return chunks.join(" ").toLocaleLowerCase("zh-CN");
}
