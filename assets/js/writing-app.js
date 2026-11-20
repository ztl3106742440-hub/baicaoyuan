import {
  exportStudyBackup,
  getReviewState,
  importStudyBackup,
  previewStudyBackup,
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
import {
  activateWritingOverlayLesson,
  renderWritingOverlays,
  writingOverlaySearchItems,
} from "./writing-overlays.js";
import { createExamDirections } from "./writing-exam-directions.js";
import { REVIEW_FORMAT, createReviewedEssay, reviewLessonTarget } from "./writing-review.js";
import { PART_B_MATERIALS_FORMAT, createPartBPromptMaterials } from "./writing-part-b-materials.js";
import { configurePageZoom, isCompactPage, watchCompactPage } from "./page-zoom.js";

const part = document.body.dataset.part;
const qaMode = new URLSearchParams(location.search).get("qa") === "1";
const shell = document.querySelector("#appShell");
const shade = document.querySelector("#drawerShade");
const sidebar = document.querySelector("#sidebar");
const contentStatus = document.querySelector("#contentStatus");
const actionStatus = document.querySelector("#writingActionStatus");
const currentPartSections = [...document.querySelectorAll(".learning-section")];
const appBar = document.querySelector(".app-bar");
const themeKey = "kaoyan.writing.theme";
const partLabels = { A: "小作文", B: "大作文" };
const kindLabels = { template: "母版", expression: "功能句", topic: "主题卡", prompt: "题卡" };
const kindSectionSuffix = { template: "templates", expression: "expressions", topic: "topics", prompt: "prompts" };
const entityPageSizes = { template: 1, prompt: 1, expression: 4, topic: 2 };
const priorityLabels = { "must-memorize": "必须背", recommended: "推荐", understand: "理解" };
const chapterAliases = new Map([
  ["a-five-steps", "a-overview"],
  ["a-navigation", "a-overview"],
]);
const reviewOptions = [
  ["new", "未学"],
  ["fuzzy", "模糊"],
  ["mastered", "掌握"],
];

let actionStatusTimer = null;

function announceAction(message, tone = "error") {
  if (!actionStatus) return;
  clearTimeout(actionStatusTimer);
  actionStatus.textContent = message;
  actionStatus.dataset.tone = tone;
  actionStatusTimer = setTimeout(() => {
    actionStatus.textContent = "";
    delete actionStatus.dataset.tone;
  }, 6000);
}
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
  ["A", "a-core", "主背", "万能加分句、整篇主背、跨题对照和题型短块"],
  ["A", "a-overview", "审题与体裁", "收信人、目的、任务、语气、格式、邮件与通知"],
  ["A", "a-templates", "四组核心功能母版", "邀请安排、建议推荐、回复说明、通知招募"],
  ["A", "a-prompts", "小作文真题范文", "题意、原创范文和段落讲解"],
  ["A", "a-expressions", "小作文功能句补充库", "称呼、目的、细节、礼貌结尾"],
  ["A", "a-topics", "小作文主题思路", "校园活动、沟通、建议与具体行动"],
  ["B", "b-core", "主背", "万能加分句、整篇主背、跨题对照和图表句架"],
  ["B", "b-overview", "大作文概览", "20分、图画、图表、图文混合"],
  ["B", "b-routes", "三类材料审题路线", "事实、单位、比较、寓意、论证"],
  ["B", "b-templates", "图画与图表核心母版", "三段骨架、槽位、迁移"],
  ["B", "b-expressions", "大作文功能句库", "数字、趋势、原因、意义、让步、措施"],
  ["B", "b-prompts", "大作文真题范文", "图画、图表、混合材料的题意与范文"],
  ["B", "b-topics", "主题补充素材", "科技、成长、教育、文化、公共环境"],
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

function appendTextList(parent, items, className = "") {
  if (!Array.isArray(items) || items.length === 0) return null;
  const list = element("ul", className);
  for (const item of items) list.append(element("li", "", item));
  parent.append(list);
  return list;
}

function createTeachingDetails(summaryText, className = "study-details") {
  const details = element("details", className);
  details.append(element("summary", "", summaryText));
  return details;
}

function sectionIdForKind(kind, targetPart = part) {
  return `${targetPart.toLocaleLowerCase("en-US")}-${kindSectionSuffix[kind]}`;
}

function partsForEntry(entry) {
  return entry?.examPart === "both" ? ["A", "B"] : [entry?.examPart].filter(Boolean);
}

function createEntityFrame(entry, { domIdPrefix = "", compact = false } = {}) {
  const card = element("article", "entity-card");
  card.id = `${domIdPrefix}entry-${entry.id}`;
  card.dataset.entryId = entry.id;
  card.dataset.entryKind = entry.kind;
  const head = element("header", "entity-head");
  const copy = element("div");
  copy.append(element("h3", "", entry.title));
  head.append(copy);
  if (!compact) appendParagraph(copy, "entity-summary", entry.zhSummary);
  const badges = element("div", "entry-badges");
  badges.append(createBadge(priorityLabels[entry.learningPriority] ?? entry.learningPriority));
  badges.append(createBadge(`难度 ${entry.difficulty}`));
  if (entry.origin?.sourceType === "codex-demo") badges.append(createBadge("结构演示", "demo-badge"));
  if (!compact) head.append(badges);
  card.append(head);
  if (entry.kind !== "prompt") card.append(createReviewControl(entry));
  return card;
}

function createReviewControl(entry) {
  const control = element("div", "review-control");
  control.append(element("span", "", "掌握状态"));
  let currentStatus = "new";
  const renderStatus = () => {
    for (const button of buttons) {
      const active = button.dataset.reviewStatus === currentStatus;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  };
  const buttons = reviewOptions.map(([value, label]) => {
    const button = element("button", "", label);
    button.type = "button";
    button.dataset.reviewStatus = value;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", async () => {
      for (const candidate of buttons) candidate.disabled = true;
      try {
        const saved = await saveReviewState(entry.id, value, activeBundle?.writingContentVersion ?? null);
        if (saved == null) throw new Error("当前浏览器没有开放本地存储");
        currentStatus = value;
        renderStatus();
      } catch (error) {
        renderStatus();
        announceAction(`掌握状态没有保存：${error.message}`);
      } finally {
        for (const candidate of buttons) candidate.disabled = false;
      }
    });
    control.append(button);
    return button;
  });
  getReviewState(entry.id).then((state) => {
    currentStatus = state?.status ?? "new";
    renderStatus();
  }).catch((error) => announceAction(`本机掌握状态暂时无法读取：${error.message}`));
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
  details.append(element("summary", "", "点击展开 · 语法、边界与失分提醒"));
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

function preferredPartForEntry(entry) {
  return partsForEntry(entry).includes(part) ? part : partsForEntry(entry)[0] ?? part;
}

function routeForEntry(entry, targetPart = preferredPartForEntry(entry)) {
  const query = `?entry=${encodeURIComponent(entry.id)}#entry-${encodeURIComponent(entry.id)}`;
  if (targetPart === part) return query;
  return targetPart === "A" ? `../part-a/${query}` : `../part-b/${query}`;
}

function appendTemplateGuide(parent, entry) {
  const hasGuide = (entry.applicableTasks ?? []).length > 0
    || (entry.structureMap ?? []).length > 0
    || (entry.migrationExamples ?? []).length > 0
    || (entry.inapplicableTasks ?? []).length > 0;
  if (!hasGuide) return;
  const details = createTeachingDetails("点击展开 · 适用任务、结构地图与迁移示例");
  const body = element("div", "teaching-detail-body");
  if ((entry.applicableTasks ?? []).length > 0) {
    body.append(element("h4", "", "适合解决什么任务"));
    appendTextList(body, entry.applicableTasks);
  }
  if ((entry.structureMap ?? []).length > 0) {
    body.append(element("h4", "", "结构地图"));
    const map = element("ol", "structure-map");
    for (const item of [...entry.structureMap].sort((left, right) => left.order - right.order)) {
      const row = element("li");
      row.append(element("b", "", item.label), element("span", "", item.goalZh));
      map.append(row);
    }
    body.append(map);
  }
  if ((entry.migrationExamples ?? []).length > 0) {
    body.append(element("h4", "", "换题迁移示例"));
    for (const migration of entry.migrationExamples) {
      const example = element("article", "migration-example");
      example.append(element("h5", "", migration.topicZh));
      appendParagraph(example, "", migration.summaryZh);
      for (const adaptation of migration.adaptations ?? []) {
        const row = element("div", "migration-row");
        appendParagraph(row, "migration-en", adaptation.en);
        appendParagraph(row, "migration-zh", adaptation.zh);
        appendParagraph(row, "migration-note", adaptation.note);
        example.append(row);
      }
      body.append(example);
    }
  }
  if ((entry.inapplicableTasks ?? []).length > 0) {
    body.append(element("h4", "", "不能硬套的任务"));
    appendTextList(body, entry.inapplicableTasks, "risk-list");
  }
  details.append(body);
  parent.append(details);
}

function appendSlotOverview(parent, slots) {
  if (!Array.isArray(slots) || slots.length === 0) return;
  parent.append(element("h4", "", "替换槽位"));
  const grid = element("div", "slot-overview");
  for (const slot of slots) {
    const item = element("article");
    item.append(element("b", "", slot.placeholder), element("span", "", slot.zhHint));
    appendParagraph(item, "", slot.grammar);
    for (const example of slot.examples ?? []) {
      appendParagraph(item, "slot-example-en", example.en);
      appendParagraph(item, "slot-example-zh", example.zh);
    }
    grid.append(item);
  }
  parent.append(grid);
}

function appendBilingualExamples(parent, examples, heading = "完整例句") {
  if (!Array.isArray(examples) || examples.length === 0) return;
  parent.append(element("h4", "", heading));
  const list = element("div", "bilingual-examples");
  for (const example of examples) {
    const item = element("article");
    appendParagraph(item, "example-en", example.en);
    appendParagraph(item, "example-zh", example.zh);
    list.append(item);
  }
  parent.append(list);
}

function appendPromptStudyInfo(card, entry) {
  const hasInformation = (entry.commonMistakes ?? []).length > 0
    || (entry.practiceSettings?.formatChecklist ?? []).length > 0;
  if (!hasInformation) return;
  const details = createTeachingDetails("点击展开 · 审题陷阱与考场检查");
  const body = element("div", "teaching-detail-body");
  if ((entry.commonMistakes ?? []).length > 0) {
    body.append(element("h4", "", "常见失误"));
    appendTextList(body, entry.commonMistakes, "risk-list");
  }
  if ((entry.practiceSettings?.formatChecklist ?? []).length > 0) {
    body.append(element("h4", "", "交卷前检查"));
    appendTextList(body, entry.practiceSettings.formatChecklist, "check-list");
  }
  details.append(body);
  card.append(details);
}

function createTemplateCard(entry, options = {}) {
  const card = createEntityFrame(entry, options);
  if (reviewOverlay) {
    appendTemplateGuide(card, entry);
    const skeleton = createTeachingDetails("骨架与替换槽位");
    const body = element("div", "teaching-detail-body");
    for (const paragraph of entry.article.paragraphs) {
      const sentences = paragraph.sentences.filter((sentence) => (sentence.slots ?? []).length > 0);
      if (sentences.length === 0) continue;
      body.append(element("h4", "", paragraph.roleZh ?? paragraph.goalZh ?? `第 ${paragraph.order} 段`));
      for (const sentence of sentences) body.append(createSlotSkeleton(sentence));
    }
    if (body.childElementCount) {
      skeleton.append(body);
      card.append(skeleton);
    }
    return card;
  }
  const content = createTeachingDetails("点击展开 · 完整母版、槽位替换与逐句批注", "template-content");
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
  appendTemplateGuide(article, entry);
  content.append(article);
  card.append(content);
  return card;
}

function createExpressionCard(entry) {
  const card = createEntityFrame(entry);
  card.classList.add("expression-card");
  appendParagraph(card, "expression-pattern", entry.patternEn);
  appendParagraph(card, "expression-zh", entry.meaningZh);
  if (entry.memorizationCue) {
    const cue = element("aside", "memory-cue");
    cue.append(element("b", "", "一句记法"), element("span", "", entry.memorizationCue));
    card.append(cue);
  }
  const details = createTeachingDetails("点击展开 · 用法、槽位、例句与典型错误");
  const body = element("div", "teaching-detail-body");
  if ((entry.usageConditions ?? []).length > 0) {
    body.append(element("h4", "", "适用条件"));
    appendTextList(body, entry.usageConditions);
  }
  appendSlotOverview(body, entry.slots);
  appendBilingualExamples(body, entry.examples);
  if ((entry.alternatives ?? []).length > 0) body.append(element("h4", "", "安全替换与升级表达"));
  for (const alternative of entry.alternatives ?? []) {
    appendParagraph(body, "expression-pattern", `${alternative.level}：${alternative.patternEn}`);
    appendParagraph(body, "expression-zh", alternative.note ?? alternative.zhHint);
  }
  if ((entry.commonErrors ?? []).length > 0) body.append(element("h4", "", "典型错误"));
  for (const error of entry.commonErrors ?? []) {
    appendParagraph(body, "topic-boundary", `错：${error.wrong}　→　对：${error.correct}。${error.reasonZh}`);
  }
  if ((entry.applicationLimits ?? []).length > 0) {
    body.append(element("h4", "", "不能使用的情境"));
    appendTextList(body, entry.applicationLimits, "risk-list");
  }
  details.append(body);
  card.append(details);
  return card;
}

function createTopicCard(entry) {
  const card = createEntityFrame(entry);
  appendParagraph(card, "expression-pattern", entry.thesisEn);
  appendParagraph(card, "expression-zh", entry.thesisZh);
  const chain = element("div", "topic-chain");
  for (const step of entry.reasoningChain ?? []) {
    const item = element("div", "topic-step");
    item.append(element("b", "", `STEP ${String(step.order).padStart(2, "0")}`));
    appendParagraph(item, "topic-step-zh", step.zh);
    appendParagraph(item, "topic-step-en", step.en);
    chain.append(item);
  }
  card.append(chain);
  const guide = createTeachingDetails("点击展开 · 适用任务、例证与论证边界");
  const guideBody = element("div", "teaching-detail-body");
  if ((entry.applicableTasks ?? []).length > 0) {
    guideBody.append(element("h4", "", "适用任务"));
    appendTextList(guideBody, entry.applicableTasks);
  }
  appendBilingualExamples(guideBody, entry.evidenceExamples, "可替换例证");
  if ((entry.inapplicableCases ?? []).length > 0) {
    guideBody.append(element("h4", "", "不适用边界"));
    appendTextList(guideBody, entry.inapplicableCases, "risk-list");
  }
  if (guideBody.childElementCount > 0) {
    guide.append(guideBody);
    card.append(guide);
  }
  return card;
}

function createPromptCard(entry) {
  const review = reviewOverlay?.essayMeta[entry.id];
  const card = createEntityFrame(entry, { compact: Boolean(review) });
  const directions = createExamDirections(entry.year, entry.examPart);
  if (directions) card.append(directions);
  if (review) {
    const note = createTeachingDetails("审题要点");
    const body = element("div", "teaching-detail-body");
    if (entry.examPart === "A") appendParagraph(body, "", entry.materialSummaryZh);
    appendTextList(body, entry.taskPoints.filter((point) => entry.examPart === "B").map((point) => point.zh));
    if (body.childElementCount > 0) { note.append(body); card.append(note); }
    const materials = createPartBPromptMaterials(partBMaterialsOverlay, entry.id);
    if (materials) card.append(materials);
    card.append(createReviewedEssay(entry, review));
    const transfer = createTeachingDetails("换题怎么填");
    appendParagraph(transfer, "review-note", review.transfer);
    card.append(transfer, createReviewControl(entry));
    return card;
  }
  const brief = element("div", "prompt-brief");
  const material = element("section", "prompt-material");
  material.append(element("h4", "", entry.year ? "审题提示" : "原创练习材料摘要"));
  appendParagraph(material, "", entry.materialSummaryZh);
  const tasks = element("section", "task-points");
  tasks.append(element("h4", "", entry.year ? "答题与展开建议" : "必答任务"));
  const taskList = element("ol");
  for (const point of entry.taskPoints ?? []) taskList.append(element("li", "", point.zh));
  tasks.append(taskList);
  brief.append(material, tasks);
  card.append(brief);

  const practice = element("details", "prompt-practice");
  practice.append(element("summary", "", "审题与提纲"));
  const outline = element("section", "outline-panel");
  outline.append(element("h4", "", `建议用时 ${entry.practiceSettings?.recommendedMinutes ?? "—"} 分钟 · 先想后看`));
  const outlineList = element("ol");
  for (const item of entry.outline ?? []) outlineList.append(element("li", "", `${item.functionZh}：${item.contentZh}`));
  outline.append(outlineList);
  practice.append(outline);
  card.append(practice);

  appendPromptStudyInfo(card, entry);

  if (entry.modelResponse) {
    const response = element("details", "model-response");
    response.open = true;
    response.append(element("summary", "", "原创参考范文"));
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
  card.append(createReviewControl(entry));
  return card;
}

const renderers = {
  template: createTemplateCard,
  expression: createExpressionCard,
  topic: createTopicCard,
  prompt: createPromptCard,
};

let activeBundle = null;
let reviewOverlay = null;
let partBMaterialsOverlay = null;
let allEntries = [];
let entryIndex = new Map();
const entityHostStates = new Map();
let activeChapterId = currentPartSections[0]?.id ?? null;
let chapterBrowser = null;

function pageLabel(state, pageIndex) {
  const start = pageIndex * state.pageSize;
  const end = Math.min(start + state.pageSize, state.entries.length);
  if (state.pageSize === 1) return state.entries[start]?.title ?? "";
  return `第 ${pageIndex + 1} 组 · ${start + 1}–${end}`;
}

function createEntityPager(state, locationLabel) {
  const pager = element("nav", "entity-pager");
  pager.setAttribute("aria-label", `${kindLabels[state.kind]}${locationLabel}分页`);
  const unit = state.kind === "prompt" ? "题" : state.pageSize === 1 ? "套" : "组";
  const previous = element("button", "entity-page-button", `上一${unit}`);
  previous.type = "button";
  previous.addEventListener("click", () => changePage(state.page - 1, "previous"));
  const select = element("select", "entity-page-select");
  select.setAttribute("aria-label", `选择${kindLabels[state.kind]}页`);
  for (let index = 0; index < state.pageCount; index += 1) {
    const option = element("option", "", pageLabel(state, index));
    option.value = String(index);
    const label = state.groupLabels?.get(state.entries[index].id);
    if (label && select.lastElementChild?.label !== label) {
      const group = element("optgroup");
      group.label = label;
      select.append(group);
    }
    if (label) select.lastElementChild.append(option);
    else select.append(option);
  }
  select.addEventListener("change", () => changePage(Number(select.value), "select"));
  const next = element("button", "entity-page-button", `下一${unit}`);
  next.type = "button";
  next.addEventListener("click", () => changePage(state.page + 1, "next"));
  pager.append(previous, select, next);
  state.pagers.push({ pager, previous, select, next });
  return pager;

  function changePage(page, control) {
    renderHostPage(state, page);
    const topControls = state.pagers[0];
    const target = topControls[control].disabled ? topControls.select : topControls[control];
    target.focus({ preventScroll: true });
    scrollToReadingStart(state.host);
  }
}

function renderHostPage(state, page = state.page) {
  state.page = Math.max(0, Math.min(page, state.pageCount - 1));
  const start = state.page * state.pageSize;
  const visible = state.entries.slice(start, start + state.pageSize);
  state.cards.replaceChildren(...visible.map((entry) => renderers[entry.kind](entry)));
  const end = Math.min(start + visible.length, state.entries.length);
  const range = state.pageSize === 1 ? String(end) : `${start + 1}–${end}`;
  state.meta.textContent = `${kindLabels[state.kind]}共 ${state.entries.length} 条 · 当前 ${range}`;
  for (const controls of state.pagers) {
    controls.pager.hidden = state.pageCount <= 1;
    controls.previous.disabled = state.page === 0;
    controls.next.disabled = state.page === state.pageCount - 1;
    controls.select.value = String(state.page);
  }
}

function initializeEntityHost(host, entries, groupLabels) {
  const kind = host.dataset.entityKind;
  if (entries.length === 0) {
    host.replaceChildren(element("div", "empty-state", host.dataset.empty));
    return;
  }
  const pageSize = entityPageSizes[kind] ?? 4;
  const state = {
    kind,
    host,
    entries,
    groupLabels,
    pageSize,
    pageCount: Math.max(1, Math.ceil(entries.length / pageSize)),
    page: 0,
    pagers: [],
    meta: element("p", "entity-page-meta"),
    cards: element("div", "entity-page-cards"),
  };
  state.meta.setAttribute("role", "status");
  state.meta.setAttribute("aria-live", "polite");
  const shellNode = element("div", "entity-page-shell");
  shellNode.append(state.meta, createEntityPager(state, "顶部"), state.cards, createEntityPager(state, "底部"));
  host.replaceChildren(shellNode);
  entityHostStates.set(kind, state);
  renderHostPage(state);
}

function renderEntryHosts(entries) {
  entityHostStates.clear();
  const partEntries = entriesForPart(entries, part);
  for (const host of document.querySelectorAll("[data-entity-kind]")) {
    const kind = host.dataset.entityKind;
    const matching = partEntries.filter((entry) => entry.kind === kind);
    if (kind === "prompt" && reviewOverlay) {
      const groupLabels = new Map(
        reviewOverlay.parts[part].groups.flatMap((group) => group.ids.map((id) => [id, group.title])),
      );
      const ordered = [...groupLabels.keys()].map((id) => entryIndex.get(id));
      for (const entry of matching) {
        if (groupLabels.has(entry.id)) continue;
        groupLabels.set(entry.id, "补充题卡");
        ordered.push(entry);
      }
      initializeEntityHost(host, ordered, groupLabels);
    } else initializeEntityHost(host, matching);
  }
}

function updateContentStatus(mode, bundle, failures = []) {
  contentStatus.className = "content-status";
  if (mode === "demo") {
    contentStatus.classList.add("is-demo");
    contentStatus.textContent = bundle.disclaimerZh ?? "当前显示结构演示数据，不是正式教材。";
  } else if (mode === "release" || mode === "preview") {
    contentStatus.classList.add("is-ready");
    contentStatus.textContent = "";
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
    void savePreference("writingTheme", selected).catch(() => {});
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
  }).catch(() => {});
  addEventListener("storage", (event) => {
    if (event.key === themeKey && event.newValue) applyTheme(event.newValue, false);
  });
}

function isNarrow() {
  return isCompactPage();
}

let drawerReturnFocus = null;

function drawerFocusableElements() {
  return [...sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((node) => !node.hidden && node.getClientRects().length > 0);
}

function setDrawer(open, { restoreFocus = true } = {}) {
  const wasOpen = shell.classList.contains("drawer-open");
  const shouldOpen = Boolean(open && isNarrow());
  if (shouldOpen && !wasOpen) drawerReturnFocus = document.activeElement;
  shell.classList.toggle("drawer-open", shouldOpen);
  shade.hidden = !shouldOpen;
  document.body.style.overflow = shouldOpen ? "hidden" : "";
  document.querySelector("#openDrawer")?.setAttribute("aria-expanded", String(shouldOpen));
  sidebar.inert = isNarrow() && !shouldOpen;
  if (isNarrow() && !shouldOpen) sidebar.setAttribute("aria-hidden", "true");
  else sidebar.removeAttribute("aria-hidden");
  if (shouldOpen) {
    requestAnimationFrame(() => document.querySelector("#sidebarCollapse")?.focus());
  } else if (wasOpen && restoreFocus && drawerReturnFocus instanceof HTMLElement) {
    drawerReturnFocus.focus({ preventScroll: true });
  }
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
  setDrawer(false, { restoreFocus: false });
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
  watchCompactPage(() => {
    setDrawer(false, { restoreFocus: false });
    refreshLabel();
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shell.classList.contains("drawer-open")) {
      event.preventDefault();
      setDrawer(false);
      return;
    }
    if (event.key !== "Tab" || !shell.classList.contains("drawer-open")) return;
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
        scrollTo({ top: 0, behavior: "instant" });
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

function chapterTitle(id) {
  return document.querySelector(`#sectionNav a[href="#${CSS.escape(id)}"] span`)?.textContent?.trim()
    ?? document.querySelector(`#${CSS.escape(id)} h2`)?.textContent?.trim()
    ?? id;
}

function updateChapterBrowser() {
  if (!chapterBrowser || !activeChapterId) return;
  const index = currentPartSections.findIndex((section) => section.id === activeChapterId);
  chapterBrowser.querySelector("[data-chapter-status]").textContent = `第 ${index + 1} / ${currentPartSections.length} 章 · ${chapterTitle(activeChapterId)}`;
  chapterBrowser.querySelector("[data-chapter-previous]").disabled = index <= 0;
  chapterBrowser.querySelector("[data-chapter-next]").disabled = index >= currentPartSections.length - 1;
}

function scrollToReadingStart(target) {
  const headerHeight = appBar.getBoundingClientRect().height + chapterBrowser.getBoundingClientRect().height;
  const top = target.getBoundingClientRect().top + scrollY - headerHeight - 12;
  scrollTo({ top: Math.max(0, top), behavior: "instant" });
}

function focusHeading(heading) {
  heading?.setAttribute("tabindex", "-1");
  heading?.focus({ preventScroll: true });
}

function showChapter(id, { updateHistory = false, focus = false, scroll = true, lessonId = null } = {}) {
  const target = currentPartSections.find((section) => section.id === id) ?? currentPartSections[0];
  if (!target) return;
  activeChapterId = target.id;
  for (const section of currentPartSections) {
    const active = section === target;
    section.hidden = !active;
    section.classList.toggle("active-chapter", active);
  }
  setActiveSection(activeChapterId);
  updateChapterBrowser();
  const reviewTarget = lessonId ? reviewLessonTarget(lessonId) : null;
  const activated = lessonId && !reviewTarget ? activateWritingOverlayLesson(lessonId) : null;
  const lessonTarget = reviewTarget ?? (activated instanceof HTMLElement ? activated : null);
  if (updateHistory) {
    const url = new URL(location.href);
    url.searchParams.delete("entry");
    if (lessonId) url.searchParams.set("lesson", lessonId);
    else url.searchParams.delete("lesson");
    url.hash = activeChapterId;
    if (url.href !== location.href) history.pushState({}, "", url);
  }
  if (focus) focusHeading(lessonTarget?.querySelector("h4") ?? target.querySelector("h2"));
  if (scroll) scrollToReadingStart(lessonTarget ?? target);
}

function sectionForEntry(entry) {
  const id = sectionIdForKind(entry.kind);
  return currentPartSections.some((section) => section.id === id) ? id : currentPartSections[0]?.id;
}

function goToEntry(entryId, { focus = true, updateHistory = true } = {}) {
  const entry = entryIndex.get(entryId);
  if (!entry) return false;
  if (!partsForEntry(entry).includes(part)) {
    location.href = routeForEntry(entry);
    return true;
  }
  const state = entityHostStates.get(entry.kind);
  const entryPosition = state?.entries.findIndex((candidate) => candidate.id === entryId) ?? -1;
  if (!state || entryPosition < 0) return false;
  const chapterId = sectionForEntry(entry);
  showChapter(chapterId, { scroll: false });
  if (updateHistory) {
    const url = new URL(location.href);
    url.searchParams.set("entry", entryId);
    url.searchParams.delete("lesson");
    url.hash = `entry-${entryId}`;
    if (url.href !== location.href) history.pushState({}, "", url);
  }
  renderHostPage(state, Math.floor(entryPosition / state.pageSize));
  const card = document.getElementById(`entry-${entryId}`);
  const archive = card.closest(".materials-archive");
  if (archive) archive.open = true;
  if (focus) focusHeading(card.querySelector("h3"));
  scrollToReadingStart(card);
  return true;
}

function requestedEntryIdFromLocation() {
  const requested = new URLSearchParams(location.search).get("entry");
  if (requested) return requested;
  return location.hash.startsWith("#entry-") ? location.hash.slice(7) : null;
}

function chapterFromLocation() {
  const hashId = location.hash.slice(1);
  const normalizedHashId = chapterAliases.get(hashId) ?? hashId;
  return normalizedHashId || currentPartSections[0]?.id;
}

function showLocation({ initial = false } = {}) {
  const entryId = requestedEntryIdFromLocation();
  if (entryId && goToEntry(entryId, { focus: false, updateHistory: false })) return;
  const lessonId = new URLSearchParams(location.search).get("lesson");
  showChapter(chapterFromLocation(), { lessonId, scroll: !initial || Boolean(location.hash || lessonId) });
}

function configureChapterNavigation() {
  chapterBrowser = element("nav", "chapter-browser");
  chapterBrowser.setAttribute("aria-label", `${partLabels[part]}章节浏览`);
  const previous = element("button", "chapter-arrow", "上一章");
  previous.type = "button";
  previous.dataset.chapterPrevious = "";
  const next = element("button", "chapter-arrow", "下一章");
  next.type = "button";
  next.dataset.chapterNext = "";
  const status = element("p", "chapter-status");
  status.dataset.chapterStatus = "";
  status.setAttribute("aria-live", "polite");
  previous.addEventListener("click", () => {
    const index = currentPartSections.findIndex((section) => section.id === activeChapterId);
    if (index > 0) showChapter(currentPartSections[index - 1].id, { updateHistory: true, focus: true });
  });
  next.addEventListener("click", () => {
    const index = currentPartSections.findIndex((section) => section.id === activeChapterId);
    if (index < currentPartSections.length - 1) showChapter(currentPartSections[index + 1].id, { updateHistory: true, focus: true });
  });
  chapterBrowser.append(previous, status, next);
  contentStatus.insertAdjacentElement("afterend", chapterBrowser);

  for (const link of document.querySelectorAll("#sectionNav a")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setDrawer(false, { restoreFocus: false });
      showChapter(link.hash.slice(1), { updateHistory: true, focus: true });
    });
  }
  addEventListener("popstate", () => showLocation());
}

function trackAppBarHeight() {
  const column = appBar.closest(".main-column");
  const update = () => column.style.setProperty("--app-bar-offset", `${appBar.offsetHeight}px`);
  update();
  new ResizeObserver(update).observe(appBar);
  addEventListener("pagezoomchange", update);
}

function routeFor(itemPart, anchor, entryId = null, lessonId = null) {
  if (entryId && entryIndex.has(entryId)) return routeForEntry(entryIndex.get(entryId), itemPart);
  const lessonQuery = lessonId ? `?lesson=${encodeURIComponent(lessonId)}` : "";
  if (itemPart === part) return `${lessonQuery}#${anchor}`;
  return itemPart === "A" ? `../part-a/${lessonQuery}#${anchor}` : `../part-b/${lessonQuery}#${anchor}`;
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
        entryId: entry.id,
        searchText: searchTextForEntry(entry),
      });
    }
  }
  return result;
}

