import {
  THEME_BODY_FORMAT,
  activateThemeBodyLesson,
  renderThemeBodyOverlay,
  themeBodySearchItems,
} from "./writing-theme-body.js";

const CORE_TRANSFER_FORMAT = "baicaoyuan-v7-study-overlay";
const PROMPT_LITERACY_FORMAT = "baicaoyuan-v7.1-prompt-literacy-overlay";

const lessonActivators = new Map();

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  return node;
}

function appendInline(parent, source) {
  const text = String(source ?? "");
  const tokenPattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/gu;
  let cursor = 0;
  for (const match of text.matchAll(tokenPattern)) {
    if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
    const token = match[0];
    if (token.startsWith("**")) parent.append(element("strong", "", token.slice(2, -2)));
    else if (token.startsWith("`")) parent.append(element("code", "", token.slice(1, -1)));
    else parent.append(element("em", "", token.slice(1, -1)));
    cursor = match.index + token.length;
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function markdownCells(line) {
  return line.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/u.test(line);
}

function isMarkdownBoundary(lines, index) {
  const line = lines[index] ?? "";
  if (!line.trim()) return true;
  if (/^#{1,6}\s+/u.test(line) || /^>\s?/u.test(line) || /^\s*(?:[-*]|\d+[.)])\s+/u.test(line) || /^\s*---+\s*$/u.test(line)) return true;
  return line.trim().startsWith("|") && isTableSeparator(lines[index + 1] ?? "");
}

function renderMarkdown(markdown) {
  const root = element("div", "overlay-markdown");
  const lines = String(markdown ?? "").replace(/\r\n?/gu, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/u);
    if (headingMatch) {
      const level = Math.min(5, Math.max(3, headingMatch[1].length + 2));
      const heading = element(`h${level}`);
      appendInline(heading, headingMatch[2]);
      root.append(heading);
      index += 1;
      continue;
    }

    if (line.trim().startsWith("|") && isTableSeparator(lines[index + 1] ?? "")) {
      const wrapper = element("div", "overlay-table-wrap");
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", "教学对照表，可横向滚动");
      const table = element("table", "overlay-table");
      const head = element("thead");
      const headRow = element("tr");
      for (const cellText of markdownCells(line)) {
        const cell = element("th");
        cell.scope = "col";
        appendInline(cell, cellText);
        headRow.append(cell);
      }
      head.append(headRow);
      table.append(head);
      index += 2;
      const body = element("tbody");
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const row = element("tr");
        for (const cellText of markdownCells(lines[index])) {
          const cell = element("td");
          appendInline(cell, cellText);
          row.append(cell);
        }
        body.append(row);
        index += 1;
      }
      table.append(body);
      wrapper.append(table);
      root.append(wrapper);
      continue;
    }

    if (/^>\s?/u.test(line)) {
      const quote = element("blockquote");
      while (index < lines.length && /^>\s?/u.test(lines[index])) {
        const paragraph = element("p");
        appendInline(paragraph, lines[index].replace(/^>\s?/u, ""));
        quote.append(paragraph);
        index += 1;
      }
      root.append(quote);
      continue;
    }

    const listMatch = line.match(/^\s*((?:[-*])|(?:\d+[.)]))\s+(.+)$/u);
    if (listMatch) {
      const ordered = /^\d/u.test(listMatch[1]);
      const list = element(ordered ? "ol" : "ul");
      while (index < lines.length) {
        const candidate = lines[index].match(/^\s*((?:[-*])|(?:\d+[.)]))\s+(.+)$/u);
        if (!candidate || /^\d/u.test(candidate[1]) !== ordered) break;
        const item = element("li");
        appendInline(item, candidate[2]);
        list.append(item);
        index += 1;
      }
      root.append(list);
      continue;
    }

    if (/^\s*---+\s*$/u.test(line)) {
      root.append(element("hr"));
      index += 1;
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length && !isMarkdownBoundary(lines, index)) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    const paragraph = element("p");
    appendInline(paragraph, paragraphLines.join(" "));
    root.append(paragraph);
  }
  return root;
}

