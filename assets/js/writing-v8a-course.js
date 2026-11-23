import { getV8BCourse, v8bFunctions, v8bView, V8B_FORMAT } from "./writing-v8b-data.js";

export const V8A_FORMAT = "baicaoyuan-writing-v8a-unified-application-course";

const types = new Set(["fixed", "prepared", "fact"]);
const functions = {
  invitation: "邀请与活动价值", advice: "建议与准备步骤", recruitment: "招募与职责",
  reply: "逐问回复", notice: "通知与活动安排", recommend: "推荐与价值说明", welcome: "欢迎与实用建议",
};
const bodyLabels = {
  invitation: "活动安排、参与收益或具体角色",
  advice: "先做什么，再做什么",
  recruitment: "职责、条件与报名信息",
  reply: "逐项回答来信",
  notice: "说明安排和参加方式",
  recommend: "推荐对象的价值与理由",
  welcome: "给新同学的可执行建议",
};
const roles = {
  activity: "活动", value: "价值", duty: "职责", reply: "回复", action1: "第一步", action2: "第二步",
  focus: "关注点", outcome: "预期结果", programme: "活动安排", benefit: "收益", role: "角色", logistics: "现场安排",
  duties: "具体工作", requirements: "所需能力", team: "协作", application: "报名", feature: "亮点",
  expert: "专家职责", safety: "安全要求", merit: "值得推荐之处", evidence: "具体依据", reader: "适合对象", tone: "语气",
};
const hasItems = (items, size) => Array.isArray(items) && items.length === size;
const isText = (value) => typeof value === "string" && Boolean(value.trim());
const textList = (items) => Array.isArray(items) && items.every(isText);
const bodyText = (paragraph) => paragraph.map(({ text }) => text).join("");

export function getV8ACourse(overlays) {
  const course = overlays.find((item) => item?.format === V8A_FORMAT);
  if (course?.schemaVersion !== 1 || !hasItems(course.cases, 22) || !hasItems(course.scenes, 6) ||
      !hasItems(course.blueprint?.modules, 4) || !course.studyPlan) return null;
  const { blueprint, cases, scenes, studyPlan } = course;
  try {
    const ids = new Set(cases.map(({ id }) => id));
    if (ids.size !== 22 || !["opening", "body", "ending"].every((key) => isText(blueprint.common?.[key])) ||
        !hasItems(studyPlan.primaryComplete, 2) || !hasItems(studyPlan.specialistModules, 2) ||
        ![...studyPlan.primaryComplete, ...studyPlan.specialistModules].every((id) => ids.has(id)) ||
        !hasItems(studyPlan.relatedComparisons, 5) ||
        !studyPlan.relatedComparisons.every((group) => Array.isArray(group) && group.length > 0 && group.every((id) => ids.has(id)))) return null;
    if (blueprint.modules.map(({ id }) => id).join("") !== "ABCD" || !blueprint.modules.every((item) =>
      [item.title, item.main, item.zh].every(isText) && textList(item.constraints) &&
      Array.isArray(item.related) && item.related.length > 0 && item.related.every((id) => ids.has(id)))) return null;
    if (!cases.every((item) =>
      [item.id, item.title, item.taskZh, item.greeting, item.signoff, item.logicZh].every(isText) &&
      functions[item.category] && ["past-paper", "original"].includes(item.kind) &&
      item.source && isText(item.disclaimer) && typeof item.riskZh === "string" &&
      hasItems(item.paragraphs, 3) && item.paragraphs.every((line) => Array.isArray(line) && line.length > 0 &&
        line.every((segment) => types.has(segment.type) && isText(segment.text))) &&
      hasItems(item.paragraphsZh, 3) && textList(item.paragraphsZh) &&
      Array.isArray(item.slots) && item.slots.every(({ role, en, zh }) => [role, en, zh].every(isText)))) return null;
    if (!scenes.every((scene) => [scene.id, scene.name, scene.reason].every(isText) &&
      Array.isArray(scene.slots) && scene.slots.length > 0 && scene.slots.every((row) => hasItems(row, 3) && textList(row)))) return null;
  } catch {
    return null;
  }
  return course;
}

