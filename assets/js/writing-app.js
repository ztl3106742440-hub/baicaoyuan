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
const sidebar = document.querySelector("#sidebar");
const contentStatus = document.querySelector("#contentStatus");
const currentPartSections = [...document.querySelectorAll(".learning-section")];
const positionKey = `kaoyan.writing.position.${part}`;
const themeKey = "kaoyan.writing.theme";
const fontKey = "kaoyan.writing.largeType";
const partLabels = { A: "小作文", B: "大作文" };
const kindLabels = { template: "母版", expression: "功能句", topic: "主题卡", prompt: "题卡" };
const kindSectionSuffix = { template: "templates", expression: "expressions", topic: "topics", prompt: "prompts" };
const entityPageSizes = { template: 1, prompt: 1, expression: 4, topic: 2 };
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
  ["A", "a-topics", "小作文主题思路", "校园活动、沟通、建议与具体行动"],
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

function createEntityFrame(entry, overline) {
  const card = element("article", "entity-card");
  card.id = `entry-${entry.id}`;
  card.dataset.entryId = entry.id;
  card.dataset.entryKind = entry.kind;
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

function uniqueIds(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value))];
}

function expressionIdsForTemplate(entry) {
  return uniqueIds((entry.article?.paragraphs ?? []).flatMap((paragraph) =>
    (paragraph.sentences ?? []).flatMap((sentence) => sentence.expressionIds ?? [])));
}

function relationGroupsFor(entry) {
  if (entry.kind === "template") {
    return [
      ["配套功能句", expressionIdsForTemplate(entry)],
      ["相关题卡", entry.relatedPromptIds ?? []],
      ["关联单词", entry.wordIds ?? []],
    ];
  }
  if (entry.kind === "expression") {
    return [
      ["可用母版", entry.relatedTemplateIds ?? []],
      ["相关主题", entry.relatedTopicIds ?? []],
      ["相关题卡", entry.relatedPromptIds ?? []],
      ["关联单词", entry.wordIds ?? []],
    ];
  }
  if (entry.kind === "topic") {
    return [
      ["可用母版", entry.relatedTemplateIds ?? []],
      ["配套功能句", entry.expressionIds ?? []],
      ["相关题卡", entry.relatedPromptIds ?? []],
      ["关联单词", entry.wordIds ?? []],
    ];
  }
  return [
    ["关联母版", entry.relatedTemplateIds ?? []],
    ["推荐功能句", entry.expressionIds ?? []],
    ["主题思路", entry.topicIds ?? []],
    ["关联单词", entry.wordIds ?? []],
  ];
}

function preferredPartForEntry(entry) {
  return partsForEntry(entry).includes(part) ? part : partsForEntry(entry)[0] ?? part;
}

function routeForEntry(entry) {
  const targetPart = preferredPartForEntry(entry);
  const query = `?entry=${encodeURIComponent(entry.id)}#entry-${encodeURIComponent(entry.id)}`;
  if (targetPart === part) return query;
  return targetPart === "A" ? `../part-a/${query}` : `../part-b/${query}`;
}

function createRelationPanel(entry) {
  const groups = relationGroupsFor(entry)
    .map(([label, ids]) => [label, uniqueIds(ids)])
    .filter(([, ids]) => ids.length > 0);
  if (groups.length === 0) return null;

  const panel = element("section", "relation-panel");
  panel.append(element("h4", "", "关联学习"));
  for (const [label, ids] of groups) {
    const group = element("div", "relation-group");
    group.append(element("span", "relation-label", label));
    const links = element("div", "relation-links");
    for (const id of ids) {
      const target = entryIndex.get(id);
      if (target) {
        const link = element("a", "relation-link", target.title);
        link.href = routeForEntry(target);
        link.dataset.relatedEntryId = target.id;
        if (preferredPartForEntry(target) === part) {
          link.addEventListener("click", (event) => {
            event.preventDefault();
            goToEntry(target.id, { focus: true, historyMode: "push" });
          });
        }
        links.append(link);
      } else if (id.startsWith("w-")) {
        const link = element("a", "relation-link relation-word", id.replace(/^w-/u, ""));
        link.href = `../../vocabulary/?q=${encodeURIComponent(id.replace(/^w-/u, ""))}`;
        links.append(link);
      }
    }
    if (links.childElementCount > 0) {
      group.append(links);
      panel.append(group);
    }
  }
  return panel.childElementCount > 1 ? panel : null;
}

