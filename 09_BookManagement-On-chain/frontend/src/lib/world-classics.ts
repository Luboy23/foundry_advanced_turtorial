// 教学演示用默认借阅规则：批量填充名著时写入 policy 摘要。
export const DEFAULT_CLASSIC_BORROW_POLICY = "默认借阅期30天；单读者同时在借不超过2本。";

// 批量种子条目：用于快速演示“20 本书一键上架”。
export type WorldClassicSeed = {
  title: string;
  author: string;
  isbn: string;
  category: string;
  summary: string;
  totalCopies: number;
};

// 世界名著种子库：仅用于教学/演示，不作为真实业务数据源。
export const WORLD_CLASSIC_SEEDS: WorldClassicSeed[] = [
  {
    title: "红与黑",
    author: "司汤达",
    isbn: "9787501000012",
    category: "文学",
    summary: "讲述青年于连在理想、野心与社会阶层之间的挣扎。",
    totalCopies: 6,
  },
  {
    title: "悲惨世界",
    author: "维克多·雨果",
    isbn: "9787501000029",
    category: "文学",
    summary: "以冉阿让的人生轨迹呈现法国社会的贫困、法律与救赎。",
    totalCopies: 8,
  },
  {
    title: "巴黎圣母院",
    author: "维克多·雨果",
    isbn: "9787501000036",
    category: "文学",
    summary: "围绕钟楼人卡西莫多与埃斯梅拉达展开的命运悲剧。",
    totalCopies: 6,
  },
  {
    title: "战争与和平",
    author: "列夫·托尔斯泰",
    isbn: "9787501000043",
    category: "文学",
    summary: "通过多个家族的兴衰描绘战争年代中的人性与历史。",
    totalCopies: 5,
  },
  {
    title: "安娜·卡列尼娜",
    author: "列夫·托尔斯泰",
    isbn: "9787501000050",
    category: "文学",
    summary: "聚焦安娜的婚姻与情感抉择，反映社会道德与个体冲突。",
    totalCopies: 6,
  },
  {
    title: "罪与罚",
    author: "陀思妥耶夫斯基",
    isbn: "9787501000067",
    category: "文学",
    summary: "刻画拉斯科尔尼科夫在犯罪后的心理煎熬与精神救赎。",
    totalCopies: 7,
  },
  {
    title: "白痴",
    author: "陀思妥耶夫斯基",
    isbn: "9787501000074",
    category: "文学",
    summary: "以梅诗金公爵的善良与脆弱折射复杂社会关系。",
    totalCopies: 5,
  },
  {
    title: "卡拉马佐夫兄弟",
    author: "陀思妥耶夫斯基",
    isbn: "9787501000081",
    category: "文学",
    summary: "通过家族冲突探讨信仰、伦理、责任与自由意志。",
    totalCopies: 6,
  },
  {
    title: "堂吉诃德",
    author: "塞万提斯",
    isbn: "9787501000098",
    category: "文学",
    summary: "以骑士幻想与现实碰撞讽刺社会并歌颂理想精神。",
    totalCopies: 7,
  },
  {
    title: "百年孤独",
    author: "加西亚·马尔克斯",
    isbn: "9787501000104",
    category: "文学",
    summary: "布恩迪亚家族七代人的循环命运与拉美历史隐喻。",
    totalCopies: 10,
  },
  {
    title: "霍乱时期的爱情",
    author: "加西亚·马尔克斯",
    isbn: "9787501000111",
    category: "文学",
    summary: "跨越半生的等待与爱情，展现时间对情感的塑造。",
    totalCopies: 6,
  },
  {
    title: "傲慢与偏见",
    author: "简·奥斯汀",
    isbn: "9787501000128",
    category: "文学",
    summary: "伊丽莎白与达西在误解与偏见中完成自我成长。",
    totalCopies: 9,
  },
  {
    title: "简·爱",
    author: "夏洛蒂·勃朗特",
    isbn: "9787501000135",
    category: "文学",
    summary: "简在独立人格与爱情之间坚持尊严和自我价值。",
    totalCopies: 8,
  },
  {
    title: "呼啸山庄",
    author: "艾米莉·勃朗特",
    isbn: "9787501000142",
    category: "文学",
    summary: "希斯克利夫与凯瑟琳的爱恨纠葛构成激烈悲剧叙事。",
    totalCopies: 6,
  },
  {
    title: "大卫·科波菲尔",
    author: "查尔斯·狄更斯",
    isbn: "9787501000159",
    category: "文学",
    summary: "主人公从困顿童年走向成熟，展现维多利亚时代众生相。",
    totalCopies: 5,
  },
  {
    title: "双城记",
    author: "查尔斯·狄更斯",
    isbn: "9787501000166",
    category: "文学",
    summary: "以伦敦与巴黎两城为背景书写革命、牺牲与人性光辉。",
    totalCopies: 7,
  },
  {
    title: "老人与海",
    author: "欧内斯特·海明威",
    isbn: "9787501000173",
    category: "文学",
    summary: "老渔夫与大海和命运搏斗，体现坚韧与尊严。",
    totalCopies: 12,
  },
  {
    title: "审判",
    author: "弗兰茨·卡夫卡",
    isbn: "9787501000180",
    category: "文学",
    summary: "约瑟夫·K在荒诞审判中经历迷惘与存在困境。",
    totalCopies: 6,
  },
  {
    title: "变形记",
    author: "弗兰茨·卡夫卡",
    isbn: "9787501000197",
    category: "文学",
    summary: "格里高尔变形后的家庭关系变迁揭示异化与孤独。",
    totalCopies: 11,
  },
  {
    title: "局外人",
    author: "阿尔贝·加缪",
    isbn: "9787501000203",
    category: "文学",
    summary: "默尔索的冷峻视角呈现荒诞世界与存在主义命题。",
    totalCopies: 9,
  },
];
