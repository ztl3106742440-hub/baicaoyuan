import {
  exportStudyBackup,
  getReviewState,
  importStudyBackup,
  readPreference,
  savePreference,
  saveReviewState,
} from "./storage.js";
import {
  entriesForPart,
  loadWritingData,
  searchTextForEntry,
  sentencesForPromptParagraph,
} from "./writing-data.js";

const part = document.body.dataset.part;
const qaMode = new URLSearchParams(location.search).get("qa") === "1";
const shell = document.querySelector("#appShell");
const shade = document.querySelector("#drawerShade");
const contentStatus = document.querySelector("#contentStatus");
const currentPartSections = [...document.querySelectorAll(".learning-section")];
const positionKey = `kaoyan.writing.position.${part}`;
const themeKey = "kaoyan.writing.theme";
const fontKey = "kaoyan.writing.largeType";
const partLabels = { A: "小作文", B: "大作文" };
const kindLabels = { template: "母版", expression: "功能句", topic: "主题卡", prompt: "题卡" };
const priorityLabels = { "must-memorize": "必须背", recommended: "推荐", understand: "理解" };
const reviewOptions = [
  ["new", "未学"],
  ["fuzzy", "模糊"],
  ["mastered", "掌握"],
];
const themeInformation = {
  nature: {
    src: new URL("../illustrations/nature-reader.svg", import.meta.url).href,
    alt: "林间阅读的猫狗插画",
    caption: "FOREST READER · 主题 A",
    color: "#eef0df",
  },
  newspaper: {
    src: new URL("../illustrations/newspaper-chart.svg", import.meta.url).href,
    alt: "报纸铜版画风格数据图",
    caption: "THE WRITING REVIEW · 主题 B",
    color: "#282924",
  },
  collage: {
    src: new URL("../illustrations/editorial-collage.svg", import.meta.url).href,
    alt: "花卉与纸片的编辑拼贴",
    caption: "FLEURS & NOTES · 主题 C",
    color: "#f7e4dc",
  },
};
const staticSearchItems = [
  ["A", "a-overview", "认识小作文", "10分、交际任务、格式与语气"],
  ["A", "a-five-steps", "先判题，再写", "收信人、目的、任务、语气、格式"],
  ["A", "a-navigation", "功能与体裁二维导航", "邮件、书信、通知、回复、邀请、建议"],
  ["A", "a-templates", "四组核心功能母版", "邀请安排、建议推荐、回复说明、通知招募"],
  ["A", "a-prompts", "小作文代表题与逐句精讲", "任务点、原创范文、难词、短评"],
  ["A", "a-expressions", "小作文功能句补充库", "称呼、目的、细节、礼貌结尾"],
  ["A", "a-takeaways", "小作文本节必带走", "格式自查、改写练习"],
  ["B", "b-overview", "大作文概览", "20分、图画、图表、图文混合"],
  ["B", "b-routes", "三类材料审题路线", "事实、单位、比较、寓意、论证"],
  ["B", "b-templates", "图画与图表核心母版", "三段骨架、槽位、迁移"],
  ["B", "b-expressions", "大作文功能句库", "数字、趋势、原因、意义、让步、措施"],
  ["B", "b-prompts", "大作文题卡逐句精讲", "审题、提纲、范文、批注"],
  ["B", "b-topics", "主题补充素材", "科技、成长、教育、文化、公共环境"],
  ["B", "b-takeaways", "大作文本节必带走", "数字表达、论证逻辑、考场自查"],
].map(([itemPart, anchor, title, summary]) => ({
  part: itemPart,
  anchor,
  title,
  summary,
  type: "章节",
  searchText: `${title} ${summary}`.toLocaleLowerCase("zh-CN"),
}));

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  return node;
}

function appendParagraph(parent, className, text) {
  if (!text) return null;
  const paragraph = element("p", className, text);
  parent.append(paragraph);
  return paragraph;
}

function createBadge(text, className = "") {
  return element("span", className, text);
}

