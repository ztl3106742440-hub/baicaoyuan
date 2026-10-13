import { configureLearningServiceWorker, configureLearningShell } from "./learning-shell.js";
import { loadLocalSet, loadStudyData, saveLocalSet, textNode } from "./study-data.js";

const COMPLETED_KEY = "baicaoyuan.reading.completed.v1";
const categoryLabels = { "reading-skill": "题型方法", "topic-reading": "主题阅读" };
const params = new URLSearchParams(location.search);
const state = { modules: [], category: params.get("category") ?? "all", currentId: params.get("id"), completed: loadLocalSet(COMPLETED_KEY) };
const elements = {
  status: document.querySelector("#vocabularyStatus"),
  filters: document.querySelector("#readingFilters"),
  select: document.querySelector("#moduleSelect"),
  stage: document.querySelector("#readingStage"),
  previous: document.querySelector("#previousModule"),
  next: document.querySelector("#nextModule"),
  bottomPrevious: document.querySelector("#bottomPreviousModule"),
  bottomNext: document.querySelector("#bottomNextModule"),
  position: document.querySelector("#modulePosition"),
};

function visibleModules() { return state.category === "all" ? state.modules : state.modules.filter((module) => module.category === state.category); }
function currentIndex() { const index = visibleModules().findIndex((module) => module.id === state.currentId); return index < 0 ? 0 : index; }

function updateUrl() {
  const query = new URLSearchParams();
  if (state.currentId) query.set("id", state.currentId);
  if (state.category !== "all") query.set("category", state.category);
  history.replaceState(null, "", `${location.pathname}?${query}`);
}

function section(title, className = "reading-block") {
  const block = textNode("section", className);
  block.append(textNode("h2", "reading-block-title", title));
  return block;
}

function renderQuestion(question, number) {
  const fieldset = textNode("fieldset", "reading-question");
  fieldset.dataset.questionId = question.id;
  const legend = textNode("legend", null, `${number}. ${question.stem}`);
  const options = textNode("div", "reading-options");
  question.options.forEach((option, index) => {
    const label = textNode("label", "reading-option");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = question.id;
    input.value = String(index);
    const copy = textNode("span", "reading-option-copy");
    copy.append(textNode("strong", null, `${String.fromCharCode(65 + index)}.`), textNode("span", null, option.text));
    const diagnosis = textNode("small", "option-diagnosis", option.diagnosis);
    diagnosis.hidden = true;
    label.append(input, copy, diagnosis);
    options.append(label);
  });
  const explanation = textNode("div", "question-explanation");
  explanation.hidden = true;
  explanation.append(textNode("strong", null, "证据与解析"), textNode("p", null, question.whyCorrect), textNode("p", "evidence-ids", `证据句：${question.evidenceSentenceIds.join("、")}`));
  fieldset.append(legend, options, explanation);
  return fieldset;
}

function submitModule(form, module) {
  const answers = module.questions.map((question) => form.querySelector(`input[name="${question.id}"]:checked`));
  const notice = form.querySelector(".answer-notice");
  if (answers.some((answer) => !answer)) {
    notice.textContent = "两道题都选完再提交。";
    notice.hidden = false;
    return;
  }
  notice.hidden = true;
  let correct = 0;
  module.questions.forEach((question, questionIndex) => {
    const fieldset = form.querySelector(`[data-question-id="${question.id}"]`);
    const selectedIndex = Number(answers[questionIndex].value);
    if (selectedIndex === question.correctIndex) correct += 1;
    [...fieldset.querySelectorAll(".reading-option")].forEach((label, index) => {
      label.classList.toggle("correct", index === question.correctIndex);
      label.classList.toggle("wrong", index === selectedIndex && index !== question.correctIndex);
      label.querySelector("input").disabled = true;
      label.querySelector(".option-diagnosis").hidden = false;
    });
    fieldset.querySelector(".question-explanation").hidden = false;
    for (const sentenceId of question.evidenceSentenceIds) form.closest(".reading-module").querySelector(`[data-sentence-id="${sentenceId}"]`)?.classList.add("is-evidence");
  });
  form.querySelector(".submit-reading").hidden = true;
  const result = form.querySelector(".reading-result");
  result.hidden = false;
  result.textContent = `本专题 ${correct} / ${module.questions.length}。绿色为正确选项，红色为本次误选。`;
  state.completed.add(module.id);
  saveLocalSet(COMPLETED_KEY, state.completed);
  updateProgress();
}

