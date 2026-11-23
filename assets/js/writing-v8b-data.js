export const V8B_FORMAT = "baicaoyuan-writing-v8b-high-retention-application-course";

export const v8bFunctions = {
  A: "邀请与活动价值",
  B: "建议与准备步骤",
  C: "招募与职责",
  D: "逐问回复",
  "C-event": "活动通知",
  "A-recommend": "推荐与价值说明",
};
const segmentTypes = new Set(["fixed", "prepared", "task"]);
const hasItems = (value, size) => Array.isArray(value) && value.length === size;
const isText = (value) => typeof value === "string" && Boolean(value.trim());
const textList = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);
const slotLabels = {
  goal: "目标", step1: "第一步", focus: "关注点", step2: "第二步", outcome: "预期结果",
  purpose: "目的", programme: "活动安排", benefit: "具体收益", reason: "理由", project: "项目", role: "角色",
  tasks: "任务", requirement: "所需能力", q1: "第一问", a1: "第一答", q2: "第二问", a2: "第二答",
  offer: "可提供的帮助", experience: "经验", object: "推荐对象", feature: "特色", value: "价值", action: "行动", help: "具体帮助",
  eventGoal: "活动目的", eventContent: "活动安排", realBenefit: "参加收益", whyWorth: "价值理由", invitedRole: "受邀者职责",
  response: "回复内容", adviceStep1: "第一步建议", adviceFocus: "建议关注点", adviceStep2: "第二步建议", logistics: "现场安排",
  projectGoal: "项目目标", responsibilities: "岗位职责", requirements: "任职能力", application: "报名方式",
  expertRole: "专家职责", evaluation: "评价内容", objectFeature: "对象特点", deepValue: "实际价值",
  bookClub: "读书会用途", placeValue: "游览价值", filmValue: "电影价值", personalFit: "与对方的契合点",
};

export function getV8BCourse(overlays) {
  const course = overlays.find((item) => item?.format === V8B_FORMAT);
  if (course?.schemaVersion !== 1 || course.publicationStatus !== "review-candidate" ||
      !hasItems(course.cases, 22) || !hasItems(course.coreModules, 4) || !hasItems(course.themeBundles, 6) ||
      !hasItems(course.primaryIds, 2) || !hasItems(course.specialistIds, 2) || !hasItems(course.proofPairs, 6)) return null;
  try {
    const ids = new Set(course.cases.map((item) => item.id));
    if (ids.size !== 22 || ![...course.primaryIds, ...course.specialistIds].every((id) => ids.has(id)) ||
        !course.proofPairs.every((pair) => hasItems(pair, 2) && pair.every((id) => ids.has(id))) ||
        !textList(course.studyPrinciples) || course.studyPrinciples.length < 4) return null;
    const modules = course.coreModules;
    if (modules.map((item) => item.id).join("") !== "ABCD" || !modules.every((item) =>
      isText(item.name) && isText(item.priority) && textList(item.notes) && textList(item.examples) &&
      item.examples.every((id) => ids.has(id)) && Array.isArray(item.core) && item.core.length > 0 &&
      item.core.every((row) => hasItems(row, 2) && textList(row)))) return null;
    if (!course.themeBundles.every((item) => isText(item.id) && isText(item.name) && textList(item.use) &&
      Object.values(item.slots).length === 6 && Object.values(item.slots).every((row) => hasItems(row, 2) && textList(row)) &&
      hasItems(item.readySentences, 2) && textList(item.readySentences))) return null;
    if (!course.cases.every((item) => v8bFunctions[item.module] && ["past-paper", "original"].includes(item.kind) &&
      [item.id, item.title, item.taskZh, item.greeting, item.signoff, item.lessonZh, item.logicZh, item.sourceIntegrity].every(isText) &&
      item.source && typeof item.riskZh === "string" && Number.isInteger(item.wordCount) &&
      hasItems(item.paragraphsZh, 3) && textList(item.paragraphsZh) &&
      hasItems(item.paragraphs, 3) && item.paragraphs.every((paragraph) => Array.isArray(paragraph) && paragraph.length > 0 &&
        paragraph.every(({ type, text }) => segmentTypes.has(type) && isText(text))) &&
      Object.values(item.slots).length > 0 && textList(Object.values(item.slots)))) return null;
  } catch {
    return null;
  }
  return course;
}

// The shared Part A reader consumes labelled phrases. Keep the original overlay and its essay segments intact.
export function v8bView(course) {
  const labelled = (key) => slotLabels[key] ?? key;
  return {
    format: course.format,
    studyPlan: { primaryComplete: course.primaryIds, specialistModules: course.specialistIds, proofPairs: course.proofPairs },
    blueprint: {
      common: {
        opening: "交代身份或来信背景＋写作目的",
        body: "完成题干任务＋给出具体信息或理由",
        ending: "说明下一步＋礼貌收束",
      },
      principles: course.studyPrinciples.slice(0, 4),
      modules: course.coreModules.map((item) => ({
        id: item.id, title: item.name, lines: item.core, constraints: item.notes,
        zh: item.priority, related: item.examples,
      })),
    },
    scenes: course.themeBundles.map((item) => ({
      id: item.id, name: item.name, rank: item.rank, reason: item.use.join("、"), examples: item.readySentences,
      slots: Object.entries(item.slots).map(([key, [en, zh]]) => [labelled(key), en, zh]),
    })),
    cases: course.cases.map((item) => ({
      ...item,
      disclaimer: item.sourceIntegrity,
      slots: Object.entries(item.slots).map(([key, en]) => ({ role: labelled(key), en })),
    })),
  };
}
