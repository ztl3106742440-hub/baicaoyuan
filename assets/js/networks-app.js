import { configureLearningServiceWorker, configureLearningShell } from "./learning-shell.js";
import { loadStudyData, textNode } from "./study-data.js";

const PAGE_SIZE = 10;
const params = new URLSearchParams(location.search);
const state = { networks: [], function: params.get("function") ?? "all", page: Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1), targetId: params.get("id") };
const elements = {
  list: document.querySelector("#networkList"),
  filters: document.querySelector("#networkFilters"),
  summary: document.querySelector("#networkSummary"),
  status: document.querySelector("#vocabularyStatus"),
  top: document.querySelector("#networkPaginationTop"),
  bottom: document.querySelector("#networkPaginationBottom"),
};

function pill(text, className = "material-pill") { return textNode("span", className, text); }

function section(title, className = "material-section") {
  const element = textNode("section", className);
  element.append(textNode("h3", "material-section-title", title));
  return element;
}

function renderTerms(network) {
  const block = section("词义边界与触发搭配", "material-section terms-section");
  const grid = textNode("div", "term-grid");
  for (const term of network.terms) {
    const card = textNode("article", "term-card");
    const heading = textNode("div", "term-heading");
    if (term.entryId) {
      const link = textNode("a", "term-form", term.form);
      link.href = `../?view=library&q=${encodeURIComponent(term.form)}#word-${encodeURIComponent(term.entryId)}`;
      link.title = "打开主词条";
      heading.append(link);
    } else {
      heading.append(textNode("strong", "term-form", term.form));
    }
    heading.append(pill(term.zh, "material-pill term-zh"));
    card.append(heading, textNode("p", "term-boundary", term.boundary));
    if (term.trigger) card.append(textNode("p", "term-trigger", `常见触发：${term.trigger}`));
    if (term.memoryCue) card.append(textNode("p", "term-memory", `记忆：${term.memoryCue}`));
    grid.append(card);
  }
  block.append(grid);
  return block;
}

function renderMiniTest(network) {
  const block = section("原创微测试", "material-section quiz-section");
  block.append(textNode("p", "quiz-label", "先选答案，再看解析；本题为原创仿真题。"));
  const form = textNode("form", "mini-quiz");
  form.append(textNode("p", "quiz-prompt", network.miniTest.prompt));
  const options = textNode("div", "quiz-options");
  network.miniTest.options.forEach((option, index) => {
    const label = textNode("label", "quiz-option");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `quiz-${network.id}`;
    input.value = String(index);
    label.append(input, textNode("span", null, `${String.fromCharCode(65 + index)}. ${option}`));
    options.append(label);
  });
  const feedback = textNode("div", "quiz-feedback");
  feedback.hidden = true;
  const submit = textNode("button", "quiz-submit", "提交答案");
  submit.type = "submit";
  form.append(options, submit, feedback);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = form.querySelector("input:checked");
    if (!selected) { feedback.hidden = false; feedback.className = "quiz-feedback needs-answer"; feedback.textContent = "先选一个答案。"; return; }
    const answer = Number(selected.value);
    for (const [index, label] of [...options.children].entries()) {
      label.classList.toggle("correct", index === network.miniTest.correctIndex);
      label.classList.toggle("wrong", index === answer && answer !== network.miniTest.correctIndex);
      label.querySelector("input").disabled = true;
    }
    feedback.hidden = false;
    feedback.className = `quiz-feedback ${answer === network.miniTest.correctIndex ? "is-correct" : "is-wrong"}`;
    feedback.textContent = `${answer === network.miniTest.correctIndex ? "答对了。" : `正确答案是 ${String.fromCharCode(65 + network.miniTest.correctIndex)}。`} ${network.miniTest.explanation}`;
    submit.hidden = true;
  });
  block.append(form);
  return block;
}