function configureSearch(entries, overlayItems = []) {
  const dialog = document.querySelector("#searchDialog");
  const input = document.querySelector("#searchInput");
  const output = document.querySelector("#searchResults");
  const index = [...staticSearchItems, ...overlayItems, ...dynamicSearchItems(entries)];
  function renderResults() {
    const query = input.value.trim().toLocaleLowerCase("zh-CN");
    const matches = index.filter((item) => !query || item.searchText.includes(query)).slice(0, 30);
    if (matches.length === 0) {
      output.replaceChildren(element("p", "search-empty", "没有匹配项。试试更短的关键词。"));
      return;
    }
    output.replaceChildren(...matches.map((item) => {
      const link = element("a", "search-result");
      link.href = routeFor(item.part, item.anchor, item.entryId, item.overlayChapterId);
      link.append(
        element("span", "", `PART ${item.part} · ${partLabels[item.part]} · ${item.type}`),
        element("strong", "", item.title),
        element("small", "", item.summary),
      );
      link.addEventListener("click", (event) => {
        dialog.close();
        if (item.part !== part) return;
        event.preventDefault();
        setDrawer(false, { restoreFocus: false });
        if (item.entryId) goToEntry(item.entryId);
        else showChapter(item.anchor, { updateHistory: true, focus: true, lessonId: item.overlayChapterId });
      });
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
      if (file.size > 5 * 1024 * 1024) throw new Error("文件超过 5 MB，请确认没有误选教材数据包。");
      const backup = JSON.parse(await file.text());
      const preview = await previewStudyBackup(backup);
      const accepted = confirm(`将新增 ${preview.additions} 条本机没有的记录；${preview.conflicts} 条同 ID 记录会保留当前平板版本，不会覆盖。继续吗？`);
      if (!accepted) {
        status.textContent = "已取消导入，没有修改本机记录。";
        return;
      }
      const result = await importStudyBackup(backup);
      status.textContent = `已新增 ${result.additions} 条记录，保留 ${result.conflictsPreserved} 条本机冲突记录。页面将在 1 秒后刷新。`;
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
    await navigator.serviceWorker.register(workerUrl, { scope: scopeUrl.pathname });
  } catch {
    // Local development and unsupported hosting should not block reading.
  }
}

async function initialize() {
  history.scrollRestoration = "manual";
  for (const [index, section] of currentPartSections.entries()) section.hidden = index !== 0;
  configureTheme();
  configurePageZoom(() => setDrawer(false, { restoreFocus: false }));
  trackAppBarHeight();
  configureSidebar();
  configureLearningUtilities();
  const result = await loadWritingData();
  activeBundle = result.bundle;
  allEntries = result.bundle.entries;
  entryIndex = new Map(allEntries.map((entry) => [entry.id, entry]));
  const overlays = Array.isArray(result.bundle.overlays) ? result.bundle.overlays : [];
  reviewOverlay = overlays.find((overlay) => overlay.format === REVIEW_FORMAT);
  if (part === "B") partBMaterialsOverlay = overlays.find((overlay) => overlay.format === PART_B_MATERIALS_FORMAT);
  renderEntryHosts(allEntries);
  renderWritingOverlays({
    overlays,
    part,
    entryIndex,
    renderTemplateCard: createTemplateCard,
  });
  updateContentStatus(result.mode, result.bundle, result.failures);
  configureChapterNavigation();
  const overlaySearchItems = ["A", "B"].flatMap((targetPart) => writingOverlaySearchItems(overlays, targetPart));
  configureSearch(allEntries, overlaySearchItems);
  configureDataCenter();
  showLocation({ initial: true });
  if (!qaMode) configureServiceWorker();
}

initialize();