function createEntityFrame(entry, overline) {
  const card = element("article", "entity-card");
  card.id = `entry-${entry.id}`;
  card.dataset.entryId = entry.id;
  const head = element("header", "entity-head");
  const copy = element("div");
  appendParagraph(copy, "entity-overline", `${overline} · ${entry.id}`);
  copy.append(element("h3", "", entry.title));
  appendParagraph(copy, "entity-summary", entry.zhSummary);
  const badges = element("div", "entry-badges");
  badges.append(createBadge(priorityLabels[entry.learningPriority] ?? entry.learningPriority));
  badges.append(createBadge(`难度 ${entry.difficulty}`));
  if (entry.editorial?.verificationStatus) badges.append(createBadge(entry.editorial.verificationStatus));
  if (entry.origin?.sourceType === "codex-demo") badges.append(createBadge("结构演示", "demo-badge"));
  head.append(copy, badges);
  card.append(head);
  card.append(createReviewControl(entry));
  return card;
}

function createReviewControl(entry) {
  const control = element("div", "review-control");
  control.append(element("span", "", "掌握状态"));
  const buttons = reviewOptions.map(([value, label]) => {
    const button = element("button", "", label);
    button.type = "button";
    button.dataset.reviewStatus = value;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", async () => {
      for (const candidate of buttons) {
        const active = candidate === button;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-pressed", String(active));
      }
      await saveReviewState(entry.id, value, activeBundle?.writingContentVersion ?? null);
    });
    control.append(button);
    return button;
  });
  getReviewState(entry.id).then((state) => {
    const current = state?.status ?? "new";
    for (const button of buttons) {
      const active = button.dataset.reviewStatus === current;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  });
  return control;
}

