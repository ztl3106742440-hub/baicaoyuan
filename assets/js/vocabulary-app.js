import { listWordProgress, saveWordProgress } from "./storage.js";
import { loadVocabularyData, searchTextForWord } from "./vocabulary-data.js";
import {
  reinforcementInsertionIndex,
  scheduleWordRating,
  selectStudySession,
} from "./word-scheduler.js";

const PAGE_SIZE = 30;
const viewValues = new Set(["study", "library"]);
const filterValues = new Set(["all", "unrated", "unknown", "unstable", "known", "starred"]);
const urlParameters = new URLSearchParams(location.search);

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

function storedView() {
  try { return localStorage.getItem("kaoyan.vocabulary.view"); } catch { return null; }
}

function storedSessionSize() {
  try {
    const value = Number.parseInt(localStorage.getItem("kaoyan.vocabulary.sessionSize") ?? "20", 10);
    return [10, 20, 30].includes(value) ? value : 20;
  } catch {
    return 20;
  }
}

function storedSessionCursor() {
  try {
    const value = Number.parseInt(localStorage.getItem("kaoyan.vocabulary.sessionCursor") ?? "0", 10);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

const requestedView = urlParameters.get("view") ?? storedView();
const requestedFilter = urlParameters.get("filter");
const requestedPage = Number.parseInt(urlParameters.get("page") ?? "1", 10);
const state = {
  words: [],
  progress: new Map(),
  query: urlParameters.get("q") ?? "",
  filter: filterValues.has(requestedFilter) ? requestedFilter : "all",
  page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  view: viewValues.has(requestedView) ? requestedView : "study",
  version: null,
  mode: null,
  sessionSize: storedSessionSize(),
  sessionWords: [],
  sessionCursor: storedSessionCursor(),
  nextSessionCursor: storedSessionCursor(),
  sessionComposition: { due: 0, fresh: 0, extra: 0 },
  studyIndex: 0,
  studyRevealed: false,
  studyPoolIds: null,
  ratedThisRound: new Set(),
  reinforcementCounts: new Map(),
  reinforcementReviews: 0,
  searchIndex: new Map(),
  roundResults: { unknown: 0, unstable: 0, known: 0 },
};

const elements = {
  shell: document.querySelector("#vocabShell"),
  sidebar: document.querySelector("#vocabSidebar"),
  workspace: document.querySelector("#mainContent"),
  shade: document.querySelector("#drawerShade"),
  openDrawer: document.querySelector("#openVocabDrawer"),
  closeDrawer: document.querySelector("#closeVocabDrawer"),
  count: document.querySelector("#wordCount"),
  filterBar: document.querySelector("#wordFilters"),
  list: document.querySelector("#wordList"),
  loading: document.querySelector("#wordLoading"),
  search: document.querySelector("#wordSearch"),
  status: document.querySelector("#vocabularyStatus"),
  studyView: document.querySelector("#studyView"),
  libraryView: document.querySelector("#libraryView"),
  studyStage: document.querySelector("#studyStage"),
  studyProgressText: document.querySelector("#studyProgressText"),
  studyRoundStatus: document.querySelector("#studyRoundStatus"),
  studyProgressBar: document.querySelector("#studyProgressBar"),
  actionStatus: document.querySelector("#vocabActionStatus"),
  sessionSize: document.querySelector("#sessionSize"),
  studyVisibleWords: document.querySelector("#studyVisibleWords"),
  topPagination: document.querySelector("#topPagination"),
  bottomPagination: document.querySelector("#bottomPagination"),
  sideTotal: document.querySelector("#sideTotal"),
  sidePending: document.querySelector("#sidePending"),
  sideKnown: document.querySelector("#sideKnown"),
};

let actionStatusTimer = null;

function announceAction(message, tone = "error") {
  clearTimeout(actionStatusTimer);
  elements.actionStatus.textContent = message;
  elements.actionStatus.dataset.tone = tone;
  actionStatusTimer = setTimeout(() => {
    elements.actionStatus.textContent = "";
    delete elements.actionStatus.dataset.tone;
  }, 6000);
}

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
  wrapper.append(badge(`置信度：${morphology.confidence}`, "confidence"));
  for (const root of morphology.verifiedRoots) wrapper.append(node("p", "morph-line", `${root.form} · ${root.role} · ${root.meaning}`));
  for (const affix of morphology.affixes) wrapper.append(node("p", "morph-line", `${affix.form} · ${affix.kind} · ${affix.meaning}`));
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
    row.append(node("strong", null, item.phrase), node("span", null, item.zh));
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
  body.append(...[
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
  ].filter(Boolean));
  body.append(node("p", "editorial-note", `内容状态：${word.editorial.publicationStatus} · ${word.editorial.verificationStatus} · 词条版本 ${word.editorial.entryVersion}`));
  return body;
}

async function rateWord(wordId, rating) {
  const current = progressFor(wordId);
  const record = await saveWordProgress(wordId, scheduleWordRating(current, rating));
  if (!record) throw new Error("当前浏览器没有开放本地学习记录");
  state.progress.set(wordId, record);
  renderSideStats();
  updateFilterCounts();
  return record;
}

async function toggleStar(wordId) {
  const current = progressFor(wordId);
  const record = await saveWordProgress(wordId, { starred: !current.starred });
  if (!record) throw new Error("当前浏览器没有开放本地学习记录");
  state.progress.set(wordId, record);
  renderSideStats();
  updateFilterCounts();
  return record;
}

function renderActions(word) {
  const wrapper = node("div", "word-actions");
  const ratingGroup = node("div", "rating-group");
  ratingGroup.setAttribute("aria-label", `${word.word} 掌握程度`);
  for (const [rating, label] of Object.entries(ratingLabels)) {
    const button = node("button", "rating-button", label);
    button.type = "button";
    button.dataset.rating = rating;
    button.addEventListener("click", async () => {
      for (const control of wrapper.querySelectorAll("button")) control.disabled = true;
      try {
        await rateWord(word.id, rating);
        syncActions();
      } catch (error) {
        announceAction(`${word.word} 的掌握状态没有保存：${error.message}`);
      } finally {
        for (const control of wrapper.querySelectorAll("button")) control.disabled = false;
      }
    });
    ratingGroup.append(button);
  }
  const star = node("button", "star-button");
  star.type = "button";
  star.addEventListener("click", async () => {
    for (const control of wrapper.querySelectorAll("button")) control.disabled = true;
    try {
      await toggleStar(word.id);
      syncActions();
    } catch (error) {
      announceAction(`${word.word} 的收藏状态没有保存：${error.message}`);
    } finally {
      for (const control of wrapper.querySelectorAll("button")) control.disabled = false;
    }
  });
  wrapper.append(ratingGroup, star);
  function syncActions() {
    const current = progressFor(word.id);
    for (const button of ratingGroup.querySelectorAll("button[data-rating]")) {
      button.setAttribute("aria-pressed", String(current.lastRating === button.dataset.rating));
    }
    star.textContent = current.starred ? "★ 已收藏" : "☆ 收藏";
    star.setAttribute("aria-pressed", String(Boolean(current.starred)));
  }
  syncActions();
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
  header.append(title, node("div", "word-priority", `P${word.examPriority} · 难度 ${word.difficulty}`));
  const copy = node("div", "word-summary-copy");
  copy.append(node("p", "primary-meaning", primaryMeaning(word)), node("p", "recall-line", word.recallLine));
  const tags = node("div", "word-tags");
  for (const tag of word.tags.slice(0, 3)) tags.append(badge(tagLabels[tag] ?? tag));
  summary.append(header, copy, tags, node("span", "expand-hint", "展开完整词条"));
  details.append(summary);
  let detailsRendered = false;
  details.addEventListener("toggle", () => {
    if (!details.open || detailsRendered) return;
    details.append(renderDetails(word));
    detailsRendered = true;
  });
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
  return state.words.filter((word) => matchesFilter(word) && (!query || state.searchIndex.get(word.id)?.includes(query)));
}

function pageCount(total) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function updateUrl() {
  const parameters = new URLSearchParams();
  parameters.set("view", state.view);
  if (state.view === "library" && state.page > 1) parameters.set("page", String(state.page));
  if (state.filter !== "all") parameters.set("filter", state.filter);
  if (state.query.trim()) parameters.set("q", state.query.trim());
  history.replaceState(null, "", `${location.pathname}?${parameters.toString()}${location.hash}`);
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

function renderSideStats() {
  const known = state.words.filter((word) => progressFor(word.id).lastRating === "known").length;
  elements.sideTotal.textContent = String(state.words.length);
  elements.sideKnown.textContent = String(known);
  elements.sidePending.textContent = String(state.words.length - known);
}

function scrollLibraryTop() {
  document.querySelector("#libraryTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPagination(container, total) {
  const pages = pageCount(total);
  const previous = node("button", null, "上一页");
  previous.type = "button";
  previous.disabled = state.page <= 1;
  previous.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    updateUrl();
    renderLibrary();
    scrollLibraryTop();
  });
  const label = node("span", null, `第 ${state.page} / ${pages} 页`);
  const next = node("button", null, "下一页");
  next.type = "button";
  next.disabled = state.page >= pages;
  next.addEventListener("click", () => {
    state.page = Math.min(pages, state.page + 1);
    updateUrl();
    renderLibrary();
    scrollLibraryTop();
  });
  for (const button of [previous, next]) button.addEventListener("dblclick", scrollLibraryTop);
  container.replaceChildren(previous, label, next);
}

function renderLibrary() {
  const words = visibleWords();
  const pages = pageCount(words.length);
  state.page = Math.min(Math.max(1, state.page), pages);
  const start = (state.page - 1) * PAGE_SIZE;
  const current = words.slice(start, start + PAGE_SIZE);
  elements.list.replaceChildren(...current.map(renderWord));
  const rangeStart = current.length === 0 ? 0 : start + 1;
  const rangeEnd = start + current.length;
  elements.count.textContent = `第 ${rangeStart}–${rangeEnd} 个，共 ${words.length} 个词；每页最多 ${PAGE_SIZE} 个`;
  elements.studyVisibleWords.disabled = words.length === 0;
  elements.studyVisibleWords.textContent = words.length === 0 ? "当前筛选无单词" : "背当前筛选";
  updateFilterCounts();
  renderPagination(elements.topPagination, words.length);
  renderPagination(elements.bottomPagination, words.length);
  elements.loading.hidden = current.length > 0;
  if (state.words.length === 0) elements.loading.textContent = "当前词库还没有可显示的词条。";
  else if (words.length === 0) elements.loading.textContent = "没有匹配的词。请调整筛选条件。";
}

function saveSessionCursor(value) {
  state.sessionCursor = value;
  try { localStorage.setItem("kaoyan.vocabulary.sessionCursor", String(value)); } catch {}
}

function startStudySession({ rotate = false } = {}) {
  if (rotate) saveSessionCursor(state.nextSessionCursor);
  const selection = selectStudySession(state.words, state.progress, {
    size: state.sessionSize,
    poolIds: state.studyPoolIds,
    cursor: state.sessionCursor,
  });
  state.sessionWords = selection.words;
  state.nextSessionCursor = selection.nextCursor;
  state.sessionComposition = selection.composition;
  state.studyIndex = 0;
  state.studyRevealed = false;
  state.ratedThisRound = new Set();
  state.reinforcementCounts = new Map();
  state.reinforcementReviews = 0;
  state.roundResults = { unknown: 0, unstable: 0, known: 0 };
  renderStudy();
}

function primaryMemoryHook(word) {
  return word.memoryHooks.find((hook) => hook.isPrimary) ?? word.memoryHooks[0] ?? null;
}

function queueReinforcement(word, rating) {
  const insertionIndex = reinforcementInsertionIndex(rating, state.studyIndex, state.sessionWords.length);
  const count = state.reinforcementCounts.get(word.id) ?? 0;
  if (insertionIndex == null || count >= 2) return false;
  state.sessionWords.splice(insertionIndex, 0, word);
  state.reinforcementCounts.set(word.id, count + 1);
  return true;
}

function renderStudyAnswer(word) {
  const answer = node("div", "study-answer");
  const main = node("section", "study-answer-main");
  main.append(node("strong", null, primaryMeaning(word)), node("p", null, word.coreSense));
  answer.append(main);
  const ratings = node("div", "study-rating");
  ratings.setAttribute("aria-label", `${word.word} 掌握程度`);
  for (const [rating, label] of Object.entries(ratingLabels)) {
    const button = node("button", null, label);
    button.type = "button";
    button.dataset.rating = rating;
    button.addEventListener("click", async () => {
      for (const control of ratings.querySelectorAll("button")) control.disabled = true;
      const firstRating = !state.ratedThisRound.has(word.id);
      try {
        if (firstRating) {
          await rateWord(word.id, rating);
          state.ratedThisRound.add(word.id);
          state.roundResults[rating] += 1;
        } else {
          state.reinforcementReviews += 1;
        }
        queueReinforcement(word, rating);
        state.studyIndex += 1;
        state.studyRevealed = false;
        renderStudy({ focus: true });
      } catch (error) {
        announceAction(`${word.word} 的复习记录没有保存：${error.message}`);
        for (const control of ratings.querySelectorAll("button")) control.disabled = false;
      }
    });
    ratings.append(button);
  }
  answer.append(ratings);
  const hook = primaryMemoryHook(word);
  if (hook) {
    const memory = node("section", "study-memory");
    memory.append(node("span", null, hookLabels[hook.type] ?? "主助记"), node("strong", null, hook.title), node("p", null, hook.content));
    answer.append(memory);
  }
  const quickItems = word.collocations.filter((item) => item.showInQuick).slice(0, 3);
  const fallbackItems = quickItems.length > 0 ? quickItems : word.collocations.slice(0, 2);
  if (fallbackItems.length > 0) {
    const collocations = node("div", "quick-collocations");
    for (const item of fallbackItems) collocations.append(node("span", null, `${item.phrase} · ${item.zh}`));
    answer.append(collocations);
  }
  const deep = node("details", "study-deep");
  deep.append(node("summary", null, "查看完整词条"), renderDetails(word));
  answer.append(deep);
  return answer;
}

function renderSessionFinished() {
  const wrapper = node("section", "session-finished");
  const body = node("div");
  body.append(
    node("h2", null, "本轮完成"),
    node("p", null, `不会 ${state.roundResults.unknown} · 模糊 ${state.roundResults.unstable} · 认识 ${state.roundResults.known}`),
    node("p", "session-composition", `到期 ${state.sessionComposition.due} · 新词 ${state.sessionComposition.fresh} · 补充复习 ${state.sessionComposition.extra} · 本轮巩固 ${state.reinforcementReviews}`),
  );
  const restart = node("button", null, "再来一轮");
  restart.type = "button";
  restart.addEventListener("click", () => startStudySession({ rotate: true }));
  body.append(restart);
  wrapper.append(body);
  return wrapper;
}

function renderStudy({ focus = false } = {}) {
  elements.studyStage.setAttribute("aria-busy", "false");
  const total = state.sessionWords.length;
  const completed = Math.min(state.studyIndex, total);
  elements.studyProgressText.textContent = total === 0 ? "当前没有可学习的单词" : `本轮 ${completed} / ${total}`;
  elements.studyRoundStatus.textContent = total === 0
    ? "空词库"
    : completed >= total
      ? "已完成"
      : `到期 ${state.sessionComposition.due} · 新词 ${state.sessionComposition.fresh} · 剩余 ${total - completed}`;
  elements.studyProgressBar.style.width = `${total === 0 ? 0 : (completed / total) * 100}%`;
  if (total === 0) {
    elements.studyStage.replaceChildren(node("p", "loading-state", "当前筛选没有可学习的单词。请到单词库调整筛选。"));
    return;
  }
  if (state.studyIndex >= total) {
    saveSessionCursor(state.nextSessionCursor);
    elements.studyStage.replaceChildren(renderSessionFinished());
    if (focus) requestAnimationFrame(() => elements.studyStage.querySelector("button")?.focus({ preventScroll: true }));
    return;
  }
  const word = state.sessionWords[state.studyIndex];
  const card = node("article", "study-card");
  const top = node("header", "study-card-top");
  top.append(node("span", "study-sequence", `第 ${state.studyIndex + 1} / ${total} 个`));
  const currentProgress = progressFor(word.id);
  const star = node("button", "study-star", currentProgress.starred ? "★" : "☆");
  star.type = "button";
  star.setAttribute("aria-label", currentProgress.starred ? "取消收藏" : "收藏单词");
  star.setAttribute("aria-pressed", String(Boolean(currentProgress.starred)));
  star.addEventListener("click", async () => {
    star.disabled = true;
    try {
      await toggleStar(word.id);
      renderStudy({ focus: true });
    } catch (error) {
      announceAction(`${word.word} 的收藏状态没有保存：${error.message}`);
      star.disabled = false;
      star.focus({ preventScroll: true });
    }
  });
  top.append(star);
  const prompt = node("section", "study-prompt");
  const wordBlock = node("div", "study-word");
  if (word.word.length >= 12) wordBlock.classList.add("long-word");
  if (word.word.length >= 17) wordBlock.classList.add("very-long-word");
  wordBlock.append(node("h2", null, word.word), node("p", "phonetic", phonetic(word)), node("p", "memory-question", "先在脑中说出核心意思"));
  if (!state.studyRevealed) {
    const reveal = node("button", "reveal-button", "显示答案");
    reveal.type = "button";
    reveal.addEventListener("click", () => {
      state.studyRevealed = true;
      renderStudy({ focus: true });
    });
    wordBlock.append(reveal);
  }
  prompt.append(wordBlock);
  card.append(top, prompt);
  if (state.studyRevealed) card.append(renderStudyAnswer(word));
  const navigation = node("footer", "study-navigation");
  const previous = node("button", null, "← 上一个");
  previous.type = "button";
  previous.disabled = state.studyIndex === 0;
  previous.addEventListener("click", () => {
    state.studyIndex = Math.max(0, state.studyIndex - 1);
    state.studyRevealed = false;
    renderStudy({ focus: true });
  });
  const later = node("button", null, "稍后再看 →");
  later.type = "button";
  later.addEventListener("click", () => {
    const [deferred] = state.sessionWords.splice(state.studyIndex, 1);
    if (deferred) state.sessionWords.push(deferred);
    state.studyRevealed = false;
    renderStudy({ focus: true });
  });
  navigation.append(previous, later);
  card.append(navigation);
  elements.studyStage.replaceChildren(card);
  if (focus) {
    requestAnimationFrame(() => elements.studyStage.querySelector(state.studyRevealed ? ".study-rating button" : ".reveal-button")?.focus({ preventScroll: true }));
  }
}

function isNarrowLayout() {
  return matchMedia("(max-width: 900px)").matches;
}

let drawerReturnFocus = null;

function drawerFocusableElements() {
  return [...elements.sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function setDrawer(open, { restoreFocus = true } = {}) {
  const shouldOpen = Boolean(open && isNarrowLayout());
  if (shouldOpen) drawerReturnFocus = document.activeElement;
  elements.shell.classList.toggle("drawer-open", shouldOpen);
  elements.shade.hidden = !shouldOpen;
  document.body.style.overflow = shouldOpen ? "hidden" : "";
  elements.openDrawer.setAttribute("aria-expanded", String(shouldOpen));
  elements.sidebar.inert = isNarrowLayout() && !shouldOpen;
  elements.workspace.inert = shouldOpen;
  if (elements.sidebar.inert) elements.sidebar.setAttribute("aria-hidden", "true");
  else elements.sidebar.removeAttribute("aria-hidden");
  if (shouldOpen) requestAnimationFrame(() => (elements.closeDrawer ?? drawerFocusableElements()[0])?.focus());
  else if (restoreFocus && drawerReturnFocus instanceof HTMLElement && drawerReturnFocus.isConnected) {
    requestAnimationFrame(() => drawerReturnFocus.focus());
  }
}

function setView(view, { scroll = false } = {}) {
  state.view = viewValues.has(view) ? view : "study";
  elements.studyView.hidden = state.view !== "study";
  elements.libraryView.hidden = state.view !== "library";
  for (const button of document.querySelectorAll("[data-view-button]")) button.setAttribute("aria-pressed", String(button.dataset.viewButton === state.view));
  try { localStorage.setItem("kaoyan.vocabulary.view", state.view); } catch {}
  updateUrl();
  setDrawer(false);
  if (state.view === "study" && state.sessionWords.length === 0 && state.words.length > 0) startStudySession();
  if (state.view === "library" && state.words.length > 0) renderLibrary();
  if (scroll) scrollTo({ top: 0, behavior: "smooth" });
}

function collapseAllWords() {
  for (const details of document.querySelectorAll("#mainContent details[open]")) details.open = false;
  setDrawer(false);
}

function configureControls() {
  setDrawer(false, { restoreFocus: false });
  elements.search.value = state.query;
  elements.sessionSize.value = String(state.sessionSize);
  for (const button of document.querySelectorAll("[data-view-button]")) {
    button.addEventListener("click", () => setView(button.dataset.viewButton));
    button.addEventListener("dblclick", () => setView(button.dataset.viewButton, { scroll: true }));
  }
  let searchTimer = null;
  elements.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = elements.search.value;
      state.page = 1;
      updateUrl();
      renderLibrary();
    }, 150);
  });
  for (const button of elements.filterBar.querySelectorAll("button[data-filter]")) {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      state.page = 1;
      updateUrl();
      renderLibrary();
    });
  }
  elements.sessionSize.addEventListener("change", () => {
    state.sessionSize = Number.parseInt(elements.sessionSize.value, 10);
    try { localStorage.setItem("kaoyan.vocabulary.sessionSize", String(state.sessionSize)); } catch {}
    startStudySession({ rotate: true });
  });
  document.querySelector("#restartSession").addEventListener("click", () => startStudySession({ rotate: true }));
  elements.studyVisibleWords.addEventListener("click", () => {
    const filtered = visibleWords();
    if (filtered.length === 0) return;
    state.studyPoolIds = filtered.map((word) => word.id);
    setView("study", { scroll: true });
    startStudySession({ rotate: true });
  });
  document.querySelector("#collapseAllWords").addEventListener("click", collapseAllWords);
  elements.openDrawer.addEventListener("click", () => setDrawer(true));
  elements.closeDrawer.addEventListener("click", () => setDrawer(false));
  elements.shade.addEventListener("click", () => setDrawer(false));
  document.querySelector("#vocabSidebarCollapse").addEventListener("click", () => {
    const collapsed = !elements.shell.classList.contains("sidebar-collapsed");
    elements.shell.classList.toggle("sidebar-collapsed", collapsed);
    document.querySelector("#vocabSidebarCollapse").setAttribute("aria-expanded", String(!collapsed));
    document.querySelector("#vocabSidebarCollapseLabel").textContent = collapsed ? "展开功能栏" : "收起功能栏";
    try { localStorage.setItem("kaoyan.vocabulary.sidebarCollapsed", String(collapsed)); } catch {}
  });
  let collapsed = false;
  try { collapsed = localStorage.getItem("kaoyan.vocabulary.sidebarCollapsed") === "true"; } catch {}
  elements.shell.classList.toggle("sidebar-collapsed", collapsed);
  document.querySelector("#vocabSidebarCollapse").setAttribute("aria-expanded", String(!collapsed));
  document.querySelector("#vocabSidebarCollapseLabel").textContent = collapsed ? "展开功能栏" : "收起功能栏";
  addEventListener("resize", () => {
    if (!isNarrowLayout()) setDrawer(false, { restoreFocus: false });
  }, { passive: true });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape") setDrawer(false);
    if (event.key === "Tab" && elements.shell.classList.contains("drawer-open")) {
      const focusable = drawerFocusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === " " && state.view === "study" && !state.studyRevealed && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/u.test(document.activeElement?.tagName ?? "")) {
      event.preventDefault();
      state.studyRevealed = true;
      renderStudy();
    }
  });
}