export function getPartACourse(overlays) {
  const v8b = getV8BCourse(overlays);
  return v8b ? v8bView(v8b) : getV8ACourse(overlays);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function panel(title) {
  const node = el("section", "v8-panel");
  node.append(el("h3", "", title));
  return node;
}

function disclosure(title, extraClass = "") {
  const details = el("details", `study-details v8-details ${extraClass}`);
  details.append(el("summary", "", title));
  return details;
}

function legend() {
  const label = el("p", "v8-legend v8a-legend");
  label.append(el("b", "v8-fixed", "绿 · 固定句架"), el("b", "v8-fill", "蓝 · 可换表达"), el("b", "v8a-fact", "棕 · 题情信息"));
  return label;
}

function english(segments) {
  const p = el("p", "v8-en");
  p.lang = "en";
  for (const { type, text } of segments) {
    const className = type === "fixed" ? "v8-fixed" : type === "prepared" ? "v8-fill" : "v8a-fact";
    p.append(el("span", className, text));
  }
  return p;
}

function letterLine(text) {
  const p = el("p", "v8-en v8a-letter-line", text);
  p.lang = "en";
  return p;
}

function slotList(slots) {
  const list = el("dl", "v8-slot-list");
  for (const [role, en, zh] of slots) {
    const pair = el("dd");
    const phrase = el("span", "v8-fill", en);
    phrase.lang = "en";
    pair.append(phrase);
    if (zh) pair.append(el("small", "v8a-slot-zh", zh));
    list.append(el("dt", "", roles[role] ?? role), pair);
  }
  return list;
}

function essayParagraph(item, index) {
  const headings = ["第一段 · 交代目的", `第二段 · ${bodyLabels[item.category]}`, "第三段 · 给出下一步"];
  const node = el("section", "v8-essay-paragraph");
  node.append(el("h5", "", headings[index]), english(item.paragraphs[index]), el("p", "v8-caption v8a-meaning", item.paragraphsZh[index]));
  return node;
}

function renderEssay(item, { showLegend = false, showTitle = true } = {}) {
  const article = el("article", "v8-essay v8a-essay");
  article.dataset.v8aCase = item.id;
  if (showTitle) article.append(el("h4", "", item.title));
  const origin = item.kind === "past-paper" ? "真题题材 · 原创范文" : "原创模拟";
  article.append(el("p", "v8-caption", `${origin} · 正文 ${item.wordCount} 词`), el("p", "", item.taskZh));
  if (showLegend) article.append(legend());
  if (item.riskZh) article.append(el("p", "v8a-caution", item.riskZh));
  const text = el("div", "v8a-letter");
  text.append(letterLine(item.greeting), ...item.paragraphs.map((_, index) => essayParagraph(item, index)), letterLine(item.signoff));
  article.append(text);
  const slots = disclosure("填槽对照");
  slots.append(el("p", "v8-route", item.logicZh));
  if (item.lessonZh) slots.append(el("p", "v8-caption", item.lessonZh));
  slots.append(slotList(item.slots.map(({ role, en, zh }) => [role, en, zh])));
  const source = disclosure("任务来源与示例设定");
  source.append(el("p", "v8-caption", item.disclaimer));
  if (item.kind === "past-paper") {
    source.append(el("p", "v8-caption", `交付包标注：${item.source.file}，扫描册物理第 ${item.source.page} 页。`));
  }
  article.append(slots, source);
  return article;
}

function labelledSelect(label) {
  const field = el("label", "v8-field");
  const select = el("select", "theme-item-select");
  field.append(el("span", "", label), select);
  return { field, select };
}

function optionsFor(select, items, label = (item) => item.title) {
  select.replaceChildren(...items.map((item) => new Option(label(item), item.id)));
}

function updateChapter(id, content, title) {
  const chapter = document.getElementById(id);
  const header = chapter.querySelector(".section-heading");
  header.querySelector("p")?.remove();
  if (title) header.querySelector("h2").textContent = title;
  chapter.replaceChildren(header, content);
}

function renderCore(course, lookup) {
  const route = panel("一套三段结构");
  const steps = el("ol", "v8-steps");
  for (const [label, value] of [["开头", course.blueprint.common.opening], ["主体", course.blueprint.common.body], ["收尾", course.blueprint.common.ending]]) {
    steps.append(el("li", "", `${label} · ${value.replace(/[\[\]]/gu, "").replaceAll(" + ", "＋")}`));
  }
  route.append(steps, legend());
  const primary = panel("两篇整背");
  const { field, select } = labelledSelect("选择一篇主背范文");
  const models = course.studyPlan.primaryComplete.map((id) => lookup.get(id));
  optionsFor(select, models);
  const stage = el("div", "v8a-stage");
  const show = () => stage.replaceChildren(renderEssay(lookup.get(select.value), { showTitle: false }));
  select.addEventListener("change", show);
  primary.append(field, stage);
  show();

  const specialists = panel("两个功能短块");
  const columns = el("div", "v8-two-col");
  for (const id of course.studyPlan.specialistModules) {
    const item = lookup.get(id);
    const card = el("article", "v8-essay");
    card.append(el("h4", "", item.title), essayParagraph(item, 1));
    if (item.lessonZh) card.append(el("p", "v8-caption", item.lessonZh));
    if (item.riskZh) card.append(el("p", "v8a-caution", item.riskZh));
    columns.append(card);
  }
  specialists.append(columns);
  const host = el("div");
  host.append(route, primary, specialists);
  updateChapter("a-core", host);
}

function renderOverview(course) {
  const overview = panel("先辨别写作目的");
  if (course.blueprint.principles) {
    const list = el("ul", "v8a-principles");
    list.append(...course.blueprint.principles.map((text) => el("li", "", text)));
    overview.append(list);
  } else overview.append(el("p", "", course.blueprint.note));
  const grid = el("div", "v8-two-col");
  for (const item of course.blueprint.modules) {
    const card = el("article", "v8-essay");
    card.append(el("h4", "", item.title), el("p", "", course.blueprint.principles ? item.constraints[0] : item.zh));
    grid.append(card);
  }
  overview.append(grid);
  updateChapter("a-overview", overview, "审题与体裁");
}

function renderTemplates(course, lookup, register) {
  const guide = panel("四个功能母版");
  guide.append(el("p", "v8-caption", "按题干选择功能。推荐沿用邀请组的价值表达，欢迎沿用建议组的步骤。"), legend());
  const grid = el("div", "v8-two-col");
  for (const module of course.blueprint.modules) {
    const card = el("article", "v8-essay");
    card.dataset.v8aModule = module.id;
    card.append(el("h4", "", `${module.id} · ${module.title}`), el("p", "v8-caption", module.zh));
    for (const [label, frame] of module.lines ?? [["", module.main]]) {
      if (label) card.append(el("h5", "", label));
      const segments = frame.split(/(\[[^\]]+\])/gu).filter(Boolean).map((text) => ({
        type: text.startsWith("[") ? "prepared" : "fixed", text,
      }));
      card.append(english(segments));
    }
    const limits = disclosure("用法和语法限制");
    const list = el("ul");
    list.append(...module.constraints.map((text) => el("li", "", text)));
    limits.append(list);
    if (module.lines) {
      const examples = module.related.map((id) => lookup.get(id).year).join("、");
      card.append(el("p", "v8-caption", `对应真题示范：${examples}`));
    }
    card.append(limits);
    grid.append(card);
    register(`v8a-module-${module.id}`, () => card);
  }
  guide.append(grid);
  updateChapter("a-templates", guide);
}