function appendGlossedEnglish(parent, sentence) {
  const paragraph = element("p", "sentence-en");
  const text = sentence?.en ?? "";
  const matches = (sentence?.vocabGlosses ?? [])
    .map((gloss) => ({ ...gloss, index: text.indexOf(gloss.surfaceEn) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index || right.surfaceEn.length - left.surfaceEn.length);
  let cursor = 0;
  for (const gloss of matches) {
    if (gloss.index < cursor) continue;
    paragraph.append(document.createTextNode(text.slice(cursor, gloss.index)));
    const mark = element("mark", "gloss", gloss.surfaceEn);
    const note = element("small", "gloss-note", gloss.meaningZh);
    if (gloss.usageZh) note.title = gloss.usageZh;
    mark.append(note);
    paragraph.append(mark);
    cursor = gloss.index + gloss.surfaceEn.length;
  }
  paragraph.append(document.createTextNode(text.slice(cursor)));
  parent.append(paragraph);
}

function createAnnotationDetails(sentence) {
  const notes = [
    ["语法", sentence.grammarNote, ""],
    ["风险", sentence.riskNote, "risk"],
    ["避坑", sentence.pitfallZh, "risk"],
  ].filter(([, value]) => value);
  if (notes.length === 0) return null;
  const details = element("details", "details-note");
  details.append(element("summary", "", "展开语法、边界与失分提醒"));
  for (const [label, value, className] of notes) details.append(element("div", className, `${label}：${value}`));
  return details;
}

function createAnnotatedSentence(sentence, { includeSlots = false } = {}) {
  const block = element("div", "annotated-sentence");
  appendGlossedEnglish(block, sentence);
  const annotations = element("div", "annotation-layer");
  appendParagraph(annotations, "sentence-zh", sentence.zh);
  if (sentence.whyZh) {
    const why = element("div", "why-note");
    why.append(element("b", "", "为什么这样写"), element("span", "", sentence.whyZh));
    annotations.append(why);
  }
  const details = createAnnotationDetails(sentence);
  if (details) annotations.append(details);
  block.append(annotations);
  if (includeSlots && sentence.skeleton) block.append(createSlotSkeleton(sentence));
  return block;
}

function createSlotSkeleton(sentence) {
  const wrapper = element("div");
  const skeleton = element("div", "slot-skeleton");
  const hint = element("p", "slot-hint", "轻点槽位查看中文提示和一个语法完整的示例。示例不是固定答案。");
  const source = sentence.skeleton;
  const matches = (sentence.slots ?? [])
    .map((slot) => ({ slot, index: source.indexOf(slot.placeholder) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index);
  let cursor = 0;
  for (const { slot, index } of matches) {
    if (index < cursor) continue;
    skeleton.append(document.createTextNode(source.slice(cursor, index)));
    const button = element("button", "slot-button", slot.placeholder);
    button.type = "button";
    button.dataset.placeholder = slot.placeholder;
    button.dataset.answer = slot.examples?.[0]?.en ?? slot.placeholder;
    button.addEventListener("click", () => {
      const filled = button.classList.toggle("filled");
      button.textContent = filled ? button.dataset.answer : button.dataset.placeholder;
      hint.textContent = `${slot.zhHint}；语法：${slot.grammar}${slot.examples?.[0] ? `；示例：${slot.examples[0].en}（${slot.examples[0].zh}）` : ""}`;
    });
    skeleton.append(button);
    cursor = index + slot.placeholder.length;
  }
  skeleton.append(document.createTextNode(source.slice(cursor)));
  wrapper.append(skeleton, hint);
  return wrapper;
}

function createTemplateCard(entry) {
  const card = createEntityFrame(entry, "TEMPLATE");
  const article = element("div", "template-article");
  const toolbar = element("div", "template-toolbar");
  const range = entry.targetWordCount ? `${entry.targetWordCount.min}–${entry.targetWordCount.max} 词` : "";
  toolbar.append(element("p", "", `${entry.article?.titleEn ?? entry.title}${range ? ` · ${range}` : ""}`));
  const fillButton = element("button", "", "一键填入槽位示例");
  fillButton.type = "button";
  fillButton.addEventListener("click", () => {
    const buttons = [...article.querySelectorAll(".slot-button")];
    const fill = buttons.some((button) => !button.classList.contains("filled"));
    for (const button of buttons) {
      button.classList.toggle("filled", fill);
      button.textContent = fill ? button.dataset.answer : button.dataset.placeholder;
    }
    fillButton.textContent = fill ? "恢复全部挖空" : "一键填入槽位示例";
  });
  toolbar.append(fillButton);
  article.append(toolbar);
  for (const paragraph of entry.article?.paragraphs ?? []) {
    const row = element("section", "template-paragraph");
    const label = element("div", "paragraph-label", String(paragraph.order).padStart(2, "0"));
    label.append(element("small", "", paragraph.functionZh));
    const sentences = element("div", "paragraph-sentences");
    for (const sentence of paragraph.sentences ?? []) sentences.append(createAnnotatedSentence(sentence, { includeSlots: true }));
    row.append(label, sentences);
    article.append(row);
  }
  if ((entry.inapplicableTasks ?? []).length > 0) {
    const details = element("details", "study-details");
    details.append(element("summary", "", "展开适用边界与不能硬套的任务"));
    const list = element("ul");
    for (const item of entry.inapplicableTasks) list.append(element("li", "", item));
    details.append(list);
    article.append(details);
  }
  card.append(article);
  return card;
}

function createExpressionCard(entry) {
  const card = createEntityFrame(entry, "EXPRESSION");
  card.classList.add("expression-card");
  appendParagraph(card, "expression-pattern", entry.patternEn);
  appendParagraph(card, "expression-zh", entry.meaningZh);
  const details = element("details");
  details.append(element("summary", "", "查看用法、替换与典型错误"));
  const body = element("div");
  if ((entry.usageConditions ?? []).length > 0) {
    body.append(element("strong", "", "适用条件"));
    const list = element("ul");
    for (const item of entry.usageConditions) list.append(element("li", "", item));
    body.append(list);
  }
  for (const alternative of entry.alternatives ?? []) {
    appendParagraph(body, "expression-pattern", `${alternative.level}：${alternative.patternEn}`);
    appendParagraph(body, "expression-zh", alternative.note ?? alternative.zhHint);
  }
  for (const error of entry.commonErrors ?? []) {
    appendParagraph(body, "topic-boundary", `错：${error.wrong}　→　对：${error.correct}。${error.reasonZh}`);
  }
  details.append(body);
  card.append(details);
  return card;
}

function createTopicCard(entry) {
  const card = createEntityFrame(entry, "TOPIC");
  appendParagraph(card, "expression-pattern", entry.thesisEn);
  appendParagraph(card, "expression-zh", entry.thesisZh);
  const chain = element("div", "topic-chain");
  for (const step of entry.reasoningChain ?? []) {
    const item = element("div", "topic-step");
    item.append(element("b", "", `STEP ${String(step.order).padStart(2, "0")}`));
    appendParagraph(item, "", step.zh);
    chain.append(item);
  }
  card.append(chain);
  if ((entry.inapplicableCases ?? []).length > 0) appendParagraph(card, "topic-boundary", `不适用边界：${entry.inapplicableCases.join("；")}`);
  return card;
}

function createPromptCard(entry) {
  const card = createEntityFrame(entry, "PROMPT");
  const brief = element("div", "prompt-brief");
  const material = element("section", "prompt-material");
  material.append(element("h4", "", entry.year ? `${entry.year} 年材料摘要` : "原创练习材料摘要"));
  appendParagraph(material, "", entry.materialSummaryZh);
  const tasks = element("section", "task-points");
  tasks.append(element("h4", "", "必答任务"));
  const taskList = element("ol");
  for (const point of entry.taskPoints ?? []) taskList.append(element("li", "", point.zh));
  tasks.append(taskList);
  brief.append(material, tasks);
  card.append(brief);

  const practice = element("details", "prompt-practice");
  practice.append(element("summary", "", "第一步：先自己审题并展开提纲"));
  const outline = element("section", "outline-panel");
  outline.append(element("h4", "", `建议用时 ${entry.practiceSettings?.recommendedMinutes ?? "—"} 分钟 · 先想后看`));
  const outlineList = element("ol");
  for (const item of entry.outline ?? []) outlineList.append(element("li", "", `${item.functionZh}：${item.contentZh}`));
  outline.append(outlineList);
  practice.append(outline);
  card.append(practice);

  if (entry.modelResponse) {
    const response = element("details", "model-response");
    response.append(element("summary", "", "第二步：显示原创示范与逐句批注"));
    appendParagraph(response, "model-disclaimer", entry.modelResponse.disclaimerZh);
    const toolbar = element("div", "reading-toolbar");
    toolbar.append(element("span", "", `${entry.modelResponse.label} · ${entry.modelResponse.wordCount} 词`));
    const readingMode = element("button", "", "临时隐藏批注，整篇连读");
    readingMode.type = "button";
    readingMode.addEventListener("click", () => {
      const active = response.classList.toggle("reading-mode");
      readingMode.textContent = active ? "恢复逐句批注" : "临时隐藏批注，整篇连读";
    });
    toolbar.append(readingMode);
    response.append(toolbar);
    for (const [index, paragraph] of entry.modelResponse.paragraphs.entries()) {
      const row = element("section", "template-paragraph");
      const label = element("div", "paragraph-label", String(index + 1).padStart(2, "0"));
      label.append(element("small", "", paragraph.commentZh));
      const sentenceColumn = element("div", "paragraph-sentences");
      for (const sentence of sentencesForPromptParagraph(paragraph)) sentenceColumn.append(createAnnotatedSentence(sentence));
      row.append(label, sentenceColumn);
      response.append(row);
    }
    card.append(response);
  }
  return card;
}

const renderers = {
  template: createTemplateCard,
  expression: createExpressionCard,
  topic: createTopicCard,
  prompt: createPromptCard,
};

let activeBundle = null;
let allEntries = [];

function renderEntryHosts(entries) {
  const partEntries = entriesForPart(entries, part);
  for (const host of document.querySelectorAll("[data-entity-kind]")) {
    const kind = host.dataset.entityKind;
    const matching = partEntries.filter((entry) => entry.kind === kind);
    if (matching.length === 0) {
      host.replaceChildren(element("div", "empty-state", host.dataset.empty));
      continue;
    }
    host.replaceChildren(...matching.map((entry) => renderers[kind](entry)));
  }
}

function updateContentStatus(mode, bundle, failures = []) {
  contentStatus.className = "content-status";
  if (mode === "demo") {
    contentStatus.classList.add("is-demo");
    contentStatus.textContent = bundle.disclaimerZh ?? "当前显示结构演示数据，不是正式教材。";
  } else if (mode === "release") {
    contentStatus.classList.add("is-ready");
    contentStatus.textContent = `正式教材已载入：版本 ${bundle.writingContentVersion}，共 ${bundle.entries.length} 个实体。`;
  } else if (mode === "preview") {
    contentStatus.classList.add("is-ready");
    contentStatus.textContent = `预览教材已载入：版本 ${bundle.writingContentVersion}，共 ${bundle.entries.length} 个实体。`;
  } else {
    contentStatus.classList.add("is-error");
    contentStatus.textContent = `尚无可用教材包。页面结构仍可检查；加载诊断：${failures.join("；")}`;
  }
}

function applyTheme(theme, persist = true) {
  const selected = themeInformation[theme] ? theme : "nature";
  document.documentElement.dataset.theme = selected;
  const info = themeInformation[selected];
  const image = document.querySelector("#heroArt");
  const caption = document.querySelector("#heroCaption");
  if (image) {
    image.src = info.src;
    image.alt = info.alt;
  }
  if (caption) caption.textContent = info.caption;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", info.color);
  for (const button of document.querySelectorAll("[data-theme-choice]")) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === selected));
  }
  if (persist) {
    try { localStorage.setItem(themeKey, selected); } catch {}
    savePreference("writingTheme", selected);
  }
}

function configureTheme() {
  const requestedTheme = new URLSearchParams(location.search).get("theme");
  applyTheme(themeInformation[requestedTheme] ? requestedTheme : document.documentElement.dataset.theme, false);
  for (const button of document.querySelectorAll("[data-theme-choice]")) {
    button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
  }
  readPreference("writingTheme").then((record) => {
    let hasLocal = false;
    try { hasLocal = Boolean(localStorage.getItem(themeKey)); } catch {}
    if (!hasLocal && record?.value) applyTheme(record.value);
  });
  addEventListener("storage", (event) => {
    if (event.key === themeKey && event.newValue) applyTheme(event.newValue, false);
  });
}

function isNarrow() {
  return matchMedia("(max-width: 800px)").matches;
}

function setDrawer(open) {
  shell.classList.toggle("drawer-open", open);
  shade.hidden = !open;
  document.body.style.overflow = open ? "hidden" : "";
  document.querySelector("#openDrawer")?.setAttribute("aria-expanded", String(open));
}

function configureSidebar() {
  let collapsed = false;
  try { collapsed = localStorage.getItem("kaoyan.writing.sidebarCollapsed") === "true"; } catch {}
  shell.classList.toggle("sidebar-collapsed", collapsed && !isNarrow());
  const collapseButton = document.querySelector("#sidebarCollapse");
  const label = collapseButton.querySelector(".collapse-label");
  function refreshLabel() {
    const isCollapsed = shell.classList.contains("sidebar-collapsed");
    collapseButton.setAttribute("aria-expanded", String(!isCollapsed));
    label.textContent = isNarrow() ? "关闭目录" : isCollapsed ? "展开目录" : "收起目录";
  }
  refreshLabel();
  collapseButton.addEventListener("click", () => {
    if (isNarrow()) {
      setDrawer(false);
      return;
    }
    const next = !shell.classList.contains("sidebar-collapsed");
    shell.classList.toggle("sidebar-collapsed", next);
    try { localStorage.setItem("kaoyan.writing.sidebarCollapsed", String(next)); } catch {}
    refreshLabel();
  });
  document.querySelector("#openDrawer").addEventListener("click", () => setDrawer(true));
  shade.addEventListener("click", () => setDrawer(false));
  document.querySelectorAll("#sectionNav a").forEach((link) => link.addEventListener("click", () => {
    if (isNarrow()) setDrawer(false);
  }));
  addEventListener("resize", () => {
    if (!isNarrow()) setDrawer(false);
    refreshLabel();
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shell.classList.contains("drawer-open")) setDrawer(false);
  });
}

