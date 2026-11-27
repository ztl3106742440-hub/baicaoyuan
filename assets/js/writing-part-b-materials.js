import { createEssayPicker } from "./writing-essay-picker.js";

export const PART_B_MATERIALS_FORMAT = "baicaoyuan-writing-part-b-materials-overlay";

const starterGroups = ["benefits", "charts"];
const firstExample = {
  benefits: "wp-2023-dragon-boat-culture",
  charts: "wp-2025-household-appliances",
  action: "wp-2020-procrastination-contrast",
  tradeoffs: "wp-2015-dinner-phones",
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function english(text, className = "review-english") {
  const paragraph = element("p", className, text);
  paragraph.lang = "en";
  return paragraph;
}

function frameText(text) {
  const paragraph = english(null, "review-english materials-frame");
  for (const part of text.split(/(\[[^\]]+\])/gu)) {
    if (part.startsWith("[")) paragraph.append(element("span", "materials-frame-slot", part));
    else paragraph.append(part);
  }
  return paragraph;
}

function disclosure(label, className = "") {
  const details = element("details", `study-details materials-details ${className}`);
  details.append(element("summary", "", label));
  return details;
}

function pointCard(point, frame, index) {
  const card = element("article", "materials-point");
  const slots = element("ul", "materials-slots");
  for (const slot of point.slots) {
    const item = element("li", "", slot);
    item.lang = "en";
    slots.append(item);
  }
  card.append(element("h5", "", `论点${index === 0 ? "一" : "二"}`));
  card.append(frameText(frame[0]), element("p", "materials-note", frame[1]));
  card.append(
    element("p", "materials-plan", point.zh),
    slots,
    english(point.claim, "review-english materials-claim"),
    english(point.support),
  );
  return card;
}

function quoteCard(quote) {
  const article = element("article", "review-card");
  const source = element("a", "materials-link", quote.sourceName ?? "剑桥词典");
  source.href = quote.url;
  source.target = "_blank";
  source.rel = "noopener";
  article.append(english(quote.en), element("p", "", quote.zh), element("p", "materials-note", quote.use),
    english(quote.enUse), element("p", "materials-note", quote.limit), source);
  return article;
}

function renderCase(card, overlay, { inline = false } = {}) {
  const original = card.kind === "original";
  const group = overlay.groups.find((item) => item.id === card.group);
  const lesson = element("section", "materials-case");
  lesson.dataset.materialsCard = card.id;
  const heading = element("h4", "", inline ? "主体迁移示范" : card.title);
  lesson.append(heading);
  if (!inline) {
    lesson.append(
      element("p", "materials-kind", original ? "原创迁移题" : "英语一真题 · 主体迁移示范"),
      element("p", "materials-prompt", card.prompt),
    );
  }
  const points = element("div", "materials-points");
  const next = disclosure("论点二 · 换一个角度", "materials-point-two");
  next.append(pointCard(card.points[1], group.frames[1], 1));
  points.append(pointCard(card.points[0], group.frames[0], 0), next);
  lesson.append(points, element("p", "materials-transfer", card.boundary));

  const reading = disclosure("连读两点主体");
  reading.append(english(card.body));
  if (!inline && !original) {
    const link = element("a", "materials-link", "查看同题完整范文");
    link.href = `?entry=${encodeURIComponent(card.promptId)}#entry-${encodeURIComponent(card.promptId)}`;
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const back = new URL(location.href);
      back.searchParams.delete("entry");
      back.searchParams.set("lesson", `b-materials-${card.id}`);
      back.hash = "b-expressions";
      history.replaceState(history.state, "", back);
    });
    reading.append(link);
  }
  lesson.append(reading);
  if (original) {
    const essay = disclosure(`展开原创范文 · ${card.wordCount} 词`);
    essay.append(...card.originalEssay.map((paragraph) => english(paragraph)));
    lesson.append(essay);
  }
  if (card.proverbIds.length) {
    const quotes = disclosure("可选引语 · 看适用场景");
    for (const id of card.proverbIds) quotes.append(quoteCard(overlay.proverbs.find((item) => item.id === id)));
    lesson.append(quotes);
  }
  return lesson;
}

export function createPartBPromptMaterials(overlay, promptId) {
  const card = overlay?.cards.find((item) => item.promptId === promptId);
  if (!card) return null;
  const details = disclosure("看本题主体怎么展开", "materials-prompt-details");
  details.append(renderCase(card, overlay, { inline: true }));
  return details;
}

