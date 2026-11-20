export const REVIEW_FORMAT = "baicaoyuan-writing-review-overlay";

const lessonTargets = new Map();

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function english(parts, className = "review-english") {
  const paragraph = element("p", null, className);
  paragraph.lang = "en";
  for (const { text, fixed } of parts) {
    paragraph.append(fixed ? element("strong", text) : document.createTextNode(text));
  }
  return paragraph;
}

function textWithHighlights(paragraph, block, from = 0, to = paragraph.en.length) {
  const parts = [];
  let cursor = from;
  for (const [start, length] of block.highlights) {
    const first = Math.max(from, start);
    const last = Math.min(to, start + length);
    if (first >= last) continue;
    parts.push({ text: paragraph.en.slice(cursor, first) });
    parts.push({ text: paragraph.en.slice(first, last), fixed: true });
    cursor = last;
  }
  parts.push({ text: paragraph.en.slice(cursor, to) });
  return english(parts, `review-english review-${block.role}`);
}

function disclosure(label) {
  const details = element("details", null, "study-details review-details");
  details.append(element("summary", label));
  return details;
}

function register(id, node) {
  node.dataset.reviewLesson = id;
  lessonTargets.set(id, node);
  return node;
}

export function reviewLessonTarget(id) {
  return lessonTargets.get(id) ?? null;
}

export function createReviewedEssay(entry, metadata) {
  const { modelResponse } = entry;
  const section = element("section", null, "review-essay");
  section.dataset.reviewEssay = entry.id;
  const heading = element("header", null, "review-essay-head");
  heading.append(element("h4", modelResponse.label), element("span", `正文 ${modelResponse.wordCount} 词`));
  section.append(heading);
  for (const paragraph of modelResponse.paragraphs) {
    const block = metadata.blocks[paragraph.id];
    const node = textWithHighlights(paragraph, block);
    node.dataset.paragraphId = paragraph.id;
    section.append(node);
  }
  const notes = disclosure("段落讲解");
  const list = element("ol", null, "review-note-list");
  for (const paragraph of modelResponse.paragraphs) {
    if (metadata.blocks[paragraph.id].role === "body") list.append(element("li", paragraph.zh));
  }
  notes.append(list);
  section.append(notes);
  return section;
}

function phraseCard(phrase) {
  const article = element("article", null, "review-card");
  article.append(element("h4", phrase.title));
  const [example, ...remaining] = phrase.examples;
  article.append(english(example.parts), element("p", example.note, "review-note"));
  const guide = disclosure(remaining.length ? "句架与换题例句" : "句架与用法");
  guide.append(english(phrase.frame, "review-english review-frame"), element("p", phrase.usage, "review-note"));
  for (const alternative of remaining) {
    guide.append(english(alternative.parts), element("p", alternative.note, "review-note"));
  }
  article.append(guide);
  return article;
}

function comparison(rows) {
  const [headers, ...values] = rows;
  const list = element("div", null, "review-comparison");
  for (const [name, ...cells] of values) {
    const item = element("section", null, "review-card");
    item.append(element("h4", name));
    const row = element("dl");
    for (const [index, text] of cells.entries()) {
      const pair = element("div");
      const value = element("dd", text);
      if (/^[a-zA-Z]/u.test(text)) value.lang = "en";
      pair.append(element("dt", headers[index + 1]), value);
      row.append(pair);
    }
    item.append(row);
    list.append(item);
  }
  return list;
}

const invitationRows = [
  ["位置", "2018 毕业典礼", "2013 演讲赛", "2022 创新赛"],
  ["邀请对方做什么", "attend our graduation ceremony", "serve as a judge at our English speech contest", "organise a student team for the International Innovation Contest"],
  ["主体要补什么", "出席典礼、流程及会后招待会。", "比赛安排、评委要评什么。", "原型展示、队伍需要准备什么。"],
  ["结尾确认什么", "是否出席。", "能不能担任评委。", "是否能组织队伍。"],
];