function configureLearningUtilities() {
  const collapseButton = document.querySelector("#collapseAllContent");
  const collapseLabel = collapseButton?.querySelector(".sidebar-tool-label");
  collapseButton?.addEventListener("click", () => {
    const openItems = [...document.querySelectorAll("#mainContent details[open]")];
    for (const details of openItems) details.open = false;
    if (collapseLabel) {
      collapseLabel.textContent = openItems.length > 0 ? `已收起 ${openItems.length} 项` : "当前没有展开内容";
      setTimeout(() => { collapseLabel.textContent = "收起全部展开内容"; }, 1200);
    }
    if (isNarrow()) setDrawer(false);
  });

  for (const link of document.querySelectorAll(".top-page-button[data-part-link]")) {
    if (link.getAttribute("aria-current") === "page") {
      link.addEventListener("click", (event) => event.preventDefault());
      link.addEventListener("dblclick", (event) => {
        event.preventDefault();
        scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }
}

function setActiveSection(id) {
  for (const link of document.querySelectorAll("#sectionNav a")) {
    const active = link.hash === `#${id}`;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

function configureSectionTracking() {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
    if (visible[0]) setActiveSection(visible[0].target.id);
  }, { rootMargin: "-18% 0px -70% 0px", threshold: [0, .1] });
  for (const section of currentPartSections) observer.observe(section);
}

function readPosition(targetPart = part) {
  try { return JSON.parse(localStorage.getItem(`kaoyan.writing.position.${targetPart}`) ?? "null"); } catch { return null; }
}

function activeSectionId() {
  return document.querySelector("#sectionNav a.active")?.hash.slice(1) ?? currentPartSections[0]?.id ?? null;
}

function savePositionNow() {
  try {
    localStorage.setItem(positionKey, JSON.stringify({
      y: Math.max(0, Math.round(scrollY)),
      anchor: activeSectionId(),
      updatedAt: new Date().toISOString(),
    }));
  } catch {}
}

function configurePositionMemory() {
  let timer = null;
  addEventListener("scroll", () => {
    clearTimeout(timer);
    timer = setTimeout(savePositionNow, 180);
  }, { passive: true });
  addEventListener("pagehide", savePositionNow);
  for (const link of document.querySelectorAll("[data-part-link]")) link.addEventListener("click", savePositionNow);
  document.querySelector("#resumePosition").addEventListener("click", () => {
    const saved = readPosition();
    if (saved?.y >= 0) scrollTo({ top: saved.y, behavior: "smooth" });
  });
}

function restorePositionAfterRender() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (qaMode) {
      document.documentElement.dataset.qaClientWidth = String(document.documentElement.clientWidth);
      document.documentElement.dataset.qaScrollWidth = String(document.documentElement.scrollWidth);
      const widest = [...document.querySelectorAll("body *")]
        .map((node) => ({ node, rect: node.getBoundingClientRect() }))
        .filter(({ rect }) => rect.right > document.documentElement.clientWidth + 1)
        .sort((a, b) => b.rect.right - a.rect.right)[0];
      if (widest) {
        document.documentElement.dataset.qaOverflowTag = widest.node.tagName.toLowerCase();
        document.documentElement.dataset.qaOverflowClass = widest.node.className || "";
        document.documentElement.dataset.qaOverflowRight = widest.rect.right.toFixed(1);
      }
    }
    if (location.hash) {
      document.querySelector(location.hash)?.scrollIntoView({ block: "start" });
      return;
    }
    const saved = readPosition();
    if (saved?.y > 0) scrollTo({ top: saved.y, behavior: "auto" });
  }));
}