function renderPairStudy(pairs, lookup) {
  const box = panel("同一句架，换一道题");
  const { field, select } = labelledSelect("选择一组对照");
  select.dataset.v8bPair = "";
  select.append(...pairs.map(([left, right], index) =>
    new Option(`${lookup.get(left).title} ↔ ${lookup.get(right).title}`, String(index))));
  const stage = el("div", "v8-two-col v8a-stage");
  const show = () => {
    stage.replaceChildren(...pairs[select.selectedIndex].map((id) => {
      const item = lookup.get(id);
      const card = el("article", "v8-essay");
      card.dataset.v8bExample = id;
      card.append(el("h4", "", item.title), el("p", "v8-caption", item.taskZh), essayParagraph(item, 1),
        el("p", "v8-route", item.lessonZh));
      return card;
    }));
  };
  select.addEventListener("change", show);
  box.append(legend(), field, stage);
  show();
  updateChapter("a-expressions", box, "备用句式");
}

function renderExpressions(course, lookup) {
  if (course.studyPlan.proofPairs) {
    renderPairStudy(course.studyPlan.proofPairs, lookup);
    return;
  }
  const box = panel("同一功能，换一道题");
  box.append(legend());
  const { field: typeField, select: group } = labelledSelect("功能");
  const { field: exampleField, select: example } = labelledSelect("本题示范");
  const recommendation = { id: "recommend", title: "推荐分支", related: course.studyPlan.relatedComparisons[4] };
  const groups = [...course.blueprint.modules, recommendation];
  optionsFor(group, groups, (item) => item.id === "recommend" ? item.title : `${item.id} · ${item.title}`);
  const stage = el("div", "v8a-stage");
  function show() {
    const item = lookup.get(example.value);
    const card = el("article", "v8-essay");
    card.append(el("h4", "", item.title), el("p", "v8-caption", item.taskZh), essayParagraph(item, 1),
      el("p", "v8-route", item.logicZh));
    if (item.riskZh) card.append(el("p", "v8a-caution", item.riskZh));
    stage.replaceChildren(card);
  }
  function refresh() {
    const selected = groups.find(({ id }) => id === group.value);
    optionsFor(example, selected.related.map((id) => lookup.get(id)));
    show();
  }
  group.addEventListener("change", refresh);
  example.addEventListener("change", show);
  box.append(typeField, exampleField, stage);
  refresh();
  updateChapter("a-expressions", box, "备用句式");
}

