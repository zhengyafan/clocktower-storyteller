/* 染·钟楼谜团 — 智能问答 / 局面分析 v2
 * 纯前端：离线规则引擎（官方魔典数据 + 百科全文 + 能力引擎推理），可选接入大模型做深度分析。
 * 回答结构：结论 → 分析过程 → 官方依据 → 说书人提示 → 追问。
 */
(function () {
  'use strict';
  var D = window.BOTC_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = function () { return $('#view'); };

  var TEAMCN = { townsfolk: '镇民', outsider: '外来者', minion: '爪牙', demon: '恶魔', traveler: '旅行者', fabled: '传奇角色' };
  var ALL = D.roles.concat(D.fabled);
  var byId = {}; ALL.forEach(function (r) { byId[r.id] = r; });
  var byName = {}; ALL.forEach(function (r) { byName[r.name] = r; });

  /* 阵营泛称（不指向具体角色） */
  var TEAMWORD = { 镇民: 'townsfolk', 外来者: 'outsider', 爪牙: 'minion', 恶魔: 'demon', 旅行者: 'traveler', 邪恶: 'evil', 善良: 'good', 好人: 'good', 坏人: 'evil' };

  /* 常见简称 / 别称 → 正式名 */
  var ALIAS = {
    '共情': '共情者', '占卜': '占卜师', '调查': '调查员', '洗衣': '洗衣妇', '图书': '图书管理员', '管理员': '图书管理员',
    '送葬': '送葬者', '守鸦': '守鸦人', '投毒': '投毒者', '毒师': '投毒者', '小恶魔': '小恶魔', '红唇': '红唇女郎',
    '圣女': '贞洁者', '贞洁': '贞洁者', '市长': '镇长', '圣徒': '圣徒', '教父': '教父', '刺客': '刺客', '普卡': '普卡',
    '沙巴': '沙巴洛斯', '僵怖': '僵怖', '钟表': '钟表匠', '筑梦': '筑梦师', '舞蛇': '舞蛇人', '数学': '数学家',
    '卖花': '卖花女孩', '公告': '城镇公告员', '公告员': '城镇公告员', '神谕': '神谕者', '裁缝': '女裁缝', '贤者': '贤者',
    '洗脑': '洗脑师', '镜像': '镜像双子', '方古': '方古', '涡流': '涡流', '麻脸': '麻脸巫婆', '哲学家': '哲学家',
    '官员': '官员', '窃贼': '窃贼', '枪手': '枪手', '小怪宝': '小怪宝', '军团': '军团', '利维坦': '利维坦',
    '驱魔': '驱魔人', '旅店': '旅店老板', '赌徒': '赌徒', '侍臣': '侍臣', '教授': '教授', '疯子': '疯子',
    '祖母': '祖母', '水手': '水手', '侍女': '侍女', '陌客': '陌客', '士兵': '士兵', '酒鬼': '酒鬼', '男爵': '男爵',
    '女巫': '女巫', '隐士': '陌客', '猎手': '猎手', '管家': '管家', '僧侣': '僧侣', '洗衣妇': '洗衣妇'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* 下拉选项缓存：座位表每次重渲染都要几百个 option，缓存字符串避免重复拼接 */
  var OPTCACHE = {};
  function optsAll(cur, excludeFabled) {
    var k = (excludeFabled ? 'p' : 'a');
    if (!OPTCACHE[k]) {
      OPTCACHE[k] = ALL.filter(function (x) { return excludeFabled ? (x.team !== 'fabled' && x.team !== 'traveler') : true; })
        .map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('');
    }
    var h = '<option value="">—</option>' + OPTCACHE[k];
    if (cur) h = h.replace('value="' + cur + '"', 'value="' + cur + '" selected');
    return h;
  }

  function uniq(a) { var o = {}, r = []; a.forEach(function (x) { if (x && !o[x]) { o[x] = 1; r.push(x); } }); return r; }
  function strip(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function cut(s, n) { s = strip(s); return s.length > n ? s.slice(0, n) + '…' : s; }

  /* ================= 百科全文（wiki.js 懒加载） ================= */
  var WIKISTATE = (window.BOTC_WIKI || (window.BOTCWiki && window.BOTCWiki.state === 2)) ? 2 : 0; /* 0 未加载 1 加载中 2 就绪 3 失败 */
  function ensureWiki(cb) {
    if (WIKISTATE === 2) { cb && cb(); return true; }
    if (window.BOTCWiki && window.BOTCWiki.load) { WIKISTATE = 1; window.BOTCWiki.load(function () { WIKISTATE = 2; cb && cb(); }); return false; }
    if (WIKISTATE === 1) return false;
    WIKISTATE = 1;
    var s = document.createElement('script');
    s.src = 'wiki.js';
    s.onload = function () {
      var w = window.BOTC_WIKI || {}, R = w.r || {}, F = w.f || {}, E = w.e || {}, U = w.u || {};
      D.roles.forEach(function (r) { if (R[r.id]) r.wiki = R[r.id]; });
      D.fabled.forEach(function (r) { if (F[r.id]) r.wiki = F[r.id]; });
      D.editions.forEach(function (e) { if (E[e.id]) e.wiki = E[e.id]; });
      D.rules.forEach(function (r) { if (U[r.id]) { r.html = U[r.id].html; r.sections = U[r.id].sections; } });
      WIKISTATE = 2; cb && cb();
    };
    s.onerror = function () { WIKISTATE = 3; cb && cb(); };
    document.head.appendChild(s);
    return false;
  }
  /* 在角色百科里找相关章节 */
  function wikiHits(r, kw, limit) {
    var w = r && r.wiki; if (!w) return [];
    var secs = w.sections || [];
    var keys = String(kw || '').split(/[\s，,。？?]+/).filter(function (x) { return x.length >= 2; });
    var out = [];
    secs.forEach(function (s) {
      var t = strip(s.html), sc = 0;
      keys.forEach(function (k) { if ((s.title + t).indexOf(k) >= 0) sc += (s.title.indexOf(k) >= 0 ? 5 : 1); });
      if (!keys.length) sc = 1;
      if (sc) out.push({ title: s.title, text: t, s: sc });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, limit || 2);
  }
  function wikiSection(r, re) {
    var w = r && r.wiki; if (!w || !w.sections) return null;
    return w.sections.filter(function (s) { return re.test(s.title); })[0] || null;
  }

  /* ================= 实体抽取 ================= */
  function findRoles(q) {
    var hits = [];
    var names = ALL.map(function (r) { return r.name; })
      .concat(Object.keys(ALIAS))
      .sort(function (a, b) { return b.length - a.length; });
    var used = [];
    names.forEach(function (n) {
      var p = 0;
      while ((p = q.indexOf(n, p)) >= 0) {
        var cover = used.some(function (u) { return p >= u[0] && p < u[1]; });
        var r = byName[n] || byName[ALIAS[n]];
        if (r && !cover) { hits.push({ r: r, pos: p, len: n.length, alias: n }); used.push([p, p + n.length]); }
        p += n.length;
      }
    });
    ALL.forEach(function (r) {
      if (!r.en) return;
      var en = r.en.toLowerCase();
      if (en.length < 4) return;
      var p = q.toLowerCase().indexOf(en);
      if (p >= 0 && !hits.some(function (h) { return h.r.id === r.id; })) hits.push({ r: r, pos: p, len: en.length, alias: r.en });
    });
    hits.sort(function (a, b) { return a.pos - b.pos; });
    var seen = {}, out = [];
    hits.forEach(function (h) { if (!seen[h.r.id]) { seen[h.r.id] = 1; out.push(h); } });
    return out;
  }
  function ents(q) {
    var e = { roles: findRoles(q), nums: [], n: 0, phase: null, teams: [], has: function (re) { return re.test(q); } };
    var m = q.match(/\d+/g);
    if (m) e.nums = m.map(Number);
    var mn = /(\d+)\s*[人位]/.exec(q);
    if (mn) e.n = +mn[1];
    if (/首夜|第一夜|第一晚|第一个晚上|首晚/.test(q)) e.phase = 'first';
    else if (/其他夜|其他晚|后续夜|第[二三四五]夜|每夜|每晚/.test(q)) e.phase = 'other';
    Object.keys(TEAMWORD).forEach(function (k) { if (q.indexOf(k) >= 0) e.teams.push(TEAMWORD[k]); });
    return e;
  }

  /* ================= 检索工具 ================= */
  function jinxOf(a, b) {
    return D.jinxes.filter(function (j) { return (j.a === a && j.b === b) || (j.a === b && j.b === a); })[0] || null;
  }
  function jinxListOf(name) { return D.jinxes.filter(function (j) { return j.a === name || j.b === name; }); }
  function nightPos(r) {
    var f = null, o = null;
    (D.nightOrder.first || []).forEach(function (x, i) { if (x.id === r.id) f = i + 1; });
    (D.nightOrder.other || []).forEach(function (x, i) { if (x.id === r.id) o = i + 1; });
    return { f: f, o: o };
  }
  function compOf(n) { return D.composition[Math.min(Math.max(n - 5, 0), D.composition.length - 1)]; }
  function execThreshold(alive) { return Math.ceil(alive / 2); }
  function ruleSearch(kw, limit) {
    var keys = String(kw).split(/[\s，,。？?、]+/).filter(function (x) { return x.length >= 2; });
    if (!keys.length) keys = [String(kw)];
    var out = [];
    D.rules.forEach(function (r) {
      var t = r.title + ' ' + (r.text || '');
      var s = 0;
      keys.forEach(function (k) { if (t.indexOf(k) >= 0) s += (r.title.indexOf(k) >= 0 ? 10 : 1); });
      if (s) out.push({ r: r, s: s });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, limit || 3).map(function (x) { return x.r; });
  }
  function fullSearch(kw, limit) {
    var out = [], k = String(kw || '').trim();
    if (!k) return out;
    ALL.forEach(function (r) {
      var t = r.name + ' ' + (r.ability || '') + ' ' + (r.flavor || '');
      if (r.wiki && r.wiki.html) t += ' ' + strip(r.wiki.html).slice(0, 4000);
      if (t.indexOf(k) >= 0) out.push({ t: 'role', id: r.id, name: r.name, sub: r.teamCn || '', hit: cut(t.slice(Math.max(0, t.indexOf(k) - 40)), 90) });
    });
    D.rules.forEach(function (r) {
      var t = r.title + ' ' + (r.text || '') + ' ' + (r.html ? strip(r.html).slice(0, 3000) : '');
      if (t.indexOf(k) >= 0) out.push({ t: 'rule', id: r.id, name: r.title, sub: r.catName || '', hit: cut(t.slice(Math.max(0, t.indexOf(k) - 40)), 90) });
    });
    D.jinxes.forEach(function (j) {
      if ((j.a + j.b + j.reason).indexOf(k) >= 0) out.push({ t: 'jinx', id: 'x', name: j.a + ' × ' + j.b, sub: cut(j.reason, 60) });
    });
    return out.slice(0, limit || 8);
  }

  /* ================= 答案结构 ================= */
  function A(title, kind) {
    return {
      title: title, kind: kind || '',
      answer: '',       /* ✅ 直接回答提问的一句话（必须有） */
      verdict: '',      /* 结论补充/详解（与 answer 不同才显示） */
      verdictHtml: '', why: '',
      steps: [],      /* [{t, d}] 分析过程 */
      cites: [],      /* [{src, text}] 官方依据 */
      tips: [], warns: [], links: [], follow: [], sandbox: null, calc: null,
      roles: []      /* [{id, note}] 本题涉及到的角色 */
    };
  }
  /* 收集"本题涉及的角色"（同角色被多次提及时合并备注） */
  function addRole(a, id, note) {
    if (!id || !byId[id]) return;
    for (var i = 0; i < a.roles.length; i++) {
      if (a.roles[i].id === id) {
        if (note && a.roles[i].note.indexOf(note) < 0) a.roles[i].note += '、' + note;
        return;
      }
    }
    a.roles.push({ id: id, note: note || '' });
  }
  function roleLink(r) { return { href: '#/role/' + r.id, label: r.name }; }
  function cite(src, text) { return { src: src, text: cut(text, 320) }; }

  /* ================= 内置规则速答（FAQ） ================= */
  var FAQ = [
    {
      k: /恶魔.*(死|出局|被处决|被杀).*(结束|赢|胜负|怎么办)|恶魔死了|游戏什么时候结束|什么时候结束|如何结束|结束条件|胜负判定/,
      t: '对局何时结束 / 恶魔出局',
      rk: '游戏结束 胜利 死亡 处决',
      v: '场上没有存活的恶魔 → 善良阵营立即获胜，对局立刻结束；另一个结束条件是「存活只剩 2 人」→ 邪恶方获胜。恶魔一死不需要再等到只剩两人。',
      s: [
        { t: '主判定', d: '恶魔出局的瞬间（处决或夜晚能力）游戏结束，善良获胜，说书人应立即宣布并揭示身份。' },
        { t: '例外 1 · 红唇女郎', d: '若红唇女郎在场且存活人数 ≥ 5，恶魔死后她立刻变成恶魔，对局继续（她会成为新的恶魔）。' },
        { t: '例外 2 · 僵怖', d: '僵怖第一次「死亡」是假死，不算真正出局，不会触发结束。' },
        { t: '例外 3 · 小恶魔传刀', d: '小恶魔可在夜晚自杀把恶魔身份传给一名爪牙，此时恶魔身份未断，对局继续。' },
        { t: '另一结束条件', d: '存活人数降到 2 人时邪恶方获胜（无论恶魔是否还活着）。' }
      ],
      tip: '本工具「🕯️ 开局」在恶魔出局时会自动判定并跳到复盘分析页；红唇女郎/僵怖会弹出确认卡让你决定。',
      follow: ['红唇女郎怎么运作？', '僵怖假死怎么处理？', '存活只剩2人是谁赢？']
    },
    {
      k: /剩\s*[两2]\s*[人位]|只剩两人|只剩2人|两人局/,
      t: '只剩 2 人 → 邪恶获胜',
      v: '存活玩家降到 2 人时，邪恶阵营立即获胜，对局结束（这是邪恶方的第二条胜利线路）。',
      s: [
        { t: '为什么', d: '2 人时善良已无法通过投票处决（1 票赞成达不到门槛），邪恶只要熬到这一天就赢。' },
        { t: '说书人操作', d: '达到 2 人存活时立刻宣布邪恶获胜，不必再走完当天流程。' },
        { t: '注意', d: '旅行者不计入阵营配比，但通常也不算在这条「2 人」判定里（按房规）。' }
      ],
      tip: '善良方要抢在人数被消耗到 2 人之前找出恶魔。',
      follow: ['恶魔死了游戏就结束吗？', '处决门槛怎么算？']
    },
    {
      k: /处决门槛|需要几票|要几票|几票通过|多少票|票数/,
      t: '处决票数门槛',
      v: '处决需要赞成票 ≥ 存活人数的一半（向上取整）。存活 9 人需 5 票，7 人需 4 票，5 人需 3 票，4 人需 2 票，3 人需 2 票。',
      s: [
        { t: '公式', d: '门槛 = ceil(存活人数 / 2)。死亡玩家不投票也不计入存活人数。' },
        { t: '平票', d: '票数未达门槛或平票 → 无人被处决，当天继续（通常直接进入夜晚）。' },
        { t: '提名规则', d: '每名玩家每天只能提名一次、只能被提名一次；投票按顺时针从提名人下家开始举手。' }
      ],
      tip: '工具的对局页会自动算出门槛票数并处理平票，你只需记录谁举手。',
      follow: ['提名和投票怎么算？', '平票怎么办？']
    },
    {
      k: /提名|投票|平票|举手|顺时针/,
      t: '提名与投票流程',
      rk: '提名 投票 处决 白天',
      v: '白天：讨论 → 任何人可提名（每人每天限提名 1 次，每人每天限被提名 1 次）→ 从提名人开始顺时针依次举手 → 票数 ≥ 门槛则被处决，否则换下一个提名。',
      s: [
        { t: '提名门槛', d: '钟楼没有「附议」门槛，一个人提名即可成立。' },
        { t: '投票顺序', d: '顺时针，从提名人的下一位开始，最后轮到提名人，避免跟风。' },
        { t: '被处决者', d: '当天死亡，不能再提名/投票；其能力（若依赖存活）随之失效。' },
        { t: '平票', d: '未达门槛 → 无人被处决。' }
      ],
      tip: '管家投票受主人限制、乞丐需要投票标记、镇长可平票改判——这些例外要在投票前确认。',
      follow: ['处决门槛怎么算？', '镇长怎么运作？', '管家怎么投票？']
    },
    {
      k: /中毒|醉酒|酒鬼|中毒了/,
      t: '中毒 vs 醉酒',
      v: '两者效果完全一样：能力「失效或可能给出错误信息」，且玩家本人不知道。区别只在来源——中毒多来自投毒者等邪恶能力，醉酒多来自酒鬼、旅店老板等。',
      s: [
        { t: '官方表述', d: '中毒 / 醉酒的角色「能力失效或产生错误信息」，说书人可以给他任意信息（包括假的）。' },
        { t: '不影响身份', d: '中毒的共情者仍是善良的共情者，阵营不变，只是信息不可靠。' },
        { t: '致死类照常', d: '中毒/醉酒不阻止死亡，恶魔杀人、刺客等仍生效。' },
        { t: '操作', d: '魔典上给该玩家打「中毒/醉酒」标记，每周目夜晚信息可故意给错。' }
      ],
      tip: '本工具魔典里可一键给任意座位打中毒/醉酒标记，夜晚信息卡片会提示"此人状态异常"。',
      follow: ['投毒者怎么运作？', '说书人可以给假信息吗？', '酒鬼怎么运作？']
    },
    {
      k: /说书人.*(能|可以|能不能|要不要).*(说谎|骗|假信息|给错|改)|可以给假信息|说谎/,
      t: '说书人能给假信息吗',
      v: '可以，但只在合法时机：目标中毒/醉酒，或能力文本本身允许出错（如酒鬼、间谍、疯子）。其余情况信息类能力必须给出真实结果。',
      s: [
        { t: '合法时机', d: '① 目标中毒或醉酒；② 能力文本写明"可能得到错误信息/自以为"。' },
        { t: '禁止', d: '不能因为"这样更好玩"就给正常角色假信息——会破坏信任与推理基础。' },
        { t: '自由度', d: '中毒时给真给假都合法，建议本局保持一致风格并让玩家无法反推。' }
      ],
      tip: '日志里记下每一次"故意给错"，复盘时能解释清楚。',
      follow: ['中毒和醉酒有什么区别？', '间谍怎么运作？']
    },
    {
      k: /首夜.*(流程|顺序|怎么做|该做|步骤)|开局.*(流程|步骤|怎么开)|第一夜流程|夜晚流程|怎么开局/,
      t: '首夜流程',
      rk: '夜晚 首夜 流程 顺序',
      v: '首夜顺序：① 说书人做「设置阶段」（男爵/教父/哲学家等）→ ② 唤醒爪牙与恶魔互认，并给恶魔 3 张伪装角色 → ③ 按夜晚顺序表依次唤醒每个角色 → ④ 天亮宣布谁死了。',
      s: [
        { t: '设置阶段', d: '发牌后、首夜前，处理所有带「设置」标记的角色（如男爵加 2 名外来者、教父可换外来者）。' },
        { t: '互认', d: '同时唤醒所有爪牙与恶魔，让他们看见彼此；恶魔单独看 3 张不在本局的善良角色（伪装牌）。' },
        { t: '逐角色唤醒', d: '按官方夜晚顺序表，只唤醒本局在场的角色；不在场的跳过。' },
        { t: '天亮', d: '宣布夜晚死亡名单，进入第 1 天白天。' }
      ],
      tip: '工具「🕯️ 开局 → 夜晚」面板已按官方顺序排好，只需一步步点"完成"。',
      follow: ['夜晚顺序表怎么看？', '恶魔伪装牌是什么？', '哪些角色需要设置阶段？']
    },
    {
      k: /伪装|伪装牌|bluff|给恶魔看什么|恶魔看几张/,
      t: '恶魔伪装牌（bluffs）',
      v: '首夜恶魔与爪牙互认后，说书人单独给恶魔看 3 张「不在本局的善良角色」，供邪恶方统一口径、伪装身份。',
      s: [
        { t: '选择', d: '必须取本局未上场的善良（镇民/外来者）角色，通常同剧本。' },
        { t: '用法', d: '恶魔把其中一两个角色名告诉爪牙，邪恶方对外统一自称这些角色。' },
        { t: '不需要真会玩', d: '伪装牌只是"名字"，恶魔无需真的会这些能力。' }
      ],
      tip: '工具在互认步骤会自动抽 3 张伪装牌并可重抽/记录，魔典里常驻显示。',
      follow: ['首夜流程怎么走？', '间谍怎么运作？']
    },
    {
      k: /旅行者/,
      t: '旅行者规则',
      v: '旅行者可随时加入/离场（通常白天宣布），加入即获知自己的角色；数量不计入阵营配比。',
      s: [
        { t: '数量建议', d: '5–9 人局最多 1 名，10+ 人局最多 2 名。' },
        { t: '阵营', d: '旅行者可能善良也可能邪恶，说书人要告知全场"有几名旅行者、其中可能有邪恶"。' },
        { t: '离场', d: '旅行者可自行离场；被驱逐/处决同样出局。' }
      ],
      follow: ['10人局几个外来者？', '有哪些旅行者？']
    },
    {
      k: /传奇角色|传奇/,
      t: '传奇角色（Fabled）',
      v: '传奇角色不是玩家角色，是可选的全局规则变体，由说书人在开局前宣布是否启用，会改变流程或胜利条件。',
      s: [
        { t: '用法', d: '开局前向全场说明使用哪些传奇角色及其效果。' },
        { t: '建议', d: '新手局建议不用；熟练后可加 1–2 个增加变化。' }
      ],
      follow: ['有哪些传奇角色？']
    },
    {
      k: /外来者.*(几个|多少|数量|增加|变)|设置阶段|哪些角色需要设置/,
      t: '外来者数量与设置阶段',
      v: '基础外来者数量由人数配比决定（见配比表）；会被带「设置」能力的角色改变，最常见是男爵（+2 名外来者，替掉 2 名镇民）。',
      s: [
        { t: '处理时机', d: '发牌后、首夜之前，先处理所有设置类角色再走夜晚流程。' },
        { t: '男爵', d: '+2 外来者、-2 镇民，邪恶方开局信息优势。' },
        { t: '教父', d: '可把一名外来者换成另一名外来者（部分版本为预知外来者有哪些）。' },
        { t: '告知', d: '设置阶段的结果只对相关玩家公开，不需要向全场宣布具体数字变化。' }
      ],
      tip: '工具在开局设置阶段会提示本局有哪些角色需要处理设置。',
      follow: ['10人局几个外来者？', '男爵怎么运作？']
    },
    {
      k: /私聊|私下|偷偷|悄悄说|耳语/,
      t: '玩家可以私聊吗',
      v: '可以。钟楼鼓励私聊，玩家可在白天自由走动私聊，这是游戏核心之一；但要保证说书人始终在场中立，且私聊内容不违反角色能力限制。',
      s: [
        { t: '常见限制', d: '某些角色能力会限制交流（如洗脑师、镜像双子等按能力文本处理）。' },
        { t: '线上局', d: '线上私聊建议开小房间，但要注意邪恶方在首夜已互认，天然有信息优势。' }
      ],
      follow: ['首夜流程怎么走？']
    },
    {
      k: /死亡.*(说话|发言|投票|提名)|死了还能|死后能/,
      t: '死亡玩家的权限',
      v: '死亡玩家不再参与投票与提名，但仍可讨论发言（多数房规允许），且保留一次"死亡票"——每名玩家整局只有 1 票投票权，死后仍可用这 1 票。',
      s: [
        { t: '死亡票', d: '每名玩家全局只有 1 张"死亡票"，死后可在某次投票中举手使用，用完即止。' },
        { t: '能力', d: '多数能力死亡后失效；少数能力文本写明死后仍生效（如送葬者）。' },
        { t: '信息', d: '死亡玩家身份通常公开（说书人揭示），便于推理。' }
      ],
      follow: ['送葬者怎么运作？', '提名和投票怎么算？']
    },
    {
      k: /新手|第一次玩|入门|推荐.*剧本|玩哪个剧本|哪个剧本/,
      t: '新手剧本推荐',
      v: '首选《暗流涌动》（Trouble Brewing，1 级剧本）：机制最干净，全部角色都是"信息 vs 干扰"的基础款，最适合第一次玩。',
      s: [
        { t: '第一梯队', d: '暗流涌动（5–15 人）—— 新手必选。' },
        { t: '第二梯队', d: '教区钟声（Bad Moon Rising）、梦魇降临（Sects & Violets）—— 有更多状态与变化，建议玩过 2–3 局后再上。' },
        { t: '实验剧本', d: '其他自定义/实验剧本适合老玩家。' },
        { t: '人数建议', d: '新手局 7–10 人体验最好：信息量适中、白天不至于太乱。' }
      ],
      tip: '说书人自己第一次带局，建议先用暗流涌动 + 不用传奇角色 + 不用旅行者。',
      follow: ['暗流涌动有哪些角色？', '9人局怎么配比？']
    },
    {
      k: /说书人.*(是|做什么|职责|作用)|什么是说书人/,
      t: '说书人的职责',
      v: '说书人是主持人兼裁判：负责发牌、执行夜晚流程、裁定能力、控制节奏，并且是唯一知道全部真相的人。说书人不参与任何一方，但要保证邪恶方有足够信息。',
      s: [
        { t: '必须做的', d: '严格执行能力文本、记录状态标记、控制白天时长、宣布死亡与胜负。' },
        { t: '不要做的', d: '不要替玩家推理、不要泄露未公开信息、不要因同情而改判。' },
        { t: '可以做的', d: '中毒/醉酒时给假信息、用节奏控制游戏时长、在白天给出无人称的提示。' }
      ],
      follow: ['说书人可以给假信息吗？', '首夜流程怎么走？']
    }
  ];

  /* ================= 各意图答案生成器 ================= */
  function answerFaq(f, q) {
    var a = A('规则速答 · ' + f.t, 'faq');
    a.answer = f.v;
    a.steps = f.s || [];
    if (f.tip) a.tips.push(f.tip);
    (f.follow || []).forEach(function (x) { a.follow.push(x); });
    var rs = ruleSearch(f.rk || f.t.replace(/^.*·\s*/, ''), 3);
    rs.forEach(function (r) {
      a.cites.push(cite('规则条目 · ' + r.title + '（' + r.catName + '）', r.text));
      a.links.push({ href: '#/rule/' + r.id, label: '§ ' + r.title });
    });
    return a;
  }

  /* 能力一句话摘要（取能力文本第一句） */
  function abilityBrief(r) {
    var t = strip(r.ability || '');
    var seg = t.split(/[。；;！!]/)[0] || t;
    return cut(seg || '（无能力文本）', 80);
  }

  function answerRole(r, q) {
    q = q || '';
    var a = A('角色解析 · ' + r.name, 'role');
    var np = nightPos(r);
    var teamCn = r.teamCn || TEAMCN[r.team];
    var side = (r.team === 'minion' || r.team === 'demon') ? '邪恶方' : '善良方';
    var brief = abilityBrief(r);
    var when = (np.f || np.o)
      ? '首夜' + (np.f ? '第 ' + np.f + ' 位' : '不行动') + '、其他夜' + (np.o ? '第 ' + np.o + ' 位' : '不行动')
      : '夜晚不行动（白天 / 被动能力）';

    /* ✅ 直接回答提问 */
    if (/怎么运作|如何运作|怎么用|怎么玩|怎么用|该怎么做|要怎么做|作用|干嘛|做什么|怎么执行|如何处理|怎么给|怎么算/.test(q)) {
      a.answer = r.name + '（' + teamCn + '・' + side + '）的做法：' + brief + '。' +
        '说书人操作：' + (np.f ? '首夜第 ' + np.f + ' 位唤醒他' : '首夜不唤醒') +
        (np.o ? '，之后每夜第 ' + np.o + ' 位唤醒' : '') + '，严格按能力文本给出信息即可。';
    } else if (/强吗|厉害|好用|值得|推荐|评价|怎么样/.test(q)) {
      a.answer = r.name + '（' + teamCn + '）：' + brief + '　评价：' +
        (r.team === 'demon' ? '作为恶魔，强度取决于伪装与杀人节奏，需要说书人配合给好伪装牌。'
          : r.team === 'minion' ? '爪牙的价值在干扰信息，单看能力不出彩，配合恶魔才强。'
            : r.team === 'outsider' ? '外来者能力有副作用，对善良方是"信息 + 干扰"的双刃剑，新手局慎用。'
              : '镇民信息位，强度稳定，是善良方推理的主力。') + '（' + when + '）';
    } else if (/相克|冲突/.test(q)) {
      var jx0 = jinxListOf(r.name);
      a.answer = jx0.length ? (r.name + ' 有 ' + jx0.length + ' 条相克：' + jx0.slice(0, 6).map(function (j) { return j.a === r.name ? j.b : j.a; }).join('、') + '，同局时必须按相克规则处理。')
        : (r.name + ' 没有相克规则，可以和任意角色同局。');
    } else {
      a.answer = r.name + ' 是' + teamCn + '（' + side + '）：' + brief + '。' + when + '。';
    }

    a.steps.push({ t: '① 能力原文', d: r.ability || '—' });
    a.steps.push({ t: '② 阵营与定位', d: teamCn + '・' + side + '。' + (r.team === 'demon' ? '本局核心目标：活到最后，让善良方无法处决你。' : r.team === 'minion' ? '任务：保护恶魔、混淆信息、必要时替恶魔挡刀。' : r.team === 'outsider' ? '外来者：能力有代价或会干扰善良方判断。' : '镇民：靠能力获取信息，帮善良方定位邪恶。') });
    if (np.f || np.o) a.steps.push({ t: '③ 夜晚时机', d: '首夜 ' + (np.f ? '第 ' + np.f + ' 位被唤醒' : '不行动') + '，其他夜晚 ' + (np.o ? '第 ' + np.o + ' 位' : '不行动') + '。序号是全表位置，只有本局在场的角色才需要执行。' });
    if (r.setup) a.steps.push({ t: '⚙ 设置阶段', d: '该角色需要在发牌后、首夜之前处理设置，别忘了。' });
    if (r.firstNightReminder || r.otherNightReminder) {
      a.steps.push({ t: '④ 说书人提示语', d: '首夜：' + (r.firstNightReminder || '—') + '　／　其他夜：' + (r.otherNightReminder || '—') });
    }
    if (r.reminders && r.reminders.length) a.steps.push({ t: '⑤ 提示标记', d: r.reminders.join('、') });

    var jx = jinxListOf(r.name);
    if (jx.length) {
      a.warns.push('相克 ' + jx.length + ' 条：' + jx.slice(0, 5).map(function (j) { return (j.a === r.name ? j.b : j.a); }).join('、') + (jx.length > 5 ? ' 等' : '') + '（同局须按相克规则处理）');
    }

    a.cites.push(cite('官方魔典 · ' + r.name, r.ability));
    if (r.flavor) a.why += '<div class="flavor" style="padding:6px 0">' + esc(r.flavor) + '</div>';
    addRole(a, r.id, '你问的角色');

    /* 百科：运作方式 / 范例 / 说书人建议 */
    var ws = wikiSection(r, /运作方式|如何运作|机制|运作/);
    var wx = wikiSection(r, /范例|示例|例子/);
    var wh = wikiSection(r, /说书人|攻略|提示|建议/);
    [ws, wx, wh].forEach(function (s) {
      if (!s) return;
      if (s === ws) a.steps.push({ t: '⑥ 运作方式（百科）', d: cut(s.html, 420) });
      else if (s === wx) a.steps.push({ t: '⑦ 范例（百科）', d: cut(s.html, 360) });
      else a.steps.push({ t: '⑧ 说书人建议（百科）', d: cut(s.html, 300) });
      a.cites.push(cite('钟楼百科 · ' + r.name + ' · ' + s.title, s.html));
    });
    if (!ws && !wx && !wh && WIKISTATE !== 2) {
      a.tips.push('📖 该角色还有百科全文（运作方式/范例/伪装建议），加载百科后可给出更详细的说书人指引。');
    }
    /* 按问题关键词定向检索百科，并把最关键的一句写进答案 */
    var kw = q.replace(new RegExp(r.name, 'g'), '').replace(/[的了吗呢？?，,。怎么如何什么]/g, ' ').trim();
    if (kw.length >= 2 && r.wiki) {
      var hs = wikiHits(r, kw, 2);
      hs.forEach(function (h) {
        a.steps.push({ t: '🔎 百科命中 · ' + h.title, d: cut(h.text, 300) });
        a.cites.push(cite('钟楼百科 · ' + r.name + ' · ' + h.title, h.html || h.text));
      });
      if (hs.length) a.answer += '　关于「' + kw + '」：' + cut(hs[0].text, 100);
    }

    if (window.BOTCAbility && BOTCAbility.has(r.id)) {
      var ab = BOTCAbility.get(r.id);
      a.tips.push('✅ 本工具内置「' + r.name + '」的自动计算：' + (ab.hint || '可在下方情境分析器里推演他会得到什么信息。'));
      a.sandbox = r.id;
      a.follow.push(r.name + '两边都是善良应该给几？', r.name + '和谁有相克？');
    } else {
      a.tips.push('该角色暂无自动计算，按能力文本手动处理即可。');
    }
    a.links.push(roleLink(r));
    if (jx.length) a.links.push({ href: '#/jinxes', label: '相克规则' });
    a.follow.push(r.name + '第几夜行动？', r.name + '是好人还是坏人？');
    return a;
  }

  function answerJinx(r1, r2) {
    var a = A('相克判定 · ' + r1.name + ' × ' + r2.name, 'jinx');
    addRole(a, r1.id, '你问的角色'); addRole(a, r2.id, '你问的角色');
    var j = jinxOf(r1.name, r2.name);
    if (j) {
      a.answer = '⚠ 不能按常规同局：' + r1.name + ' 与 ' + r2.name + ' 存在官方相克，必须按相克规则处理' + (j.reason ? '（' + cut(j.reason, 60) + '）' : '') + '。';
      a.steps.push({ t: '① 相克原文', d: j.reason || '—' });
      a.steps.push({ t: '② 处理方式', d: '把相克卡放在魔典中间，开局告知全场"本局存在相克"，并在设置阶段/首夜按卡面文字调整。' });
      a.cites.push(cite('官方相克规则 · ' + j.a + ' × ' + j.b, j.reason));
      a.tips.push('相克是官方为平衡设计的强制规则，说书人不能自行忽略。');
    } else {
      a.answer = '✅ 可以同局：' + r1.name + ' 与 ' + r2.name + ' 之间没有官方相克记录，按常规执行即可。';
      a.steps.push({ t: '核对范围', d: '已比对全部 ' + D.jinxes.length + ' 条官方相克规则，未命中。' });
      a.steps.push({ t: '仍需注意', d: '无相克≠无互动：还要看两者能力是否互相干扰（如中毒/保护/信息重叠）。' });
      var j1 = jinxListOf(r1.name).length, j2 = jinxListOf(r2.name).length;
      a.steps.push({ t: '各自相克数', d: r1.name + ' ' + j1 + ' 条，' + r2.name + ' ' + j2 + ' 条。' });
    }
    a.links.push(roleLink(r1), roleLink(r2), { href: '#/jinxes', label: '全部相克规则' });
    a.follow.push(r1.name + '怎么运作？', r2.name + '怎么运作？');
    return a;
  }

  function answerNightOrder(hits, q) {
    var a = A('夜晚顺序', 'night');
    hits.forEach(function (h) { addRole(a, h.r.id, '你问的角色'); });
    if (hits.length >= 2) {
      var r1 = hits[0].r, r2 = hits[1].r, p1 = nightPos(r1), p2 = nightPos(r2);
      if (!p1.f && !p1.o) { a.verdict = r1.name + ' 夜晚不行动。'; }
      else if (!p2.f && !p2.o) { a.verdict = r2.name + ' 夜晚不行动。'; }
      else {
        var key = /首夜|第一夜|第一晚/.test(q) ? 'f' : 'o';
        var v1 = p1[key], v2 = p2[key];
        if (v1 && v2) a.verdict = (key === 'f' ? '首夜' : '其他夜晚') + '：' +
          (v1 < v2 ? r1.name + '（第 ' + v1 + ' 位）先于 ' + r2.name + '（第 ' + v2 + ' 位）行动'
            : r2.name + '（第 ' + v2 + ' 位）先于 ' + r1.name + '（第 ' + v1 + ' 位）行动');
        else a.verdict = (key === 'f' ? '首夜' : '其他夜晚') + '：' +
          (v1 ? r1.name + ' 第 ' + v1 + ' 位' : r1.name + ' 不行动') + '，' +
          (v2 ? r2.name + ' 第 ' + v2 + ' 位' : r2.name + ' 不行动');
        a.steps.push({ t: '推导', d: '两条顺序表中取同一夜晚（' + (key === 'f' ? '首夜' : '其他夜') + '）的位置号，数字小者先被唤醒。' });
      }
      a.cites.push(cite('官方夜晚顺序表', '首夜共 ' + (D.nightOrder.first || []).length + ' 位、其他夜共 ' + (D.nightOrder.other || []).length + ' 位。'));
      a.links.push(roleLink(r1), roleLink(r2));
    } else {
      var r = hits[0].r, p = nightPos(r);
      a.verdict = r.name + '：' + (p.f ? '首夜第 ' + p.f + ' 位被唤醒' : '首夜不行动') + ' ／ ' +
        (p.o ? '其他夜晚第 ' + p.o + ' 位' : '其他夜晚不行动') + '。';
      a.steps.push({ t: '① 位置', d: '首夜表第 ' + (p.f || '—') + ' 位，其他夜表第 ' + (p.o || '—') + ' 位（首夜共 ' + (D.nightOrder.first || []).length + ' 位、其他夜共 ' + (D.nightOrder.other || []).length + ' 位，含所有剧本角色）。' });
      a.steps.push({ t: '② 怎么用', d: '真正开局只唤醒本局在场的角色；序号只用于判断谁先谁后。死亡/离场角色跳过。' });
      if (p.f) a.steps.push({ t: '③ 首夜前序', d: (D.nightOrder.first || []).slice(Math.max(0, p.f - 3), p.f).map(function (x) { return x.name; }).join(' → ') + ' → 【' + r.name + '】' });
      if (p.o) a.steps.push({ t: '④ 其他夜前序', d: (D.nightOrder.other || []).slice(Math.max(0, p.o - 3), p.o).map(function (x) { return x.name; }).join(' → ') + ' → 【' + r.name + '】' });
      a.links.push(roleLink(r), { href: '#/night/' + (p.f ? 'first' : 'other'), label: '完整夜晚顺序表' });
    }
    a.tips.push('顺序说明：数字小者先被唤醒；"首夜之后"才行动的角色首夜不动；互认步骤固定在首夜最前。');
    return a;
  }

  function answerComp(n) {
    var a = A(n + ' 人局 · 角色配比', 'comp');
    var c = compOf(n);
    if (!c) { a.verdict = '暂无该人数配比（支持 5–' + (D.composition.length + 4) + ' 人）。'; return a; }
    var tf = c.townsfolk || 0, ou = c.outsider || 0, mi = c.minion || 0, de = c.demon || 0;
    a.verdict = n + ' 人局：镇民 ' + tf + '・外来者 ' + ou + '・爪牙 ' + mi + '・恶魔 ' + de + '。善良 ' + (tf + ou) + ' 人，邪恶 ' + (mi + de) + ' 人。';
    a.steps.push({ t: '① 配比来源', d: '官方人数配比表：' + n + ' 人 → ' + tf + '/' + ou + '/' + mi + '/' + de + '。' });
    a.steps.push({ t: '② 会被改变', d: '外来者数量会被带「设置」能力的角色改变（男爵 +2 外来者等），发牌后先处理设置再走首夜。' });
    a.steps.push({ t: '③ 处决门槛', d: '开局存活 ' + n + ' 人时需 ' + execThreshold(n) + ' 票才能处决；人数减少后门槛随之降低（ceil(存活/2)）。' });
    a.steps.push({ t: '④ 旅行者', d: n <= 9 ? '建议最多 1 名旅行者。' : '建议最多 2 名旅行者。' });
    /* 相邻人数对比 */
    var row = [];
    [n - 1, n, n + 1].forEach(function (x) {
      var cc = x >= 5 && x <= D.composition.length + 4 ? compOf(x) : null;
      if (cc) row.push(x + '人：' + (cc.townsfolk || 0) + '/' + (cc.outsider || 0) + '/' + (cc.minion || 0) + '/' + (cc.demon || 0));
    });
    if (row.length) a.steps.push({ t: '⑤ 相邻人数', d: row.join('　｜　') });
    a.cites.push(cite('官方人数配比表', row.join('；')));
    a.tips.push('开局用「🕯️ 开局 → 抽签台」让玩家自己抽角色，避免说书人提前知道谁是什么。');
    a.links.push({ href: '#/game/new', label: '去开一局' }, { href: '#/rules', label: '规则条目' });
    a.follow.push('哪些角色需要设置阶段？', '处决门槛怎么算？');
    return a;
  }

  function answerExec(alive) {
    var a = A('处决票数计算', 'calc');
    if (!alive || alive < 2 || alive > 20) { a.verdict = '请给出存活人数（例如"7人存活需要几票"）。'; return a; }
    a.verdict = '存活 ' + alive + ' 人 → 处决需要 ' + execThreshold(alive) + ' 票赞成（ceil(' + alive + '/2)）。';
    a.steps.push({ t: '① 公式', d: '门槛 = 向上取整(存活人数 ÷ 2) = ceil(' + alive + '/2) = ' + execThreshold(alive) + '。' });
    a.steps.push({ t: '② 说明', d: '死亡玩家不投票、不计入存活人数；平票或未达门槛 → 无人被处决。' });
    var tbl = [];
    for (var x = Math.max(2, alive - 2); x <= Math.min(20, alive + 2); x++) tbl.push(x + '人→' + execThreshold(x) + '票');
    a.steps.push({ t: '③ 参考表', d: tbl.join('　') });
    a.tips.push('管家投票受主人限制、乞丐需投票标记、镇长能力可改变结果——投票前先确认这些例外。');
    a.follow.push('提名和投票怎么算？', '平票怎么办？');
    return a;
  }

  function answerCompare(r1, r2, q) {
    var a = A('角色对比 · ' + r1.name + ' vs ' + r2.name, 'compare');
    addRole(a, r1.id, '对比对象'); addRole(a, r2.id, '对比对象');
    var p1 = nightPos(r1), p2 = nightPos(r2);
    a.verdict = r1.name + '（' + (r1.teamCn || TEAMCN[r1.team]) + '）与 ' + r2.name + '（' + (r2.teamCn || TEAMCN[r2.team]) + '）：' +
      (r1.team === r2.team ? '同阵营，' : '不同阵营，') +
      '核心差异在' + (r1.team === r2.team ? '能力机制与夜晚时机' : '立场与胜负目标') + '。';
    a.steps.push({ t: r1.name + ' 能力', d: r1.ability || '—' });
    a.steps.push({ t: r2.name + ' 能力', d: r2.ability || '—' });
    a.steps.push({ t: '阵营', d: r1.name + '：' + (r1.teamCn || TEAMCN[r1.team]) + '（' + ((r1.team === 'demon' || r1.team === 'minion') ? '邪恶' : '善良') + '）　｜　' + r2.name + '：' + (r2.teamCn || TEAMCN[r2.team]) + '（' + ((r2.team === 'demon' || r2.team === 'minion') ? '邪恶' : '善良') + '）' });
    a.steps.push({ t: '夜晚时机', d: r1.name + '：首夜' + (p1.f ? '第' + p1.f + '位' : '不行动') + '/其他夜' + (p1.o ? '第' + p1.o + '位' : '不行动') + '　｜　' + r2.name + '：首夜' + (p2.f ? '第' + p2.f + '位' : '不行动') + '/其他夜' + (p2.o ? '第' + p2.o + '位' : '不行动') });
    a.steps.push({ t: '剧本', d: (r1.editionCn || '—') + '　｜　' + (r2.editionCn || '—') });
    var j = jinxOf(r1.name, r2.name);
    if (j) { a.warns.push('两者相克：' + j.reason); a.cites.push(cite('官方相克规则', j.reason)); }
    else a.steps.push({ t: '相克', d: '两者无官方相克记录。' });
    a.cites.push(cite('官方魔典 · ' + r1.name, r1.ability));
    a.cites.push(cite('官方魔典 · ' + r2.name, r2.ability));
    a.links.push(roleLink(r1), roleLink(r2));
    a.follow.push(r1.name + '怎么运作？', r2.name + '怎么运作？');
    return a;
  }

  function answerTeamOf(r, q) {
    var a = A('阵营判定 · ' + r.name, 'team');
    addRole(a, r.id, '你问的角色');
    var evil = (r.team === 'demon' || r.team === 'minion');
    a.answer = r.name + ' 是' + (evil ? '邪恶方' : '善良方') + '的' + (r.teamCn || TEAMCN[r.team]) +
      '，' + (evil ? '与恶魔同阵营，目标是让恶魔活到最后' : '目标是找出并处决所有恶魔') + '。';
    a.steps.push({ t: '① 阵营', d: (r.teamCn || TEAMCN[r.team]) + ' → ' + (evil ? '与恶魔同阵营，胜利条件是恶魔活到最后 / 存活只剩 2 人' : '胜利条件是处决所有恶魔') + '。' });
    a.steps.push({ t: '② 能力', d: r.ability || '—' });
    if (r.team === 'outsider') a.steps.push({ t: '③ 注意', d: '外来者是善良方，但能力往往有副作用或会制造错误信息，容易被误当成邪恶。' });
    if (r.team === 'minion') a.steps.push({ t: '③ 注意', d: '爪牙首夜会与恶魔互认，知道恶魔是谁；开局就掌握信息优势。' });
    if (r.team === 'demon') a.steps.push({ t: '③ 注意', d: '恶魔每夜杀人（具体按能力文本），首夜会拿到 3 张伪装牌。' });
    a.cites.push(cite('官方魔典 · ' + r.name, r.name + '（' + (r.teamCn || TEAMCN[r.team]) + '）：' + r.ability));
    a.links.push(roleLink(r));
    a.follow.push(r.name + '怎么运作？', r.name + '第几夜行动？');
    return a;
  }

  function answerRule(q) {
    var a = A('规则检索', 'rule');
    var rs = ruleSearch(q, 3);
    if (!rs.length) { a.answer = '规则条目里没匹配到这个词，下面是百科/角色里最接近的内容。'; a.similars = fullSearch(q, 8); return a; }
    var r0 = rs[0];
    a.answer = '按官方规则：' + cut(r0.text, 110) + '（出自《' + (r0.catName || '') + '》· ' + r0.title + '）';
    a.verdict = '最相关规则：' + r0.title + '（' + (r0.catName || '') + '）';
    a.steps.push({ t: '① 规则原文', d: r0.text || '—' });
    rs.slice(1).forEach(function (r, i) {
      a.steps.push({ t: '相关 ' + (i + 2) + '・' + r.title, d: cut(r.text, 200) });
    });
    if (r0.html) a.steps.push({ t: '② 百科补充', d: cut(r0.html, 400) });
    rs.forEach(function (r) {
      a.cites.push(cite('规则条目 · ' + r.title, r.text));
      a.links.push({ href: '#/rule/' + r.id, label: '§ ' + r.title });
    });
    a.follow.push(rs[0].title + '具体怎么执行？');
    return a;
  }

  function answerEdition(q) {
    var ql = q.toLowerCase();
    var eds = D.editions.filter(function (e) {
      if (e.name && q.indexOf(e.name) >= 0) return true;
      if (!e.id || e.id.length < 3) return false;
      var i = ql.indexOf(e.id.toLowerCase());
      return i >= 0;
    });
    var a = A('剧本解析', 'edition');
    if (!eds.length) return null;
    if (eds.length > 1) eds.sort(function (x, y) { return (y.name || '').length - (x.name || '').length; });
    var e = eds[0], c = e.counts || {};
    a.answer = '《' + e.name + '》适合 ' + (e.playerNum || '—') + '，' + (e.level === 1 ? '是新手首选剧本' : e.level ? '属于进阶级剧本（建议玩过几局再开）' : '') +
      '：镇民' + (c.townsfolk || 0) + '・外来者' + (c.outsider || 0) + '・爪牙' + (c.minion || 0) + '・恶魔' + (c.demon || 0) + '。玩法要点：' + cut(e.description, 70);
    a.steps.push({ t: '① 剧本简介', d: cut(e.description, 320) || '—' });
    var rs = D.roles.filter(function (r) { return r.edition === e.id; });
    var roleNames = {};
    ['townsfolk', 'outsider', 'minion', 'demon'].forEach(function (t) {
      var list = rs.filter(function (r) { return r.team === t; }).map(function (r) { return r.name; });
      roleNames[t] = list;
      if (list.length) a.steps.push({ t: TEAMCN[t], d: list.join('、') });
    });
    if (/有哪些角色|角色有哪些|角色列表|有什么角色|角色一览/.test(q)) {
      a.answer = '《' + e.name + '》共 ' + rs.length + ' 名玩家角色 —— 镇民：' + (roleNames.townsfolk || []).join('、') +
        '；外来者：' + (roleNames.outsider || []).join('、') + '；爪牙：' + (roleNames.minion || []).join('、') +
        '；恶魔：' + (roleNames.demon || []).join('、') + '。';
    }
    if (e.wiki) a.steps.push({ t: '百科补充', d: cut(e.wiki.html, 400) });
    a.links.push({ href: '#/edition/' + e.id, label: '《' + e.name + '》全部角色' });
    a.follow.push('《' + e.name + '》适合几个人玩？', '《' + e.name + '》有什么相克？');
    return a;
  }

  /* 兜底：全文检索 + 追问引导 */
  function answerSearch(q) {
    var a = A('检索结果', 'search');
    var hits = fullSearch(q, 10);
    if (!hits.length) {
      a.answer = '没查到「' + q + '」的直接答案。建议换个说法，或直接问角色名 / 规则关键词。';
      a.tips.push('支持的问法：角色能力、相克、夜晚顺序、人数配比、规则词条、局面推演（如"9人局，1号自称共情者，2号也自称共情者，该怀疑谁？"）。');
      a.follow.push('9人局怎么配比？', '首夜流程怎么走？', '处决门槛怎么算？', '新手玩哪个剧本？');
      return a;
    }
    a.answer = '没有匹配到明确意图，最接近的答案是「' + hits[0].name + '」' +
      (hits[0].t === 'role' ? '（角色）' : hits[0].t === 'rule' ? '（规则条目）' : '（相克规则）') +
      '：' + cut(hits[0].hit || hits[0].sub || '', 80);
    hits.forEach(function (h) {
      a.steps.push({ t: (h.t === 'role' ? '角色' : h.t === 'rule' ? '规则' : '相克') + ' · ' + h.name, d: h.sub ? h.sub + '：' + (h.hit || '') : (h.hit || '') });
      a.links.push({ href: h.t === 'role' ? '#/role/' + h.id : h.t === 'rule' ? '#/rule/' + h.id : '#/jinxes', label: h.name });
    });
    if (WIKISTATE !== 2) a.tips.push('📖 加载百科全文后可检索 432 页百科内容，命中会明显变多。');
    return a;
  }

  /* ================= 主分析入口 ================= */
  /* 统一收口：保证每条回答都有「✅ 直接答案」 */
  function fin(a, q) {
    if (!a) return a;
    if (!a.answer) {
      a.answer = a.verdict || (a.steps && a.steps.length ? a.steps[0].d : '');
      a.verdict = '';
    }
    if (a.verdict && a.verdict === a.answer) a.verdict = '';
    if (!a.answer) a.answer = '见下方分析过程。';
    /* 兜底：问题里提到的角色都列出来 */
    if (q && (!a.roles || !a.roles.length)) {
      findRoles(q).slice(0, 6).forEach(function (h) { addRole(a, h.r.id, '问题中提及'); });
    }
    return a;
  }
  function analyze(q) { return fin(analyzeRaw(q), q); }

  function analyzeRaw(q) {
    q = (q || '').trim();
    if (!q) return null;
    var e = ents(q), hits = e.roles, i;

    /* 0) 票数 / 门槛计算（带具体人数时优先精确计算） */
    if (/几票|多少票|票数|处决门槛|需要.*票/.test(q)) {
      var an0 = /(\d+)\s*[人位]/.exec(q);
      if (an0 && +an0[1] >= 2 && +an0[1] <= 20) return answerExec(+an0[1]);
    }

    /* 1) 内置规则速答（优先级最高，覆盖流程/判定类） */
    for (i = 0; i < FAQ.length; i++) {
      if (FAQ[i].k.test(q)) return answerFaq(FAQ[i], q);
    }

    /* 2) 相克 */
    if (/相克|冲突|排斥|不能一起|能一起|同局|同时出现|可以一起/.test(q) && hits.length >= 2) return answerJinx(hits[0].r, hits[1].r);
    if (/相克/.test(q) && hits.length === 1) {
      var r0 = hits[0].r, jl = jinxListOf(r0.name);
      var aj = A('相克清单 · ' + r0.name, 'jinx');
      aj.verdict = jl.length ? (r0.name + ' 共有 ' + jl.length + ' 条相克规则。') : (r0.name + ' 没有相克规则，可与任意角色同局。');
      if (!jl.length) aj.steps.push({ t: '核对范围', d: '已比对全部 ' + D.jinxes.length + ' 条官方相克规则，' + r0.name + ' 未出现在任何一条中。' });
      jl.forEach(function (j) { aj.steps.push({ t: '× ' + (j.a === r0.name ? j.b : j.a), d: j.reason || '' }); aj.cites.push(cite('官方相克规则', (j.a === r0.name ? j.b : j.a) + '：' + j.reason)); });
      aj.links.push({ href: '#/jinxes', label: '全部相克规则' }, roleLink(r0));
      return aj;
    }

    /* 3) 局面分析（含"N号…"的实战局面描述 → 直接给结论） */
    var seatMentions = q.match(/(\d+)\s*号/g);
    var imRole = /我是|我玩|我扮演|我的角色是|我拿到的是/.test(q);
    var askDeduce = /怀疑|谁|分析|推理|怎么判断|该.*(提名|办|做|怎么)|怎么看|盘一盘|梳理/.test(q);
    if ((seatMentions && (seatMentions.length >= 2 ||
      (seatMentions.length === 1 && /自称|声称|说自己是|死了|出局|被处决|得知|得到|怀疑|谁|分析/i.test(q))))
      || (imRole && askDeduce)) {
      var as = answerSituation(q);
      if (as) return as;
    }

    /* 4) 夜晚顺序 */
    if (/顺序|第几夜|第几位|先后|先谁|谁先|先于|晚于|第几个|什么时候行动|几时行动/.test(q) && hits.length) return answerNightOrder(hits, q);

    /* 5) 配比 */
    if (e.n && (/配比|几个|多少|组成|配置|分布|怎么配/.test(q) || /镇民|外来者|爪牙|恶魔/.test(q))) {
      if (e.n >= 5 && e.n <= 20) return answerComp(e.n);
    }

    /* 6) 阵营判定 */
    if (hits.length === 1 && /是好人还是坏人|好还是坏|什么阵营|善良还是邪恶|是好的吗|是坏的吗|是好人是坏人|哪个阵营/.test(q)) {
      return answerTeamOf(hits[0].r, q);
    }

    /* 7) 两角色对比 */
    if (hits.length >= 2 && /区别|对比|比较|哪个好|有什么不同|差异|vs|还是/.test(q)) {
      return answerCompare(hits[0].r, hits[1].r, q);
    }

    /* 8) 剧本（命中剧本名即可） */
    var ae = answerEdition(q);
    if (ae) return ae;

    /* 9) 单/多角色解析（含"怎么运作/该给什么信息"） */
    if (hits.length === 1) {
      var a1 = answerRole(hits[0].r, q);
      if (window.BOTCAbility && BOTCAbility.has(hits[0].r.id) &&
        /两边|相邻|旁边|之间|都是|是邪恶|是善良|得到|得知|给几|给什么|知道什么|应该是|会知道|信息|怎么给|怎么算/.test(q)) {
        a1.title = '情境分析 · ' + hits[0].r.name;
        a1.sandbox = hits[0].r.id;
        var rn = hits[0].r.name;
        if (/都是善良|都是好人|全善良|都为善良/.test(q)) {
          a1.answer = '应该给「0」。两侧存活玩家都是善良 → 邪恶数量 = 0，' + rn + ' 得知的是邻座中邪恶玩家的数量（不是善良数量），所以全善良时告知 0 而不是 2。';
          a1.steps.unshift({ t: '🎯 结论提示', d: '若两侧存活玩家都是善良 → 邪恶数量 = 0，告知「0」。' });
        } else if (/都是邪恶|全邪恶|都为邪恶/.test(q)) {
          a1.answer = '应该给「2」。两侧存活玩家都是邪恶 → 邪恶数量 = 2。';
          a1.steps.unshift({ t: '🎯 结论提示', d: '若两侧都是邪恶 → 邪恶数量 = 2。' });
        }
        if (/两边|相邻|旁边|之间/.test(q)) a1.steps.unshift({ t: '🎯 你的问题', d: '你在问「两侧邻座」类信息，下方情境分析器已按座次环计算（取左右最近的两名存活玩家）。' });
      }
      return a1;
    }
    if (hits.length > 1) {
      var a3 = A('多角色解析', 'role');
      hits.forEach(function (h) { addRole(a3, h.r.id, '问题中提及'); });
      a3.verdict = '识别到 ' + hits.length + ' 个角色：' + hits.map(function (h) { return h.r.name; }).join('、') + '。下面逐一给出能力与关键点。';
      hits.forEach(function (h) {
        var r = h.r, p = nightPos(r);
        a3.steps.push({ t: r.name + '（' + (r.teamCn || TEAMCN[r.team]) + '）', d: (r.ability || '') + '　【首夜' + (p.f ? '第' + p.f + '位' : '不行动') + '/其他夜' + (p.o ? '第' + p.o + '位' : '不行动') + '】' });
        a3.cites.push(cite('官方魔典 · ' + r.name, r.ability));
        a3.links.push(roleLink(r));
      });
      var pairs = [];
      for (var x = 0; x < hits.length; x++) {
        for (var y = x + 1; y < hits.length; y++) {
          var j2 = jinxOf(hits[x].r.name, hits[y].r.name);
          if (j2) pairs.push(hits[x].r.name + ' × ' + hits[y].r.name + '：' + j2.reason);
        }
      }
      if (pairs.length) a3.warns = a3.warns.concat(pairs);
      else a3.tips.push('这些角色之间没有相克记录，可以正常同局。');
      a3.follow.push(hits[0].r.name + '和' + hits[1].r.name + '有什么区别？');
      return a3;
    }

    /* 10) 规则检索 */
    var rs2 = ruleSearch(q, 3);
    if (rs2.length && q.length >= 2) {
      var ar = answerRule(q);
      ar.similars = fullSearch(q, 6);
      return ar;
    }

    /* 11) 兜底全文检索 */
    return answerSearch(q);
  }

  /* ================= AI 增强：上下文组装 ================= */
  function aiContext(a, q) {
    var lines = [];
    (a.cites || []).slice(0, 6).forEach(function (c) { lines.push('[官方资料·' + c.src + '] ' + c.text); });
    (a.steps || []).slice(0, 6).forEach(function (s) { lines.push('[分析·' + s.t + '] ' + cut(s.d, 200)); });
    if (a.answer) lines.push('[本地引擎答案] ' + a.answer);
    if (a.verdict) lines.push('[本地引擎结论] ' + a.verdict);
    if (!lines.length) {
      fullSearch(q, 5).forEach(function (h) { lines.push('[检索·' + h.name + '] ' + (h.hit || h.sub || '')); });
    }
    return lines.join('\n');
  }
  var SYS = '你是《染·钟楼谜团》(Blood on the Clocktower) 的资深说书人与规则裁判。' +
    '只依据提供的【官方资料】回答；资料不足时先说明，再基于官方通用规则谨慎推理，不要编造角色能力。' +
    '回答结构：1) 一句话结论 2) 规则依据（引用资料）3) 说书人该怎么做（分步骤）4) 常见坑。中文、简洁、分点，不要客套。';

  /* ================= 情境沙盒（复用能力引擎） ================= */
  var SB = { roleId: null, n: 9, ed: 'tb', seats: null, selfN: 1, t1: null, t2: null };
  function sandboxRoles(ed, n) {
    if (window.BOTCGame && BOTCGame.rollPool) { try { return BOTCGame.rollPool(ed, n); } catch (err) { } }
    var c = compOf(n) || { townsfolk: 3, outsider: 0, minion: 1, demon: 1 };
    var out = [], pick = function (t, k) {
      var pool = D.roles.filter(function (r) { return r.edition === ed && r.team === t; });
      for (var i = 0; i < k; i++) out.push(pool.length ? pool[i % pool.length].id : 'imp');
    };
    pick('townsfolk', c.townsfolk || 0); pick('outsider', c.outsider || 0);
    pick('minion', c.minion || 0); pick('demon', c.demon || 0);
    while (out.length < n) out.push('imp');
    return out.slice(0, n);
  }
  function newSandbox(roleId, n) {
    SB.roleId = roleId; SB.n = n || SB.n;
    var r = byId[roleId]; SB.ed = (r && r.edition) || SB.ed;
    var ids = sandboxRoles(SB.ed, SB.n);
    if (ids.indexOf(roleId) < 0) ids[0] = roleId;
    SB.seats = ids.map(function (id, i) {
      return {
        n: i + 1, name: '玩家' + (i + 1), role: id, alive: true, traveler: false,
        st: { poison: false, drunk: false, protect: false, red: false, marks: [] },
        voted: false, nominated: false, deadDay: 0
      };
    });
    var me = SB.seats.filter(function (s) { return s.role === roleId; })[0];
    SB.selfN = me ? me.n : 1;
    SB.t1 = null; SB.t2 = null;
  }
  function sandboxCalc() {
    if (!SB.seats || !window.BOTCAbility) return null;
    var self = SB.seats[SB.selfN - 1];
    var ab = BOTCAbility.has(self.role) ? BOTCAbility.get(self.role) : null;
    if (!ab) return { none: true };
    var G = {
      v: 0, edition: SB.ed, day: 0, phase: 'night', night: 'first', nightStep: 0, nightActs: {},
      seats: SB.seats, noms: [], log: [], fabled: [], bluffs: null, winner: null
    };
    var ctx = BOTCAbility.buildCtx(G, self, { byId: byId, log: function () { }, save: function () { } });
    var t1 = SB.t1 ? SB.seats[SB.t1 - 1] : null;
    var t2 = SB.t2 ? SB.seats[SB.t2 - 1] : null;
    try { return { res: ab.calc(ctx, t1, t2), ab: ab, self: self }; }
    catch (err) { return { err: String(err && err.message || err) }; }
  }

  /* ================= 局面推理器 ================= */
  var DD = { n: 9, me: 'empath', claims: {}, known: {}, dead: {}, notes: '' };
  function dedReset(n) {
    DD.n = n || DD.n;
    DD.claims = {}; DD.known = {}; DD.dead = {}; DD.notes = '';
  }
  function dedAnalyze() {
    var n = DD.n, c = compOf(n) || { townsfolk: 3, outsider: 0, minion: 1, demon: 1 };
    var evilTotal = (c.minion || 0) + (c.demon || 0);
    var rows = [], i;
    for (i = 1; i <= n; i++) {
      rows.push({ n: i, claim: DD.claims[i] || '', known: DD.known[i] || '', dead: !!DD.dead[i], susp: 0, why: [] });
    }
    /* 声称冲突：同一角色被多人声称 */
    var byClaim = {};
    rows.forEach(function (r) { if (r.claim) { (byClaim[r.claim] = byClaim[r.claim] || []).push(r); } });
    Object.keys(byClaim).forEach(function (k) {
      var g = byClaim[k];
      if (g.length > 1) {
        g.forEach(function (r) { r.susp += 3; r.why.push('与 ' + g.map(function (x) { return x.n + '号'; }).join('/') + ' 声称同一个「' + (byId[k] ? byId[k].name : k) + '」→ 这组至少 ' + (g.length - 1) + ' 人在说谎'); });
      }
    });
    /* 已知真实身份 */
    rows.forEach(function (r) {
      if (!r.known) return;
      var kr = byId[r.known];
      if (!kr) return;
      if (kr.team === 'demon' || kr.team === 'minion') { r.susp += 10; r.why.push('已确认为' + kr.name + '（邪恶）'); }
      else { r.susp -= 5; r.why.push('已确认为' + kr.name + '（善良）'); }
      if (r.claim && r.claim !== r.known) { r.susp += 6; r.why.push('声称「' + (byId[r.claim] ? byId[r.claim].name : r.claim) + '」但实际是「' + kr.name + '」→ 说谎'); }
    });
    /* 声称邪恶角色 = 直接可疑（自愿承认邪恶一般只可能是间谍等） */
    rows.forEach(function (r) {
      var cr = r.claim ? byId[r.claim] : null;
      if (cr && (cr.team === 'demon' || cr.team === 'minion')) { r.susp += 4; r.why.push('公开声称自己是邪恶角色（多半是间谍/策略性发言）'); }
      if (cr && cr.team === 'outsider') { r.susp += 0.5; r.why.push('声称外来者：外来者数量有限，可对照配比核验'); }
    });
    /* 死亡但未确认身份 */
    rows.forEach(function (r) { if (r.dead && !r.known) r.why.push('已出局：若翻开身份请填入"已知身份"以提高精度'); });
    /* 名额推算 */
    var confirmedEvil = rows.filter(function (r) { return r.known && (byId[r.known] && (byId[r.known].team === 'demon' || byId[r.known].team === 'minion')); }).length;
    var left = evilTotal - confirmedEvil;
    rows.sort(function (a, b) { return b.susp - a.susp; });
    return { rows: rows, evilTotal: evilTotal, confirmedEvil: confirmedEvil, left: left, c: c };
  }

  /* ================= 自然语言局面解析 → 明确答案 ================= */
  var NAMES_LONGFIRST = null;
  function roleNameIn(seg) {
    if (!NAMES_LONGFIRST) {
      NAMES_LONGFIRST = ALL.map(function (r) { return r.name; })
        .concat(Object.keys(ALIAS))
        .filter(function (n) { return n.length >= 2; })
        .sort(function (a, b) { return b.length - a.length; });
    }
    var best = null, bestPos = 999;
    for (var i = 0; i < NAMES_LONGFIRST.length; i++) {
      var n = NAMES_LONGFIRST[i], p = seg.indexOf(n);
      if (p >= 0 && p < bestPos) { bestPos = p; best = n; }
    }
    if (!best) return null;
    var r = byName[best] || byName[ALIAS[best]];
    return r ? { r: r, pos: bestPos, name: best } : null;
  }
  function parseSituation(q) {
    var st = { n: 0, me: '', claims: {}, known: {}, dead: {}, infos: [], seats: [] };
    var mn = /(\d+)\s*[人位]/.exec(q);
    if (mn && +mn[1] >= 5 && +mn[1] <= 20) st.n = +mn[1];
    /* 我的角色 */
    var meM = /(?:我是|我玩|我扮演|我的角色是|作为|我拿到的是)\s*([^\s，。？?、]{2,8})/.exec(q);
    if (meM) { var mr = roleNameIn(meM[1]); if (mr) st.me = mr.r.id; }
    /* 座位提及 */
    var re = /(\d+)\s*号/g, m, pos = [];
    while ((m = re.exec(q))) pos.push({ n: +m[1], i: m.index });
    pos.forEach(function (p, k) {
      var end = (k + 1 < pos.length) ? pos[k + 1].i : q.length;
      var seg = q.slice(p.i, Math.min(end, p.i + 26));
      st.seats.push(p.n);
      if (/死|出局|被处决|被杀|死了|阵亡/.test(seg)) st.dead[p.n] = true;
      var f = roleNameIn(seg);
      if (f && f.pos <= 12) {
        var evilRole = (f.r.team === 'demon' || f.r.team === 'minion');
        if (/其实是|确实是|确认|真的是|翻开|已确认|真实是|就是/.test(seg)) st.known[p.n] = f.r.id;
        else if (evilRole && !/自称|声称|说自己是|喊|假装/.test(seg)) st.known[p.n] = f.r.id;  /* 没人会公开自称爪牙/恶魔 → 视为已确认 */
        else st.claims[p.n] = f.r.id;
      }
    });
    /* 信息数字：整句扫描（"首夜得知1""第二夜得知0"） */
    var reInfo = /(?:得知|得到|给的是|结果是|查到|告诉|显示|结果是)\s*(?:了)?\s*([0-9])/g, mi;
    while ((mi = reInfo.exec(q))) st.infos.push({ seat: null, v: +mi[1] });
    return st;
  }
  function answerSituation(q) {
    var st = parseSituation(q);
    /* 覆盖式写入推理器（自然语言描述的是新局面，先清空旧状态） */
    dedReset(st.n || DD.n);
    Object.keys(st.claims).forEach(function (k) { DD.claims[k] = st.claims[k]; });
    Object.keys(st.known).forEach(function (k) { DD.known[k] = st.known[k]; });
    Object.keys(st.dead).forEach(function (k) { DD.dead[k] = st.dead[k]; });

    var a = A('局面分析', 'situation');
    /* 涉及角色：按座位登记（"1号自称共情者"这类） */
    if (st.me) addRole(a, st.me, '你的角色');
    Object.keys(st.claims).forEach(function (k) { addRole(a, st.claims[k], k + '号自称'); });
    Object.keys(st.known).forEach(function (k) { addRole(a, st.known[k], k + '号已确认'); });
    if (!a.roles.length) findRoles(q).slice(0, 5).forEach(function (h) { addRole(a, h.r.id, '问题中提及'); });
    var res = dedAnalyze();
    var rows = res.rows.slice().sort(function (x, y) { return y.susp - x.susp; });
    var knownEvils = rows.filter(function (r) { return r.known && (byId[r.known].team === 'demon' || byId[r.known].team === 'minion'); });
    var conflicts = rows.filter(function (r) { return r.susp >= 3 && knownEvils.indexOf(r) < 0; });
    var aliveN = res.rows.filter(function (r) { return !r.dead; }).length;
    var caveats = '注意中毒/醉酒、间谍、疯子、提线木偶都会让"声称 ≠ 真相"，别只凭逻辑定死罪。';

    /* ✅ 直接给结论 */
    if (conflicts.length) {
      var t1 = conflicts[0];
      a.answer = '该怀疑的是 ' + t1.n + ' 号' + (conflicts[1] ? ' 和 ' + conflicts[1].n + ' 号' : '') + '：' + (t1.why[0] || '信息矛盾集中在他身上') + '。' +
        '建议今天优先向 ' + t1.n + ' 号施压或提名，逼他解释自己的声称' +
        (knownEvils.length ? '；已确认的邪恶是 ' + knownEvils.map(function (r) { return r.n + '号(' + byId[r.known].name + ')'; }).join('、') +
          '，邪恶名额还剩 ' + Math.max(0, res.left) + ' 个' : '') + '。' + caveats;
    } else if (knownEvils.length) {
      a.answer = '已确认的邪恶是 ' + knownEvils.map(function (r) { return r.n + '号 ' + byId[r.known].name; }).join('、') +
        '（名额 ' + res.confirmedEvil + '/' + res.evilTotal + '，还剩 ' + Math.max(0, res.left) + ' 个）。' +
        '目前没有形成声称冲突，' + (Math.max(0, res.left) > 0
          ? '下一步应逼出更多声称：让还没报角色的人依次公开身份，重点比对重复声称与外来者数量。'
          : '邪恶名额已全部确认，其余存活玩家可视为善良，直接收官。') + caveats;
    } else {
      var deadList = Object.keys(st.dead).map(function (k) { return k + '号'; });
      var frame = '现在还定位不了坏人：' + (DD.n ? DD.n + ' 人局邪恶共 ' + res.evilTotal + ' 人（爪牙' + (res.c.minion || 0) + '+恶魔' + (res.c.demon || 0) + '）' : '还没给出人数') +
        (deadList.length ? '，' + deadList.join('、') + '已出局' : '') + '。';
      if (st.me) {
        var mr = byId[st.me];
        var extra = st.infos.length
          ? '你提供的信息：' + st.infos.map(function (x) { return '得知 ' + x.v; }).join('、') +
            (mr.id === 'empath' ? '（共情者：这个数字 = 你两侧存活邻座里的邪恶数量；邻座会随死亡变化，两次信息的对象不同，不能直接相加，要分别对照当时的邻座）' : '')
          : '（你还没告诉我你得知的数字）';
        frame = '你是' + mr.name + '：' + abilityBrief(mr) + '。' + extra + '。' + frame;
      }
      a.answer = frame + '下一步：① 让每个人依次公开声称的角色（找重复声称 = 找说谎者）；② 记录已出局者翻开的身份；' +
        (st.infos.length ? '③ 把你每一夜的两侧邻座告诉我，我就能用你上面的数字直接锁人。'
          : '③ 把你掌握的信息数字告诉我（如"我共情者首夜得知 1"）。');
    }

    /* 分析过程 */
    var sit = [];
    if (st.n) sit.push('人数 ' + st.n + ' 人');
    if (st.me) sit.push('你的角色：' + byId[st.me].name);
    var cl = Object.keys(st.claims).map(function (k) { return k + '号自称' + byId[st.claims[k]].name; });
    if (cl.length) sit.push('声称：' + cl.join('、'));
    var kn = Object.keys(st.known).map(function (k) { return k + '号实为' + byId[st.known[k]].name; });
    if (kn.length) sit.push('已确认身份：' + kn.join('、'));
    var dd = Object.keys(st.dead).map(function (k) { return k + '号'; });
    if (dd.length) sit.push('已出局：' + dd.join('、'));
    if (st.infos.length) sit.push('信息数字：' + st.infos.map(function (x) { return x.seat + '号→' + x.v; }).join('、'));
    a.steps.push({ t: '① 我识别到的局面', d: sit.length ? sit.join('；') : '（没能解析出具体座位信息，请在下方推理器里手动填）' });
    a.steps.push({ t: '② 邪恶名额', d: '本局邪恶共 ' + res.evilTotal + ' 人（爪牙' + (res.c.minion || 0) + ' + 恶魔' + (res.c.demon || 0) + '），已确认 ' + res.confirmedEvil + ' 人，还差 ' + Math.max(0, res.left) + ' 人。' });
    a.steps.push({ t: '③ 矛盾检测', d: conflicts.length ? conflicts.map(function (r) { return r.n + '号：' + r.why.join('；'); }).join('　｜　') : '未发现声称冲突。' });
    if (conflicts.length || knownEvils.length) {
      a.steps.push({ t: '④ 嫌疑排序', d: rows.filter(function (r) { return r.susp > 0; }).slice(0, 5).map(function (r, i) { return (i + 1) + '. ' + r.n + '号（' + r.susp.toFixed(1) + '）' + (r.why.length ? '：' + r.why[0] : ''); }).join('　') });
      var focus = conflicts.length ? conflicts[0] : knownEvils[0];
      a.steps.push({ t: '⑤ 建议行动', d: '今天把火力放在 ' + focus.n + ' 号：先要求他解释声称，再对照已确认身份；存活 ' + aliveN + ' 人，处决需要 ' + execThreshold(aliveN) + ' 票。' });
    } else {
      a.steps.push({ t: '④ 还缺什么', d: '至少再要 2 条声称，或 1 个已确认身份 + 1 条信息数字，才能定位矛盾。' });
    }
    if (st.me) {
      a.steps.push({ t: '⑥ 你的角色', d: byId[st.me].name + '：' + abilityBrief(byId[st.me]) + (st.infos.length ? '　你提供的数字：' + st.infos.map(function (x) { return x.v; }).join('、') : '') });
    }
    if (st.infos.length) {
      a.tips.push('你提供的信息数字（' + st.infos.map(function (x) { return '得知 ' + x.v; }).join('、') +
        '）：若你未中毒/醉酒，这就是确定线索——把它和当时的座次环对照，能直接圈出嫌疑范围。');
    }
    a.warns.push('以上是基于你提供的信息做的逻辑推演，不是官方规则；中毒/醉酒、间谍、疯子、提线木偶都会让"声称"与"真相"不一致。');
    a.tips.push('已把解析结果填入下方「🧩 局面推理器」，可以直接改座位继续推演。');
    a.follow.push('恶魔死了游戏就结束吗？', '7人存活需要几票？', '处决门槛怎么算？');
    return a;
  }

  /* ================= 当前对局上下文 ================= */
  function gameCtx() {
    var G = window.BOTCGame && BOTCGame.get ? BOTCGame.get() : null;
    if (!G || !G.seats) return null;
    var alive = G.seats.filter(function (s) { return s.alive; }).length;
    var key = (G.phase === 'setup' || G.day === 0) ? 'first' : (G.night || 'first');
    var src = D.nightOrder[key] || [];
    var present = {}; G.seats.forEach(function (s) { if (s.role) present[s.role] = s; });
    var step = G.nightStep || 0, next = null;
    for (var i = step; i < src.length && !next; i++) { if (present[src[i].id]) next = { i: i, x: src[i], seat: present[src[i].id] }; }
    return { G: G, alive: alive, key: key, next: next, total: src.length };
  }
  function answerGame() {
    var gc = gameCtx();
    var a = A('当前对局 · 说书人下一步', 'game');
    if (!gc) { a.answer = '当前没有进行中的对局，先去「🕯️ 开局」创建一局，再回来问"我现在该做什么"。'; a.links.push({ href: '#/game/new', label: '去开一局' }); return a; }
    var G = gc.G;
    a.verdict = '当前：' + (window.BOTCGame.edName ? BOTCGame.edName(G.edition) : G.edition) + ' · ' +
      (G.day === 0 ? '设置/首夜' : '第 ' + G.day + ' 天') + ' · 阶段「' + (G.phase === 'night' ? '夜晚' : G.phase === 'day' ? '白天' : '设置') + '」 · 存活 ' + gc.alive + '/' + G.seats.length + ' 人。';
    if (G.phase === 'night' || G.day === 0) {
      if (gc.next) {
        a.answer = '下一步：唤醒 ' + gc.next.x.name + (gc.next.seat ? '（' + gc.next.seat.n + '号 ' + gc.next.seat.name + '）' : '') +
          ' —— ' + ((window.BOTCAbility && BOTCAbility.has(gc.next.x.id) && BOTCAbility.get(gc.next.x.id).hint) || abilityBrief(byId[gc.next.x.id] || {})) +
          ' 完成后再叫下一位。';
        a.steps.push({ t: '① 当前该唤醒', d: gc.next.x.name + '（本夜第 ' + (gc.next.i + 1) + ' 步）' + (gc.next.seat ? ' → ' + gc.next.seat.n + '号 ' + gc.next.seat.name : '') + '。' });
        var ab = window.BOTCAbility && BOTCAbility.has(gc.next.x.id) ? BOTCAbility.get(gc.next.x.id) : null;
        if (ab) a.steps.push({ t: '② 能力提示', d: ab.hint || (byId[gc.next.x.id] ? byId[gc.next.x.id].ability : '') });
      } else { a.answer = '本夜顺序已走完，可以宣布天亮、进入白天（存活 ' + gc.alive + ' 人，今天处决需要 ' + execThreshold(gc.alive) + ' 票）。'; a.steps.push({ t: '① 当前该做', d: '本夜顺序已走完，可以进入天亮/白天。' }); }
      a.steps.push({ t: '③ 处决门槛预告', d: '若白天存活 ' + gc.alive + ' 人，需要 ' + execThreshold(gc.alive) + ' 票才能处决。' });
    } else {
      a.answer = '现在是白天：先讨论，再走提名 → 顺时针举手投票，存活 ' + gc.alive + ' 人，处决需要 ' + execThreshold(gc.alive) + ' 票；没人提名或票数不够就直接进夜晚。';
      a.steps.push({ t: '① 白天流程', d: '讨论 → 提名（每人每天限提名/被提名各 1 次）→ 顺时针举手 → 票数 ≥ ' + execThreshold(gc.alive) + ' 票则处决。' });
      var noNominated = G.seats.filter(function (s) { return s.alive && !s.nominated; }).length;
      a.steps.push({ t: '② 提名情况', d: '还有 ' + noNominated + ' 名存活玩家今天没提名过。' });
    }
    var setupRoles = G.seats.filter(function (s) { var r = byId[s.role]; return r && r.setup; });
    if (setupRoles.length && G.day === 0) a.warns.push('设置阶段未处理：' + setupRoles.map(function (s) { return byId[s.role].name; }).join('、'));
    var jx = window.BOTCGame.jinxCheck ? BOTCGame.jinxCheck(G.seats.map(function (s) { return s.role; })) : [];
    if (jx.length) a.warns.push('本局存在相克：' + jx.join('；'));
    var bad = G.seats.filter(function (s) { return s.st && (s.st.poison || s.st.drunk); });
    if (bad.length) a.tips.push('当前有状态标记：' + bad.map(function (s) { return s.n + '号' + (s.st.poison ? '中毒' : '') + (s.st.drunk ? '醉酒' : ''); }).join('、') + ' → 给他们信息时可以给假信息。');
    a.tips.push('恶魔出局即结束（红唇女郎/僵怖/小恶魔传刀除外）；存活降到 2 人则邪恶获胜。');
    a.links.push({ href: '#/game', label: '回到魔典' }, { href: '#/analyze', label: '复盘分析' });
    a.follow.push('恶魔死了游戏就结束吗？', '处决门槛怎么算？');
    return a;
  }

  /* ================= 渲染 ================= */
  var UIQ = { q: '', ans: null, ai: '', aiState: 0, aiErr: '', set: false };

  function render() {
    var h = '<div class="backbar"><button data-qback="1">‹ 首页</button><span style="font-size:12px;color:var(--text-faint)">智能问答 · 局面分析</span>' +
      '<button data-qset="1" style="margin-left:auto">⚙ AI</button></div>';

    var gc = gameCtx();
    if (gc) {
      h += '<div class="card" style="margin-top:10px;padding:10px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<div style="font-size:13px;flex:1;min-width:180px">📌 已接入当前对局：' + esc(window.BOTCGame.edName(gc.G.edition)) + ' · ' +
        (gc.G.day === 0 ? '首夜' : '第' + gc.G.day + '天') + ' · 存活 ' + gc.alive + '/' + gc.G.seats.length + '</div>' +
        '<button class="chip" data-qask="现在该做什么？">我现在该做什么？</button></div>';
    }

    h += '<div class="card" style="padding:12px 14px">' +
      '<textarea id="qq" class="sel" style="min-height:76px" placeholder="输入你的问题，例如：&#10;· 共情者两边都是善良应该给几？&#10;· 小恶魔和男爵能同局吗？&#10;· 送葬者第几夜行动？&#10;· 10人局几个外来者？&#10;· 现在该做什么？（结合当前对局）">' + esc(UIQ.q) + '</textarea>' +
      '<div class="qbtns" style="margin-top:8px"><button class="btn primary" data-qgo="1">🔍 解答并分析</button>' +
      '<button class="btn" data-qclear="1">清空</button></div>' +
      (UIQ.set ? aiSetHtml() : '') +
      '<div class="ftl">常见问题（点击直接问）</div><div class="chips">' +
      ['共情者两边都是善良应该给几？', '恶魔死了游戏就结束吗？', '小恶魔和红唇女郎能同局吗？',
        '送葬者第几夜行动？', '10人局几个外来者？', '中毒和醉酒有什么区别？',
        '提名和投票怎么算？', '7人存活需要几票？', '首夜流程怎么走？', '新手玩哪个剧本？'].map(function (t) {
          return '<button class="chip" data-qask="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') + '</div></div>';

    if (UIQ.ans) {
      h += ansHtml(UIQ.ans);
      h += '<div class="card" style="margin-top:10px;padding:12px 14px" id="aibox">' + aiBoxHtml() + '</div>';
    }
    h += sandboxHtml();
    h += dedHtml();
    view().innerHTML = h;

    var box = $('#qq');
    if (box) box.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) doAsk();
    });
    var ps = $('#qspreset');
    if (ps) ps.addEventListener('change', function () {
      var p = window.BOTCAI.PRESETS[ps.value];
      if (!p) return;
      if (p.url) { var u = $('#qsurl'); if (u) u.value = p.url; }
      if (p.model) { var m = $('#qsmodel'); if (m) m.value = p.model; }
    });
  }

  function aiSetHtml() {
    if (!window.BOTCAI) return '<div class="note">AI 模块未加载，请刷新页面。</div>';
    var c = BOTCAI.cfg();
    var opts = Object.keys(BOTCAI.PRESETS).map(function (k) {
      return '<option value="' + k + '"' + (c.preset === k ? ' selected' : '') + '>' + esc(BOTCAI.PRESETS[k].name) + '</option>';
    }).join('');
    return '<div class="aiset" style="margin-top:10px">' +
      '<div class="ftl">🤖 AI 深度分析（可选 · 配置只存本机浏览器）</div>' +
      '<div class="note" style="padding:6px 0">不配置也能用：上面的本地规则引擎已能回答绝大多数规则问题。配置后，回答会额外给出大模型结合官方资料的深度分析。</div>' +
      '<div class="qrow"><label>服务商</label><select id="qspreset">' + opts + '</select></div>' +
      '<div class="qrow"><label>Base&nbsp;URL</label><input id="qsurl" class="sel" value="' + esc(c.url || '') + '" placeholder="https://api.deepseek.com/v1"></div>' +
      '<div class="qrow"><label>API&nbsp;Key</label><input id="qskey" class="sel" type="password" value="' + esc(c.key || '') + '" placeholder="sk-..."></div>' +
      '<div class="qrow"><label>模型</label><input id="qsmodel" class="sel" value="' + esc(c.model || '') + '" placeholder="deepseek-chat"></div>' +
      '<div class="qbtns" style="margin-top:8px">' +
      '<button class="btn primary" data-qssave="1">保存并启用</button>' +
      '<button class="btn" data-qsping="1">测试连接</button>' +
      '<button class="btn danger" data-qsclear="1">清除</button></div>' +
      '<div id="qsmsg" class="note" style="padding:6px 0">状态：' + (BOTCAI.on() ? '✅ 已启用（模型 ' + esc(c.model) + '）' : '未启用 · 仅本地引擎') + '</div>' +
      '<div class="note" style="padding:0 0 4px">提示：直接从浏览器调用需要接口允许跨域（CORS）。若报跨域错误，请填自建代理地址（自定义）。Key 仅保存在你本机 localStorage，不会上传到本站点。</div>' +
      '</div>';
  }

  function aiBoxHtml() {
    if (!window.BOTCAI || !BOTCAI.on()) {
      return '<div class="ftl">🤖 AI 深度分析</div><div class="note" style="padding:0">未启用。点右上「⚙ AI」填 Base URL / API Key / 模型即可开启；不开启也不影响上面的本地解答。</div>';
    }
    if (UIQ.aiState === 1) {
      return '<div class="ftl">🤖 AI 深度分析</div><div class="md">' + BOTCAI.md(UIQ.ai) + '<span class="aicursor">▍</span></div>' +
        '<button class="btn" data-qstop="1" style="margin-top:8px">停止</button>';
    }
    if (UIQ.aiState === 3) {
      return '<div class="ftl">🤖 AI 深度分析</div><div class="abox warn"><b>调用失败</b><div>' + esc(UIQ.aiErr || '') + '</div></div>' +
        '<button class="btn" data-qai="1" style="margin-top:8px">重试</button>';
    }
    if (UIQ.aiState === 2) {
      return '<div class="ftl">🤖 AI 深度分析</div><div class="md">' + BOTCAI.md(UIQ.ai) + '</div>';
    }
    return '<div class="ftl">🤖 AI 深度分析</div>' +
      '<button class="btn primary" data-qai="1">用 AI 结合官方资料深度分析这个问题</button>';
  }

  function ansHtml(a) {
    var h = '<div id="ansbox" class="card" style="margin-top:12px;padding:12px 14px">';
    h += '<div class="ftl">' + esc(a.title) + '</div>';
    if (a.answer) h += '<div class="abox ans"><b>✅ 直接答案</b><div class="anstext">' + esc(a.answer) + '</div></div>';
    if (a.verdictHtml) h += '<div class="abox"><b>结论</b><div>' + a.verdictHtml + '</div></div>';
    else if (a.verdict) h += '<div class="abox"><b>结论</b><div>' + esc(a.verdict) + '</div></div>';
    if (a.why) h += a.why;

    /* 本题涉及的角色 */
    if (a.roles && a.roles.length) {
      h += '<div class="ftl">🎭 本题涉及的角色</div>';
      h += a.roles.slice(0, 8).map(function (x) {
        var r = byId[x.id]; if (!r) return '';
        var p = nightPos(r);
        var evil = (r.team === 'demon' || r.team === 'minion');
        var jx = jinxListOf(r.name).length;
        return '<a class="rcard" href="#/role/' + r.id + '">' +
          '<div class="rcnm">' + esc(r.name) +
          '<span class="tag" style="' + (evil ? 'color:var(--evil);border-color:#eecfd3' : 'color:var(--good);border-color:#cfe3d0') + '">' +
          esc(r.teamCn || TEAMCN[r.team]) + '</span>' +
          (x.note ? '<span class="rcnote">' + esc(x.note) + '</span>' : '') + '</div>' +
          '<div class="rcab">' + esc(r.ability || '') + '</div>' +
          '<div class="rcmeta">' + esc(r.editionCn || '—') + ' ・ ' +
          (p.f || p.o ? '首夜' + (p.f ? '第' + p.f + '位' : '不行动') + '／其他夜' + (p.o ? '第' + p.o + '位' : '不行动') : '夜晚不行动') +
          (jx ? ' ・ ⚠相克 ' + jx + ' 条' : '') + ' ・ 查看详情 →</div>' +
          '</a>';
      }).join('');
    }

    if (a.steps && a.steps.length) {
      h += '<div class="ftl">分析过程</div>';
      h += a.steps.map(function (s) {
        return '<div class="anstep"><div class="anst">' + esc(s.t) + '</div><div class="ansd">' + esc(s.d) + '</div></div>';
      }).join('');
    }
    if (a.cites && a.cites.length) {
      h += '<div class="ftl">官方依据</div>';
      h += a.cites.slice(0, 6).map(function (c) {
        return '<div class="cite"><div class="csrc">📖 ' + esc(c.src) + '</div><div class="ctext">' + esc(c.text) + '</div></div>';
      }).join('');
    }
    if (a.warns && a.warns.length) {
      h += '<div class="abox warn"><b>⚠ 注意</b>' + a.warns.map(function (s) { return '<div>' + esc(s) + '</div>'; }).join('') + '</div>';
    }
    if (a.tips && a.tips.length) {
      h += '<div class="abox tip"><b>💡 说书人提示</b>' + a.tips.map(function (s) { return '<div>' + esc(s) + '</div>'; }).join('') + '</div>';
    }
    var links = (a.links || []).concat((a.similars || []).map(function (s) {
      return { href: s.t === 'role' ? '#/role/' + s.id : s.t === 'rule' ? '#/rule/' + s.id : '#/jinxes', label: s.name };
    }));
    if (links.length) {
      h += '<div class="ftl">相关条目</div><div class="chips">' +
        uniq(links.map(function (l) { return l.href + '|' + l.label; })).slice(0, 14).map(function (x) {
          var p = x.split('|');
          return '<a class="chip" href="' + p[0] + '">' + esc(p[1]) + '</a>';
        }).join('') + '</div>';
    }
    if (a.follow && a.follow.length) {
      h += '<div class="ftl">继续追问</div><div class="chips">' +
        uniq(a.follow).slice(0, 6).map(function (t) {
          return '<button class="chip" data-qask="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') + '</div>';
    }
    h += '</div>';
    return h;
  }

  /* ---------------- 情境分析器 ---------------- */
  function sandboxHtml() {
    var able = ALL.filter(function (r) { return window.BOTCAbility && BOTCAbility.has(r.id); });
    var h = '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">🎯 情境分析器（推演某角色此刻会得到什么信息）</div>';
    h += '<div class="qrow"><label>角色</label><select id="sbrole">' +
      able.map(function (r) {
        return '<option value="' + r.id + '"' + (SB.roleId === r.id ? ' selected' : '') + '>' + esc(r.name) + '（' + (r.teamCn || TEAMCN[r.team]) + '）</option>';
      }).join('') + '</select></div>';
    h += '<div class="qrow"><label>人数</label><select id="sbn">' +
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (n) {
        return '<option value="' + n + '"' + (SB.n === n ? ' selected' : '') + '>' + n + ' 人</option>';
      }).join('') + '</select></div>';
    h += '<div class="qbtns" style="margin-top:8px"><button class="btn primary" data-sbnew="1">🎲 生成新局面</button>' +
      (SB.seats ? '<button class="btn" data-sbcalc="1">重新计算</button>' : '') + '</div>';

    if (SB.seats) {
      var ab = window.BOTCAbility && BOTCAbility.has(SB.seats[SB.selfN - 1].role) ? BOTCAbility.get(SB.seats[SB.selfN - 1].role) : null;
      h += '<div class="note">下面每个座位可改角色、切换存活 / 中毒 / 醉酒；<b>你（' + SB.selfN + '号）是 ' +
        esc(byId[SB.seats[SB.selfN - 1].role].name) + '</b>。' + (ab && ab.hint ? '能力提示：' + esc(ab.hint) : '') + '</div>';
      if (ab && ab.targets >= 1) h += '<div class="qrow"><label>目标1</label><select id="sbt1">' + optSeats(SB.t1, SB.selfN) + '</select></div>';
      if (ab && ab.targets >= 2) h += '<div class="qrow"><label>目标2</label><select id="sbt2">' + optSeats(SB.t2, SB.selfN) + '</select></div>';
      h += '<div class="stwrap"><table class="sttable"><thead><tr><th>座</th><th>角色</th><th>操作</th></tr></thead><tbody>' +
        SB.seats.map(function (s) {
          var r = byId[s.role];
          return '<tr class="' + (s.alive ? '' : 'dead') + '"><td>' + s.n + (s.n === SB.selfN ? ' 👤' : '') + '</td>' +
            '<td><select data-sbrole="' + s.n + '">' + optsAll(s.role, false) + '</select></td>' +
            '<td><button class="chip' + (s.alive ? '' : ' on') + '" data-sbkill="' + s.n + '">' + (s.alive ? '存活' : '死亡') + '</button> ' +
            '<button class="chip' + (s.st.poison ? ' on' : '') + '" data-sbps="' + s.n + '">中毒</button> ' +
            '<button class="chip' + (s.st.drunk ? ' on' : '') + '" data-sbdk="' + s.n + '">醉酒</button></td></tr>';
        }).join('') + '</tbody></table></div>';

      var c = sandboxCalc();
      h += '<div class="ftl">计算结果</div>';
      if (!c) h += '<div class="note">该角色暂无内置计算。</div>';
      else if (c.err) h += '<div class="abox warn">计算出错：' + esc(c.err) + '</div>';
      else if (c.none) h += '<div class="note">该角色没有内置自动计算，请参考角色能力文本手动处理。</div>';
      else {
        var res = c.res;
        h += '<div class="abox"><b>应告知的信息</b><div style="font-size:17px;font-weight:800">' + esc(res.info) + '</div></div>';
        if (res.detail) h += '<div class="abox tip"><b>推演过程</b><div style="white-space:pre-line">' + esc(res.detail) + '</div></div>';
        if (res.say) h += '<div class="abox"><b>建议话术</b><div>' + esc(res.say) + '</div></div>';
        if (res.warn) h += '<div class="abox warn">' + esc(res.warn) + '</div>';
      }
      var warns = [];
      var DISTURB = {
        poisoner: '投毒者：每夜可让一名玩家中毒，信息类能力可能得到假信息。',
        spy: '间谍：可以看到魔典，邪恶方掌握全部信息。',
        drunk: '酒鬼：自认为某个镇民，其实能力无效。',
        recluse: '陌客：可能被邪恶能力误判为邪恶。',
        saint: '圣徒：被处决则邪恶方获胜，白天要格外小心。',
        butler: '管家：投票受主人限制。',
        scarlet_woman: '红唇女郎：恶魔死后可能接任，别急着宣告结束。',
        zombuul: '僵怖：第一次死亡是假死。',
        lunatic: '疯子：自认为是恶魔，实为镇民。',
        marionette: '提线木偶：不知道自己是邪恶。'
      };
      SB.seats.forEach(function (s) { if (DISTURB[s.role] && s.n !== SB.selfN) warns.push(DISTURB[s.role]); });
      SB.seats.forEach(function (s) {
        var r2 = byId[s.role];
        if (r2 && r2.setup) warns.push('⚙ ' + r2.name + ' 需要「设置阶段」处理，别忘在首夜前完成。');
      });
      for (var i = 0; i < SB.seats.length; i++) {
        for (var j = i + 1; j < SB.seats.length; j++) {
          var jx = jinxOf(byId[SB.seats[i].role].name, byId[SB.seats[j].role].name);
          if (jx) warns.push('⚠ 本局面存在相克：' + jx.a + ' × ' + jx.b + ' —— ' + jx.reason);
        }
      }
      if (warns.length) {
        h += '<div class="ftl">本局面提醒</div><div class="abox warn">' +
          uniq(warns).map(function (w) { return '<div>' + esc(w) + '</div>'; }).join('') + '</div>';
      }
    }
    h += '</div>';
    return h;
  }
  function optSeats(cur, selfN) {
    return '<option value="">—</option>' + SB.seats.map(function (s) {
      if (s.n === selfN) return '';
      return '<option value="' + s.n + '"' + (cur === s.n ? ' selected' : '') + '>' + s.n + '号 ' + esc(byId[s.role].name) + '</option>';
    }).join('');
  }

  /* ---------------- 局面推理器 UI ---------------- */
  function dedHtml() {
    var res = dedAnalyze();
    var h = '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">🧩 局面推理器（填进已知信息 → 自动找矛盾、排嫌疑）</div>';
    h += '<div class="qrow"><label>人数</label><select id="dedn">' +
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (n) {
        return '<option value="' + n + '"' + (DD.n === n ? ' selected' : '') + '>' + n + ' 人</option>';
      }).join('') + '</select></div>';
    h += '<div class="qbtns" style="margin-top:8px"><button class="btn primary" data-dedcalc="1">重新推理</button>' +
      '<button class="btn" data-dedreset="1">清空</button></div>';
    h += '<div class="note">填法：①「声称」= 该玩家公开自称的角色；②「已知」= 已翻开的真实身份（复盘或已出局揭示时填）；③ 勾「死亡」。推理基于逻辑矛盾，非官方规则。</div>';
    h += '<div class="stwrap"><table class="sttable"><thead><tr><th>座</th><th>声称</th><th>已知真实身份</th><th>状态</th></tr></thead><tbody>';
    res.rows.slice().sort(function (a, b) { return a.n - b.n; }).forEach(function (r) {
      h += '<tr class="' + (r.dead ? 'dead' : '') + '"><td>' + r.n + '</td>' +
        '<td><select data-dedclaim="' + r.n + '">' + optsAll(r.claim, true) + '</select></td>' +
        '<td><select data-dedknown="' + r.n + '">' + optsAll(r.known, true) + '</select></td>' +
        '<td><button class="chip' + (r.dead ? ' on' : '') + '" data-deddead="' + r.n + '">' + (r.dead ? '出局' : '存活') + '</button></td></tr>';
    });
    h += '</tbody></table></div>';

    h += '<div class="ftl">推理结论</div>';
    h += '<div class="abox"><b>邪恶名额</b><div>本局邪恶共 ' + res.evilTotal + ' 人（爪牙' + (res.c.minion || 0) + ' + 恶魔' + (res.c.demon || 0) + '）' +
      '；已确认 ' + res.confirmedEvil + ' 人，还差 ' + Math.max(0, res.left) + ' 人未找出。</div></div>';
    var top = res.rows.filter(function (r) { return r.susp > 0; }).slice(0, 5);
    if (top.length) {
      h += '<div class="abox warn"><b>🚨 嫌疑排序</b>' + top.map(function (r, i) {
        return '<div>' + (i + 1) + '. ' + r.n + '号（可疑度 ' + r.susp.toFixed(1) + '）：' + esc(r.why.join('；') || '—') + '</div>';
      }).join('') + '</div>';
      h += '<div class="abox tip"><b>建议行动</b><div>优先向「' + top[0].n + '号」施压或提名；' +
        '若他声称的角色已被他人证实，可直接点破矛盾。注意：中毒/醉酒、间谍、疯子会让"声称"与"真相"不一致，别只凭逻辑定罪。</div></div>';
    } else {
      h += '<div class="note">当前信息不足以定位矛盾。多填几名玩家的声称/已知身份，或等第二天的信息后再推理。</div>';
    }
    var dead = res.rows.filter(function (r) { return r.dead; });
    if (dead.length) h += '<div class="note">已出局：' + dead.map(function (r) { return r.n + '号' + (r.known ? '（' + byId[r.known].name + '）' : ''); }).join('、') + '</div>';
    h += '</div>';
    return h;
  }

  /* ================= 交互 ================= */
  function doAsk() {
    var box = $('#qq');
    UIQ.q = box ? box.value.trim() : '';
    if (!UIQ.q) { alert('请输入你的问题'); return; }
    if (/^(现在该做什么|现在该怎么做|下一步|接下来)/.test(UIQ.q)) UIQ.ans = answerGame();
    else UIQ.ans = analyze(UIQ.q);
    UIQ.ai = ''; UIQ.aiState = 0; UIQ.aiErr = ''; AIHANDLER = null;
    if (UIQ.ans && UIQ.ans.sandbox && (!SB.roleId || SB.roleId !== UIQ.ans.sandbox)) newSandbox(UIQ.ans.sandbox, SB.n);
    render();
    var el = $('#ansbox'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.BOTCAI && BOTCAI.on() && UIQ.auto) runAI();
  }
  var AIHANDLER = null;
  function runAI() {
    if (!window.BOTCAI || !BOTCAI.on() || !UIQ.ans) return;
    if (UIQ.aiState === 1) return;
    UIQ.ai = ''; UIQ.aiErr = ''; UIQ.aiState = 1;
    render();
    var ctx = aiContext(UIQ.ans, UIQ.q);
    var user = '【玩家/说书人的问题】\n' + UIQ.q + '\n\n【官方资料（来自本工具内置魔典与百科）】\n' + ctx;
    AIHANDLER = BOTCAI.call({
      system: SYS, user: user,
      onDelta: function (d, full) {
        UIQ.ai = full;
        var box = $('#aibox');
        if (box) box.innerHTML = aiBoxHtml();
      },
      onDone: function (full) { UIQ.ai = full; UIQ.aiState = 2; AIHANDLER = null; var box = $('#aibox'); if (box) box.innerHTML = aiBoxHtml(); },
      onError: function (msg, full) { UIQ.ai = full || UIQ.ai; UIQ.aiErr = msg; UIQ.aiState = 3; AIHANDLER = null; var box = $('#aibox'); if (box) box.innerHTML = aiBoxHtml(); }
    });
  }

  function readSB() {
    if (!SB.seats) return;
    var t1 = $('#sbt1'), t2 = $('#sbt2');
    SB.t1 = t1 && t1.value ? +t1.value : null;
    SB.t2 = t2 && t2.value ? +t2.value : null;
  }
  function readDD() {
    var n = $('#dedn');
    if (n) DD.n = +n.value;
  }

  document.addEventListener('click', function (e) {
    var el;
    if (e.target.closest('[data-qback]')) { location.hash = '#/home'; return; }
    if (e.target.closest('[data-qgo]')) { doAsk(); return; }
    if (e.target.closest('[data-qclear]')) { UIQ.q = ''; UIQ.ans = null; UIQ.ai = ''; UIQ.aiState = 0; render(); return; }
    if (e.target.closest('[data-qset]')) { UIQ.set = !UIQ.set; render(); return; }
    if (e.target.closest('[data-qai]')) { runAI(); return; }
    if (e.target.closest('[data-qstop]')) { if (AIHANDLER) AIHANDLER.abort(); UIQ.aiState = UIQ.ai ? 2 : 0; render(); return; }
    if (e.target.closest('[data-qssave]')) {
      var c = {
        preset: $('#qspreset') ? $('#qspreset').value : 'deepseek',
        url: ($('#qsurl') ? $('#qsurl').value : '').trim(),
        key: ($('#qskey') ? $('#qskey').value : '').trim(),
        model: ($('#qsmodel') ? $('#qsmodel').value : '').trim()
      };
      window.BOTCAI.save(c);
      UIQ.set = false;
      render();
      var m = $('#qsmsg'); if (m) m.textContent = '已保存：' + (BOTCAI.on() ? '✅ 已启用' : '⚠ 未完整，仍用本地引擎');
      return;
    }
    if (e.target.closest('[data-qsping]')) {
      var c2 = {
        preset: $('#qspreset') ? $('#qspreset').value : 'deepseek',
        url: ($('#qsurl') ? $('#qsurl').value : '').trim(),
        key: ($('#qskey') ? $('#qskey').value : '').trim(),
        model: ($('#qsmodel') ? $('#qsmodel').value : '').trim()
      };
      window.BOTCAI.save(c2);
      var m2 = $('#qsmsg'); if (m2) m2.textContent = '测试中…';
      BOTCAI.ping(function (ok, msg) { var m3 = $('#qsmsg'); if (m3) m3.textContent = (ok ? '✅ ' : '❌ ') + msg; });
      return;
    }
    if (e.target.closest('[data-qsclear]')) {
      window.BOTCAI.save({});
      render();
      var m4 = $('#qsmsg'); if (m4) m4.textContent = '已清除，回到本地引擎模式。';
      return;
    }
    if ((el = e.target.closest('[data-qask]'))) {
      UIQ.q = el.dataset.qask;
      if (/^(现在该做什么|现在该怎么做|下一步|接下来)/.test(UIQ.q)) UIQ.ans = answerGame();
      else UIQ.ans = analyze(UIQ.q);
      UIQ.ai = ''; UIQ.aiState = 0; AIHANDLER = null;
      if (UIQ.ans && UIQ.ans.sandbox) newSandbox(UIQ.ans.sandbox, SB.n);
      render();
      var el2 = $('#ansbox'); if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('[data-sbnew]')) {
      newSandbox($('#sbrole') ? $('#sbrole').value : SB.roleId, $('#sbn') ? +$('#sbn').value : SB.n);
      render(); return;
    }
    if (e.target.closest('[data-sbcalc]')) { readSB(); render(); return; }
    if ((el = e.target.closest('[data-sbkill]'))) {
      var n1 = +el.dataset.sbkill; readSB();
      SB.seats[n1 - 1].alive = !SB.seats[n1 - 1].alive;
      if (!SB.seats[n1 - 1].alive) SB.seats[n1 - 1].deadDay = 1;
      render(); return;
    }
    if ((el = e.target.closest('[data-sbps]'))) { var n2 = +el.dataset.sbps; readSB(); SB.seats[n2 - 1].st.poison = !SB.seats[n2 - 1].st.poison; render(); return; }
    if ((el = e.target.closest('[data-sbdk]'))) { var n3 = +el.dataset.sbdk; readSB(); SB.seats[n3 - 1].st.drunk = !SB.seats[n3 - 1].st.drunk; render(); return; }
    if (e.target.closest('[data-dedcalc]')) { readDD(); render(); return; }
    if (e.target.closest('[data-dedreset]')) { readDD(); dedReset(DD.n); render(); return; }
    if ((el = e.target.closest('[data-deddead]'))) {
      var n4 = +el.dataset.deddead; readDD();
      DD.dead[n4] = !DD.dead[n4];
      render(); return;
    }
  });
  document.addEventListener('change', function (e) {
    var el;
    if ((el = e.target.closest('[data-sbrole]'))) {
      var n = +el.dataset.sbrole; readSB();
      SB.seats[n - 1].role = el.value;
      if (n === SB.selfN) SB.roleId = el.value;
      render(); return;
    }
    if (e.target.id === 'sbt1' || e.target.id === 'sbt2') { readSB(); render(); return; }
    if ((el = e.target.closest('[data-dedclaim]'))) { var a = +el.dataset.dedclaim; readDD(); DD.claims[a] = el.value; render(); return; }
    if ((el = e.target.closest('[data-dedknown]'))) { var b = +el.dataset.dedknown; readDD(); DD.known[b] = el.value; render(); return; }
    if (e.target.id === 'dedn') { readDD(); dedReset(DD.n); render(); return; }
  });

  /* 首次进入预取百科（空闲时），让后续回答能引用百科原文 */
  function prefetch() {
    if (WIKISTATE !== 0) return;
    var go = function () { ensureWiki(function () { if (UIQ.ans && location.hash.indexOf('#/qa') === 0) render(); }); };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 2500);
  }

  window.BOTCQA = {
    route: function () { render(); prefetch(); },
    ask: function (q) { return /^(现在该做什么|现在该怎么做|下一步|接下来)/.test(q) ? answerGame() : analyze(q); },
    open: function (q) {
      if (q) {
        UIQ.q = q;
        UIQ.ans = /^(现在该做什么|现在该怎么做|下一步|接下来)/.test(q) ? answerGame() : analyze(q);
        if (UIQ.ans && UIQ.ans.sandbox) newSandbox(UIQ.ans.sandbox, SB.n);
      }
      render();
    }
  };
})();