export function renderReviewCore(host, review, part, entries) {
  lessonTargets.clear();
  const data = review.parts[part];
  const fragment = document.createDocumentFragment();
  const phrases = element("section", null, "review-module");
  phrases.append(element("h3", "万能加分句"));
  const phraseGrid = element("div", null, "review-grid");
  for (const [index, phrase] of data.phrases.entries()) {
    phraseGrid.append(register(`review-phrase-${part}-${index + 1}`, phraseCard(phrase)));
  }
  phrases.append(phraseGrid);
  const combined = disclosure(part === "A" ? "组装示例 · 科技展邀请" : "组装示例 · 龙舟分工");
  combined.append(english(data.combination));
  phrases.append(combined);
  fragment.append(phrases);

  const primary = element("section", null, "review-module");
  primary.append(element("h3", "整篇主背"));
  for (const [index, id] of data.primaryIds.entries()) {
    const entry = entries.get(id);
    const meta = review.essayMeta[id];
    const card = register(`review-primary-${id}`, element("article", null, "review-card review-primary"));
    card.append(element("h4", entry.title), createReviewedEssay(entry, meta));
    const guide = disclosure("同一句怎么换");
    guide.append(element("p", meta.transfer, "review-note"));
    guide.append(comparison(part === "A" && index === 1 ? invitationRows : data.comparison));
    card.append(guide);
    primary.append(card);
  }
  fragment.append(primary);

  const last = element("section", null, "review-module");
  last.append(element("h3", part === "A" ? "题型短块" : "图表句架与题型短块"));
  for (const chart of data.charts) {
    const card = disclosure(chart.title);
    card.append(english(chart.frame, "review-english review-frame"), element("p", chart.usage, "review-note"));
    last.append(card);
  }
  for (const excerpt of data.shorts) {
    const entry = entries.get(excerpt.promptId);
    const meta = review.essayMeta[entry.id];
    const card = disclosure(`${entry.year} · ${excerpt.title}`);
    for (const { paragraphId, start, end } of excerpt.ranges) {
      const paragraph = entry.modelResponse.paragraphs.find(({ id }) => id === paragraphId);
      card.append(textWithHighlights(paragraph, meta.blocks[paragraphId], start, end));
    }
    card.append(element("p", meta.transfer, "review-note"));
    last.append(card);
  }
  fragment.append(last);
  host.replaceChildren(fragment);
}

export function renderReviewAppendix(review, part) {
  const data = review.parts[part];
  const prefix = part.toLowerCase();
  const expressions = document.getElementById(`${prefix}-expressions`);
  const phrases = element("section", null, "review-module");
  phrases.append(element("h3", "常用备用句"));
  const grid = element("div", null, "review-grid");
  for (const phrase of data.extras) grid.append(phraseCard(phrase));
  phrases.append(grid);
  expressions.querySelector(".theme-expression-course, .supplement-library")?.before(phrases);

  const topic = document.getElementById(`${prefix}-topics`);
  const examples = disclosure("常用主题语料");
  const materials = element("div", null, "review-grid");
  for (const item of data.materials) {
    const article = element("article", null, "review-card");
    article.append(element("h4", item.title));
    for (const text of item.text) {
      article.append(/^[a-zA-Z]/u.test(text) ? english([{ text }]) : element("p", text, "review-note"));
    }
    materials.append(article);
  }
  examples.append(materials);
  topic.querySelector(".theme-body-course, .supplement-library")?.before(examples);
}

export function reviewSearchItems(review, part) {
  const data = review.parts[part];
  const anchor = `${part.toLowerCase()}-core`;
  const phrases = data.phrases.map((phrase, index) => ({
    part, anchor, title: phrase.title, type: "万能加分句",
    summary: phrase.usage,
    overlayChapterId: `review-phrase-${part}-${index + 1}`,
    searchText: JSON.stringify(phrase).toLocaleLowerCase("zh-CN"),
  }));
  const primary = data.primaryIds.map((id) => {
    const summary = review.essayMeta[id].transfer;
    const year = id.split("-")[1];
    return { part, anchor, title: `${year} 整篇主背与跨题对照`, type: "整篇主背", summary,
      overlayChapterId: `review-primary-${id}`, searchText: `${year} 整篇主背 跨题对照 ${summary}`.toLocaleLowerCase("zh-CN") };
  });
  return [...phrases, ...primary];
}