function renderScenes(course, register) {
  const box = panel("六组主题填充");
  const grid = el("div", "v8-two-col");
  for (const scene of [...course.scenes].sort((a, b) => a.rank - b.rank)) {
    const card = el("article", "v8-essay");
    card.append(el("h4", "", scene.name), el("p", "v8-caption", scene.reason), slotList(scene.slots));
    if (scene.examples) {
      const examples = disclosure("两句完整用法");
      examples.append(...scene.examples.map(letterLine));
      card.append(examples);
    }
    grid.append(card);
    register(`v8a-scene-${scene.id}`, () => card);
  }
  box.append(grid);
  updateChapter("a-topics", box);
}

function renderLibrary(course, { register, createReviewControl, entryIndex }) {
  const library = panel("按题选范文");
  const select = el("select", "theme-item-select");
  select.setAttribute("aria-label", "选择范文");
  select.dataset.v8aPicker = "";
  const previous = el("button", "ghost-button v8a-page-button", "上一篇");
  const next = el("button", "ghost-button v8a-page-button", "下一篇");
  previous.type = next.type = "button";
  previous.dataset.v8aPrevious = "";
  next.dataset.v8aNext = "";
  const position = el("p", "v8-caption");
  position.setAttribute("aria-live", "polite");
  const pager = el("div", "v8a-pager");
  pager.append(previous, select, next);
  const stage = el("div", "v8-library-stage");
  const { field, select: filter } = labelledSelect("交际功能");
  const grouped = course.format === V8B_FORMAT;
  if (grouped) {
    field.classList.add("v8b-function-filter");
    filter.dataset.v8bFilter = "";
    filter.append(new Option("全部功能", ""), ...Object.entries(v8bFunctions).map(([id, title]) => new Option(title, id)));
    library.append(field);
  }
  library.append(pager, position, stage);
  updateChapter("a-prompts", library);
  const papers = course.cases.filter((item) => item.year).sort((a, b) => b.year - a.year);
  const originals = course.cases.filter((item) => !item.year);
  const ordered = [...papers, ...originals];
  let visible = ordered;

  function show(index) {
    const sample = visible[index];
    if (!sample) return;
    select.selectedIndex = index;
    previous.disabled = index === 0;
    next.disabled = index === visible.length - 1;
    position.textContent = `第 ${index + 1} / ${visible.length} 篇`;
    const essay = renderEssay(sample, { showLegend: true });
    const matched = entryIndex.get(sample.matchedExistingPromptId);
    if (matched?.examPart === "A") essay.append(createReviewControl(matched));
    stage.replaceChildren(essay);
    return essay;
  }

  function refresh(id) {
    visible = filter.value ? ordered.filter((item) => item.module === filter.value) : ordered;
    const groups = [
      ["历年真题", visible.filter((item) => item.year)],
      ["原创模拟", visible.filter((item) => !item.year)],
    ];
    select.replaceChildren(...groups.filter(([, items]) => items.length).map(([label, items]) => {
      const group = el("optgroup");
      group.label = label;
      optionsFor(group, items);
      return group;
    }));
    return show(Math.max(0, visible.findIndex((item) => item.id === id)));
  }

  select.addEventListener("change", () => show(select.selectedIndex));
  previous.addEventListener("click", () => show(select.selectedIndex - 1));
  next.addEventListener("click", () => show(select.selectedIndex + 1));
  filter.addEventListener("change", () => refresh(select.value));
  for (const item of ordered) register(`v8a-case-${item.id}`, () => {
    const index = visible.findIndex((row) => row.id === item.id);
    if (index >= 0) return show(index);
    filter.value = "";
    return refresh(item.id);
  });
  refresh(course.studyPlan.primaryComplete[0]);
}

export function renderV8ACourse(course, options) {
  const lookup = new Map(course.cases.map((item) => [item.id, item]));
  renderCore(course, lookup);
  renderOverview(course);
  renderTemplates(course, lookup, options.register);
  renderExpressions(course, lookup);
  renderScenes(course, options.register);
  renderLibrary(course, options);
}

export function v8aSearchItems(course) {
  const version = course.format === V8B_FORMAT ? "V8B" : "V8A";
  const search = (section, id, title, summary, input, type) => ({
    part: "A", anchor: `a-${section}`, overlayChapterId: `v8a-${id}`, title, summary, type,
    searchText: `${title} ${input}`.toLocaleLowerCase("zh-CN"),
  });
  return [
    ...course.blueprint.modules.map((item) =>
      search("templates", `module-${item.id}`, item.title, item.zh, item.lines?.flat().join(" ") ?? item.main, "功能母版")),
    ...course.scenes.map((scene) =>
      search("topics", `scene-${scene.id}`, scene.name, "场景英文填充", JSON.stringify(scene), "主题素材")),
    ...course.cases.map((item) =>
      search("prompts", `case-${item.id}`, item.title, item.taskZh,
        `${item.taskZh} ${item.paragraphs.map(bodyText).join(" ")} ${item.logicZh}`,
        item.year ? `真题 · ${version} 套写` : "原创模拟")),
  ];
}
