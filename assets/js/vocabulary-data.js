const VERSION_CANDIDATES = [
  ["version.json", "release"],
  ["version.preview.json", "preview"],
];

const appRoot = new URL("../../", import.meta.url);

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url.pathname}`);
  return response.json();
}

export async function loadVocabularyData() {
  const failures = [];
  for (const [filename, mode] of VERSION_CANDIDATES) {
    const versionUrl = new URL(filename, appRoot);
    try {
      const version = await fetchJson(versionUrl, { cache: "no-store" });
      const dataPath = version?.wordData?.url;
      if (typeof dataPath !== "string" || dataPath.length === 0) throw new Error("版本索引缺少 wordData.url");
      const dataUrl = new URL(dataPath, versionUrl);
      const bundle = await fetchJson(dataUrl);
      if (!Array.isArray(bundle?.words)) throw new Error("单词数据包缺少 words 数组");
      return { mode, version, bundle, words: bundle.words };
    } catch (error) {
      failures.push(`${filename}: ${error.message}`);
    }
  }
  throw new Error(`无法加载单词数据：${failures.join("；")}`);
}

function values(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(values);
  if (typeof value === "object") return Object.values(value).flatMap(values);
  return [String(value)];
}

export function searchTextForWord(word) {
  return values({
    word: word.word,
    lemma: word.lemma,
    aliases: word.aliases,
    coreSense: word.coreSense,
    senses: word.senses,
    memoryHooks: word.memoryHooks,
    wordFamily: word.wordFamily,
    confusables: word.confusables,
    synonymGroups: word.synonymGroups,
    collocations: word.collocations,
    examTraps: word.examTraps,
    recallLine: word.recallLine,
  }).join(" ").toLocaleLowerCase("zh-CN");
}
