export const THEME_BODY_FORMAT = "baicaoyuan-v7.2-theme-body-overlay";

const themeBodyActivators = new Map();

const FUNCTION_LABELS = new Map([
  ["all", "全部主题"],
  ["invitation", "邀请"],
  ["notice", "通知"],
  ["recruitment", "招募"],
  ["reply", "回复"],
  ["advice", "建议"],
  ["recommendation", "推荐"],
]);

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  return node;
}

function button(text, className = "") {
  const node = element("button", className, text);
  node.type = "button";
  return node;
}

function openSection(sectionId) {
  const link = document.querySelector(`#sectionNav a[href="#${sectionId}"]`);
  if (link) link.click();
  else document.getElementById(sectionId)?.scrollIntoView({ block: "start" });
}

function createModeDeck(items, { className, label, initialId = null } = {}) {
  const root = element("div", className);
  const tabs = element("div", `${className}-tabs`);
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", label);
  const panels = element("div", `${className}-panels`);
  const buttons = [];
  const panelNodes = [];

  function activate(id, focus = false) {
    const selectedIndex = Math.max(0, items.findIndex((item) => item.id === id));
    for (const [index, tab] of buttons.entries()) {
      const active = index === selectedIndex;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panelNodes[index].hidden = !active;
    }
    if (focus) buttons[selectedIndex]?.focus();
  }

  for (const [index, item] of items.entries()) {
    const tab = button(item.label);
    tab.id = `${className}-tab-${item.id}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `${className}-panel-${item.id}`);
    const panel = element("section", `${className}-panel`);
    panel.id = `${className}-panel-${item.id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.append(item.content);
    tab.addEventListener("click", () => activate(item.id));
    tab.addEventListener("keydown", (event) => {
      if (!new Set(["ArrowLeft", "ArrowRight", "Home", "End"]).has(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
      if (event.key === "ArrowRight") next = (index + 1) % items.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = items.length - 1;
      activate(items[next].id, true);
    });
    tabs.append(tab);
    panels.append(panel);
    buttons.push(tab);
    panelNodes.push(panel);
  }
  root.append(tabs, panels);
  activate(initialId ?? items[0]?.id);
  return { root, activate };
}

function createItemBrowser(items, { label, renderItem, compact = false } = {}) {
  let visibleItems = [...items];
  let activeIndex = 0;
  const root = element("div", `theme-item-browser${compact ? " compact" : ""}`);
  const controls = element("div", "theme-item-controls");
  const previous = button("上一项", "theme-item-arrow");
  previous.setAttribute("aria-label", `${label}上一项`);
  const select = element("select", "theme-item-select");
  select.setAttribute("aria-label", label);
  const next = button("下一项", "theme-item-arrow");
  next.setAttribute("aria-label", `${label}下一项`);
  const status = element("span", "theme-item-status");
  status.setAttribute("aria-live", "polite");
  const stage = element("div", "theme-item-stage");

  function render() {
    const item = visibleItems[activeIndex];
    select.replaceChildren(...visibleItems.map((candidate) => {
      const option = element("option", "", candidate.label ?? candidate.title ?? candidate.name ?? candidate.id);
      option.value = candidate.id;
      return option;
    }));
    if (item) select.value = item.id;
    previous.disabled = activeIndex <= 0;
    next.disabled = activeIndex >= visibleItems.length - 1;
    status.textContent = visibleItems.length > 0 ? `${activeIndex + 1} / ${visibleItems.length}` : "0 / 0";
    stage.replaceChildren(item ? renderItem(item) : element("p", "overlay-empty", "当前筛选下没有内容。"));
  }

  function activate(id) {
    const index = visibleItems.findIndex((item) => item.id === id);
    if (index < 0) return false;
    activeIndex = index;
    render();
    return true;
  }

  function setItems(nextItems, preferredId = null) {
    visibleItems = [...nextItems];
    activeIndex = Math.max(0, preferredId ? visibleItems.findIndex((item) => item.id === preferredId) : 0);
    render();
  }

  previous.addEventListener("click", () => { activeIndex = Math.max(0, activeIndex - 1); render(); });
  next.addEventListener("click", () => { activeIndex = Math.min(visibleItems.length - 1, activeIndex + 1); render(); });
  select.addEventListener("change", () => activate(select.value));
  controls.append(previous, select, next, status);
  root.append(controls, stage);
  render();
  return { root, activate, setItems };
}

function sentenceBlock(sentence, label = "") {
  const block = element("article", "theme-sentence");
  if (label) block.append(element("span", "theme-sentence-label", label));
  const english = element("p", "theme-sentence-en", sentence.en);
  english.lang = "en";
  block.append(english, element("p", "theme-sentence-zh", sentence.zh));
  if (sentence.whyZh) block.append(element("p", "theme-sentence-why", sentence.whyZh));
  return block;
}

function sentenceGroup(title, sentences) {
  const section = element("section", "theme-sentence-group");
  section.append(element("h4", "", title));
  for (const sentence of sentences) section.append(sentenceBlock(sentence));
  return section;
}

function scenarioCard(item, { activeFunction = "all", linkedEssay = null, onOpenEssay, onOpenExpressions } = {}) {
  const article = element("article", "theme-body-card scenario-card");
  article.dataset.themeBodyId = item.id;
  const header = element("header", "theme-body-card-head");
  const copy = element("div");
  copy.append(element("p", "overlay-kicker", "PART A · SUBJECT MATTER"), element("h3", "", item.name));
  const tags = element("div", "theme-chip-row");
  for (const functionId of item.partA) tags.append(element("span", functionId === activeFunction ? "active" : "", FUNCTION_LABELS.get(functionId) ?? functionId));
  header.append(copy, tags);
  article.append(header, element("p", "theme-core-route", item.core));

  const primary = element("div", "theme-primary-grid");
  primary.append(sentenceGroup("写什么具体内容", item.material), sentenceGroup("为什么值得参加", item.benefits));
  article.append(primary);

  const details = element("details", "study-details theme-card-details");
  details.append(element("summary", "", "点击展开 · 条件、对象与体裁改写"));
  const body = element("div", "theme-card-detail-body");
  body.append(sentenceGroup("条件与限制", item.requirements), sentenceGroup("和收信人的关系", [item.forReader]));
  const switches = element("section", "theme-switch-grid");
  switches.append(element("h4", "", "同一主题怎样换任务"));
  for (const [functionId, guidance] of Object.entries(item.switch)) {
    const row = element("div", functionId === activeFunction ? "active" : "");
    row.append(element("b", "", FUNCTION_LABELS.get(functionId) ?? functionId), element("span", "", guidance));
    switches.append(row);
  }
  body.append(switches);
  const bridge = element("section", "theme-b-bridge");
  bridge.append(element("h4", "", "向 Part B 迁移"), sentenceBlock(item.Bbridge));
  body.append(bridge, element("p", "theme-risk-note", `别硬编：${item.dont}`));
  details.append(body);
  article.append(details);

  const actions = element("div", "theme-card-actions");
  if (linkedEssay) {
    const essayButton = button("看本主题完整范文", "theme-primary-action");
    essayButton.addEventListener("click", () => onOpenEssay(linkedEssay.id));
    actions.append(essayButton);
  }
  const expressionsButton = button("去配功能句", "theme-secondary-action");
  expressionsButton.addEventListener("click", onOpenExpressions);
  actions.append(expressionsButton);
  article.append(actions);
  return article;
}

function argumentCard(item, { linkedEssay = null, onOpenEssay, onOpenExpressions } = {}) {
  const article = element("article", "theme-body-card argument-card");
  article.dataset.themeBodyId = item.id;
  const header = element("header", "theme-body-card-head");
  const copy = element("div");
  copy.append(element("p", "overlay-kicker", "PART B · ARGUMENT CHAIN"), element("h3", "", item.title), element("p", "theme-question", item.question));
  header.append(copy);
  article.append(header, element("p", "theme-core-route", item.logic));
  const chain = element("div", "argument-chain");
  chain.append(
    sentenceBlock(item.claim, "观点"),
    sentenceBlock(item.mechanism, "机制"),
    sentenceBlock(item.example, "例子"),
    sentenceBlock(item.nuance, "限定"),
  );
  article.append(chain, element("p", "theme-risk-note", `边界：${item.avoid}`));
  const actions = element("div", "theme-card-actions");
  if (linkedEssay) {
    const essayButton = button("看本论证完整范文", "theme-primary-action");
    essayButton.addEventListener("click", () => onOpenEssay(linkedEssay.id));
    actions.append(essayButton);
  }
  const expressionsButton = button("去配论证句", "theme-secondary-action");
  expressionsButton.addEventListener("click", onOpenExpressions);
  actions.append(expressionsButton);
  article.append(actions);
  return article;
}

function essayCard(essay, part) {
  const article = element("article", "theme-essay-card");
  article.dataset.themeBodyId = essay.id;
  const header = element("header", "theme-essay-head");
  const copy = element("div");
  const title = part === "A" ? `${essay.type}｜${essay.task.replace(/^原创练习：/u, "")}` : essay.title;
  copy.append(
    element("p", "overlay-kicker", part === "A" ? "原创小作文示范" : essay.label),
    element("h3", "", title),
    element("p", "essay-task", part === "A" ? essay.task : essay.prompt),
  );
  header.append(copy, element("span", "essay-word-count", `${essay.wordCount} 词`));
  article.append(header);

  const controls = element("div", "essay-mode-switch");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "范文阅读方式");
  const memorise = button("连读速背");
  const annotate = button("逐句讲评");
  const stage = element("div", "essay-mode-stage");
  let mode = "memorise";

  function render() {
    memorise.classList.toggle("active", mode === "memorise");
    annotate.classList.toggle("active", mode === "annotate");
    memorise.setAttribute("aria-pressed", String(mode === "memorise"));
    annotate.setAttribute("aria-pressed", String(mode === "annotate"));
    if (mode === "memorise") {
      const reading = element("div", "essay-continuous-reading");
      const hideEnglish = button("遮住英文，按段复述", "ghost-button");
      hideEnglish.setAttribute("aria-pressed", "false");
      const text = element("div", "essay-continuous-text");
      if (part === "A") {
        const salutation = element("p", "essay-letter-frame", essay.salutation);
        salutation.lang = "en";
        text.append(salutation);
      }
      for (const paragraph of essay.paragraphs) {
        const line = element("p", "", paragraph.map((sentence) => sentence.en).join(" "));
        line.lang = "en";
        text.append(line);
      }
      if (part === "A") {
        const signoff = element("p", "essay-letter-frame", essay.signoff);
        signoff.lang = "en";
        text.append(signoff);
      }
      const hidden = element("div", "essay-recall-placeholder", "英文已遮住：先按三段结构完整复述，再点按钮核对。");
      hideEnglish.addEventListener("click", () => {
        const concealed = reading.classList.toggle("hide-essay-english");
        hideEnglish.setAttribute("aria-pressed", String(concealed));
        hideEnglish.textContent = concealed ? "显示英文核对" : "遮住英文，按段复述";
      });
      reading.append(hideEnglish, text, hidden);
      stage.replaceChildren(reading);
      return;
    }

    const annotated = element("div", "essay-annotated-reading");
    for (const [paragraphIndex, paragraph] of essay.paragraphs.entries()) {
      const block = element("section", "essay-annotated-paragraph");
      block.append(element("span", "essay-paragraph-label", `P${paragraphIndex + 1}`));
      for (const sentence of paragraph) block.append(sentenceBlock(sentence));
      annotated.append(block);
    }
    stage.replaceChildren(annotated);
  }

  memorise.addEventListener("click", () => { mode = "memorise"; render(); });
  annotate.addEventListener("click", () => { mode = "annotate"; render(); });
  controls.append(memorise, annotate);
  article.append(controls, stage);
  render();
  return article;
}

function drillCard(drill) {
  const article = element("article", "theme-drill-card");
  article.dataset.themeBodyId = drill.id;
  article.append(element("p", "overlay-kicker", `PART ${drill.part} · ORIGINAL PRACTICE`), element("h3", "", drill.prompt));
  const checklist = element("ul", "theme-drill-checklist");
  for (const point of drill.must) checklist.append(element("li", "", point));
  article.append(element("h4", "", "作答必须包含"), checklist);
  const answer = element("details", "study-details theme-drill-answer");
  answer.append(element("summary", "", "完成后展开 · 参考主体与错误边界"));
  const body = element("div", "theme-drill-sample");
  for (const sentence of drill.sample) body.append(sentenceBlock(sentence));
  body.append(element("p", "theme-risk-note", `常见坑：${drill.trap}`));
  answer.append(body);
  article.append(answer);
  return article;
}

function expressionCard(item) {
  const article = element("article", "theme-expression-card");
  article.dataset.themeBodyId = item.id;
  article.append(
    element("span", `expression-priority ${item.memorizationPriority}`, item.memorizationPriority === "must" ? "主背" : "备用"),
    element("p", "theme-expression-en", item.patternEn),
    element("p", "theme-expression-zh", item.meaningZh),
  );
  const details = element("details", "study-details");
  details.append(element("summary", "", "点击展开 · 适用范围与错误边界"));
  const body = element("div", "expression-boundaries");
  body.append(element("p", "", `适用：${item.intendedUse}`), element("p", "risk", `边界：${item.riskNoteZh}`));
  details.append(body);
  article.append(details);
  return article;
}

function expressionGroup(group) {
  const root = element("section", "theme-expression-group");
  root.append(element("h3", "", group.label));
  const must = group.items.filter((item) => item.memorizationPriority === "must");
  const recommended = group.items.filter((item) => item.memorizationPriority === "recommended");
  const core = element("div", "theme-expression-grid");
  for (const item of must) core.append(expressionCard(item));
  root.append(core);
  if (recommended.length > 0) {
    const details = element("details", "study-details theme-expression-backups");
    details.append(element("summary", "", `点击展开 · 备用句式 ${recommended.length} 组`));
    const grid = element("div", "theme-expression-grid");
    for (const item of recommended) grid.append(expressionCard(item));
    details.append(grid);
    root.append(details);
  }
  return root;
}

function sourceDetails(overlay) {
  const details = element("details", "theme-source-details");
  details.append(element("summary", "", "来源、原创范围与核验状态"));
  const note = element("p", "", "完整范文与练习均标为原创教学材料；真题资料只提供题型与主题背景，不把原创题干冒充历年原题。语言内容已做来源包内部审阅，外部事实仍保持 unverified。 ");
  const list = element("ul");
  for (const source of overlay.sourceReferences) {
    const item = element("li");
    const title = source.url ? element("a", "", source.title) : element("strong", "", source.title);
    if (source.url) {
      title.href = source.url;
      title.target = "_blank";
      title.rel = "noopener noreferrer";
    }
    item.append(title, document.createTextNode(`：${source.use}`));
    list.append(item);
  }
  details.append(note, list);
  return details;
}

function renderTopicCourse(overlay, part, onOpenExpressions) {
  const targetId = part === "A" ? "a-topics" : "b-topics";
  const target = document.getElementById(targetId);
  if (!target) return null;
  const course = element("section", "theme-body-course");
  course.dataset.v72Injected = "true";
  const header = element("header", "theme-body-course-head");
  header.append(
    element("p", "overlay-kicker", "V7.2 · CONTENT BEFORE ORNAMENT"),
    element("h3", "", part === "A" ? "主体内容工作台" : "论证链工作台"),
    element("p", "", part === "A" ? "先选场景和交际任务，再取具体内容、收益与限制；一次只显示一张卡。" : "按观点—机制—例子—限定组织主体段；一次只处理一条论证链。"),
  );

  const essays = part === "A" ? overlay.applicationEssays : overlay.picturePracticeEssays;
  const essayIndex = new Map(essays.map((essay) => [essay.themeId, essay]));
  let topicBrowser;
  let essayBrowser;
  let drillBrowser;
  let modeDeck;
  let selectedFunction = "all";

  const materials = element("div", "theme-material-mode");
  if (part === "A") {
    const filters = element("div", "theme-function-filters");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "按小作文功能筛选场景");
    const filterIds = ["all", "invitation", "notice", "recruitment", "reply", "advice", "recommendation"];
    const filterButtons = new Map();
    for (const id of filterIds) {
      const filter = button(FUNCTION_LABELS.get(id));
      filter.setAttribute("aria-pressed", String(id === "all"));
      filter.addEventListener("click", () => {
        selectedFunction = id;
        for (const [candidateId, candidate] of filterButtons) candidate.setAttribute("aria-pressed", String(candidateId === id));
        const matches = id === "all" ? overlay.scenarioCards : overlay.scenarioCards.filter((item) => item.partA.includes(id));
        topicBrowser.setItems(matches);
      });
      filterButtons.set(id, filter);
      filters.append(filter);
    }
    materials.append(filters);
    topicBrowser = createItemBrowser(overlay.scenarioCards, {
      label: "选择 Part A 主题场景",
      renderItem: (item) => scenarioCard(item, {
        activeFunction: selectedFunction,
        linkedEssay: essayIndex.get(item.id),
        onOpenEssay: (id) => { modeDeck.activate("essays"); essayBrowser.activate(id); },
        onOpenExpressions,
      }),
    });
    materials.append(topicBrowser.root);
    for (const item of overlay.scenarioCards) {
      themeBodyActivators.set(item.id, () => {
        openSection(targetId);
        selectedFunction = "all";
        for (const [candidateId, candidate] of filterButtons) candidate.setAttribute("aria-pressed", String(candidateId === "all"));
        topicBrowser.setItems(overlay.scenarioCards, item.id);
        modeDeck.activate("materials");
      });
    }
  } else {
    topicBrowser = createItemBrowser(overlay.argumentChains, {
      label: "选择 Part B 论证链",
      renderItem: (item) => argumentCard(item, {
        linkedEssay: essayIndex.get(item.id),
        onOpenEssay: (id) => { modeDeck.activate("essays"); essayBrowser.activate(id); },
        onOpenExpressions,
      }),
    });
    materials.append(topicBrowser.root);
    for (const item of overlay.argumentChains) {
      themeBodyActivators.set(item.id, () => { openSection(targetId); topicBrowser.activate(item.id); modeDeck.activate("materials"); });
    }
  }

  const essayMode = element("div", "theme-essay-mode");
  essayBrowser = createItemBrowser(essays, {
    label: part === "A" ? "选择小作文原创范文" : "选择大作文原创范文",
    renderItem: (essay) => essayCard(essay, part),
  });
  essayMode.append(element("p", "theme-mode-note", "连读与逐句讲评共用同一份正文；切换模式不会再复制一遍范文。"), essayBrowser.root);
  for (const essay of essays) {
    themeBodyActivators.set(essay.id, () => { openSection(targetId); modeDeck.activate("essays"); essayBrowser.activate(essay.id); });
  }

  const drills = overlay.drills.filter((drill) => drill.part === part);
  const drillMode = element("div", "theme-drill-mode");
  drillBrowser = createItemBrowser(drills, {
    label: `${part} 部分主体内容训练`,
    renderItem: drillCard,
  });
  drillMode.append(element("p", "theme-mode-note", "先只看任务点完成草稿，再展开参考主体；答案默认收起。"), drillBrowser.root);
  for (const drill of drills) {
    themeBodyActivators.set(drill.id, () => { openSection(targetId); modeDeck.activate("drills"); drillBrowser.activate(drill.id); });
  }

  modeDeck = createModeDeck([
    { id: "materials", label: part === "A" ? "主题素材" : "论证链", content: materials },
    { id: "essays", label: `完整范文 ${essays.length}`, content: essayMode },
    { id: "drills", label: `反向训练 ${drills.length}`, content: drillMode },
  ], { className: `theme-body-mode-${part.toLowerCase()}`, label: `${part} 部分主题主体学习方式` });

  course.append(header, modeDeck.root, sourceDetails(overlay));
  target.querySelector(".entity-list")?.before(course);
  if (!course.isConnected) target.append(course);
  return { targetId, modeDeck, topicBrowser, essayBrowser, drillBrowser };
}

function renderExpressionCourse(overlay, part) {
  const targetId = part === "A" ? "a-expressions" : "b-expressions";
  const target = document.getElementById(targetId);
  if (!target) return null;
  const expressions = overlay.expressionDeck.filter((item) => item.section.startsWith(`${part}-`));
  const grouped = new Map();
  for (const item of expressions) {
    if (!grouped.has(item.section)) grouped.set(item.section, []);
    grouped.get(item.section).push(item);
  }
  const groups = [...grouped].map(([section, items]) => ({ id: section.toLocaleLowerCase("en").replace(/[^a-z0-9]+/gu, "-"), label: section.replace(/^[AB]-/u, ""), section, items }));
  const course = element("section", "theme-expression-course");
  course.dataset.v72Injected = "true";
  const header = element("header", "theme-expression-course-head");
  header.append(
    element("p", "overlay-kicker", "V7.2 · FUNCTIONAL SENTENCES"),
    element("h3", "", part === "A" ? "把主体内容写成句子" : "把论证链写成句子"),
    element("p", "", "按段落功能分组；主背句直接显示，备用句和错误边界按需展开。"),
  );
  const browser = createItemBrowser(groups, {
    label: `${part} 部分 V7.2 句式分组`,
    renderItem: expressionGroup,
    compact: true,
  });
  course.append(header, browser.root);
  target.querySelector(".entity-list")?.before(course);
  if (!course.isConnected) target.append(course);
  for (const group of groups) {
    themeBodyActivators.set(`v72-expressions-${group.id}`, () => { openSection(targetId); browser.activate(group.id); });
  }
  return { targetId, browser, groups };
}

function renderBridges(part, topicCourse) {
  const topicId = part === "A" ? "a-topics" : "b-topics";
  const expressionId = part === "A" ? "a-expressions" : "b-expressions";
  const templateId = part === "A" ? "a-templates" : "b-templates";
  const coreHost = document.querySelector('[data-writing-overlay="core-transfer"]');
  const coreIntro = coreHost?.querySelector(".core-overlay-intro");
  if (coreIntro) {
    const quick = element("nav", "theme-body-quicklinks");
    quick.dataset.v72Injected = "true";
    quick.setAttribute("aria-label", "主体内容快捷入口");
    quick.append(element("span", "", "母版背完，下一步"));
    const material = button(part === "A" ? "选主题素材" : "补论证链");
    const essays = button("连读范文");
    const drills = button("闭卷训练");
    material.addEventListener("click", () => { openSection(topicId); topicCourse.modeDeck.activate("materials"); });
    essays.addEventListener("click", () => { openSection(topicId); topicCourse.modeDeck.activate("essays"); });
    drills.addEventListener("click", () => { openSection(topicId); topicCourse.modeDeck.activate("drills"); });
    quick.append(material, essays, drills);
    coreIntro.after(quick);
  }

  const template = document.getElementById(templateId);
  if (template) {
    const bridge = element("aside", "theme-template-bridge");
    bridge.dataset.v72Injected = "true";
    const copy = element("div");
    copy.append(
      element("b", "", part === "A" ? "母版负责结构，主题卡负责把第二段写实。" : "母版负责三段结构，论证链负责让第二段不是口号。"),
      element("span", "", "先选内容，再回母版填槽；别拿高级词给空心作文做尸体美容。"),
    );
    const go = button(part === "A" ? "这题写什么内容？" : "去补足论证");
    go.addEventListener("click", () => { openSection(topicId); topicCourse.modeDeck.activate("materials"); });
    bridge.append(copy, go);
    template.querySelector(".entity-list")?.before(bridge);
    if (!bridge.isConnected) template.append(bridge);
  }

  themeBodyActivators.set(`v72-${part.toLowerCase()}-materials`, () => { openSection(topicId); topicCourse.modeDeck.activate("materials"); });
  themeBodyActivators.set(`v72-${part.toLowerCase()}-essays`, () => { openSection(topicId); topicCourse.modeDeck.activate("essays"); });
  themeBodyActivators.set(`v72-${part.toLowerCase()}-drills`, () => { openSection(topicId); topicCourse.modeDeck.activate("drills"); });
  themeBodyActivators.set(`v72-${part.toLowerCase()}-expressions`, () => openSection(expressionId));
}

export function renderThemeBodyOverlay({ overlay, part }) {
  themeBodyActivators.clear();
  document.querySelectorAll("[data-v72-injected]").forEach((node) => node.remove());
  if (!overlay) return;
  const expressionId = part === "A" ? "a-expressions" : "b-expressions";
  const topicCourse = renderTopicCourse(overlay, part, () => openSection(expressionId));
  renderExpressionCourse(overlay, part);
  if (topicCourse) renderBridges(part, topicCourse);
}

export function activateThemeBodyLesson(id) {
  const activate = themeBodyActivators.get(id);
  if (!activate) return false;
  activate();
  return true;
}

export function themeBodySearchItems(overlay, part) {
  if (!overlay) return [];
  const anchor = part === "A" ? "a-topics" : "b-topics";
  const result = [
    {
      part,
      anchor,
      title: part === "A" ? "主题主体内容工作台" : "论证链工作台",
      summary: part === "A" ? "场景素材、具体收益、条件边界、完整范文与反向训练" : "观点、机制、例子、限定、完整范文与反向训练",
      type: "V7.2 主体内容",
      overlayChapterId: `v72-${part.toLowerCase()}-materials`,
      searchText: "主题 主体 内容 论证 范文 训练".toLocaleLowerCase("zh-CN"),
    },
  ];
  const topics = part === "A" ? overlay.scenarioCards : overlay.argumentChains;
  for (const item of topics) {
    result.push({
      part,
      anchor,
      title: item.name ?? item.title,
      summary: item.core ?? `${item.question} ${item.logic}`,
      type: part === "A" ? "主题场景卡" : "论证链",
      overlayChapterId: item.id,
      searchText: JSON.stringify(item).toLocaleLowerCase("zh-CN"),
    });
  }
  const essays = part === "A" ? overlay.applicationEssays : overlay.picturePracticeEssays;
  for (const essay of essays) {
    result.push({
      part,
      anchor,
      title: part === "A" ? essay.task : essay.title,
      summary: `${essay.wordCount} 词原创示范；连读速背与逐句讲评共用正文。`,
      type: "V7.2 原创范文",
      overlayChapterId: essay.id,
      searchText: JSON.stringify(essay).toLocaleLowerCase("zh-CN"),
    });
  }
  return result;
}
