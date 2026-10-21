/* 染·钟楼谜团 — 智能问答 / 局面分析
 * 纯前端：不联网、不调用大模型，基于官方魔典数据 + 角色能力引擎做规则推理。
 * 支持：角色能力问答、相克判定、夜晚顺序、人数配比、规则词条、情境计算（沙盒推演）。
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

  /* 常见简称 / 别称 → 正式名 */
  var ALIAS = {
    '共情': '共情者', '占卜': '占卜师', '调查': '调查员', '厨师': '厨师', '洗衣': '洗衣妇', '洗衣妇': '洗衣妇',
    '图书': '图书管理员', '管理员': '图书管理员', '送葬': '送葬者', '僧侣': '僧侣', '管家': '管家', '守鸦': '守鸦人',
    '投毒': '投毒者', '毒师': '投毒者', '小恶魔': '小恶魔', '恶魔': '小恶魔', '间谍': '间谍', '红唇': '红唇女郎',
    '圣女': '贞洁者', '贞洁': '贞洁者', '猎手': '猎手', '镇长': '镇长', '市长': '镇长', '圣徒': '圣徒',
    '陌客': '陌客', '士兵': '士兵', '酒鬼': '酒鬼', '男爵': '男爵', '祖母': '祖母', '水手': '水手', '侍女': '侍女',
    '驱魔': '驱魔人', '旅店': '旅店老板', '赌徒': '赌徒', '侍臣': '侍臣', '教授': '教授', '疯子': '疯子',
    '教父': '教父', '刺客': '刺客', '普卡': '普卡', '沙巴': '沙巴洛斯', '僵怖': '僵怖', '钟表': '钟表匠',
    '筑梦': '筑梦师', '舞蛇': '舞蛇人', '数学': '数学家', '卖花': '卖花女孩', '公告': '城镇公告员', '公告员': '城镇公告员',
    '神谕': '神谕者', '裁缝': '女裁缝', '贤者': '贤者', '女巫': '女巫', '洗脑': '洗脑师', '镜像': '镜像双子',
    '方古': '方古', '涡流': '涡流', '麻脸': '麻脸巫婆', '哲学家': '哲学家', '官员': '官员', '窃贼': '窃贼', '枪手': '枪手',
    '小怪宝': '小怪宝', '军团': '军团', '利维坦': '利维坦'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function uniq(a) { var o = {}, r = []; a.forEach(function (x) { if (x && !o[x]) { o[x] = 1; r.push(x); } }); return r; }

  /* ---------------- 角色识别 ---------------- */
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
        if (r && !cover) {
          hits.push({ r: r, pos: p, len: n.length, alias: n });
          used.push([p, p + n.length]);
        }
        p += n.length;
      }
    });
    /* 英文名 */
    ALL.forEach(function (r) {
      if (!r.en) return;
      var en = r.en.toLowerCase();
      if (en.length < 4) return;
      if (q.toLowerCase().indexOf(en) >= 0 && !hits.some(function (h) { return h.r.id === r.id; })) {
        hits.push({ r: r, pos: q.toLowerCase().indexOf(en), len: en.length, alias: r.en });
      }
    });
    hits.sort(function (a, b) { return a.pos - b.pos; });
    var seen = {}, out = [];
    hits.forEach(function (h) { if (!seen[h.r.id]) { seen[h.r.id] = 1; out.push(h); } });
    return out;
  }

  /* ---------------- 各类检索 ---------------- */
  function jinxOf(a, b) {
    return D.jinxes.filter(function (j) {
      return (j.a === a && j.b === b) || (j.a === b && j.b === a);
    })[0] || null;
  }
  function jinxListOf(name) {
    return D.jinxes.filter(function (j) { return j.a === name || j.b === name; });
  }
  function nightPos(r) {
    var f = null, o = null;
    D.nightOrder.first.forEach(function (x, i) { if (x.id === r.id) f = i + 1; });
    D.nightOrder.other.forEach(function (x, i) { if (x.id === r.id) o = i + 1; });
    return { f: f, o: o };
  }
  function compOf(n) {
    var c = D.composition[Math.min(Math.max(n - 5, 0), D.composition.length - 1)];
    return c;
  }
  function ruleSearch(kw, limit) {
    var keys = kw.split(/[\s，,。？?]+/).filter(function (x) { return x.length >= 2; });
    if (!keys.length) keys = [kw];
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
    var out = [], k = kw.trim();
    if (!k) return out;
    ALL.forEach(function (r) {
      var t = r.name + ' ' + (r.ability || '') + ' ' + (r.flavor || '');
      if (t.indexOf(k) >= 0) out.push({ t: 'role', id: r.id, name: r.name, sub: r.teamCn || '' });
    });
    D.rules.forEach(function (r) {
      if ((r.title + r.text).indexOf(k) >= 0) out.push({ t: 'rule', id: r.id, name: r.title, sub: r.catName || '' });
    });
    D.jinxes.forEach(function (j) {
      if ((j.a + j.b + j.reason).indexOf(k) >= 0) out.push({ t: 'jinx', id: 'x', name: j.a + ' × ' + j.b, sub: j.reason });
    });
    return out.slice(0, limit || 8);
  }

  /* ---------------- 情境沙盒（复用能力引擎） ---------------- */
  var SB = { roleId: null, n: 9, ed: 'tb', seats: null, selfN: 1, t1: null, t2: null };
  function sandboxRoles(ed, n) {
    if (window.BOTCGame && BOTCGame.rollPool) {
      try { return BOTCGame.rollPool(ed, n); } catch (e) { }
    }
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
    SB.roleId = roleId;
    SB.n = n || SB.n;
    var r = byId[roleId];
    SB.ed = (r && r.edition) || SB.ed;
    var ids = sandboxRoles(SB.ed, SB.n);
    if (ids.indexOf(roleId) < 0) ids[0] = roleId;
    SB.seats = ids.map(function (id, i) {
      return {
        n: i + 1, name: '玩家' + (i + 1), role: id, alive: true, traveler: false,
        st: { poison: false, drunk: false, protect: false, red: false, marks: [] },
        voted: false, nominated: false, deadDay: 0
      };
    });
    SB.selfN = SB.seats.filter(function (s) { return s.role === roleId; })[0].n;
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
    catch (e) { return { err: String(e && e.message || e) }; }
  }

  /* ---------------- 答案构造 ---------------- */
  function A(title) {
    return { title: title, verdict: '', why: '', steps: [], tips: [], warns: [], links: [], sandbox: null, similars: [] };
  }
  function roleLink(r) { return { href: '#/role/' + r.id, label: r.name }; }

  function answerRole(r) {
    var a = A('角色解析 · ' + r.name);
    var np = nightPos(r);
    a.verdict = r.name + ' 是「' + (r.teamCn || TEAMCN[r.team]) + '」，' +
      (np.f ? '首夜第 ' + np.f + ' 位行动' : '首夜不行动') +
      (np.o ? '，其他夜晚第 ' + np.o + ' 位行动' : '，其他夜晚不行动') + '。';
    a.why = '<div class="ability-box">' + esc(r.ability || '') + '</div>' +
      (r.flavor ? '<div class="flavor">' + esc(r.flavor) + '</div>' : '');
    a.steps.push('阵营：' + (r.teamCn || TEAMCN[r.team]) + '（' + (r.team === 'minion' || r.team === 'demon' ? '邪恶方' : '善良方') + '）・所属：' + (r.editionCn || '—'));
    if (r.setup) a.steps.push('⚙ 该角色需要「设置阶段」处理，开局前就要按能力文本调整场上配置。');
    if (r.reminders && r.reminders.length) a.steps.push('提示标记：' + r.reminders.join('、'));
    if (r.firstNightReminder) a.steps.push('首夜提示：' + r.firstNightReminder);
    if (r.otherNightReminder) a.steps.push('其他夜提示：' + r.otherNightReminder);
    var jx = jinxListOf(r.name);
    if (jx.length) {
      a.warns.push('相克 ' + jx.length + ' 条：' + jx.slice(0, 4).map(function (j) {
        return (j.a === r.name ? j.b : j.a);
      }).join('、') + (jx.length > 4 ? ' 等' : '') + '（同局时需按相克规则处理）');
    }
    if (window.BOTCAbility && BOTCAbility.has(r.id)) {
      a.tips.push('本工具内置了「' + r.name + '」的自动计算，可直接在下方情境分析器里推演他会得到什么信息。');
      a.sandbox = r.id;
    }
    var w = r.wiki;
    if (w && w.sections) {
      var s = w.sections.filter(function (x) { return /运作方式|说书人|范例|如何运作/.test(x.title); })[0];
      if (s) a.why += '<div class="card" style="margin-top:10px;padding:10px 12px"><div class="ftl">' + esc(s.title) + '</div>' + s.html + '</div>';
    }
    a.links.push(roleLink(r));
    if (jx.length) a.links.push({ href: '#/jinxes', label: '相克规则' });
    return a;
  }

  function answerJinx(r1, r2) {
    var a = A('相克判定 · ' + r1.name + ' × ' + r2.name);
    var j = jinxOf(r1.name, r2.name);
    if (j) {
      a.verdict = '⚠ 相克：这两个角色不能按常规同局，必须按相克规则处理。';
      a.why = '<div class="ability-box">' + esc(j.reason || '') + '</div>';
      a.steps.push('处理方式：把这张相克卡放在魔典中间，开局时告知全场"本局存在相克"，并在设置阶段/首夜按卡面文字调整。');
      a.tips.push('相克规则是官方为了维护游戏平衡设计的，说书人必须严格执行，不能自行忽略。');
    } else {
      a.verdict = '✅ 这两个角色之间没有官方相克记录，可以正常同局。';
      a.steps.push('已核对全部 ' + D.jinxes.length + ' 条相克规则，未命中。');
    }
    a.links.push(roleLink(r1), roleLink(r2), { href: '#/jinxes', label: '全部相克规则' });
    return a;
  }

  function answerNightOrder(hits, q) {
    var a = A('夜晚顺序');
    if (hits.length >= 2) {
      var r1 = hits[0].r, r2 = hits[1].r;
      var p1 = nightPos(r1), p2 = nightPos(r2);
      if (!p1.f && !p1.o) { a.verdict = r1.name + ' 夜晚不行动。'; }
      else if (!p2.f && !p2.o) { a.verdict = r2.name + ' 夜晚不行动。'; }
      else {
        var key = /首夜|第一夜|第一晚/.test(q) ? 'f' : 'o';
        var v1 = p1[key], v2 = p2[key];
        if (v1 && v2) a.verdict = (key === 'f' ? '首夜' : '其他夜晚') + '：' +
          (v1 < v2 ? r1.name + '（第 ' + v1 + ' 位）先于 ' + r2.name + '（第 ' + v2 + ' 位）'
            : r2.name + '（第 ' + v2 + ' 位）先于 ' + r1.name + '（第 ' + v1 + ' 位）');
        else a.verdict = (key === 'f' ? '首夜' : '其他夜晚') + '：' +
          (v1 ? r1.name + ' 第 ' + v1 + ' 位行动' : r1.name + ' 不行动') + '，' +
          (v2 ? r2.name + ' 第 ' + v2 + ' 位行动' : r2.name + ' 不行动');
      }
      a.links.push(roleLink(r1), roleLink(r2));
    } else {
      var r = hits[0].r, p = nightPos(r);
      a.verdict = r.name + '：' + (p.f ? '首夜第 ' + p.f + ' 位' : '首夜不行动') + ' ／ ' +
        (p.o ? '其他夜晚第 ' + p.o + ' 位' : '其他夜晚不行动') + '。';
      var totF = (D.nightOrder.first || []).length, totO = (D.nightOrder.other || []).length;
      a.steps.push('说明：序号是「全角色夜晚顺序总表」中的位置（首夜共 ' + totF + ' 位、其他夜共 ' + totO +
        ' 位，含所有剧本）。真正开局时只有本局在场的角色才需要唤醒，序号仅用来判断谁先谁后。');
      if (p.f) {
        var near = D.nightOrder.first.slice(Math.max(0, p.f - 2), p.f + 1);
        a.steps.push('首夜前序：' + near.map(function (x) { return x.name; }).join(' → '));
      }
      if (p.o) {
        var near2 = D.nightOrder.other.slice(Math.max(0, p.o - 2), p.o + 1);
        a.steps.push('其他夜前序：' + near2.map(function (x) { return x.name; }).join(' → '));
      }
      a.links.push(roleLink(r), { href: '#/night/first', label: '完整夜晚顺序表' });
    }
    a.steps.push('顺序说明：数字小者先被说书人唤醒；死亡或离场的角色跳过；"首夜之后"才行动的角色首夜不动。');
    return a;
  }

  function answerComp(n) {
    var a = A(n + ' 人局 · 角色配比');
    var c = compOf(n);
    if (!c) { a.verdict = '暂无该人数的配比数据（支持 5–' + (D.composition.length + 4) + ' 人）。'; return a; }
    a.verdict = n + ' 人局：镇民 ' + (c.townsfolk || 0) + '・外来者 ' + (c.outsider || 0) +
      '・爪牙 ' + (c.minion || 0) + '・恶魔 ' + (c.demon || 0) +
      (c.traveler ? '（另有旅行者位）' : '') + '。';
    a.steps.push('善良方 ' + ((c.townsfolk || 0) + (c.outsider || 0)) + ' 人，邪恶方 ' + ((c.minion || 0) + (c.demon || 0)) + ' 人。');
    a.steps.push('外来者数量会被男爵、教区牧师等角色改变——设置阶段先处理再发牌。');
    a.steps.push('处决门槛 = 存活人数的一半向上取整（例如 9 人存活需 5 票）。');
    a.tips.push('开局时用「🕯️ 开局 → 抽签台」可以让玩家自己抽角色，避免你说书人提前知道谁是什么。');
    a.links.push({ href: '#/game/new', label: '去开一局' }, { href: '#/rules', label: '规则条目' });
    return a;
  }

  function answerRule(q) {
    var a = A('规则检索');
    var rs = ruleSearch(q, 3);
    if (!rs.length) { a.verdict = '没有匹配到规则条目，换个说法试试（如"中毒"、"提名"、"旅行者"）。'; return a; }
    var r0 = rs[0];
    a.verdict = '最相关规则：' + r0.title + '（' + r0.catName + '）';
    a.why = '<div class="ability-box">' + esc((r0.text || '').replace(/\s+/g, ' ').slice(0, 300)) + '…</div>';
    rs.forEach(function (r) {
      a.steps.push('§ ' + r.title + '：' + esc((r.text || '').replace(/\s+/g, ' ').slice(0, 120)) + '…');
      a.links.push({ href: '#/rule/' + r.id, label: r.title });
    });
    return a;
  }

  /* 内置高频问题（规则速答） */
  var FAQ = [
    {
      k: /恶魔.*(死|出局|被处决).*(结束|赢|胜负)|恶魔死了|游戏什么时候结束/,
      t: '恶魔出局 = 对局立即结束',
      v: '是的。场上只要没有存活的恶魔，善良阵营立刻获胜，游戏结束 —— 不需要等到只剩两人，也不需要再投票。',
      s: ['例外 1：红唇女郎在场且存活人数 ≥ 5 时，恶魔死后她立刻变成恶魔，对局继续。',
        '例外 2：僵怖第一次被杀只是"假死"，并不真正出局。',
        '例外 3：小恶魔可以在夜晚自杀把恶魔身份传给一名爪牙，此时也不会结束。',
        '另一个结束条件：场上存活只剩 2 人时邪恶方获胜。'],
      tip: '本工具的「🕯️ 开局」会在恶魔出局时自动判定并跳到复盘分析页。'
    },
    {
      k: /中毒.*醉酒|醉酒.*中毒|中毒和醉酒|区别/,
      t: '中毒 vs 醉酒',
      v: '两者效果相同：该角色的能力"失效或可能给出错误信息"，但玩家本人不知道自己中毒/醉酒。区别只在于来源：中毒通常来自投毒者等邪恶角色，醉酒常来自酒鬼、旅店老板等善良方能力。',
      s: ['说书人可以给中毒/醉酒的角色任意信息（包括假信息），这是合法的。',
        '中毒不影响身份：中毒的共情者仍然是善良的共情者。',
        '中毒/醉酒不能让玩家死亡，致死类能力仍照常生效。'],
      tip: '在魔典里给该玩家打上"中毒/醉酒"标记，夜晚信息就能故意给错。'
    },
    {
      k: /提名|投票|处决门槛|几票|平票/,
      t: '提名与投票',
      v: '白天每名玩家每天只能提名一次、只能被提名一次；处决需要赞成票 ≥ 存活人数的一半（向上取整）；平票则无人被处决。',
      s: ['被处决者当天死亡且不能再提名/投票（仍可参与之后的讨论，具体按房规）。',
        '提名人自己不能投自己的提名？—— 可以投，提名人同样参与投票。',
        '存活 5 人时需要 3 票，存活 4 人时需要 2 票。'],
      tip: '工具的对局页会自动算出门槛票数并处理平票。'
    },
    {
      k: /旅行者|加入|离场/,
      t: '旅行者规则',
      v: '旅行者可以在任何时候加入或离场（通常说书人在白天宣布），加入时立即获知自己的角色，人数不计入阵营配比。',
      s: ['旅行者数量建议不超过：5–9人局 1 名，10+ 人局 2 名。',
        '旅行者可能是善良也可能是邪恶，但说书人会告知全场"有几名旅行者、可能邪恶"。',
        '旅行者死亡不影响胜负判定中的存活人数门槛（按房规略有差异）。']
    },
    {
      k: /传奇角色|传奇/,
      t: '传奇角色（Fabled）',
      v: '传奇角色不是说书人也不是玩家角色，是可选的"全局规则变体"，由说书人在开局前宣布是否使用。',
      s: ['它们会改变流程或胜利条件，例如"天使"可以让玩家提前知道阵营。',
        '建议新手局不使用传奇角色。']
    },
    {
      k: /说书人.*(能|可以).*(说|给|骗)|说谎|假信息/,
      t: '说书人可以给假信息吗',
      v: '可以，但只在角色"中毒 / 醉酒"或能力本身允许（如间谍、酒鬼）时。正常情况下信息类能力必须给出真实结果。',
      s: ['给假信息的唯一合法时机：目标中毒/醉酒，或能力文本写明"可能出错"。',
        '混沌局面：说书人仍需严格按能力文本执行，不能凭心情改。']
    }
  ];

  /* 会干扰信息真实性的角色（局面提醒用） */
  var DISTURB = {
    poisoner: '投毒者：每夜可让一名玩家中毒，信息类能力可能得到假信息。',
    spy: '间谍：可以看到魔典，邪恶方掌握全部信息。',
    drunk: '酒鬼：自认为某个镇民，其实能力无效。',
    recluse: '隐士（陌客）：可能被邪恶能力误判为邪恶。',
    saint: '圣徒：被处决则邪恶方获胜，白天要格外小心。',
    butler: '管家：投票受主人限制。',
    scarlet_woman: '红唇女郎：恶魔死后可能接任，别急着宣告结束。',
    zombuul: '僵怖：第一次死亡是假死。',
    lunatic: '疯子：自认为是恶魔，实为镇民。',
    marionette: '提线木偶：不知道自己是邪恶。'
  };

  /* ---------------- 主分析入口 ---------------- */
  function analyze(q) {
    q = (q || '').trim();
    if (!q) return null;
    var hits = findRoles(q);
    var i;

    /* FAQ 优先 */
    for (i = 0; i < FAQ.length; i++) {
      if (FAQ[i].k.test(q)) {
        var a = A('规则速答 · ' + FAQ[i].t);
        a.verdict = FAQ[i].v;
        a.steps = FAQ[i].s.slice();
        if (FAQ[i].tip) a.tips.push(FAQ[i].tip);
        var rs = ruleSearch(FAQ[i].t.replace(/.*·/, ''), 2);
        rs.forEach(function (r) { a.links.push({ href: '#/rule/' + r.id, label: '§ ' + r.title }); });
        return a;
      }
    }

    /* 相克 */
    if (/相克|冲突|排斥|不能一起|能一起|同局|同时出现|能不能一起|可以一起/.test(q) && hits.length >= 2) {
      return answerJinx(hits[0].r, hits[1].r);
    }
    if (/相克/.test(q) && hits.length === 1) {
      var aa = A('相克清单 · ' + hits[0].r.name);
      var jl = jinxListOf(hits[0].r.name);
      aa.verdict = jl.length ? (hits[0].r.name + ' 共有 ' + jl.length + ' 条相克规则。') : (hits[0].r.name + ' 没有相克规则。');
      jl.forEach(function (j) {
        var other = j.a === hits[0].r.name ? j.b : j.a;
        aa.steps.push('× ' + other + '：' + esc(j.reason));
      });
      aa.links.push({ href: '#/jinxes', label: '全部相克规则' });
      return aa;
    }

    /* 夜晚顺序 */
    if (/顺序|第几夜|第几位|先后|先谁|谁先|先于|晚于|第几个/.test(q) && hits.length) {
      return answerNightOrder(hits, q);
    }

    /* 配比 */
    var mn = /(\d+)\s*[人位]/.exec(q);
    if (mn && (/配比|几个|多少|组成|配置|分布/.test(q) || /镇民|外来者|爪牙|恶魔/.test(q))) {
      var n = +mn[1];
      if (n >= 5 && n <= 20) return answerComp(n);
    }

    /* 信息计算（"两边都是善良应该给几"这类） */
    if (hits.length && window.BOTCAbility && BOTCAbility.has(hits[0].r.id) &&
      (/两边|相邻|旁边|之间|都是|是邪恶|是善良|得到|得知|给几|给什么|知道什么|应该是|会知道|信息/.test(q))) {
      var r = hits[0].r;
      var a2 = answerRole(r);
      a2.title = '情境分析 · ' + r.name;
      a2.sandbox = r.id;
      var hint = [];
      if (/两边|相邻|旁边|之间/.test(q)) hint.push('你问的是「两侧邻座」类信息，已在下方情境分析器里按座次环计算。');
      if (/都是善良|都是好人|全善良/.test(q)) hint.push('若两侧存活玩家都是善良，邪恶数量 = 0 —— 以共情者为例应告知「0」，而不是 2（规则是"得知邪恶玩家数量"）。');
      if (/都是邪恶|全邪恶/.test(q)) hint.push('若两侧都是邪恶，邪恶数量 = 2。');
      a2.steps = hint.concat(a2.steps);
      return a2;
    }

    /* 单角色解析 */
    if (hits.length === 1) return answerRole(hits[0].r);
    if (hits.length > 1) {
      var a3 = A('多角色对比');
      a3.verdict = '识别到 ' + hits.length + ' 个角色：' + hits.map(function (h) { return h.r.name; }).join('、');
      hits.forEach(function (h) {
        var r = h.r;
        a3.steps.push(r.name + '（' + (r.teamCn || TEAMCN[r.team]) + '）：' + esc(r.ability || ''));
        a3.links.push(roleLink(r));
      });
      var pairs = [];
      for (var x = 0; x < hits.length; x++) {
        for (var y = x + 1; y < hits.length; y++) {
          var j = jinxOf(hits[x].r.name, hits[y].r.name);
          if (j) pairs.push(hits[x].r.name + ' × ' + hits[y].r.name + '：' + j.reason);
        }
      }
      if (pairs.length) { a3.warns = a3.warns.concat(pairs); }
      else a3.tips.push('这些角色之间没有相克记录。');
      return a3;
    }

    /* 规则检索 */
    var rs2 = ruleSearch(q, 3);
    if (rs2.length && q.length >= 2) {
      var ar = answerRule(q);
      ar.similars = fullSearch(q, 6);
      return ar;
    }

    /* 兜底 */
    var a4 = A('未识别到明确意图');
    a4.verdict = '没太看懂这个问题，下面是基于关键词找到的最相关条目：';
    a4.similars = fullSearch(q, 10);
    if (!a4.similars.length) {
      a4.verdict = '没有找到相关内容。可以直接问角色名（如"共情者"），或试试下面的常见问题。';
    }
    a4.tips.push('支持的问法：角色能力 / 相克 / 夜晚顺序 / 人数配比 / 规则词条 / 情境推演（如"共情者两边都是善良给几"）。');
    return a4;
  }

  /* ---------------- 渲染 ---------------- */
  var UIQ = { q: '', ans: null, roles: [] };

  function render() {
    var h = '<div class="backbar"><button data-qback="1">‹ 首页</button><span style="font-size:12px;color:var(--text-faint)">智能问答 · 局面分析</span></div>';
    h += '<div class="card" style="padding:12px 14px">' +
      '<textarea id="qq" class="sel" placeholder="输入你的问题，例如：&#10;· 共情者两边都是善良应该给几？&#10;· 小恶魔和男爵能同局吗？&#10;· 送葬者第几夜行动？&#10;· 10人局几个外来者？&#10;· 中毒和醉酒有什么区别？">' + esc(UIQ.q) + '</textarea>' +
      '<div class="qbtns" style="margin-top:8px"><button class="btn primary" data-qgo="1">🔍 解答并分析</button>' +
      '<button class="btn" data-qclear="1">清空</button></div>' +
      '<div class="ftl">常见问题（点击直接问）</div><div class="chips">' +
      ['共情者两边都是善良应该给几？', '恶魔死了游戏就结束吗？', '小恶魔和红唇女郎能同局吗？',
        '送葬者第几夜行动？', '10人局几个外来者？', '中毒和醉酒有什么区别？',
        '提名和投票怎么算？', '占卜师怎么给信息？'].map(function (t) {
          return '<button class="chip" data-qask="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') + '</div></div>';

    if (UIQ.ans) h += ansHtml(UIQ.ans);
    h += sandboxHtml();
    view().innerHTML = h;
    var box = $('#qq');
    if (box) {
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { doAsk(); }
      });
    }
  }

  function doAsk() {
    var box = $('#qq');
    UIQ.q = box ? box.value.trim() : '';
    if (!UIQ.q) { alert('请输入你的问题'); return; }
    UIQ.ans = analyze(UIQ.q);
    if (UIQ.ans && UIQ.ans.sandbox && (!SB.roleId || SB.roleId !== UIQ.ans.sandbox)) {
      newSandbox(UIQ.ans.sandbox, SB.n);
    }
    render();
    var el = $('#ansbox'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ansHtml(a) {
    var h = '<div id="ansbox" class="card" style="margin-top:12px;padding:12px 14px">';
    h += '<div class="ftl">' + esc(a.title) + '</div>';
    if (a.verdict) h += '<div class="abox"><b>结论</b><div>' + esc(a.verdict) + '</div></div>';
    if (a.why) h += a.why;
    if (a.steps.length) {
      h += '<div class="ftl">要点拆解</div>' + a.steps.map(function (s) {
        return '<div class="nrow"><div class="no">·</div><div><div class="rm">' + s + '</div></div></div>';
      }).join('');
    }
    if (a.warns.length) {
      h += '<div class="abox warn"><b>⚠ 注意</b>' + a.warns.map(function (s) { return '<div>' + esc(s) + '</div>'; }).join('') + '</div>';
    }
    if (a.tips.length) {
      h += '<div class="abox tip"><b>💡 说书人提示</b>' + a.tips.map(function (s) { return '<div>' + esc(s) + '</div>'; }).join('') + '</div>';
    }
    var links = (a.links || []).concat((a.similars || []).map(function (s) {
      return { href: s.t === 'role' ? '#/role/' + s.id : s.t === 'rule' ? '#/rule/' + s.id : '#/jinxes', label: s.name };
    }));
    if (links.length) {
      h += '<div class="ftl">相关条目</div><div class="chips">' +
        uniq(links.map(function (l) { return l.href + '|' + l.label; })).slice(0, 12).map(function (x) {
          var p = x.split('|');
          return '<a class="chip" href="' + p[0] + '">' + esc(p[1]) + '</a>';
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
      if (ab && ab.targets >= 1) {
        h += '<div class="qrow"><label>目标1</label><select id="sbt1">' + optSeats(SB.t1, SB.selfN) + '</select></div>';
      }
      if (ab && ab.targets >= 2) {
        h += '<div class="qrow"><label>目标2</label><select id="sbt2">' + optSeats(SB.t2, SB.selfN) + '</select></div>';
      }
      h += '<div class="stwrap"><table class="sttable"><thead><tr><th>座</th><th>角色</th><th>操作</th></tr></thead><tbody>' +
        SB.seats.map(function (s) {
          var r = byId[s.role];
          return '<tr class="' + (s.alive ? '' : 'dead') + '"><td>' + s.n + (s.n === SB.selfN ? ' 👤' : '') + '</td>' +
            '<td><select data-sbrole="' + s.n + '">' + ALL.map(function (x) {
              return '<option value="' + x.id + '"' + (x.id === s.role ? ' selected' : '') + '>' + esc(x.name) + '</option>';
            }).join('') + '</select></td>' +
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
      /* 局面提醒 */
      var warns = [];
      SB.seats.forEach(function (s) { if (DISTURB[s.role] && s.n !== SB.selfN) warns.push(DISTURB[s.role]); });
      SB.seats.forEach(function (s) {
        var r = byId[s.role];
        if (r && r.setup) warns.push('⚙ ' + r.name + ' 需要「设置阶段」处理，别忘在首夜前完成。');
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

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', function (e) {
    var el;
    if (e.target.closest('[data-qback]')) { location.hash = '#/home'; return; }
    if (e.target.closest('[data-qgo]')) { doAsk(); return; }
    if (e.target.closest('[data-qclear]')) { UIQ.q = ''; UIQ.ans = null; render(); return; }
    if ((el = e.target.closest('[data-qask]'))) { UIQ.q = el.dataset.qask; UIQ.ans = analyze(UIQ.q); if (UIQ.ans && UIQ.ans.sandbox) newSandbox(UIQ.ans.sandbox, SB.n); render(); return; }
    if (e.target.closest('[data-sbnew]')) {
      var rsel = $('#sbrole'), nsel = $('#sbn');
      newSandbox(rsel ? rsel.value : SB.roleId, nsel ? +nsel.value : SB.n);
      render(); return;
    }
    if (e.target.closest('[data-sbcalc]')) { readSandbox(); render(); return; }
    if ((el = e.target.closest('[data-sbkill]'))) {
      var n1 = +el.dataset.sbkill; readSandbox();
      SB.seats[n1 - 1].alive = !SB.seats[n1 - 1].alive;
      if (!SB.seats[n1 - 1].alive) SB.seats[n1 - 1].deadDay = 1;
      render(); return;
    }
    if ((el = e.target.closest('[data-sbps]'))) { var n2 = +el.dataset.sbps; readSandbox(); SB.seats[n2 - 1].st.poison = !SB.seats[n2 - 1].st.poison; render(); return; }
    if ((el = e.target.closest('[data-sbdk]'))) { var n3 = +el.dataset.sbdk; readSandbox(); SB.seats[n3 - 1].st.drunk = !SB.seats[n3 - 1].st.drunk; render(); return; }
  });
  document.addEventListener('change', function (e) {
    var el;
    if ((el = e.target.closest('[data-sbrole]'))) {
      var n = +el.dataset.sbrole; readSandbox();
      SB.seats[n - 1].role = el.value;
      if (n === SB.selfN) SB.roleId = el.value;
      render(); return;
    }
    if (e.target.id === 'sbt1' || e.target.id === 'sbt2') { readSandbox(); render(); return; }
  });

  function readSandbox() {
    if (!SB.seats) return;
    var t1 = $('#sbt1'), t2 = $('#sbt2');
    SB.t1 = t1 && t1.value ? +t1.value : null;
    SB.t2 = t2 && t2.value ? +t2.value : null;
  }

  window.BOTCQA = {
    route: function () { render(); },
    ask: function (q) { return analyze(q); },
    open: function (q) { if (q) { UIQ.q = q; UIQ.ans = analyze(q); if (UIQ.ans && UIQ.ans.sandbox) newSandbox(UIQ.ans.sandbox, SB.n); } render(); }
  };
})();