function configureFontSize() {
  let large = false;
  try { large = localStorage.getItem(fontKey) === "true"; } catch {}
  document.documentElement.classList.toggle("large-type", large);
  const button = document.querySelector("#fontToggle");
  button.textContent = large ? "A−" : "A+";
  button.addEventListener("click", () => {
    const next = !document.documentElement.classList.contains("large-type");
    document.documentElement.classList.toggle("large-type", next);
    button.textContent = next ? "A−" : "A+";
    try { localStorage.setItem(fontKey, String(next)); } catch {}
  });
}

function routeFor(itemPart, anchor) {
  if (itemPart === part) return `#${anchor}`;
  return itemPart === "A" ? `../part-a/#${anchor}` : `../part-b/#${anchor}`;
}

function dynamicSearchItems(entries) {
  const result = [];
  for (const entry of entries) {
    const parts = entry.examPart === "both" ? ["A", "B"] : [entry.examPart];
    for (const entryPart of parts) {
      result.push({
        part: entryPart,
        anchor: `entry-${entry.id}`,
        title: entry.title,
        summary: entry.zhSummary,
        type: kindLabels[entry.kind] ?? entry.kind,
        searchText: searchTextForEntry(entry),
      });
    }
  }
  return result;
}

function configureSearch(entries) {
  const dialog = document.querySelector("#searchDialog");
  const input = document.querySelector("#searchInput");
  const output = document.querySelector("#searchResults");
  const index = [...staticSearchItems, ...dynamicSearchItems(entries)];
  function renderResults() {
    const query = input.value.trim().toLocaleLowerCase("zh-CN");
    const matches = index.filter((item) => !query || item.searchText.includes(query)).slice(0, 30);
    if (matches.length === 0) {
      output.replaceChildren(element("p", "search-empty", "没有匹配项。试试更短的关键词。"));
      return;
    }
    output.replaceChildren(...matches.map((item) => {
      const link = element("a", "search-result");
      link.href = routeFor(item.part, item.anchor);
      link.append(
        element("span", "", `PART ${item.part} · ${partLabels[item.part]} · ${item.type}`),
        element("strong", "", item.title),
        element("small", "", item.summary),
      );
      link.addEventListener("click", () => dialog.close());
      return link;
    }));
  }
  document.querySelector("#openSearch").addEventListener("click", () => {
    renderResults();
    dialog.showModal();
    requestAnimationFrame(() => input.focus());
  });
  input.addEventListener("input", renderResults);
  addEventListener("keydown", (event) => {
    if (event.key === "/" && !dialog.open && !/^(INPUT|TEXTAREA)$/u.test(document.activeElement?.tagName ?? "")) {
      event.preventDefault();
      renderResults();
      dialog.showModal();
      input.focus();
    }
  });
}

