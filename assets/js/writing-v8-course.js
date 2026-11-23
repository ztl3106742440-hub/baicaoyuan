export const V8_FORMAT = "baicaoyuan-writing-v8-unified-essay-course";

const existingPromptIds = {
  2010: "wp-2010-cultural-hotpot",
  2012: "wp-2012-water-and-attitude",
  2014: "wp-2014-intergenerational-care",
  2015: "wp-2015-dinner-phones",
  2016: "wp-2016-parental-example",
  2018: "wp-2018-course-choice",
  2019: "wp-2019-climbing-support",
  2020: "wp-2020-procrastination-contrast",
  2021: "wp-2021-support-ones-interests",
  2022: "wp-2022-cross-disciplinary-learning",
  2023: "wp-2023-dragon-boat-culture",
  2024: "wp-2024-parks-mixed",
  2025: "wp-2025-household-appliances",
  2026: "wp-2026-eldercare-robots",
};
const materialNames = { picture: "图画", contrast: "对比图", static: "静态图表", trend: "趋势图表", dual: "双图表", mixed: "图文混合", text: "文字材料" };
const modeNames = { A: "A · 意义与影响", B: "B · 原因与解释" };
const openerFamilies = [
  ["图画与对比", ["picture", "contrast"]],
  ["图表", ["static", "trend", "dual"]],
  ["图文混合与文字", ["mixed", "text"]],
];
const paragraphLabels = ["第一段 · 描述材料", "第二段 · 展开论证", "第三段 · 回应与建议"];
const bodyLabels = {
  A: ["中心判断", "论点一 · 直接作用与例证", "论点二 · 第二层影响", "收束判断"],
  B: ["引出待解释的现象", "原因一 · 机制与情境", "原因二 · 影响实际选择", "收束判断"],
};

export function v8PromptId(item) {
  return existingPromptIds[item.year];
}

const hasItems = (items, size) => Array.isArray(items) && items.length === size;
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const validFrame = (frame, labels) => Array.isArray(frame) && frame.length > 0 && frame.every((line) =>
  Array.isArray(line) && line.length > 0 && line.every(([kind, value]) => (kind === "F" && isText(value)) || (kind === "S" && isText(labels[value]))));