function splitAnswerSection(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n?/gu, "\n").split("\n");
  const answerIndex = lines.findIndex((line) => /^###\s+参考(?:答案|解析)/u.test(line));
  if (answerIndex < 0) return { lesson: markdown, answer: null };
  return {
    lesson: lines.slice(0, answerIndex).join("\n"),
    answer: lines.slice(answerIndex + 1).join("\n"),
  };
}

function createTabDeck(items, { className, label, initialId = null, onChange = null } = {}) {
  const root = element("div", className);
  const tabs = element("div", `${className}-tabs`);
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", label);
  const panels = element("div", `${className}-panels`);
  const buttons = [];
  const panelNodes = [];

  function activate(id, focus = false) {
    const selectedIndex = Math.max(0, items.findIndex((item) => item.id === id));
    for (const [index, button] of buttons.entries()) {
      const active = index === selectedIndex;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      panelNodes[index].hidden = !active;
    }
    if (focus) buttons[selectedIndex]?.focus();
    onChange?.(items[selectedIndex], panelNodes[selectedIndex]);
  }

  for (const [index, item] of items.entries()) {
    const button = element("button", "", item.label);
    button.type = "button";
    button.id = `${className}-tab-${item.id}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `${className}-panel-${item.id}`);
    const panel = element("section", `${className}-panel`);
    panel.id = `${className}-panel-${item.id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", button.id);
    panel.append(item.content);
    button.addEventListener("click", () => activate(item.id));
    button.addEventListener("keydown", (event) => {
      if (!new Set(["ArrowLeft", "ArrowRight", "Home", "End"]).has(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
      if (event.key === "ArrowRight") next = (index + 1) % items.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = items.length - 1;
      activate(items[next].id, true);
    });
    tabs.append(button);
    panels.append(panel);
    buttons.push(button);
    panelNodes.push(panel);
  }
  root.append(tabs, panels);
  activate(initialId ?? items[0]?.id);
  return { root, activate };
}

function createModelStudy(modelId, metadata, entry, renderTemplateCard, tier) {
  const wrapper = element("div", "core-model-study");
  const header = element("header", "core-model-header");
  const copy = element("div");
  copy.append(
    element("p", "overlay-kicker", `${tier === "primary" ? "主背" : "扩展"} · ${entry?.id ?? modelId}`),
    element("h3", "", metadata?.title ?? entry?.title ?? modelId),
  );
  if (metadata?.referenceTopic) copy.append(element("p", "core-reference", `参考主题：${metadata.referenceTopic}`));
  header.append(copy, element("span", `study-tier ${tier}`, tier === "primary" ? "优先背诵" : "功能扩展"));
  wrapper.append(header);
  if (metadata?.route) {
    const route = element("div", "study-route");
    route.append(element("b", "", "迁移路线"), element("span", "", metadata.route));
    wrapper.append(route);
  }
  if (entry) wrapper.append(renderTemplateCard(entry, { domIdPrefix: "core-" }));
  else wrapper.append(element("p", "overlay-empty", `母版 ${modelId} 未进入当前教材包。`));
  return wrapper;
}

function renderCoreModels(overlay, part, entryIndex, renderTemplateCard) {
  const plan = overlay.partStudyPlan?.[part];
  const modelIds = [...(plan?.primaryModelIds ?? []), ...(plan?.extensionModelIds ?? [])];
  const metadata = new Map(overlay.coreModels.map((model) => [model.sourceEntryId, model]));
  const items = modelIds.map((id) => ({
    id,
    label: `${plan.primaryModelIds.includes(id) ? "主背" : "扩展"}｜${metadata.get(id)?.title?.split("｜").at(-1) ?? entryIndex.get(id)?.title ?? id}`,
    content: createModelStudy(
      id,
      metadata.get(id),
      entryIndex.get(id),
      renderTemplateCard,
      plan.primaryModelIds.includes(id) ? "primary" : "extension",
    ),
  }));
  return createTabDeck(items, { className: `model-deck-${part.toLowerCase()}`, label: `${part} 部分核心母版` }).root;
}

function renderTransferCase(item, entryIndex, onOpenEntry) {
  const article = element("article", "transfer-case");
  const head = element("header", "transfer-head");
  const copy = element("div");
  copy.append(
    element("p", "overlay-kicker", `${item.kind} · 约 ${item.wordCountApprox} 词`),
    element("h3", "", item.title),
    element("p", "transfer-theme", `主题：${item.theme}`),
  );
  const toggle = element("button", "ghost-button", "进入默写模式");
  toggle.type = "button";
  toggle.setAttribute("aria-pressed", "false");
  toggle.addEventListener("click", () => {
    const hidden = article.classList.toggle("hide-english");
    toggle.setAttribute("aria-pressed", String(hidden));
    toggle.textContent = hidden ? "显示英文" : "进入默写模式";
  });
  head.append(copy, toggle);
  article.append(head);

  const evidence = element("aside", "overlay-callout evidence-callout");
  evidence.append(element("b", "", "材料边界"), element("span", "", item.evidence));
  article.append(evidence);
  const sourceLinks = element("div", "transfer-source-links");
  for (const [label, id] of [["查看原母版", item.modelId], ["查看原题卡", item.sourcePromptId]]) {
    if (!id) continue;
    const button = element("button", "", entryIndex.get(id)?.title ? `${label}｜${entryIndex.get(id).title}` : label);
    button.type = "button";
    button.disabled = !entryIndex.has(id);
    button.addEventListener("click", () => onOpenEntry(id));
    sourceLinks.append(button);
  }
  article.append(sourceLinks);

  const decisions = element("div", "transfer-decisions");
  for (const [paragraph, decision, note] of item.changes) {
    const card = element("article", `transfer-decision ${decision}`);
    card.append(
      element("span", "", paragraph),
      element("b", "", decision === "reuse" ? "保留" : decision === "partial" ? "局部改写" : "整体重写"),
      element("p", "", note),
    );
    decisions.append(card);
  }
  article.append(decisions);

  const paragraphs = element("div", "transfer-paragraphs");
  for (const [index, paragraph] of item.paragraphs.entries()) {
    const block = element("section", "transfer-paragraph");
    block.append(element("span", "transfer-paragraph-label", `P${index + 1}`));
    const en = element("p", "transfer-en", paragraph.en);
    en.lang = "en";
    block.append(en, element("p", "transfer-hidden-note", `第 ${index + 1} 段英文已隐藏，请按中文提示复述。`), element("p", "transfer-zh", paragraph.zh));
    const notes = element("details", "study-details");
    notes.append(element("summary", "", "点击展开 · 讲评与难词"));
    const noteBody = element("div", "transfer-notes");
    const comments = element("ul");
    for (const comment of paragraph.comments) comments.append(element("li", "", comment));
    noteBody.append(comments);
    if (paragraph.glosses.length > 0) {
      const glosses = element("div", "transfer-glosses");
      for (const [word, meaning] of paragraph.glosses) glosses.append(element("span", "", `${word}｜${meaning}`));
      noteBody.append(glosses);
    }
    notes.append(noteBody);
    block.append(notes);
    paragraphs.append(block);
  }
  article.append(paragraphs);
  return article;
}

function renderTransfers(overlay, part, entryIndex, onOpenEntry) {
  const cases = overlay.transferCases.filter((item) => item.part === part);
  const items = cases.map((item) => ({ id: item.id, label: item.title.split("｜")[0], content: renderTransferCase(item, entryIndex, onOpenEntry) }));
  return createTabDeck(items, { className: `transfer-deck-${part.toLowerCase()}`, label: `${part} 部分跨题迁移案例` }).root;
}

function fillFrame(frame, slots, values) {
  let output = frame;
  for (const slot of slots) output = output.replace(`[${slot.name}]`, values.get(slot.name) ?? `[${slot.name}]`);
  return output;
}

function renderSlotGuide(guide) {
  const card = element("article", "slot-guide-card");
  card.append(element("h3", "", guide.title));
  const selections = new Map();
  const preview = element("p", "slot-guide-frame", guide.frame);
  preview.lang = "en";
  card.append(preview);
  for (const slot of guide.slots) {
    const details = element("details", "slot-choice");
    details.append(element("summary", "", `${slot.name}｜${slot.zh}`));
    const choices = element("div", "slot-examples");
    for (const example of slot.examples) {
      const button = element("button", "", example);
      button.type = "button";
      button.addEventListener("click", () => {
        selections.set(slot.name, example);
        preview.textContent = fillFrame(guide.frame, guide.slots, selections);
        for (const candidate of choices.querySelectorAll("button")) candidate.setAttribute("aria-pressed", String(candidate === button));
      });
      choices.append(button);
    }
    details.append(choices);
    card.append(details);
  }
  const hazard = element("aside", "overlay-callout hazard-callout");
  hazard.append(element("b", "", "别硬套"), element("span", "", guide.hazard));
  card.append(hazard);
  return card;
}

function renderSlots(overlay, part) {
  const grid = element("div", "slot-guide-grid");
  for (const guide of overlay.slotGuides.filter((item) => item.part === part)) grid.append(renderSlotGuide(guide));
  return grid;
}

function renderExpression(expression) {
  const card = element("article", "overlay-expression-card");
  card.append(element("span", "expression-category", expression.category), element("p", "expression-en", expression.en), element("p", "expression-zh", expression.zh));
  const details = element("details", "study-details");
  details.append(element("summary", "", "点击展开 · 适用范围与坑点"));
  const body = element("div", "expression-boundaries");
  body.append(element("p", "", `适用：${expression.useWhen}`), element("p", "risk", `避免：${expression.avoidWhen}`));
  details.append(body);
  card.append(details);
  return card;
}

function createPager(items, pageSize, renderItem, label) {
  const root = element("div", "overlay-pager");
  const cards = element("div", "overlay-expression-grid");
  const controls = element("div", "overlay-pager-controls");
  const previous = element("button", "", "上一组");
  const status = element("span");
  status.setAttribute("aria-live", "polite");
  const next = element("button", "", "下一组");
  previous.type = next.type = "button";
  let page = 0;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  function render() {
    cards.replaceChildren(...items.slice(page * pageSize, (page + 1) * pageSize).map(renderItem));
    status.textContent = `${label} · ${page + 1} / ${pageCount}`;
    previous.disabled = page === 0;
    next.disabled = page === pageCount - 1;
  }
  previous.addEventListener("click", () => { page = Math.max(0, page - 1); render(); });
  next.addEventListener("click", () => { page = Math.min(pageCount - 1, page + 1); render(); });
  controls.append(previous, status, next);
  root.append(cards, controls);
  render();
  return root;
}

function renderExpressions(overlay, part) {
  const wrapper = element("div", "expression-deck");
  const relevant = overlay.expressionDeck.filter((item) => item.parts.includes(part));
  const core = relevant.filter((item) => item.studyTier === "core");
  const supplement = relevant.filter((item) => item.studyTier === "supplement");
  wrapper.append(element("h3", "", "核心表达｜每次看四张"), createPager(core, 4, renderExpression, "核心表达"));
  if (supplement.length > 0) {
    const details = element("details", "supplement-expression-deck study-details");
    details.append(element("summary", "", `点击展开 · 补充表达 ${supplement.length} 组`));
    details.append(createPager(supplement, 4, renderExpression, "补充表达"));
    wrapper.append(details);
  }
  return wrapper;
}

function renderDrill(drill) {
  const card = element("article", "overlay-drill-card");
  card.append(element("p", "overlay-kicker", drill.focus), element("h3", "", drill.task));
  const answer = element("details", "study-details drill-answer");
  answer.append(element("summary", "", "完成后展开 · 参考答案"));
  const body = element("div");
  body.append(element("p", "", drill.modelAnswer));
  const warning = element("p", "drill-warning", `不要这样做：${drill.avoid}`);
  body.append(warning);
  answer.append(body);
  card.append(answer);
  return card;
}

function renderDrills(overlay, part) {
  const drills = overlay.drills.filter((item) => item.part === part);
  const items = drills.map((item) => ({ id: item.id, label: item.focus, content: renderDrill(item) }));
  return createTabDeck(items, { className: `drill-deck-${part.toLowerCase()}`, label: `${part} 部分自测练习` }).root;
}

function renderCoreOverlay(overlay, part, entryIndex, host, renderTemplateCard, onOpenEntry) {
  if (!host) return;
  const modes = [
    { id: "models", label: "核心母版", content: renderCoreModels(overlay, part, entryIndex, renderTemplateCard) },
    { id: "transfer", label: "跨题迁移", content: renderTransfers(overlay, part, entryIndex, onOpenEntry) },
    { id: "slots", label: "填槽训练", content: renderSlots(overlay, part) },
    { id: "expressions", label: "加分句", content: renderExpressions(overlay, part) },
    { id: "drills", label: "自测", content: renderDrills(overlay, part) },
  ];
  const intro = element("div", "core-overlay-intro");
  intro.append(
    element("strong", "", "一次只练一种动作"),
    element("span", "", "先背骨架，再看迁移；长答案和补充句默认收起。"),
  );
  const deck = createTabDeck(modes, { className: `core-mode-deck-${part.toLowerCase()}`, label: `${part} 部分核心学习模式` });
  host.replaceChildren(intro, deck.root);
}

function sourceDetails(chapter, sourceIndex) {
  const details = element("details", "lesson-sources");
  details.append(element("summary", "", "来源与内容边界"));
  const list = element("ul");
  for (const id of chapter.sourceRefIds) {
    const source = sourceIndex.get(id);
    if (!source) continue;
    const item = element("li");
    const label = source.url ? element("a", "", source.label) : element("strong", "", source.label);
    if (source.url) {
      label.href = source.url;
      label.target = "_blank";
      label.rel = "noopener noreferrer";
    }
    item.append(label, document.createTextNode(`：${source.notes}`));
    list.append(item);
  }
  details.append(list);
  return details;
}

function renderLiteracyChapter(chapter, sourceIndex, entryIndex, onOpenEntry) {
  const article = element("article", "literacy-lesson");
  article.dataset.overlayChapterId = chapter.id;
  const header = element("header", "literacy-lesson-head");
  const copy = element("div");
  copy.append(element("p", "overlay-kicker", `${chapter.sectionCode} · ${chapter.studyTier}`), element("h3", "", chapter.title));
  header.append(copy, element("span", "lesson-state", chapter.defaultExpanded ? "先学这一块" : "按需展开"));
  article.append(header);

  const split = splitAnswerSection(chapter.bodyMarkdown);
  const lessonBody = renderMarkdown(split.lesson);
  if (chapter.defaultExpanded) article.append(lessonBody);
  else {
    const details = element("details", "literacy-body-toggle study-details");
    details.append(element("summary", "", "点击展开 · 完整精讲"), lessonBody);
    article.append(details);
  }
  if (split.answer) {
    const answer = element("details", "literacy-answer study-details");
    answer.append(element("summary", "", "完成后展开 · 参考答案与解析"), renderMarkdown(split.answer));
    article.append(answer);
  }
  if (chapter.linksToModels.length > 0) {
    const links = element("div", "lesson-model-links");
    links.append(element("b", "", "回到对应母版"));
    for (const id of chapter.linksToModels) {
      const button = element("button", "", entryIndex.get(id)?.title ?? id);
      button.type = "button";
      button.disabled = !entryIndex.has(id);
      button.addEventListener("click", () => onOpenEntry(id));
      links.append(button);
    }
    article.append(links);
  }
  article.append(sourceDetails(chapter, sourceIndex));
  return article;
}

function renderLiteracyOverlay(overlay, part, entryIndex, onOpenEntry) {
  const sourceIndex = new Map(overlay.sourceReferences.map((source) => [source.id, source]));
  const chapters = overlay.chapters.filter((chapter) => chapter.part === part);
  const grouped = new Map();
  for (const chapter of chapters) {
    const targetId = chapter.targetSectionIds.find((id) => document.getElementById(id));
    if (!targetId) continue;
    if (!grouped.has(targetId)) grouped.set(targetId, []);
    grouped.get(targetId).push(chapter);
  }

  for (const [targetId, group] of grouped) {
    const target = document.getElementById(targetId);
    const course = element("section", "literacy-course");
    course.dataset.targetSection = targetId;
    const header = element("header", "literacy-course-head");
    header.append(
      element("p", "overlay-kicker", "V7.1 · ENGLISH PROMPT READING"),
      element("h3", "", "英文审题精讲"),
      element("p", "", "先判断任务，再调用母版；一次只显示一个专题。"),
    );
    const items = group.map((chapter) => ({
      id: chapter.id,
      label: `${chapter.sectionCode} ${chapter.title}`,
      content: renderLiteracyChapter(chapter, sourceIndex, entryIndex, onOpenEntry),
    }));
    const initial = group.find((chapter) => chapter.defaultExpanded)?.id ?? group[0].id;
    const deck = createTabDeck(items, {
      className: `literacy-deck-${targetId}`,
      label: `${targetId} 英文审题专题`,
      initialId: initial,
    });
    for (const chapter of group) lessonActivators.set(chapter.id, () => deck.activate(chapter.id));
    course.append(header, deck.root);
    target.append(course);
  }
}

export function activateWritingOverlayLesson(chapterId) {
  const activate = lessonActivators.get(chapterId);
  if (activate) {
    activate();
    return true;
  }
  return activateThemeBodyLesson(chapterId);
}

export function writingOverlaySearchItems(overlays, part) {
  const literacy = overlays.find((overlay) => overlay.format === PROMPT_LITERACY_FORMAT);
  const themeBody = overlays.find((overlay) => overlay.format === THEME_BODY_FORMAT);
  const result = [{
    part,
    anchor: `${part.toLowerCase()}-core`,
    title: "核心背诵与跨题迁移",
    summary: "核心母版、跨题迁移、填槽、加分句与自测",
    type: "V7 学习覆盖层",
    searchText: "核心背诵 跨题迁移 填槽 加分句 自测".toLocaleLowerCase("zh-CN"),
  }];
  for (const chapter of literacy?.chapters?.filter((item) => item.part === part) ?? []) {
    result.push({
      part,
      anchor: chapter.targetSectionIds[0],
      title: chapter.title,
      summary: chapter.bodyMarkdown.replace(/[#*`|>\[\]]/gu, " ").replace(/\s+/gu, " ").slice(0, 110),
      type: "英文审题课",
      overlayChapterId: chapter.id,
      searchText: `${chapter.title} ${chapter.bodyMarkdown}`.toLocaleLowerCase("zh-CN"),
    });
  }
  result.push(...themeBodySearchItems(themeBody, part));
  return result;
}

export function renderWritingOverlays({ overlays = [], part, entryIndex, renderTemplateCard, onOpenEntry }) {
  lessonActivators.clear();
  const core = overlays.find((overlay) => overlay.format === CORE_TRANSFER_FORMAT);
  const literacy = overlays.find((overlay) => overlay.format === PROMPT_LITERACY_FORMAT);
  const themeBody = overlays.find((overlay) => overlay.format === THEME_BODY_FORMAT);
  const host = document.querySelector('[data-writing-overlay="core-transfer"]');
  if (core) renderCoreOverlay(core, part, entryIndex, host, renderTemplateCard, onOpenEntry);
  else if (host) host.replaceChildren(element("p", "overlay-empty", "核心背诵覆盖层尚未进入当前教材版本。"));
  if (literacy) renderLiteracyOverlay(literacy, part, entryIndex, onOpenEntry);
  renderThemeBodyOverlay({ overlay: themeBody, part });
  return writingOverlaySearchItems(overlays, part);
}
