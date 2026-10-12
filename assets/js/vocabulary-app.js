import { getWordProgress, listWordProgress, saveWordProgress } from "./storage.js";
import { loadVocabularyData, searchTextForWord } from "./vocabulary-data.js";

const tagLabels = {
  "high-priority": "考研重点",
  "rare-sense": "熟词僻义",
  polysemy: "多义词",
  confusable: "易混词",
  morphology: "词根词族",
  "sound-mnemonic": "谐音助记",
  collocation: "搭配重点",
  synonym: "近义辨析",
  abstract: "抽象词",
  "exam-trap": "考试陷阱",
};

const hookLabels = {
  morphology: "构词助记",
  sound: "谐音助记",
  scene: "场景助记",
  "semantic-story": "语义故事",
  confusable: "辨析助记",
  spelling: "拼写助记",
};

const ratingLabels = {
  unknown: "不会",
  unstable: "模糊",
  known: "认识",
};

const state = {
  words: [],
  progress: new Map(),
  query: "",
  filter: "all",
  version: null,
  mode: null,
};

const elements = {
  count: document.querySelector("#wordCount"),
  filterBar: document.querySelector("#wordFilters"),
  list: document.querySelector("#wordList"),
  loading: document.querySelector("#wordLoading"),
  search: document.querySelector("#wordSearch"),
  status: document.querySelector("#vocabularyStatus"),
};