function renderModule(module) {
  const article = textNode("article", "reading-module");
  article.id = `module-${module.id}`;
  const header = textNode("header", "reading-module-header");
  const badges = textNode("div", "module-badges");
  badges.append(textNode("span", "material-pill", categoryLabels[module.category]), textNode("span", "material-pill priority-pill", `P${module.priority}`), textNode("span", "material-pill", module.examTask));
  header.append(badges, textNode("h1", null, module.title), textNode("p", "decision-rule", module.decisionRule));
  article.append(header);

  const method = section("做题顺序", "reading-block method-block");
  const steps = textNode("ol", "solve-steps");
  for (const step of module.solveSteps) steps.append(textNode("li", null, step));
  method.append(steps);

  const signals = section("词汇信号", "reading-block signals-block");
  const signalGrid = textNode("div", "signal-grid");
  for (const signal of module.lexicalSignals) {
    const item = textNode("article", "signal-card");
    item.append(textNode("h3", null, signal.term), textNode("strong", null, signal.zh), textNode("p", null, signal.readingRole), textNode("small", null, `警惕：${signal.danger}`));
    signalGrid.append(item);
  }
  signals.append(signalGrid);

  const passage = section("原创短阅读", "reading-block passage-block");
  passage.append(textNode("p", "original-label", "原创仿真材料 · 先读原文，再答题"));
  for (const sentence of module.passage.sentences) {
    const row = textNode("p", "passage-sentence");
    row.dataset.sentenceId = sentence.id;
    row.append(textNode("span", "sentence-number", sentence.id.toUpperCase()), textNode("span", "material-en", sentence.en));
    passage.append(row);
  }

  const practice = section("专题练习", "reading-block practice-block");
  const form = textNode("form", "reading-form");
  module.questions.forEach((question, index) => form.append(renderQuestion(question, index + 1)));
  const notice = textNode("p", "answer-notice");
  notice.hidden = true;
  const submit = textNode("button", "submit-reading", "提交本专题答案");
  submit.type = "submit";
  const result = textNode("p", "reading-result");
  result.hidden = true;
  form.append(notice, submit, result);
  form.addEventListener("submit", (event) => { event.preventDefault(); submitModule(form, module); });
  practice.append(form);

  const review = section("复盘提醒", "reading-block review-block");
  const mistakes = textNode("ul", "mistake-list");
  for (const mistake of module.topMistakes) mistakes.append(textNode("li", null, mistake));
  review.append(mistakes);
  if (module.relatedPart2NetworkIds.length > 0) {
    const links = textNode("div", "related-network-links");
    links.append(textNode("strong", null, "关联词汇网络："));
    for (const id of module.relatedPart2NetworkIds) {
      const link = textNode("a", null, id);
      link.href = `../networks/?id=${encodeURIComponent(id)}`;
      links.append(link);
    }
    review.append(links);
  }
  review.append(textNode("p", "editorial-note", "内容状态：draft · 部分来源核查；短文与选择题均为原创仿真材料。"));
  article.append(method, signals, passage, practice, review);
  return article;
}

function updateProgress() {
  document.querySelector("#sideModuleTotal").textContent = String(state.modules.length);
  document.querySelector("#sideCompletedTotal").textContent = String([...state.completed].filter((id) => state.modules.some((module) => module.id === id)).length);
}

function renderFilters() {
  const values = ["all", "reading-skill", "topic-reading"];
  elements.filters.replaceChildren(...values.map((value) => {
    const count = value === "all" ? state.modules.length : state.modules.filter((module) => module.category === value).length;
    const button = textNode("button", null, `${value === "all" ? "全部专题" : categoryLabels[value]} ${count}`);
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.category === value));
    button.addEventListener("click", () => {
      state.category = value;
      state.currentId = visibleModules()[0]?.id;
      updateUrl(); renderFilters(); renderNavigator(); render();
    });
    return button;
  }));
}

function renderNavigator() {
  const modules = visibleModules();
  if (!modules.some((module) => module.id === state.currentId)) state.currentId = modules[0]?.id;
  elements.select.replaceChildren(...modules.map((module) => {
    const option = textNode("option", null, `${state.completed.has(module.id) ? "✓ " : ""}${module.title}`);
    option.value = module.id;
    option.selected = module.id === state.currentId;
    return option;
  }));
  const index = currentIndex();
  elements.previous.disabled = index <= 0;
  elements.next.disabled = index >= modules.length - 1;
  elements.bottomPrevious.disabled = index <= 0;
  elements.bottomNext.disabled = index >= modules.length - 1;
  elements.position.textContent = modules.length ? `${index + 1} / ${modules.length}` : "0 / 0";
}

function render() {
  const module = visibleModules()[currentIndex()];
  elements.stage.replaceChildren(module ? renderModule(module) : textNode("p", "loading-state", "当前分类没有专题。"));
  renderNavigator();
}

function move(offset) {
  const modules = visibleModules();
  const target = modules[currentIndex() + offset];
  if (!target) return;
  state.currentId = target.id;
  updateUrl(); render(); scrollTo({ top: 0, behavior: "smooth" });
}

async function start() {
  configureLearningShell();
  elements.select.addEventListener("change", () => { state.currentId = elements.select.value; updateUrl(); render(); });
  elements.previous.addEventListener("click", () => move(-1));
  elements.next.addEventListener("click", () => move(1));
  elements.bottomPrevious.addEventListener("click", () => move(-1));
  elements.bottomNext.addEventListener("click", () => move(1));
  document.querySelector("#bottomModuleTop").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
  try {
    const { version, modules } = await loadStudyData();
    state.modules = modules;
    if (!["all", "reading-skill", "topic-reading"].includes(state.category)) state.category = "all";
    if (!state.currentId) state.currentId = visibleModules()[0]?.id;
    elements.status.textContent = `阅读专题 · ${modules.length} 组 · ${modules.reduce((count, module) => count + module.questions.length, 0)} 题 · v${version.contentVersion}`;
    renderFilters(); updateProgress(); render();
  } catch (error) {
    elements.status.textContent = "阅读专题加载失败";
    elements.stage.replaceChildren(textNode("p", "loading-state", error.message));
  }
  configureLearningServiceWorker();
}

start();