export function getV8Course(overlays) {
  const course = overlays.find((overlay) => overlay?.format === V8_FORMAT);
  if (course?.schemaVersion !== 1 || !course.templates?.openers || !course.slotLabels ||
      !hasItems(course.cases, 22) || !hasItems(course.topicPacks, 4) || !hasItems(course.quotes, 3) ||
      !hasItems(course.anchorIds, 4)) return null;
  const { templates, slotLabels, cases, topicPacks } = course;
  try {
    const frames = [...Object.keys(materialNames).map((form) => templates.openers[form]), templates.bodyA, templates.bodyB, templates.endingA, templates.endingB];
    if (!frames.every((frame) => validFrame(frame, slotLabels)) || !hasItems(templates.bodyA, 5) ||
        !hasItems(templates.bodyB, 5) || new Set(cases.map((item) => item.id)).size !== cases.length ||
        !["2023", "2015", "2025", "2026"].every((id) => course.anchorIds.includes(id) && cases.some((item) => item.id === id))) return null;
    if (!topicPacks.every((pack) => isText(pack.id) && isText(pack.title) && hasItems(pack.packs, 2) &&
        pack.packs.every((point) => [point.label, point.claim, point.mechanism, point.example, point.result].every(isText)) &&
        [pack.thesis, pack.owner, pack.measures].every((list) => Array.isArray(list) && list.every(isText)) &&
        Array.isArray(pack.subtypes) && pack.subtypes.every((pair) => hasItems(pair, 2) && pair.every(isText)))) return null;
    if (!course.quotes.every((quote) => [quote.en, quote.zh, quote.use, quote.risk].every(isText))) return null;
    if (!cases.every((item) => isText(item.title) && materialNames[item.materialForm] && modeNames[item.mode] &&
      topicPacks.some((pack) => pack.id === item.category) && item.source && item.bodySlots &&
      hasItems(item.plainParagraphs, 3) && item.plainParagraphs.every(isText) &&
      hasItems(item.paragraphs, 3) && hasItems(item.paragraphs[1], 5) &&
      item.paragraphs.every((paragraph) => Array.isArray(paragraph) && paragraph.length &&
        paragraph.every((line) => Array.isArray(line) && line.length && line.every((segment) => isText(segment.text) &&
          (segment.type === "fixed" || (segment.type === "fill" && isText(slotLabels[segment.slot])))))))) return null;
    if (!Array.isArray(course.references)) return null;
  } catch {
    return null;
  }
  return course;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function disclosure(title, extraClass = "") {
  const details = element("details", `study-details v8-details ${extraClass}`);
  details.append(element("summary", "", title));
  return details;
}

function section(title, className = "v8-panel") {
  const node = element("section", className);
  node.append(element("h3", "", title));
  return node;
}

function en(text) {
  const p = element("p", "v8-en", text);
  p.lang = "en";
  return p;
}

function segmentParagraph(lines) {
  const p = en();
  for (const [index, line] of lines.entries()) {
    if (index) p.append(" ");
    for (const segment of line) p.append(element("span", `v8-${segment.type}`, segment.text));
  }
  return p;
}

function frameParagraph(lines, labels) {
  return segmentParagraph(lines.map((line) => line.map(([kind, value]) =>
    kind === "F" ? { type: "fixed", text: value } : { type: "fill", text: `[${labels[value]}]` })));
}

function slotList(rows) {
  const list = element("dl", "v8-slot-list");
  for (const [name, text] of rows) {
    const value = element("dd", "", text);
    value.lang = "en";
    list.append(element("dt", "", name), value);
  }
  return list;
}

const caseKey = (item) => `v8-b-${item.year ? "paper" : "original"}-${item.id}`;
const topicKey = (topic) => `v8-b-topic-${topic.id}`;
const caseTitle = (item) => item.year ? `${item.year} · ${item.title}` : item.title;

function lessonLink(title, chapter, id) {
  const link = element("a", "v8-lesson-link", title);
  link.href = `?lesson=${encodeURIComponent(id)}#${chapter}`;
  link.dataset.v8Lesson = id;
  return link;
}

function materialFacts(facts) {
  const numbers = facts.filter((fact) => typeof fact.value === "number");
  if (!numbers.length) return null;
  const region = element("div", "matrix-wrap v8-data-table");
  region.tabIndex = 0;
  region.setAttribute("role", "region");
  region.setAttribute("aria-label", "题卡已有的材料数值");
  const table = element("table");
  table.append(element("caption", "", "题卡已有的材料数值"));
  for (const fact of numbers) {
    const row = table.insertRow();
    const label = element("th", "", fact.statementZh);
    label.scope = "row";
    row.append(label, element("td", "", `${fact.value}${fact.unit === "%" ? "%" : ` ${fact.unit ?? ""}`}`));
  }
  region.append(table);
  return region;
}

function appendBodySteps(container, lines, mode) {
  const chunks = [lines.slice(0, 1), lines.slice(1, 3), lines.slice(3, 4), lines.slice(4)];
  for (const [step, chunk] of chunks.entries()) {
    const block = element("div", "v8-argument-line");
    block.append(element("span", "v8-argument-label", bodyLabels[mode][step]), segmentParagraph(chunk));
    container.append(block);
  }
}

function essayParagraph(lines, index, mode) {
  const paragraph = element("section", "v8-essay-paragraph");
  paragraph.append(element("h5", "", paragraphLabels[index]));
  if (index === 1) appendBodySteps(paragraph, lines, mode);
  else paragraph.append(segmentParagraph(lines));
  return paragraph;
}

function essayView(course, item, facts = []) {
  const article = element("article", "v8-essay");
  article.dataset.v8Case = item.id;
  article.append(element("h4", "", caseTitle(item)));
  article.append(element("p", "v8-caption",
    `${item.year ? "真题题材 · 原创英文示范" : "原创模拟"} · ${materialNames[item.materialForm]} · ${modeNames[item.mode]} · ${item.wordCount} 词`));
  if (!item.year) article.append(element("p", "v8-caption", item.materialForm === "static" ? "图表比例为模拟题设。" : "场景与观点为模拟题设。"));
  article.append(element("p", "v8-route", item.routeZh));
  const legend = element("p", "v8-legend");
  legend.append(element("b", "v8-fixed", "绿色固定句架"), " · ", element("b", "v8-fill", "蓝色英文填充"));
  article.append(legend);
  const text = element("div", "v8-essay-text");
  text.append(...item.paragraphs.map((paragraph, index) => essayParagraph(paragraph, index, item.mode)));
  article.append(text);
  const slots = disclosure("看三段填槽对照", "v8-slot-guide");
  item.paragraphs.forEach((paragraph, index) => {
    const unique = new Map(paragraph.flat().filter((part) => part.type === "fill").map((part) => [part.slot, part.text]));
    slots.append(element("h5", "", paragraphLabels[index]), slotList([...unique].map(([key, value]) => [course.slotLabels[key], value])));
  });
  article.append(slots);
  const bounds = disclosure("审题边界与材料来源");
  bounds.append(element("p", "", item.riskZh));
  const table = materialFacts(facts);
  if (table) bounds.append(table);
  if (item.year) bounds.append(element("p", "v8-caption", `交付包标注：${item.source.pdf}，扫描册物理第 ${item.source.page} 页。`));
  article.append(bounds);
  return article;
}

export function createV8PromptExample(course, entry) {
  const item = course?.cases.find((candidate) => v8PromptId(candidate) === entry.id);
  if (!item) return null;
  const details = disclosure("按 V8 统一母版再写一篇", "v8-prompt-written");
  details.append(essayView(course, item, entry.verifiedFacts));
  return details;
}

function renderCore(course, host, register) {
  const old = disclosure("历史参考 · V7 主背与加分句", "v8-archive");
  old.append(...host.childNodes);
  const route = section("一套三段结构");
  const steps = element("ol", "v8-steps");
  for (const line of ["描述材料 · 图画、图表、图文混合或文字", "展开主体 · A 写意义与影响，B 写原因与解释", "给出回应 · 行动者、具体措施、预期收益、长期目标"]) {
    steps.append(element("li", "", line));
  }
  route.append(steps);
  const legend = element("p", "v8-legend");
  legend.append(element("b", "v8-fixed", "绿色固定句架"), " · ", element("b", "v8-fill", "蓝色英文填充"));
  route.append(legend);
  const bodies = element("div", "v8-two-col");
  for (const [mode, id, note] of [
    ["A", "2023", "先背到第一个情境句，再练第二层作用和综合判断。负面题可对照 2015。"],
    ["B", "2025", "两点各解释一个可能因素。静态比例和双图调查可对照 2026。"],
  ]) {
    const item = course.cases.find((sample) => sample.id === id);
    const body = section(`第二段 ${modeNames[mode]}`);
    body.id = `v8-b-body-${mode.toLowerCase()}`;
    body.dataset.v8Body = mode;
    body.append(element("p", "v8-caption", note));
    appendBodySteps(body, item.paragraphs[1], mode);
    bodies.append(body);
    register(body.id, () => body);
  }
  const ending = section("第三段 · 共用行动路线");
  ending.append(frameParagraph(course.templates.endingA, course.slotLabels));
  const alternative = disclosure("图表题的结尾起句");
  alternative.append(frameParagraph(course.templates.endingB, course.slotLabels));
  ending.append(alternative);
  const openers = section("第一段 · 三类入口");
  for (const [label, forms] of openerFamilies) {
    const details = disclosure(label);
    for (const form of forms) details.append(element("h4", "", materialNames[form]), frameParagraph(course.templates.openers[form], course.slotLabels));
    openers.append(details);
  }
  const anchors = section("四道题练同一套句法");
  const links = element("div", "v8-links");
  for (const id of course.anchorIds) {
    const item = course.cases.find((sample) => sample.id === id);
    links.append(lessonLink(caseTitle(item), "b-prompts", caseKey(item)));
  }
  anchors.append(links);
  const caution = disclosure("先看单位、材料和动词");
  caution.append(element("p", "", "正负影响可换 benefit 或 consequence。2025 写每百户拥有台数。2026 两图各用各的口径。静态图只写占比。"));
  host.replaceChildren(route, bodies, ending, openers, anchors, caution, old);
}

function archiveChildren(chapter, label) {
  const archive = disclosure(label, "v8-archive");
  for (const node of [...chapter.children].filter((node) => !node.classList.contains("section-heading"))) archive.append(node);
  chapter.append(archive);
  return archive;
}

function renderTemplates(course) {
  const chapter = document.getElementById("b-templates");
  const old = archiveChildren(chapter, "历史参考 · 旧版母版");
  const guide = section("母版填槽与跨题对照");
  guide.append(element("p", "v8-caption", "对照蓝色位置怎么换，固定句架可以留在原位。"));
  for (const [mode, ids, keys] of [
    ["A", ["2023", "2015"], ["effectNoun", "effect1", "mechanism1", "effect2"]],
    ["B", ["2025", "2026"], ["phenomenon", "cause1", "effect1", "cause2", "whether2"]],
  ]) {
    const pair = disclosure(`${modeNames[mode]} · 看同一语法槽如何换题`);
    const columns = element("div", "v8-two-col");
    for (const id of ids) {
      const item = course.cases.find((sample) => sample.id === id);
      const card = element("article", "v8-panel");
      card.append(element("h4", "", caseTitle(item)), slotList(keys.map((key) => [course.slotLabels[key], item.bodySlots[key]])),
        lessonLink("查看三段实填", "b-prompts", caseKey(item)));
      columns.append(card);
    }
    pair.append(frameParagraph(course.templates[`body${mode}`], course.slotLabels), columns);
    guide.append(pair);
  }
  old.before(guide);
}

function renderTopics(course, register) {
  const chapter = document.getElementById("b-expressions");
  const archive = archiveChildren(chapter, "历史参考 · 旧素材、题例与句库");
  const materials = section("四组主题填充");
  const buttons = element("div", "materials-group-buttons");
  const stage = element("div", "v8-topic-stage");
  function choose(topic) {
    for (const button of buttons.children) button.setAttribute("aria-pressed", String(button.value === topic.id));
    const root = element("section", "v8-topic");
    root.dataset.v8Topic = topic.id;
    root.append(element("h4", "", topic.title));
    const theses = element("ul", "v8-theses");
    theses.append(...topic.thesis.map((idea) => element("li", "", idea)));
    root.append(theses);
    const pair = element("div", "v8-two-col");
    for (const point of topic.packs) {
      const card = element("article", "v8-panel");
      card.append(element("h5", "", point.label), slotList([
        ["观点", point.claim], ["机制", point.mechanism], ["例证", point.example], ["结果", point.result],
      ]));
      pair.append(card);
    }
    root.append(pair);
    const fills = disclosure("子题材、结尾行动和用法边界");
    fills.append(slotList(topic.subtypes), element("h5", "", "可写的行动者"), en(topic.owner.join(" · ")),
      element("h5", "", "可写的具体措施"), en(topic.measures.join(" · ")), element("p", "", topic.limits));
    root.append(fills);
    stage.replaceChildren(root);
    return root;
  }
  for (const topic of course.topicPacks) {
    const button = element("button", "ghost-button", topic.title.split("／")[0]);
    button.type = "button";
    button.value = topic.id;
    button.addEventListener("click", () => choose(topic));
    buttons.append(button);
    register(topicKey(topic), () => choose(topic));
  }
  const quotes = disclosure("可选例证与引语");
  for (const quote of course.quotes) {
    const card = element("article", "v8-panel");
    card.append(en(quote.en), element("p", "", quote.zh), element("p", "v8-caption", quote.use),
      element("p", "v8-caption", quote.risk));
    quotes.append(card);
  }
  materials.append(buttons, stage, quotes);
  archive.before(materials);
  choose(course.topicPacks[0]);

  const topics = document.getElementById("b-topics");
  const oldTopics = archiveChildren(topics, "历史参考 · 六组理由与旧论证链");
  const index = section("按主题查两条论证链");
  const grid = element("div", "v8-two-col");
  for (const topic of course.topicPacks) {
    const card = element("article", "v8-panel");
    card.append(lessonLink(topic.title, "b-expressions", topicKey(topic)),
      element("p", "v8-caption", topic.packs.map((point) => point.label.split(" · ").at(-1)).join(" · ")));
    grid.append(card);
  }
  index.append(grid);
  oldTopics.before(index);
}

function field(label, control) {
  const wrapper = element("label", "v8-field");
  wrapper.append(element("span", "", label), control);
  return wrapper;
}

function selectFor(options) {
  const select = element("select", "theme-item-select");
  select.append(...options.map(([value, label]) => new Option(label, value)));
  return select;
}

function renderLibrary(course, register, selectPrompt, hasPrompt) {
  const oldHost = document.querySelector('#b-prompts [data-entity-kind="prompt"]');
  const library = section("V8 迁移库");
  library.dataset.v8Library = "";
  const items = [...course.cases].sort((a, b) => a.priority - b.priority || (b.year ?? 0) - (a.year ?? 0));
  const source = selectFor([["", "全部题目"], ["past", "2010–2026 真题"], ["original", "原创模拟"]]);
  const material = selectFor([["", "全部材料"], ...Object.entries(materialNames)]);
  const mode = selectFor([["", "A 和 B"], ...Object.entries(modeNames)]);
  const topic = selectFor([["", "全部主题"], ...course.topicPacks.map((pack) => [pack.id, pack.title])]);
  const filters = disclosure("按年份、材料、主题或 A/B 筛选");
  const controls = element("div", "v8-filters");
  const search = element("input", "v8-query");
  search.type = "search";
  search.placeholder = "例：2026、龙舟、air conditioner";
  controls.append(field("年份、题材或英文词组", search), field("题目来源", source), field("材料", material), field("主体框架", mode), field("主题", topic));
  filters.append(controls);
  const picker = selectFor([]);
  picker.dataset.v8Picker = "";
  const stage = element("div", "v8-library-stage");
  const resultStatus = element("p", "v8-caption");
  const oldButton = element("button", "ghost-button", "查看原有题卡目录");
  oldButton.type = "button";
  library.append(filters, field("选一题对照", picker), resultStatus, stage, oldButton);
  oldHost.before(library);
  let visible = items;

  function showCase(item, reveal = false) {
    oldHost.classList.toggle("v8-synced-prompts", Boolean(item));
    stage.replaceChildren();
    if (!item) {
      oldHost.hidden = true;
      return null;
    }
    picker.value = item.id;
    const id = v8PromptId(item);
    if (id && hasPrompt(id)) {
      oldHost.hidden = false;
      const card = selectPrompt(id);
      const details = card.querySelector(".v8-prompt-written");
      if (details && (reveal || !card.querySelector(".v8-original-essay"))) details.open = true;
      return reveal ? details ?? card : card;
    }
    oldHost.hidden = true;
    const essay = essayView(course, item);
    stage.append(essay);
    return essay;
  }

  function refresh(id = picker.value, reveal = false) {
    const term = search.value.trim().toLocaleLowerCase("zh-CN");
    visible = items.filter((item) =>
      (!source.value || (item.year ? "past" : "original") === source.value) &&
      (!material.value || item.materialForm === material.value) &&
      (!mode.value || item.mode === mode.value) &&
      (!topic.value || item.category === topic.value) &&
      (!term || [item.id, item.title, item.topic, item.routeZh, ...item.plainParagraphs].join(" ").toLocaleLowerCase("zh-CN").includes(term)));
    picker.replaceChildren(...visible.map((item) => new Option(caseTitle(item), item.id)));
    picker.disabled = !visible.length;
    resultStatus.textContent = visible.length ? `${visible.length} 道 · 同题可展开 V8 写法` : "没有匹配题目。";
    return showCase(visible.find((item) => item.id === id) ?? visible[0], reveal);
  }

  function reset(id, reveal = false) {
    for (const control of [search, source, material, mode, topic]) control.value = "";
    return refresh(id, reveal);
  }

  function showOld() {
    stage.replaceChildren();
    picker.value = "";
    oldHost.hidden = false;
    oldHost.classList.remove("v8-synced-prompts");
    resultStatus.textContent = "已显示原有题卡目录。";
  }

  oldButton.addEventListener("click", showOld);
  for (const control of [source, material, mode, topic]) control.addEventListener("change", () => refresh());
  search.addEventListener("input", () => refresh());
  picker.addEventListener("change", () => {
    resultStatus.textContent = `${visible.length} 道 · 同题可展开 V8 写法`;
    showCase(visible.find((item) => item.id === picker.value));
  });
  for (const item of items) register(caseKey(item), () => reset(item.id, true));
  refresh("2023");
  return (id) => {
    const item = items.find((candidate) => v8PromptId(candidate) === id);
    if (item) reset(item.id);
    else showOld();
  };
}

export function renderV8Course(course, { register, selectPrompt, hasPrompt }) {
  const host = document.querySelector('#b-core [data-writing-overlay="core-transfer"]');
  renderCore(course, host, register);
  renderTemplates(course);
  renderTopics(course, register);
  return renderLibrary(course, register, selectPrompt, hasPrompt);
}

export function v8SearchItems(course) {
  if (!course) return [];
  const item = (anchor, id, title, summary, text, type) => ({
    part: "B", anchor, overlayChapterId: id, title, summary, type, searchText: `${title} ${text}`.toLocaleLowerCase("zh-CN"),
  });
  return [
    ...Object.entries(modeNames).map(([mode, name]) =>
      item("b-core", `v8-b-body-${mode.toLowerCase()}`, `V8 母版 ${name}`, "五句连续英文主体", `V8母版${mode} ${JSON.stringify(course.templates[`body${mode}`])}`, "主背")),
    ...course.topicPacks.map((topic) =>
      item("b-expressions", topicKey(topic), topic.title, "两条论证链与英文填充", JSON.stringify(topic), "主题素材")),
    ...course.cases.map((sample) =>
      item("b-prompts", caseKey(sample), caseTitle(sample), sample.routeZh, JSON.stringify(sample), sample.year ? "真题 · V8 套用" : "原创模拟")),
  ];
}