function appendRelationPanel(card, entry) {
  const panel = createRelationPanel(entry);
  if (panel) card.append(panel);
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
    if (example.sourceType) appendParagraph(item, "example-source", `来源类型：${example.sourceType}`);
    list.append(item);
  }
  parent.append(list);
}

function appendPromptStudyInfo(card, entry) {
  const hasInformation = (entry.commonMistakes ?? []).length > 0
    || (entry.practiceSettings?.formatChecklist ?? []).length > 0
    || (entry.verifiedFacts ?? []).length > 0
    || entry.source;
  if (!hasInformation) return;
  const details = createTeachingDetails("点击展开 · 审题陷阱、考场检查与来源");
  const body = element("div", "teaching-detail-body");
  if ((entry.commonMistakes ?? []).length > 0) {
    body.append(element("h4", "", "常见失误"));
    appendTextList(body, entry.commonMistakes, "risk-list");
  }
  if ((entry.practiceSettings?.formatChecklist ?? []).length > 0) {
    body.append(element("h4", "", "交卷前检查"));
    appendTextList(body, entry.practiceSettings.formatChecklist, "check-list");
  }
  if ((entry.verifiedFacts ?? []).length > 0) {
    body.append(element("h4", "", "已记录的核查事实"));
    appendTextList(body, entry.verifiedFacts.map((fact) => fact.statementZh));
  }
  if (entry.source) {
    body.append(element("h4", "", "材料来源"));
    const source = element("div", "source-note");
    appendParagraph(source, "", entry.source.title);
    const locationText = [entry.source.fileName, entry.source.page].filter(Boolean).join(" · ");
    appendParagraph(source, "", locationText);
    if (entry.source.checkedAt) appendParagraph(source, "", `最近核查：${entry.source.checkedAt}`);
    if (entry.source.url) {
      const link = element("a", "source-link", "打开来源页面");
      link.href = entry.source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      source.append(link);
    }
    body.append(source);
  }
  details.append(body);
  card.append(details);
}

function appendLinkedTemplateCallout(card, entry) {
  if (entry.modelResponse || !(entry.relatedTemplateIds ?? []).length) return;
  const available = entry.relatedTemplateIds.map((id) => entryIndex.get(id)).filter(Boolean);
  if (available.length === 0) return;
  const callout = element("section", "linked-template-callout");
  callout.append(
    element("b", "", "本题使用关联母版，不重复存放第二份范文"),
    element("p", "", "先完成审题和提纲，再打开对应母版查看完整正文、槽位替换与逐句批注。"),
  );
  const links = element("div", "relation-links");
  for (const target of available) {
    const link = element("a", "relation-link primary-relation", `打开母版 · ${target.title}`);
    link.href = routeForEntry(target);
    if (preferredPartForEntry(target) === part) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        goToEntry(target.id, { focus: true, historyMode: "push" });
      });
    }
    links.append(link);
  }
  callout.append(links);
  card.append(callout);
}

function createTemplateCard(entry) {
  const card = createEntityFrame(entry, "TEMPLATE");
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
  appendRelationPanel(card, entry);
  return card;
}

