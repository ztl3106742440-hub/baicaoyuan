// English summaries are paraphrases. Paper links open the published question and its materials.
const papers = {
  2010: "https://kaoyan.eol.cn/fu_xi/yingyu/201209/t20120912_843027_5.shtml",
  2012: "https://static.zmxiaodao.com/downloads/2012-eng1.pdf?v=3268b3d72a#page=14",
  2013: "https://file.koolearn.com/20140711/14050465247144.pdf#:~:text=upcoming%20English%20speech%20contest",
  2014: "https://yuekao-miniapp.oss-cn-shanghai.aliyuncs.com/okaoyanHome/general-real/%E8%8B%B1%E8%AF%AD/2014%E8%8B%B1%E8%AF%AD%E4%B8%80%E8%80%83%E7%A0%94%E7%9C%9F%E9%A2%98%E5%8F%8A%E7%AD%94%E6%A1%88%E8%A7%A3%E6%9E%90.pdf#page=14",
  2015: "https://static.zmxiaodao.com/downloads/2015-eng1.pdf?v=08f5d85156#page=14",
  2016: "https://kaoyan.eol.cn/fu_xi/yingyu/201512/t20151226_1351914_7.shtml#:~:text=Section%20III",
  2017: "https://static.zmxiaodao.com/downloads/2017-eng1.pdf?v=df88322fa7#page=14",
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
  2013: "Email a foreign teacher at your college to invite them to judge the upcoming English speech contest.",
  2014: "Write a letter to your university president. Suggest ways to improve students’ physical condition and include any details you think are necessary.",
  2015: "You are organizing a club reading session. Email club members to recommend a book and explain your reasons for choosing it.",
  2016: "You are a librarian at your university. Write a notice giving newly enrolled international students information they need to use the library.",
  2017: "Email James Cook, an Australian professor who has just arrived, and recommend several places to visit in your city.",
  2018: "Email all the international experts at your university to invite them to the graduation ceremony. Include when and where it will take place and any other relevant details.",
  2021: "A friend from abroad has just finished college and plans to look for work in China. Send your friend an email with practical suggestions.",
  2022: "Email a professor at a British university. Invite the professor to organize a student team for an international innovation contest at your university.",
  2023: "Write a notice seeking one student to assist Professor Smith with a research project about sports activities on campus. Explain the job duties and what applicants need to qualify.",
  2024: "Reply to Paul, an international student who has a class assignment to give an oral report about an ancient Chinese scientist. He asks for advice on preparing the report.",
  2025: "Reply to your classmate Paul about the young craftspeople invited to demonstrate innovative crafts on campus. He wants to know what they will show and how he can help with preparations.",
  2026: "Reply to your friend Paul about the handwritten letters from Chinese families that you recently shared. He asks to learn more about the letters and wants to know if they are on public display.",
};

const partBMaterials = {
  2010: ["the drawing", "火锅里放着多种中外文化元素。"],
  2012: ["the drawing", "瓶子倒了，水洒出一部分。一个人关注失去的水，另一个人庆幸还有水。"],
  2014: ["the drawing", "前一幅情景中母亲牵着年幼的女儿，后一幅情景中长大后的女儿搀扶年老的母亲。"],
  2015: ["the drawing", "四名朋友围桌聚餐，各自看手机。"],
  2016: ["both drawings", "一图中父亲看电视却催孩子学习，另一图中父亲和孩子一起学习。"],
  2018: ["the drawing", "一名学生在选课。一类课提供新知识、比较有挑战，另一类容易通过且容易拿高分。"],
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

export function examDirectionsFor(year, part) {
  const task = part === "A" ? partATasks[year] : null;
  const material = part === "B" ? partBMaterials[year] : null;
  if (!task && !material) return null;
  return {
    en: task ?? `Base your essay on ${material[0]}. Summarize what the material shows, explain what it conveys, and give your own comments.`,
    material: material?.[1],
    url: papers[year],
  };
}

export function createExamDirections(year, part) {
  const directions = examDirectionsFor(year, part);
  if (!directions) return null;
  const box = element("section", "exam-directions", "");
  box.dataset.examDirections = `${year}-${part}`;
  box.append(element("h5", "", `${year} 英语一 · 第 ${part === "A" ? "51" : "52"} 题 · 作答要求`));
  const english = element("p", "exam-directions-en", directions.en);
  english.lang = "en";
  box.append(element("p", "exam-directions-label", "Directions · 英文题意整理"), english);
  const sheet = Number(year) <= 2012 ? "答题纸 2" : "答题卡";
  const signature = Number(year) === 2010 ? "Postgraduates’ Association" : "Li Ming";
  const noAddress = [2013, 2014].includes(Number(year)) ? " · 不写地址" : "";
  box.append(element("p", "exam-directions-format", part === "A"
    ? `约 100 词 · 10 分 · 写在${sheet}上 · 署名 ${signature}${noAddress}`
    : `160–200 词 · 20 分 · 写在${sheet}上`));
  if (directions.material) box.append(element("p", "exam-directions-material", directions.material));

  const link = element("a", "exam-paper-link", "查看原题及材料（新标签页）");
  link.href = directions.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  box.append(link);
  return box;
}