function node(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function appendText(parent, tagName, className, text) {
  const child = node(tagName, className, text);
  parent.append(child);
  return child;
}

function phonetic(word) {
  const uk = word.pronunciation?.uk;
  const us = word.pronunciation?.us;
  if (uk && us && uk !== us) return `英 ${uk} · 美 ${us}`;
  return uk ?? us ?? "音标待补充";
}

function primaryMeaning(word) {
  return word.senses
    .slice(0, 2)
    .map((sense) => `${sense.pos} ${sense.zh.join("；")}`)
    .join("　");
}

function progressFor(wordId) {
  return state.progress.get(wordId) ?? {
    wordId,
    status: "new",
    lastRating: null,
    reviewCount: 0,
    starred: false,
  };
}

function section(title, accent = null) {
  const wrapper = node("section", "word-section");
  const heading = node("h3", "word-section-title", title);
  if (accent) heading.dataset.accent = accent;
  wrapper.append(heading);
  return wrapper;
}

function badge(text, className = "") {
  return node("span", `word-badge ${className}`.trim(), text);
}

function renderSenses(word) {
  const wrapper = section("核心义项", "sense");
  const list = node("div", "sense-list");
  for (const sense of word.senses) {
    const item = node("article", "sense-item");
    const top = node("div", "sense-top");
    top.append(badge(sense.pos, "pos"), badge(`优先级 ${sense.examPriority}`, "priority"));
    item.append(top, node("p", "sense-zh", sense.zh.join("；")));
    if (sense.note) item.append(node("p", "sense-note", sense.note));
    list.append(item);
  }
  wrapper.append(list);
  return wrapper;
}

function renderMemory(word) {
  if (word.memoryHooks.length === 0 && !word.memoryHookExemption) return null;
  const wrapper = section("记忆钩子", "memory");
  if (word.memoryHooks.length === 0) {
    wrapper.append(node("p", "plain-note", word.memoryHookExemption));
    return wrapper;
  }
  const list = node("div", "memory-list");
  for (const hook of word.memoryHooks) {
    const item = node("article", `memory-item${hook.isPrimary ? " primary" : ""}`);
    const top = node("div", "memory-top");
    top.append(badge(hookLabels[hook.type] ?? hook.type, "memory-type"));
    if (hook.isPrimary) top.append(badge("主助记", "primary-label"));
    appendText(item, "h4", null, hook.title);
    item.prepend(top);
    item.append(node("p", null, hook.content));
    if (hook.isEtymology) item.append(node("small", "verified-note", "已标记为构词/词源说明"));
    list.append(item);
  }
  wrapper.append(list);
  return wrapper;
}

function renderMorphology(word) {
  const morphology = word.morphology;
  const hasContent = morphology.verifiedRoots.length > 0
    || morphology.affixes.length > 0
    || morphology.mnemonicSplit.length > 0
    || Boolean(morphology.etymologyNote);
  if (!hasContent) return null;
  const wrapper = section("构词与拆分", "morphology");
  const confidence = badge(`置信度：${morphology.confidence}`, "confidence");
  wrapper.append(confidence);
  for (const root of morphology.verifiedRoots) {
    wrapper.append(node("p", "morph-line", `${root.form} · ${root.role} · ${root.meaning}`));
  }
  for (const affix of morphology.affixes) {
    wrapper.append(node("p", "morph-line", `${affix.form} · ${affix.kind} · ${affix.meaning}`));
  }
  if (morphology.etymologyNote) wrapper.append(node("p", "plain-note", morphology.etymologyNote));
  for (const split of morphology.mnemonicSplit) {
    const item = node("article", "mnemonic-split");
    item.append(node("strong", null, split.form), node("span", null, split.cue));
    wrapper.append(item);
  }
  return wrapper;
}

function renderWordFamily(word) {
  if (word.wordFamily.length === 0) return null;
  const wrapper = section("词族", "family");
  const list = node("div", "relation-list");
  for (const item of word.wordFamily) {
    const row = node("article", "relation-item");
    const label = node("div", "relation-word");
    label.append(node("strong", null, item.word), badge(item.pos, "pos"));
    row.append(label, node("p", null, item.zh));
    list.append(row);
  }
  wrapper.append(list);
  return wrapper;
}

function renderConfusables(word) {
  if (word.confusables.length === 0) return null;
  const wrapper = section("易混词对比", "confusable");
  for (const item of word.confusables) {
    const card = node("article", "compare-item");
    const title = node("h4");
    title.append(node("strong", null, item.word), node("span", null, item.zh));
    card.append(title, node("p", null, item.difference), node("small", null, `记法：${item.cue}`));
    wrapper.append(card);
  }
  return wrapper;
}

function renderSynonyms(word) {
  if (word.synonymGroups.length === 0) return null;
  const wrapper = section("近义词辨析", "synonym");
  for (const group of word.synonymGroups) {
    const card = node("article", "synonym-group");
    card.append(node("p", "group-summary", group.summary));
    for (const item of group.items) {
      const row = node("div", "nuance-row");
      row.append(node("strong", null, item.word), node("span", null, item.nuance));
      card.append(row);
    }
    wrapper.append(card);
  }
  return wrapper;
}

function renderAntonyms(word) {
  if (word.antonymGroups.length === 0) return null;
  const wrapper = section("反义词", "antonym");
  const list = node("div", "inline-relations");
  for (const group of word.antonymGroups) {
    for (const item of group.items) list.append(badge(`${item.word} · ${item.zh}`, "antonym"));
  }
  wrapper.append(list);
  return wrapper;
}

function renderCollocations(word) {
  if (word.collocations.length === 0) return null;
  const wrapper = section("高频搭配", "collocation");
  const list = node("div", "collocation-list");
  for (const item of word.collocations) {
    const row = node("article", `collocation-item${item.showInQuick ? " quick" : ""}`);
    const phrase = node("strong", null, item.phrase);
    row.append(phrase, node("span", null, item.zh));
    if (item.showInQuick) row.append(badge("速记", "quick-label"));
    list.append(row);
  }
  wrapper.append(list);
  return wrapper;
}

function renderExamples(word) {
  if (word.examples.length === 0) return null;
  const wrapper = section("语境例句", "example");
  for (const item of word.examples) {
    const quote = node("blockquote", "example-item");
    quote.append(node("p", "example-en", item.en), node("p", "example-zh", item.zh));
    wrapper.append(quote);
  }
  return wrapper;
}

function renderTraps(word) {
  if (word.examTraps.length === 0) return null;
  const wrapper = section("考试陷阱", "trap");
  const list = node("ul", "trap-list");
  for (const trap of word.examTraps) list.append(node("li", null, trap));
  wrapper.append(list);
  return wrapper;
}

function renderDetails(word) {
  const body = node("div", "word-detail-body");
  const core = node("section", "core-sense");
  core.append(node("span", null, "核心感觉"), node("p", null, word.coreSense));
  body.append(core);
  const sections = [
    renderSenses(word),
    renderMemory(word),
    renderMorphology(word),
    renderWordFamily(word),
    renderConfusables(word),
    renderSynonyms(word),
    renderAntonyms(word),
    renderCollocations(word),
    renderExamples(word),
    renderTraps(word),
  ].filter(Boolean);
  body.append(...sections);
  const editorial = node("p", "editorial-note", `内容状态：${word.editorial.publicationStatus} · ${word.editorial.verificationStatus} · 词条版本 ${word.editorial.entryVersion}`);
  body.append(editorial);
  return body;
}

async function rateWord(wordId, rating) {
  const current = progressFor(wordId);
  const isKnown = rating === "known";
  const record = await saveWordProgress(wordId, {
    status: isKnown ? "known" : "learning",
    stage: isKnown ? Math.max(3, current.stage ?? 0) : Math.max(1, current.stage ?? 0),
    lastRating: rating,
    lastReviewedAt: new Date().toISOString(),
    correctStreak: isKnown ? (current.correctStreak ?? 0) + 1 : 0,
    lapses: rating === "unknown" ? (current.lapses ?? 0) + 1 : (current.lapses ?? 0),
    reviewCount: (current.reviewCount ?? 0) + 1,
    markedDifficult: rating === "unknown" ? true : current.markedDifficult ?? false,
  });
  state.progress.set(wordId, record);
  render();
}

async function toggleStar(wordId) {
  const current = progressFor(wordId);
  const record = await saveWordProgress(wordId, { starred: !current.starred });
  state.progress.set(wordId, record);
  render();
}

function renderActions(word) {
  const current = progressFor(word.id);
  const wrapper = node("div", "word-actions");
  const ratingGroup = node("div", "rating-group");
  ratingGroup.setAttribute("aria-label", `${word.word} 掌握程度`);
  for (const [rating, label] of Object.entries(ratingLabels)) {
    const button = node("button", "rating-button", label);
    button.type = "button";
    button.dataset.rating = rating;
    button.setAttribute("aria-pressed", String(current.lastRating === rating));
    button.addEventListener("click", () => rateWord(word.id, rating));
    ratingGroup.append(button);
  }
  const star = node("button", "star-button", current.starred ? "★ 已收藏" : "☆ 收藏");
  star.type = "button";
  star.setAttribute("aria-pressed", String(Boolean(current.starred)));
  star.addEventListener("click", () => toggleStar(word.id));
  wrapper.append(ratingGroup, star);
  return wrapper;
}

function renderWord(word) {
  const article = node("article", "word-card");
  article.id = `word-${word.id}`;
  const details = node("details", "word-details");
  const summary = node("summary", "word-summary");
  const header = node("div", "word-heading");
  const title = node("div", "word-title");
  title.append(node("h2", null, word.word), node("p", "phonetic", phonetic(word)));
  const priority = node("div", "word-priority", `P${word.examPriority} · 难度 ${word.difficulty}`);
  header.append(title, priority);
  const tags = node("div", "word-tags");
  for (const tag of word.tags) tags.append(badge(tagLabels[tag] ?? tag));
  summary.append(
    header,
    node("p", "primary-meaning", primaryMeaning(word)),
    node("p", "recall-line", word.recallLine),
    tags,
    node("span", "expand-hint", "展开完整词条"),
  );
  details.append(summary, renderDetails(word));
  article.append(details, renderActions(word));
  return article;
}

function matchesFilter(word) {
  const progress = progressFor(word.id);
  if (state.filter === "starred") return Boolean(progress.starred);
  if (state.filter === "unrated") return !progress.lastRating;
  if (state.filter !== "all") return progress.lastRating === state.filter;
  return true;
}

function visibleWords() {
  const query = state.query.trim().toLocaleLowerCase("zh-CN");
  return state.words.filter((word) => matchesFilter(word) && (!query || searchTextForWord(word).includes(query)));
}

function updateFilterCounts() {
  for (const button of elements.filterBar.querySelectorAll("button[data-filter]")) {
    const filter = button.dataset.filter;
    const count = state.words.filter((word) => {
      const progress = progressFor(word.id);
      if (filter === "all") return true;
      if (filter === "starred") return Boolean(progress.starred);
      if (filter === "unrated") return !progress.lastRating;
      return progress.lastRating === filter;
    }).length;
    button.querySelector("span").textContent = String(count);
    button.setAttribute("aria-pressed", String(filter === state.filter));
  }
}

function render() {
  const words = visibleWords();
  elements.list.replaceChildren(...words.map(renderWord));
  elements.count.textContent = `显示 ${words.length} / ${state.words.length} 个词`;
  updateFilterCounts();
  elements.loading.hidden = words.length > 0;
  if (state.words.length === 0) elements.loading.textContent = "当前词库还没有可显示的词条。";
  else if (words.length === 0) elements.loading.textContent = "没有匹配的词。换个关键词或筛选条件试试。";
}

function configureControls() {
  elements.search.addEventListener("input", () => {
    state.query = elements.search.value;
    render();
  });
  for (const button of elements.filterBar.querySelectorAll("button[data-filter]")) {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      render();
    });
  }
}

async function start() {
  configureControls();
  try {
    const [{ words, version, mode }, records] = await Promise.all([
      loadVocabularyData(),
      listWordProgress(),
    ]);
    state.words = words;
    state.version = version;
    state.mode = mode;
    state.progress = new Map((records ?? []).map((record) => [record.wordId, record]));
    elements.status.textContent = `${mode === "preview" ? "预览词库" : "正式词库"} · ${words.length} 词 · 内容版本 ${version.contentVersion}`;
    render();
  } catch (error) {
    elements.loading.hidden = false;
    elements.loading.textContent = error.message;
    elements.status.textContent = "单词数据加载失败";
  }
}

start();
