/**
 * gw-checkup.js —— 公文格式自查规则（零依赖 · Node / 浏览器 / 小程序通用）
 *
 * 源：miniprogram/src/utils/gw-checkup.js（小程序内同一份实现，改动请同步 handoff/开源/gw-checkup.js）
 *
 * 用法：
 *   Node:    const { check } = require('./gw-checkup.js');
 *   浏览器:  <script src="gw-checkup.js"></script> → window.GWCheckup.check(text)
 *   小程序:  const { check } = require('/utils/gw-checkup.js');
 *
 *   const result = check('关于……的通知\n各部门：\n……\n特此通知。');
 *   // → { score: 85, items: [{ level:'ok'|'warn', title, detail }, ...] }
 *
 * 设计原则：
 *   ① 零依赖、纯函数（不读写存储、不请求网络）——文本只在调用方处理
 *   ② 规则来自公文通用写法（标题结构 / 主送机关 / 文种结尾 / 句长 / 口语词）
 *   ③ 每条规则都给出"为什么"和"怎么改"，不只说对错
 */

var DOC_TYPES = ['通知', '报告', '请示', '批复', '意见', '方案', '总结', '纪要', '决定', '函', '公告', '通告'];

// 文种 → 期望结尾用语（任一命中即算匹配）
var ENDINGS = {
  '通知': ['特此通知', '请遵照执行', '请认真贯彻执行', '请结合实际贯彻落实'],
  '请示': ['妥否，请批示', '妥否请批示', '请予批复', '请批示'],
  '批复': ['此复', '特此批复'],
  '报告': ['特此报告', '请审阅'],
  '函': ['特此函达', '请予支持', '盼复'],
  '意见': ['请结合实际贯彻落实', '请认真贯彻执行']
};

// 口语 / 模糊词（正式公文不宜）
var ORAL_WORDS = ['差不多', '大概', '抓紧', '尽快', '搞定', '弄一下', '随便', '反正', '应该是'];

var MAX_SENTENCE = 80;   // 超过即提示拆分（公文平均句长 42 字）

/**
 * 检查一段公文文本
 * @param {string} raw 公文全文（首行为标题）
 * @returns {{score:number, items:Array<{level:string,title:string,detail:string}>}}
 */
function check(raw) {
  var text = String(raw == null ? '' : raw);
  var lines = text.split(/\n+/).map(trim).filter(notEmpty);
  var title = lines[0] || '';
  var items = [];

  // ① 标题结构：须「关于……的 + 文种」
  var hitType = null;
  for (var i = 0; i < DOC_TYPES.length; i++) {
    if (title.indexOf(DOC_TYPES[i]) >= 0) { hitType = DOC_TYPES[i]; break; }
  }
  var titleOk = /^关于.+的/.test(title) && !!hitType;
  items.push({
    level: titleOk ? 'ok' : 'warn',
    title: '标题结构',
    detail: titleOk
      ? '标题符合「关于……的' + hitType + '」结构（多数公文的标准写法）'
      : '标题建议写成「关于……的' + (hitType || '通知') + '」——把事由写清楚，文种放在结尾'
  });

  // ② 主送机关：标题下方，机构名 + 冒号
  var secondLine = lines[1] || '';
  var zhusongOk = /[^\s]{2,30}[：:]$/.test(secondLine);
  items.push({
    level: zhusongOk ? 'ok' : 'warn',
    title: '主送机关',
    detail: zhusongOk
      ? '主送机关已写明（' + secondLine.slice(0, 24) + '）'
      : '标题下方应有主送机关（接收单位），并以冒号结尾，例如「各部门：」'
  });

  // ③ 文种与结尾用语匹配
  var tail = text.slice(-60);
  var expect = hitType && ENDINGS[hitType];
  if (expect) {
    var endOk = false;
    for (var j = 0; j < expect.length; j++) {
      if (tail.indexOf(expect[j]) >= 0) { endOk = true; break; }
    }
    items.push({
      level: endOk ? 'ok' : 'warn',
      title: '结尾用语',
      detail: endOk
        ? '结尾用语与「' + hitType + '」匹配'
        : '「' + hitType + '」常见结尾是「' + expect[0] + '」，建议补上（称呼式结尾更规范）'
    });
  }

  // ④ 长句检测
  var sentences = text.split(/[。；;！!？?]/).map(trim).filter(notEmpty);
  var longList = sentences.filter(function (s) { return s.length > MAX_SENTENCE; });
  var longest = 0;
  for (var k = 0; k < longList.length; k++) {
    if (longList[k].length > longest) longest = longList[k].length;
  }
  items.push({
    level: longList.length ? 'warn' : 'ok',
    title: '句子长度',
    detail: longList.length
      ? '有 ' + longList.length + ' 句超过 ' + MAX_SENTENCE + ' 字（最长 ' + longest + ' 字），公文句子偏长，建议拆成两三句'
      : '句子长度正常（公文平均 42 字，未发现超长句）'
  });

  // ⑤ 口语 / 模糊词
  var oralHits = ORAL_WORDS.filter(function (w) { return text.indexOf(w) >= 0; });
  items.push({
    level: oralHits.length ? 'warn' : 'ok',
    title: '口语用词',
    detail: oralHits.length
      ? '出现口语/模糊词：' + oralHits.join('、') + '——正式公文建议改为「限期完成」「于 X 月 X 日前」等明确表述'
      : '未发现口语或模糊用词'
  });

  // 评分：满分 100，每条 warn 扣 15，下限 40
  var warnCount = items.filter(function (it) { return it.level !== 'ok'; }).length;
  var score = Math.max(40, 100 - warnCount * 15);

  return { score: score, items: items };
}

function trim(s) { return String(s == null ? '' : s).trim(); }
function notEmpty(s) { return s.length > 0; }

var api = { check: check, DOC_TYPES: DOC_TYPES, ENDINGS: ENDINGS, ORAL_WORDS: ORAL_WORDS, MAX_SENTENCE: MAX_SENTENCE };

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.GWCheckup = api;