export function renderPartBMaterials(overlay, registerLesson) {
  const host = document.querySelector("[data-part-b-materials]");
  const reasonHost = document.querySelector("[data-part-b-reasons]");
  if (!overlay || !host || !reasonHost) return;
  host.hidden = false;
  reasonHost.hidden = false;

  const guide = disclosure("展开主体五句和举例方法");
  guide.append(...overlay.bodyGuide.map((text) => element("p", "materials-note", text)));
  const first = element("div", "materials-group-buttons");
  first.setAttribute("role", "group");
  first.setAttribute("aria-label", "优先背诵的主体框架");
  const advanced = disclosure("进阶框架 · 行动与取舍", "materials-advanced");
  const more = element("div", "materials-group-buttons");
  advanced.append(more);
  const picker = element("div", "materials-picker");
  const label = element("span", "", "选一道题练");
  const select = element("select", "theme-item-select");
  select.id = "materialsCaseSelect";
  const essayPicker = createEssayPicker(select, "选一道题练");
  const logic = element("p", "materials-group-logic");
  const stage = element("div", "materials-stage");
  picker.append(label, essayPicker.root);
  const buttons = new Map();
  const remembered = new Map();
  let currentGroup = null;

  function pick(card) {
    const group = overlay.groups.find((item) => item.id === card.group);
    if (currentGroup !== card.group) {
      currentGroup = card.group;
      const examples = overlay.cards.filter((item) => item.group === card.group);
      const types = [["past-paper", "英语一真题"], ["original", "原创迁移题"]];
      select.replaceChildren(...types.map(([kind, title]) => {
        const options = element("optgroup");
        options.label = title;
        options.append(...examples.filter((item) => item.kind === kind).map((item) => new Option(item.title, item.id)));
        return options;
      }));
      logic.textContent = group.logic;
      for (const [id, button] of buttons) button.setAttribute("aria-pressed", String(id === currentGroup));
    }
    if (!starterGroups.includes(currentGroup)) advanced.open = true;
    remembered.set(card.group, card.id);
    select.value = card.id;
    essayPicker.sync();
    const lesson = renderCase(card, overlay);
    stage.replaceChildren(lesson);
    return lesson;
  }

  for (const group of overlay.groups) {
    const button = element("button", "ghost-button", group.title);
    button.type = "button";
    button.addEventListener("click", () => {
      const id = remembered.get(group.id) ?? firstExample[group.id];
      if (id !== select.value) pick(overlay.cards.find((item) => item.id === id));
    });
    (starterGroups.includes(group.id) ? first : more).append(button);
    buttons.set(group.id, button);
  }
  select.addEventListener("change", () => pick(overlay.cards.find((card) => card.id === select.value)));
  for (const card of overlay.cards) registerLesson(`b-materials-${card.id}`, () => pick(card));

  const extras = disclosure("按需加一句 · 结果、例证、评论和双图判断");
  const extraGrid = element("div", "review-grid");
  for (const item of overlay.extraFrames) {
    const article = element("article", "review-card");
    article.append(element("h4", "", item.title), frameText(item.frame),
      element("p", "materials-note", item.zh), english(item.en));
    extraGrid.append(article);
  }
  extras.append(extraGrid);
  host.replaceChildren(
    element("h3", "", "先背两套主体框架"),
    element("p", "materials-plan", "接题 → 论点一＋支撑 → 论点二＋支撑"),
    first, advanced, logic, picker, stage, guide, extras,
  );
  pick(overlay.cards.find((card) => card.id === firstExample.benefits));

  const archive = disclosure("更多句式 · 常用备用句和细分功能句", "materials-archive");
  for (const section of host.parentElement.querySelectorAll(":scope > .review-module, :scope > .theme-expression-course, :scope > .supplement-library")) {
    archive.append(section);
  }
  host.after(archive);

  const reasons = disclosure("六组理由速查");
  const reasonGrid = element("div", "review-grid");
  for (const reason of overlay.reasonIndex) {
    const item = element("article", "review-card");
    item.append(element("h4", "", reason.title), element("p", "", reason.logic),
      english(reason.english), element("p", "materials-note", reason.examples));
    reasonGrid.append(item);
  }
  reasons.append(reasonGrid);
  reasonHost.replaceChildren(reasons);
  registerLesson("b-materials-reasons", () => {
    reasons.open = true;
    return reasonHost;
  });
}

export function partBMaterialsSearchItems(overlay) {
  if (!overlay) return [];
  const results = overlay.cards.map((card) => ({
    part: "B", anchor: "b-expressions", overlayChapterId: `b-materials-${card.id}`,
    title: card.title, summary: card.points.map((point) => point.zh).join(" "),
    type: card.kind === "original" ? "原创迁移题" : "主体迁移示范",
    searchText: JSON.stringify([card, overlay.proverbs.filter((quote) => card.proverbIds.includes(quote.id))]).toLocaleLowerCase("zh-CN"),
  }));
  results.push({
    part: "B", anchor: "b-topics", overlayChapterId: "b-materials-reasons",
    title: "六组理由速查", summary: overlay.reasonIndex.map((item) => item.title).join(" · "),
    type: "主题素材", searchText: JSON.stringify(overlay.reasonIndex).toLocaleLowerCase("zh-CN"),
  });
  return results;
}
