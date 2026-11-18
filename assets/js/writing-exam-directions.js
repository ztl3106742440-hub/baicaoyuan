// English summaries are paraphrases. Paper links open the published question and its materials.
const papers = {
  2010: "https://kaoyan.eol.cn/fu_xi/yingyu/201209/t20120912_843027_5.shtml",
  2015: "https://static.zmxiaodao.com/downloads/2015-eng1.pdf?v=08f5d85156#page=14",
  2018: "https://static.kaoyan.cn/file/question/2024/12/02/01d52f5b8bafa0c6cdf7fa3347956c1a.pdf#page=18",
  2019: "https://download.s21i.faiusr.com/32800693/0/0/ABUIABA9GAAguPz3uAYoprW7eA.pdf?f=2019%E5%B9%B4%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%B8%80%E7%9C%9F%E9%A2%98.pdf&v=1730018872#page=14",
  2020: "https://static.zmxiaodao.com/downloads/2020-eng1.pdf?v=f7cdd06ab5#page=14",
  2021: "https://static.zmxiaodao.com/downloads/2021-eng1.pdf?v=188eadeb48#page=14",
  2022: "https://static.zmxiaodao.com/downloads/2022-eng1.pdf?v=febc00c535#page=14",
  2023: "https://static.zmxiaodao.com/downloads/2023-eng1.pdf?v=70b4b73a7e#page=14",
  2024: "https://ac-wiki.org/general-skills/study/assets/2024-201.pdf#page=14",
  2025: "https://static.zmxiaodao.com/downloads/2025-eng1.pdf?v=c573a2c3d7#page=14",
  2026: "https://static.zmxiaodao.com/downloads/2026-eng1.pdf?v=a1bed25304#page=14",
};

const partATasks = {
  2010: "Draft a notice on behalf of the Postgraduates’ Association seeking volunteers for an international conference about globalization. State what applicants need to qualify and add any other relevant information.",
  2018: "Email all the international experts at your university to invite them to the graduation ceremony. Include when and where it will take place and any other relevant details.",
  2021: "A friend from abroad has just finished college and plans to look for work in China. Send your friend an email with practical suggestions.",
  2023: "Write a notice seeking one student to assist Professor Smith with a research project about sports activities on campus. Explain the job duties and what applicants need to qualify.",
  2024: "Reply to Paul, an international student who has a class assignment to give an oral report about an ancient Chinese scientist. He asks for advice on preparing the report.",
  2026: "Reply to your friend Paul about the handwritten letters from Chinese families that you recently shared. He asks to learn more about the letters and wants to know if they are on public display.",
};

const partBMaterials = {
  2010: ["the drawing", "火锅里放着多种中外文化元素。"],
  2015: ["the drawing", "四名朋友围桌聚餐，各自看手机。"],
  2019: ["the drawing", "两人登山。一人累得想停下，另一人劝他休息片刻再继续。"],
  2020: ["both drawings", "一人埋头做功课，希望早点完成。另一人坐着不动，打算拖到最后才开始。"],
  2021: ["the drawing", "一名穿着戏曲服装的孩子说同学不喜欢戏曲，父亲鼓励他坚持自己的兴趣。"],
  2022: ["both pictures", "两名学生对一场非本专业的讲座持不同看法。一个认为没有用，另一个认为可能学到新东西。"],
  2023: ["the drawing", "年轻人参加龙舟赛，岸边有人观赛。画中有人感叹比赛越来越热闹。"],
  2024: ["both the drawing and the chart", "图中有人在公园运动。图表给出某市公园数量：2020 年 406 座、2021 年 532 座、2022 年 670 座。"],
  2025: ["the table", "每百户家电拥有量（空调／洗衣机／冰箱，单位：台）：2014 年 75.2／83.7／85.5；2017 年 96.1／91.7／95.3；2020 年 117.7／96.7／101.8；2023 年 145.9／98.2／103.4。"],
  2026: ["both charts", "接受程度：完全接受 39.3%、部分接受 32.8%、不接受 27.9%。首要关注点图列出安全 46.3%、价格 24.9%、便利 10.7%。"],
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

export function createExamDirections(year, part) {
  const task = part === "A" ? partATasks[year] : null;
  const material = part === "B" ? partBMaterials[year] : null;
  if (!task && !material) return null;

  const box = element("section", "exam-directions", "");
  box.dataset.examDirections = `${year}-${part}`;
  box.append(element("h5", "", `${year} 英语一 · 第 ${part === "A" ? "51" : "52"} 题 · 作答要求`));
  const english = element("p", "exam-directions-en", task
    ?? `Base your essay on ${material[0]}. Summarize what the material shows, explain what it conveys, and give your own comments.`);
  english.lang = "en";
  box.append(element("p", "exam-directions-label", "Directions · 英文题意整理"), english);
  const sheet = Number(year) === 2010 ? "答题纸 2" : "答题卡";
  const signature = Number(year) === 2010 ? "Postgraduates’ Association" : "Li Ming";
  box.append(element("p", "exam-directions-format", part === "A"
    ? `约 100 词 · 10 分 · 写在${sheet}上 · 署名 ${signature}`
    : `160–200 词 · 20 分 · 写在${sheet}上`));
  if (material) box.append(element("p", "exam-directions-material", material[1]));

  const link = element("a", "exam-paper-link", "查看原题及材料（新标签页）");
  link.href = papers[year];
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  box.append(link);
  return box;
}