function createExpressionCard(entry) {
  const card = createEntityFrame(entry, "EXPRESSION");
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
  appendRelationPanel(card, entry);
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
  appendRelationPanel(card, entry);
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
  practice.append(element("summary", "", "点击展开 · 第一步：自己审题并查看提纲"));
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
    response.append(element("summary", "", "点击展开 · 第二步：显示原创示范与逐句批注"));
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
  appendLinkedTemplateCallout(card, entry);
  appendRelationPanel(card, entry);
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
let entryIndex = new Map();
const entityHostStates = new Map();
let activeChapterId = currentPartSections[0]?.id ?? null;
let chapterBrowser = null;

function pageLabel(state, pageIndex) {
  const start = pageIndex * state.pageSize;
  const end = Math.min(start + state.pageSize, state.entries.length);
  if (state.pageSize === 1) return `${pageIndex + 1} / ${state.entries.length} · ${state.entries[start]?.title ?? ""}`;
  return `第 ${pageIndex + 1} 组 · ${start + 1}–${end}`;
}

function createEntityPager(state, locationLabel) {
  const pager = element("nav", "entity-pager");
  pager.setAttribute("aria-label", `${kindLabels[state.kind]}${locationLabel}分页`);
  const previous = element("button", "entity-page-button", "上一组");
  previous.type = "button";
  previous.addEventListener("click", () => renderHostPage(state, { page: state.page - 1, announce: true }));
  const select = element("select", "entity-page-select");
  select.setAttribute("aria-label", `选择${kindLabels[state.kind]}页`);
  for (let index = 0; index < state.pageCount; index += 1) {
    const option = element("option", "", pageLabel(state, index));
    option.value = String(index);
    select.append(option);
  }
  select.addEventListener("change", () => renderHostPage(state, { page: Number.parseInt(select.value, 10), announce: true }));
  const next = element("button", "entity-page-button", "下一组");
  next.type = "button";
  next.addEventListener("click", () => renderHostPage(state, { page: state.page + 1, announce: true }));
  pager.append(previous, select, next);
  state.pagers.push({ pager, previous, select, next });
  return pager;
}

function renderHostPage(state, { page = state.page, targetId = null, announce = false, focus = false } = {}) {
  state.page = Math.max(0, Math.min(page, state.pageCount - 1));
  const start = state.page * state.pageSize;
  const visible = state.entries.slice(start, start + state.pageSize);
  state.cards.replaceChildren(...visible.map((entry) => renderers[entry.kind](entry)));
  const end = Math.min(start + visible.length, state.entries.length);
  state.meta.textContent = `${kindLabels[state.kind]}共 ${state.entries.length} 条 · 当前 ${start + 1}–${end}`;
  if (announce) state.meta.setAttribute("data-announced", String(Date.now()));
  for (const controls of state.pagers) {
    controls.pager.hidden = state.pageCount <= 1;
    controls.previous.disabled = state.page === 0;
    controls.next.disabled = state.page === state.pageCount - 1;
    controls.select.value = String(state.page);
  }
  if (targetId) {
    requestAnimationFrame(() => {
      const target = document.querySelector(`#entry-${CSS.escape(targetId)}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focus) {
        const heading = target?.querySelector("h3");
        heading?.setAttribute("tabindex", "-1");
        heading?.focus({ preventScroll: true });
      }
    });
  }
}

function initializeEntityHost(host, entries, requestedEntryId = null) {
  const kind = host.dataset.entityKind;
  if (entries.length === 0) {
    host.replaceChildren(element("div", "empty-state", host.dataset.empty));
    return;
  }
  const pageSize = entityPageSizes[kind] ?? 4;
  const requestedIndex = requestedEntryId ? entries.findIndex((entry) => entry.id === requestedEntryId) : -1;
  const state = {
    kind,
    host,
    entries,
    pageSize,
    pageCount: Math.max(1, Math.ceil(entries.length / pageSize)),
    page: requestedIndex >= 0 ? Math.floor(requestedIndex / pageSize) : 0,
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
  renderHostPage(state, { targetId: requestedIndex >= 0 ? requestedEntryId : null });
}

function renderEntryHosts(entries, requestedEntryId = null) {
  entityHostStates.clear();
  const partEntries = entriesForPart(entries, part);
  for (const host of document.querySelectorAll("[data-entity-kind]")) {
    const kind = host.dataset.entityKind;
    const matching = partEntries.filter((entry) => entry.kind === kind);
    initializeEntityHost(host, matching, requestedEntryId);
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
  document.querySelectorAll("#sectionNav a").forEach((link) => link.addEventListener("click", () => {
    if (isNarrow()) setDrawer(false);
  }));
  addEventListener("resize", () => {
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
  for (const button of document.querySelectorAll("[data-chapter-id]")) {
    const active = button.dataset.chapterId === id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    if (active) button.scrollIntoView({ block: "nearest", inline: "center" });
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

function showChapter(id, { historyMode = "none", focus = false, scroll = false } = {}) {
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
  if (historyMode !== "none") {
    const url = new URL(location.href);
    url.searchParams.delete("entry");
    url.hash = activeChapterId;
    history[historyMode === "replace" ? "replaceState" : "pushState"]({}, "", url);
  }
  if (scroll) target.scrollIntoView({ behavior: "smooth", block: "start" });
  if (focus) {
    const heading = target.querySelector("h2");
    heading?.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => heading?.focus({ preventScroll: true }));
  }
}

function sectionForEntry(entry) {
  const id = sectionIdForKind(entry.kind);
  return currentPartSections.some((section) => section.id === id) ? id : currentPartSections[0]?.id;
}

function goToEntry(entryId, { focus = true, historyMode = "push" } = {}) {
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
  showChapter(chapterId, { historyMode: "none" });
  if (historyMode !== "none") {
    const url = new URL(location.href);
    url.searchParams.set("entry", entryId);
    url.hash = `entry-${entryId}`;
    history[historyMode === "replace" ? "replaceState" : "pushState"]({}, "", url);
  }
  renderHostPage(state, {
    page: Math.floor(entryPosition / state.pageSize),
    targetId: entryId,
    announce: true,
    focus,
  });
  return true;
}

function requestedEntryIdFromLocation() {
  const requested = new URLSearchParams(location.search).get("entry");
  if (requested) return requested;
  return location.hash.startsWith("#entry-") ? decodeURIComponent(location.hash.slice(7)) : null;
}

function chapterFromLocation(requestedEntryId = null) {
  if (requestedEntryId && entryIndex.has(requestedEntryId)) return sectionForEntry(entryIndex.get(requestedEntryId));
  const hashId = decodeURIComponent(location.hash.replace(/^#/u, ""));
  if (currentPartSections.some((section) => section.id === hashId)) return hashId;
  const saved = readPosition();
  if (saved?.anchor && currentPartSections.some((section) => section.id === saved.anchor)) return saved.anchor;
  return currentPartSections[0]?.id;
}

function configureChapterNavigation(requestedEntryId = null) {
  chapterBrowser = element("nav", "chapter-browser");
  chapterBrowser.setAttribute("aria-label", `${partLabels[part]}章节浏览`);
  const previous = element("button", "chapter-arrow", "上一章");
  previous.type = "button";
  previous.dataset.chapterPrevious = "";
  const track = element("div", "chapter-track");
  for (const [index, section] of currentPartSections.entries()) {
    const button = element("button", "chapter-tab");
    button.type = "button";
    button.dataset.chapterId = section.id;
    button.setAttribute("aria-pressed", "false");
    button.append(element("span", "", String(index + 1).padStart(2, "0")), element("b", "", chapterTitle(section.id)));
    button.addEventListener("click", () => showChapter(section.id, { historyMode: "push", focus: true, scroll: true }));
    track.append(button);
  }
  const next = element("button", "chapter-arrow", "下一章");
  next.type = "button";
  next.dataset.chapterNext = "";
  const status = element("p", "chapter-status");
  status.dataset.chapterStatus = "";
  status.setAttribute("aria-live", "polite");
  previous.addEventListener("click", () => {
    const index = currentPartSections.findIndex((section) => section.id === activeChapterId);
    if (index > 0) showChapter(currentPartSections[index - 1].id, { historyMode: "push", focus: true, scroll: true });
  });
  next.addEventListener("click", () => {
    const index = currentPartSections.findIndex((section) => section.id === activeChapterId);
    if (index < currentPartSections.length - 1) showChapter(currentPartSections[index + 1].id, { historyMode: "push", focus: true, scroll: true });
  });
  chapterBrowser.append(previous, track, next, status);
  contentStatus.insertAdjacentElement("afterend", chapterBrowser);

  for (const link of document.querySelectorAll("#sectionNav a")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setDrawer(false, { restoreFocus: false });
      showChapter(link.hash.slice(1), { historyMode: "push", focus: true, scroll: true });
    });
  }
  const initialChapter = chapterFromLocation(requestedEntryId);
  showChapter(initialChapter, { historyMode: "none" });
  addEventListener("popstate", () => {
    const entryId = requestedEntryIdFromLocation();
    if (entryId && goToEntry(entryId, { focus: false, historyMode: "none" })) return;
    showChapter(chapterFromLocation(), { historyMode: "none", scroll: true });
  });
}

function readPosition(targetPart = part) {
  try { return JSON.parse(localStorage.getItem(`kaoyan.writing.position.${targetPart}`) ?? "null"); } catch { return null; }
}

function activeSectionId() {
  return document.querySelector("#sectionNav a.active")?.hash.slice(1) ?? currentPartSections[0]?.id ?? null;
}

function savePositionNow() {
  try {
    const section = currentPartSections.find((candidate) => candidate.id === activeChapterId);
    localStorage.setItem(positionKey, JSON.stringify({
      y: Math.max(0, Math.round(scrollY)),
      anchor: activeSectionId(),
      offset: section ? Math.max(0, Math.round(scrollY - section.offsetTop)) : 0,
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
    if (!saved) return;
    if (saved.anchor) showChapter(saved.anchor, { historyMode: "none" });
    const section = currentPartSections.find((candidate) => candidate.id === activeChapterId);
    const top = Number.isFinite(saved.offset) && section ? section.offsetTop + saved.offset : saved.y;
    if (top >= 0) scrollTo({ top, behavior: "smooth" });
  });
}

function restorePositionAfterRender(requestedEntryId = null) {
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
    if (requestedEntryId && goToEntry(requestedEntryId, { focus: false, historyMode: "none" })) {
      return;
    }
    const hashId = decodeURIComponent(location.hash.replace(/^#/u, ""));
    if (currentPartSections.some((section) => section.id === hashId)) {
      document.querySelector(`#${CSS.escape(hashId)}`)?.scrollIntoView({ block: "start" });
      return;
    }
    const saved = readPosition();
    const section = currentPartSections.find((candidate) => candidate.id === activeChapterId);
    const top = Number.isFinite(saved?.offset) && section ? section.offsetTop + saved.offset : saved?.y;
    if (top > 0) scrollTo({ top, behavior: "auto" });
  }));
}

function configureFontSize() {
  let large = false;
  try { large = localStorage.getItem(fontKey) === "true"; } catch {}
  document.documentElement.classList.toggle("large-type", large);
  const button = document.querySelector("#fontToggle");
  button.textContent = large ? "A−" : "A+";
  button.setAttribute("aria-label", large ? "切换为标准字号" : "切换为大字号");
  button.setAttribute("aria-pressed", String(large));
  button.addEventListener("click", () => {
    const next = !document.documentElement.classList.contains("large-type");
    document.documentElement.classList.toggle("large-type", next);
    button.textContent = next ? "A−" : "A+";
    button.setAttribute("aria-label", next ? "切换为标准字号" : "切换为大字号");
    button.setAttribute("aria-pressed", String(next));
    try { localStorage.setItem(fontKey, String(next)); } catch {}
  });
}

function routeFor(itemPart, anchor, entryId = null) {
  if (entryId && entryIndex.has(entryId)) return routeForEntry(entryIndex.get(entryId));
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
        entryId: entry.id,
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
      link.href = routeFor(item.part, item.anchor, item.entryId);
      link.append(
        element("span", "", `PART ${item.part} · ${partLabels[item.part]} · ${item.type}`),
        element("strong", "", item.title),
        element("small", "", item.summary),
      );
      link.addEventListener("click", (event) => {
        dialog.close();
        if (item.part !== part) return;
        event.preventDefault();
        if (item.entryId) goToEntry(item.entryId, { focus: true, historyMode: "push" });
        else showChapter(item.anchor, { historyMode: "push", focus: true, scroll: true });
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
  for (const [index, section] of currentPartSections.entries()) section.hidden = index !== 0;
  configureTheme();
  configureSidebar();
  configureLearningUtilities();
  configureFontSize();
  configurePositionMemory();
  const result = await loadWritingData();
  activeBundle = result.bundle;
  allEntries = result.bundle.entries;
  entryIndex = new Map(allEntries.map((entry) => [entry.id, entry]));
  const requestedEntryId = requestedEntryIdFromLocation();
  renderEntryHosts(allEntries, requestedEntryId);
  updateContentStatus(result.mode, result.bundle, result.failures);
  configureChapterNavigation(requestedEntryId);
  configureSearch(allEntries);
  configureDataCenter();
  restorePositionAfterRender(requestedEntryId);
  if (!qaMode) configureServiceWorker();
}

initialize();