function downloadJson(fileName, value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function backupDate() {
  return new Date().toISOString().slice(0, 10);
}

function configureDataCenter() {
  const dialog = document.querySelector("#dataDialog");
  const status = document.querySelector("#dataStatus");
  const importInput = document.querySelector("#importStudyData");
  for (const button of document.querySelectorAll(".open-data-center")) {
    button.addEventListener("click", () => {
      setDrawer(false);
      dialog.showModal();
    });
  }
  document.querySelector("#downloadTextbook").addEventListener("click", () => {
    if (!activeBundle) return;
    downloadJson(`baicaoyuan-writing-v${activeBundle.writingContentVersion ?? "preview"}.json`, activeBundle);
    status.textContent = `已下载当前作文教材，共 ${activeBundle.entries.length} 条。`;
  });
  document.querySelector("#exportStudyData").addEventListener("click", async () => {
    try {
      const backup = await exportStudyBackup();
      downloadJson(`baicaoyuan-study-${backupDate()}.json`, backup);
      status.textContent = "学习记录已经导出。请把文件保存在可靠的位置。";
    } catch (error) {
      status.textContent = `导出失败：${error.message}`;
    }
  });
  document.querySelector("#chooseStudyData").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async () => {
    const [file] = importInput.files;
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const counts = await importStudyBackup(backup);
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      status.textContent = `已导入 ${total} 条学习记录。页面将在 1 秒后刷新。`;
      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      status.textContent = `导入失败：${error.message}`;
    } finally {
      importInput.value = "";
    }
  });
}

async function configureServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    const workerUrl = new URL("../../sw.js", import.meta.url);
    const scopeUrl = new URL("../../", import.meta.url);
    const registration = await navigator.serviceWorker.register(workerUrl, { scope: scopeUrl.pathname });
    const banner = document.querySelector("#updateBanner");
    const showUpdate = () => { banner.hidden = false; };
    if (registration.waiting) showUpdate();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate();
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
    // Local development and unsupported hosting should not block reading.
  }
}

async function initialize() {
  history.scrollRestoration = "manual";
  configureTheme();
  configureSidebar();
  configureLearningUtilities();
  configureFontSize();
  configureSectionTracking();
  configurePositionMemory();
  const result = await loadWritingData();
  activeBundle = result.bundle;
  allEntries = result.bundle.entries;
  renderEntryHosts(allEntries);
  updateContentStatus(result.mode, result.bundle, result.failures);
  configureSearch(allEntries);
  configureDataCenter();
  restorePositionAfterRender();
  if (!qaMode) configureServiceWorker();
}

initialize();