function renderNetwork(network, open = false) {
  const article = textNode("article", "network-card");
  article.id = `network-${network.id}`;
  const details = textNode("details", "network-details");
  details.open = open;
  const summary = textNode("summary", "network-card-summary");
  const title = textNode("div", "network-card-title");
  title.append(pill(network.function), textNode("h2", null, network.title));
  summary.append(title, textNode("p", "network-rule", network.focusRule), textNode("span", "expand-hint material-expand-hint", "展开学习"));
  const body = textNode("div", "network-body");
  body.append(renderTerms(network));

  const paraphrase = section("命题替换边界", "material-section paraphrase-section");
  const rows = textNode("div", "paraphrase-grid");
  rows.append(
    textNode("p", "paraphrase-source", `原表达：${network.paraphrase.source}`),
    textNode("p", "paraphrase-valid", `可替换：${network.paraphrase.validReplacement}`),
    textNode("p", "paraphrase-invalid", `不可替换：${network.paraphrase.invalidReplacement}`),
    textNode("p", "paraphrase-why", network.paraphrase.why),
  );
  paraphrase.append(rows);
  const example = section("原创阅读语境", "material-section example-section");
  example.append(textNode("p", "example-en material-en", network.example.en), textNode("p", "example-zh", network.example.zh));
  body.append(paraphrase, example, renderMiniTest(network));
  if (network.examEvidence.length > 0) {
    const evidence = section("真题关联记录", "material-section evidence-section");
    for (const item of network.examEvidence) evidence.append(textNode("p", "evidence-note", `${item.question ? `Q${item.question} · ` : ""}${item.term ?? ""} ${item.testedSense ?? ""}`.trim()));
    body.append(evidence);
  }
  body.append(textNode("p", "editorial-note", "内容状态：draft · 部分来源核查；微测试与例句为原创。"));
  details.append(summary, body);
  article.append(details);
  return article;
}

function filtered() {
  if (state.targetId) return state.networks.filter((network) => network.id === state.targetId);
  return state.function === "all" ? state.networks : state.networks.filter((network) => network.function === state.function);
}

function updateUrl() {
  const query = new URLSearchParams();
  if (state.targetId) query.set("id", state.targetId);
  else {
    if (state.function !== "all") query.set("function", state.function);
    if (state.page > 1) query.set("page", String(state.page));
  }
  history.replaceState(null, "", `${location.pathname}${query.size ? `?${query}` : ""}`);
}

function renderPagination(root, totalPages) {
  const previous = textNode("button", null, "← 上一页");
  previous.disabled = state.page <= 1;
  previous.addEventListener("click", () => { state.page -= 1; updateUrl(); render(); scrollTo({ top: 0, behavior: "smooth" }); });
  const label = textNode("span", null, `${state.page} / ${totalPages}`);
  const next = textNode("button", null, "下一页 →");
  next.disabled = state.page >= totalPages;
  next.addEventListener("click", () => { state.page += 1; updateUrl(); render(); scrollTo({ top: 0, behavior: "smooth" }); });
  root.replaceChildren(previous, label, next);
}

function renderFilters() {
  const functions = ["all", ...new Set(state.networks.map((network) => network.function))];
  elements.filters.replaceChildren(...functions.map((value) => {
    const count = value === "all" ? state.networks.length : state.networks.filter((network) => network.function === value).length;
    const button = textNode("button", null, `${value === "all" ? "全部" : value} ${count}`);
    button.type = "button";
    button.setAttribute("aria-pressed", String(!state.targetId && state.function === value));
    button.addEventListener("click", () => { state.targetId = null; state.function = value; state.page = 1; updateUrl(); renderFilters(); render(); });
    return button;
  }));
}

function render() {
  const items = filtered();
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const visible = state.targetId ? items : items.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  elements.summary.textContent = state.targetId ? `正在查看指定关系组 · ${visible.length} 组` : `${items.length} 组关系网络 · 每页 ${PAGE_SIZE} 组`;
  elements.list.replaceChildren(...visible.map((network) => renderNetwork(network, Boolean(state.targetId))));
  renderPagination(elements.top, totalPages);
  renderPagination(elements.bottom, totalPages);
  elements.top.hidden = Boolean(state.targetId);
  elements.bottom.hidden = Boolean(state.targetId);
}

async function start() {
  configureLearningShell();
  try {
    const { version, networks } = await loadStudyData();
    state.networks = networks;
    document.querySelector("#sideNetworkTotal").textContent = String(networks.length);
    document.querySelector("#sideTermTotal").textContent = String(networks.reduce((count, network) => count + network.terms.length, 0));
    elements.status.textContent = `关系网络 · ${networks.length} 组 · v${version.contentVersion}`;
    renderFilters();
    render();
  } catch (error) {
    elements.status.textContent = "关系网络加载失败";
    elements.list.replaceChildren(textNode("p", "loading-state", error.message));
  }
  configureLearningServiceWorker();
}

start();