async function configureServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    const registration = await navigator.serviceWorker.register(new URL("../../sw.js", import.meta.url), { scope: new URL("../../", import.meta.url).pathname });
    const banner = document.querySelector("#updateBanner");
    const showUpdate = () => { banner.hidden = false; };
    if (registration.waiting) showUpdate();
    registration.addEventListener("updatefound", () => {
      registration.installing?.addEventListener("statechange", () => {
        if (registration.installing?.state === "installed" && navigator.serviceWorker.controller) showUpdate();
      });
    });
    document.querySelector("#applyUpdate").addEventListener("click", () => registration.waiting?.postMessage({ type: "SKIP_WAITING" }));
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  } catch {
    // 本地预览或不支持 Service Worker 时不阻塞学习。
  }
}

async function start() {
  configureControls();
  setView(state.view);
  try {
    const { words, version, mode } = await loadVocabularyData();
    let records = [];
    try {
      records = await listWordProgress() ?? [];
    } catch (error) {
      announceAction(`词库可以正常学习，但本机进度暂时无法读取：${error.message}`);
    }
    state.words = words;
    state.version = version;
    state.mode = mode;
    state.progress = new Map(records.map((record) => [record.wordId, record]));
    state.searchIndex = new Map(words.map((word) => [word.id, searchTextForWord(word)]));
    elements.status.textContent = `${mode === "preview" ? "预览" : "正式"}词库 · ${words.length} 词 · v${version.contentVersion}`;
    renderSideStats();
    renderLibrary();
    startStudySession();
    if (location.hash.startsWith("#word-")) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start" }));
  } catch (error) {
    elements.loading.hidden = false;
    elements.loading.textContent = error.message;
    elements.studyStage.replaceChildren(node("p", "loading-state", error.message));
    elements.studyStage.setAttribute("aria-busy", "false");
    elements.status.textContent = "单词数据加载失败";
  }
  configureServiceWorker();
}

start();
