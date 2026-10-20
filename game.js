/* 染·钟楼谜团 — 线上说书人魔典（开局 / 夜晚 / 白天 / 看板） */
(function () {
  'use strict';

  var D = window.BOTC_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var view = function () { return $('#view'); };

  var byId = {}, byName = {};
  D.roles.concat(D.fabled).forEach(function (r) { byId[r.id] = r; byName[r.name] = r; });

  var TEAMCN = { townsfolk: '镇民', outsider: '外来者', minion: '爪牙', demon: '恶魔', traveler: '旅行者', fabled: '传奇' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('botcg_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('botcg_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  /* ================= 状态 ================= */
  var G = LS.get('game', null);
  var UI = { sheetSeat: -1, vote: null, timer: null, timerLeft: 180, timerMin: 3, newCfg: null,
    orderKey: null, orderAll: false, lsWarn: false, abRes: null };

  function save() { if (!LS.set('game', G)) UI.lsWarn = true; }
  try { localStorage.setItem('botcg_probe', '1'); localStorage.removeItem('botcg_probe'); }
  catch (e) { UI.lsWarn = true; }
  function aliveSeats() { return G.seats.filter(function (s) { return s.alive; }); }
  function seat(n) { for (var i = 0; i < G.seats.length; i++) if (G.seats[i].n === n) return G.seats[i]; return null; }
  function roleOf(s) { return s && s.role ? byId[s.role] : null; }
  function log(text, tag) {
    G.log.push({ t: Date.now(), day: G.day, phase: G.phase, tag: tag || '', text: text });
    save();
  }

  /* ================= 发牌 ================= */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function jinxPairs() {
    var m = {};
    D.jinxes.forEach(function (j) { m[j.a + '|' + j.b] = 1; m[j.b + '|' + j.a] = 1; });
    return m;
  }
  var JX = null;
  function hasJinx(list) {
    if (!JX) JX = jinxPairs();
    for (var i = 0; i < list.length; i++)
      for (var j = i + 1; j < list.length; j++)
        if (JX[list[i].name + '|' + list[j].name]) return true;
    return false;
  }
  function deal(ed, n) {
    var idx = Math.min(Math.max(n - 5, 0), D.composition.length - 1);
    var comp = D.composition[idx];
    var pool = D.roles.filter(function (r) { return r.edition === ed; });
    var need = { townsfolk: comp.townsfolk, outsider: comp.outsider, minion: comp.minion, demon: comp.demon };
    var picked = null;
    for (var tryN = 0; tryN < 60; tryN++) {
      var p = [];
      ['townsfolk', 'outsider', 'minion', 'demon'].forEach(function (t) {
        var g = shuffle(pool.filter(function (r) { return r.team === t; }));
        p = p.concat(g.slice(0, need[t]));
      });
      if (p.length === n && !hasJinx(p)) { picked = p; break; }
      if (!picked) picked = p;
    }
    /* 关键：选好角色后必须整体洗牌再分配到座位。
       否则会按 镇民→外来者→爪牙→恶魔 的顺序依次坐座，导致邪恶方永远坐在最后几个座位。 */
    var mixed = shuffle(picked || []);
    return { roles: mixed, comp: comp };
  }

  /* ================= 路由入口 ================= */
  function route(r) {
    var v = view();
    if (!v) return;
    if (r.p === 'board') { renderBoard(); return; }
    if (r.p === 'pc') { renderPCard(r.a); return; }
    if (!G) { renderNew(); return; }
    switch (r.a) {
      case 'new': renderNew(); break;
      case 'night': renderNight(); break;
      case 'day': renderDay(); break;
      case 'log': renderLog(); break;
      default: renderGrimoire();
    }
  }

  /* ================= 新建对局 ================= */
  function renderNew() {
    var cfg = UI.newCfg || (UI.newCfg = { ed: 'tb', n: 9, names: [], fabled: [], travelers: [], roles: null });
    if (!cfg.names.length) for (var i = 1; i <= 15; i++) cfg.names[i - 1] = '玩家' + i;

    var edOpts = D.editions.filter(function (e) { return e.id !== 'ngj' && e.id !== 'luf'; });
    var fabled = D.fabled;
    var pool = D.roles.filter(function (r) { return r.edition === cfg.ed && r.team === 'traveler'; });

    var html = '<div class="backbar"><button data-gback="1">‹ 返回</button>' +
      (G ? '<span style="font-size:12px;color:var(--text-faint)">已有进行中的对局，新建会覆盖</span>' : '') + '</div>';

    html += '<div class="card" style="padding:14px">' +
      '<div class="ftl">1. 选择剧本</div><div class="chips">' +
      edOpts.map(function (e) { return '<button class="chip' + (cfg.ed === e.id ? ' on' : '') + '" data-ged="' + e.id + '">' + esc(e.name) + '</button>'; }).join('') +
      '</div>' +
      '<div class="ftl">2. 玩家人数（不含旅行者）</div><div class="chips">' +
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (n) {
        return '<button class="chip' + (cfg.n === n ? ' on p' : '') + '" data-gn="' + n + '">' + n + '</button>';
      }).join('') + '</div></div>';

    var idx = Math.min(Math.max(cfg.n - 5, 0), D.composition.length - 1);
    var c = D.composition[idx];
    html += '<div class="card" style="padding:12px 14px;margin-top:10px">' +
      '<div class="ftl">3. 座位与玩家名</div>' +
      '<div style="font-size:12px;color:var(--text-faint);margin-bottom:8px">配比：镇民 ' + c.townsfolk + ' · 外来者 ' + c.outsider + ' · 爪牙 ' + c.minion + ' · 恶魔 ' + c.demon + '</div>' +
      '<div class="namegrid">' + Array.apply(null, Array(cfg.n)).map(function (_, i) {
        return '<label class="nrow-i"><span>' + (i + 1) + '</span><input class="gname" data-gi="' + i + '" value="' + esc(cfg.names[i] || '') + '" placeholder="玩家' + (i + 1) + '"></label>';
      }).join('') + '</div></div>';

    html += '<div class="card" style="padding:12px 14px;margin-top:10px">' +
      '<div class="ftl">4. 旅行者（可选，不计入人数）</div><div class="chips">' +
      pool.map(function (r) {
        return '<button class="chip' + (cfg.travelers.indexOf(r.id) >= 0 ? ' on' : '') + '" data-gtv="' + r.id + '">' + esc(r.name) + '</button>';
      }).join('') + '</div>' +
      (pool.length ? '' : '<div class="note">该剧本没有旅行者</div>') +
      '<div class="ftl">5. 传奇角色（可选）</div><div class="chips">' +
      fabled.map(function (r) {
        return '<button class="chip' + (cfg.fabled.indexOf(r.id) >= 0 ? ' on p' : '') + '" data-gfb="' + r.id + '">' + esc(r.name) + '</button>';
      }).join('') + '</div></div>';

    if (cfg.roles) {
      html += '<div class="card" style="padding:12px 14px;margin-top:10px"><div class="ftl">发牌结果（可点击单个座位更换角色）</div>' +
        '<div class="dealcards">' + cfg.roles.map(function (rid, i) {
          var r = byId[rid];
          return '<div class="dealc t-' + r.team + '" data-gswap="' + i + '"><b>' + (i + 1) + '号</b><span>' + esc(r.name) + '</span><i>' + esc(TEAMCN[r.team]) + '</i></div>';
        }).join('') + '</div>' +
        '<div class="note">共 ' + cfg.roles.length + ' 张。点击任意一张可更换为该阵营的其他角色。</div>' +
        '<div class="qbtns" style="margin-top:10px"><button class="btn" data-gseatshuffle="1">🔀 打乱座位顺序</button></div></div>';
    }

    html += '<div class="qbtns">' +
      '<button class="btn primary" data-gdraw="1">🧰 让玩家自己抽角色（抽签台）›</button>' +
      (cfg.roles ? '<button class="btn" data-gstart="1">确认并开始对局</button><button class="btn" data-gdeal="1">重新发牌</button>'
        : '<button class="btn" data-gdeal="1">（备用）系统一键发牌</button>') +
      '</div>' +
      '<div class="note">推荐走「抽签台」：玩家可以自己点开抽取自己的角色（本机轮流抽 / 远程发链接），系统不会提前替任何人发牌。</div>';

    view().innerHTML = html;
  }

  function doDeal() {
    var cfg = UI.newCfg;
    var res = deal(cfg.ed, cfg.n);
    cfg.roles = res.roles.map(function (r) { return r.id; });
    renderNew();
  }

  function startGame() {
    var cfg = UI.newCfg;
    if (!cfg || !cfg.roles) { alert('请先点击「随机发牌」'); return; }
    syncNames();
    beginGame(cfg);
  }

  /* 供抽签台调用：cfg = {ed,n,names[],roles[](id),travelers[],fabled[]} */
  function beginGame(cfg) {
    try {
      var seats = cfg.roles.map(function (rid, i) {
      return {
        n: i + 1, name: (cfg.names[i] || '玩家' + (i + 1)).trim() || ('玩家' + (i + 1)),
        role: rid, alive: true, traveler: false,
        st: { poison: false, drunk: false, protect: false, red: false, marks: [] },
        voted: false, nominated: false, deadDay: 0
      };
    });
    var base = seats.length;
    (cfg.travelers || []).forEach(function (rid, k) {
      seats.push({
        n: base + k + 1, name: '旅行者' + (k + 1), role: rid, alive: true, traveler: true,
        st: { poison: false, drunk: false, protect: false, red: false, marks: [] },
        voted: false, nominated: false, deadDay: 0
      });
    });
    G = {
      v: 1, edition: cfg.ed, fabled: cfg.fabled || [], day: 0, phase: 'setup',
      night: 'first', nightStep: 0, nightActs: {}, seats: seats, log: [], noms: [], winner: null, startedAt: Date.now()
    };
    /* 占卜师：自动指定一名善良玩家作为红鲱鱼（干扰项） */
    var ft = null, red = null;
    seats.forEach(function (s) { var r = byId[s.role]; if (r && r.id === 'fortune_teller') ft = s; });
    if (ft) {
      var cand = seats.filter(function (s) {
        var r = byId[s.role]; return r && (r.team === 'townsfolk' || r.team === 'outsider') && r.id !== 'fortune_teller';
      });
      if (cand.length) { red = cand[Math.floor(Math.random() * cand.length)]; red.st.red = true; }
    }
    log('创建对局：' + (EDNAME(cfg.ed)) + ' · ' + cfg.n + ' 人' + (cfg.travelers.length ? ' + ' + cfg.travelers.length + ' 旅行者' : ''), 'setup');
    if (red) log('占卜师的红鲱鱼（干扰项）自动指定为 ' + red.n + '号 ' + red.name, 'setup');
      save();
      UI.newCfg = null;
      UI.orderKey = null;
      /* 兜底：先直接渲染魔典，再同步 hash，避免部分浏览器 hashchange 不触发导致"点不开" */
      renderGrimoire();
      if (location.hash !== '#/game') location.hash = '#/game';
    } catch (err) {
      alert('开始对局失败：' + (err && err.message ? err.message : err));
    }
  }
  function EDNAME(id) { var e = D.editions.filter(function (x) { return x.id === id; })[0]; return e ? e.name : id; }

  /* ================= 夜晚行动顺序面板 ================= */
  function curNightKey() { return (G.phase === 'setup' || G.day === 0) ? 'first' : (G.night || 'first'); }

  function orderRows(key, onlyPresent) {
    var present = {}; G.seats.forEach(function (s) { if (s.role) present[s.role] = s; });
    var fb = {}; (G.fabled || []).forEach(function (id) { fb[id] = 1; });
    var src = D.nightOrder[key] || [];
    if (key === 'first') { var em = evilMeetItem(); if (em) src = [em].concat(src); }
    var out = [], gi = 0;
    src.forEach(function (x) {
      var inGame = x.id === '__evil_meet' ? true : (!!present[x.id] || !!fb[x.id]);
      if (onlyPresent && !inGame) return;
      out.push({ x: x, i: gi, seat: present[x.id] || null, inGame: inGame, fabled: !!fb[x.id] });
      gi++;
    });
    return out;
  }
  function actOf(key, i) { return G.nightActs[key + ':' + i] || null; }

  function orderRowsHtml(rows, isCur, key, clickable) {
    var all = !!UI.orderAll;
    var step = G.nightStep || 0;
    return rows.map(function (r) {
      var rr = byId[r.x.id] || {};
      var team = rr.team || r.x.team || '';
      var cls = 'ord';
      var fin = isCur && r.i < step;
      if (fin) cls += ' done';
      if (isCur && r.i === step) cls += ' cur';
      if (r.seat && !r.seat.alive) cls += ' gone';
      var act = isCur ? actOf(key, r.i) : null;
      if (act && act.skip) cls += ' skip';
      var sub;
      if (r.seat) sub = r.seat.n + '号 · ' + r.seat.name + (r.seat.alive ? '' : '（已死亡）');
      else if (r.fabled) sub = '传奇角色 · 本局已启用';
      else sub = all ? '本局不在场' : '—';
      var rec = '';
      if (act && (act.target || act.note || act.skip)) {
        rec = '<div class="rec">' + (act.skip ? '已跳过' : '') +
          (act.target ? ' → ' + act.target + '号' : '') +
          (act.note ? ' ' + esc(act.note) : '') + '</div>';
      }
      return '<div class="' + cls + '"' + (clickable ? ' data-gojump="' + r.i + '"' : '') + '>' +
        '<div class="oi">' + (fin ? '✓' : (r.i + 1)) + '</div>' +
        '<div class="ob"><div class="on">' + esc(r.x.name) +
        (team ? ' <span class="tag t-' + team + '">' + esc(TEAMCN[team] || team) + '</span>'
          : (r.x.tag ? ' <span class="tag">' + esc(r.x.tag) + '</span>' : '')) +
        (r.seat && !r.seat.alive ? ' <span class="mk dead">死亡</span>' : '') + '</div>' +
        '<div class="os">' + esc(sub) + '</div>' + rec + '</div></div>';
    }).join('');
  }

  function orderPanelHtml() {
    var key = UI.orderKey || curNightKey();
    var all = !!UI.orderAll;
    var isCur = (G.night === key) && !all;
    var rows = orderRows(key, !all);
    var step = G.nightStep || 0;
    var done = 0;
    rows.forEach(function (r) { if (isCur && r.i < step) done++; });
    var body = orderRowsHtml(rows, isCur, key, !all);

    return '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">夜晚行动顺序 · ' + (key === 'first' ? '首个夜晚' : '首夜之后的夜晚') +
      (isCur ? '（已完成 ' + done + '/' + rows.length + '）' : '（预览）') + '</div>' +
      '<div class="ordbar">' +
      '<button class="chip' + (key === 'first' ? ' on' : '') + '" data-gork="first">首夜顺序</button>' +
      '<button class="chip' + (key === 'other' ? ' on' : '') + '" data-gork="other">其他夜顺序</button>' +
      '<button class="chip' + (all ? ' on p' : '') + '" data-gora="1">' + (all ? '只看本局在场' : '显示全部角色') + '</button>' +
      (isCur ? '<button class="btn" data-gnight="1" style="padding:5px 10px;font-size:12px">去执行 ›</button>' : '') +
      '</div>' +
      '<div class="ordlist">' + (body || '<div class="note">没有可显示的顺序</div>') + '</div>' +
      '<div class="note">' + (all
        ? '当前为剧本完整顺序，仅供查阅。'
        : (key === 'other'
          ? '点击任意一步可直接跳到该步执行；✓ 已完成，红框为当前步。首夜已完成互认，这里不再重复；若本夜产生了新的爪牙/恶魔（红唇女郎接替、方古造爪牙等），请手动补一次互认并记进备注。'
          : '点击任意一步可直接跳到该步执行；✓ 已完成，红框为当前步。')) + '</div></div>';
  }

  /* ================= 角色状态总览 ================= */
  function statusTableHtml() {
    var key = G.night || 'first';
    var list = nightList();
    var info = {};
    list.forEach(function (x, i) {
      var a = actOf(key, i); if (!a) return;
      G.seats.forEach(function (s) { if (s.role === x.id) info[s.n] = a; });
    });
    var rows = G.seats.map(function (s) {
      var r = roleOf(s);
      var mini = '';
      if (!s.alive) mini += '<i class="mini on">死亡</i>';
      if (s.st.poison) mini += '<i class="mini ps">中毒</i>';
      if (s.st.drunk) mini += '<i class="mini dk">醉酒</i>';
      if (s.st.protect) mini += '<i class="mini pt">保护</i>';
      if (s.st.red) mini += '<i class="mini rd">红鲱鱼</i>';
      (s.st.marks || []).forEach(function (m) { mini += '<i class="mini">' + esc(m) + '</i>'; });
      if (!mini) mini = '<span style="color:var(--text-faint)">正常</span>';
      var a = info[s.n], night = '';
      if (a) night = (a.skip ? '已跳过' : '') + (a.target ? ' → ' + a.target + '号' : '') + (a.note ? ' ' + esc(a.note) : '');
      return '<tr data-gseat="' + s.n + '">' +
        '<td class="nowrap">' + s.n + '</td>' +
        '<td class="nowrap' + (s.alive ? '' : ' dead') + '">' + esc(s.name) + '</td>' +
        '<td class="nowrap' + (s.alive ? '' : ' dead') + '">' + (r ? esc(r.name) : '—') + '</td>' +
        '<td class="nowrap">' + (r ? '<span class="tag t-' + r.team + '">' + esc(TEAMCN[r.team]) + '</span>' : '') + '</td>' +
        '<td>' + mini + '</td>' +
        '<td style="min-width:88px;color:var(--purple)">' + (night || '<span style="color:var(--text-faint)">—</span>') + '</td>' +
        '</tr>';
    }).join('');

    return '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">角色状态总览 · ' + (G.phase === 'night' ? '本夜' : '最近一次夜晚') + '行动记录（点任意一行可修改）</div>' +
      '<div class="stwrap"><table class="sttable"><thead><tr>' +
      '<th>座</th><th>玩家</th><th>角色</th><th>阵营</th><th>状态标记</th><th>夜晚记录</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  /* ================= 魔典 ================= */
  function renderGrimoire() {
    var al = aliveSeats().length;
    var phaseText = G.phase === 'setup' ? '准备阶段' :
      G.phase === 'night' ? ('夜晚' + (G.night === 'first' ? '（首夜）' : '（第 ' + G.day + ' 夜）')) :
        G.phase === 'day' ? ('第 ' + G.day + ' 天 · 白天') : '已结束';

    var setupRoles = G.seats.map(roleOf).filter(function (r) { return r && r.setup; });

    var html = '<div class="ghead">' +
      '<div class="l"><b>' + esc(EDNAME(G.edition)) + '</b><span>' + esc(phaseText) + '</span></div>' +
      '<div class="r"><span>存活 ' + al + '/' + G.seats.length + '</span></div></div>';

    if (G.winner) {
      html += '<div class="card winbox"><div class="wt">' + (G.winner === 'good' ? '善良阵营胜利 🎉' : '邪恶阵营胜利 😈') + '</div>' +
        '<div class="note">可查看日志复盘，或新建一局。</div></div>';
    }

    html += '<div class="seatgrid">' + G.seats.map(function (s) {
      var r = roleOf(s);
      var cls = 'seat t-' + (r ? r.team : '') + (s.alive ? '' : ' dead');
      var marks = '';
      if (!s.alive) marks += '<i class="mk dead">死亡</i>';
      if (s.st.poison) marks += '<i class="mk ps">中毒</i>';
      if (s.st.drunk) marks += '<i class="mk dk">醉酒</i>';
      if (s.st.protect) marks += '<i class="mk pt">保护</i>';
      if (s.st.red) marks += '<i class="mk rd">红鲱鱼</i>';
      (s.st.marks || []).forEach(function (m) { marks += '<i class="mk">' + esc(m) + '</i>'; });
      return '<div class="' + cls + '" data-gseat="' + s.n + '">' +
        '<div class="sn">' + s.n + '</div>' +
        '<div class="sn2">' + esc(s.name) + '</div>' +
        '<div class="sr">' + (r ? esc(r.name) : '—') + '</div>' +
        '<div class="sm">' + marks + '</div></div>';
    }).join('') + '</div>';

    if (UI.lsWarn) {
      html += '<div class="card" style="margin-top:10px;padding:10px 12px;background:#fff6e5;border:1px solid #f0d3a0">' +
        '<div style="font-size:13px;color:#8a5a1f">⚠ 当前浏览器禁用了本地存储（常见于隐私模式 / 微信内置浏览器），刷新页面会丢失对局。请及时用「导出对局快照」保存。</div></div>';
    }

    /* 夜晚行动顺序 + 角色状态总览 */
    if (G.bluffs && G.bluffs.length) {
      html += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">😈 恶魔的伪装牌（bluffs）</div>' +
        '<div class="chips">' + G.bluffs.map(function (id) {
          var r = byId[id]; return '<span class="chip on">' + esc(r ? r.name : id) + '</span>';
        }).join('') + '</div>' +
        '<div class="note">首夜互认时给恶魔看的「不在本局的善良角色」，用来伪装自己；只有恶魔和你知道。</div></div>';
    }
    html += orderPanelHtml();
    html += statusTableHtml();

    html += '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">阶段控制</div><div class="qbtns">' +
      (G.phase === 'setup' ? '<button class="btn primary" data-gtonight="1">开始夜晚</button>' : '') +
      (G.phase === 'night' ? '<button class="btn primary" data-gnight="1">继续夜晚流程</button>' : '') +
      (G.phase === 'day' ? '<button class="btn primary" data-gtoday="1">进入白天（提名 / 投票）</button>' : '') +
      (G.phase === 'day' ? '<button class="btn" data-gtonight="1">直接进入夜晚</button>' : '') +
      '<button class="btn" data-glog="1">对局日志</button>' +
      '<button class="btn" data-ganalyze="1">📊 对局分析</button>' +
      '<button class="btn" data-gboard="1">公开看板（投屏）</button>' +
      '<button class="btn" data-gnew="1">新建一局</button>' +
      '</div></div>';

    if (setupRoles.length && G.phase === 'setup') {
      html += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">⚠ 本局含需「设置阶段」处理的角色</div>' +
        setupRoles.map(function (r) {
          return '<div class="nrow"><div class="no">⚙</div><div><div class="nm">' + esc(r.name) + '</div><div class="rm">' + esc(r.ability) + '</div></div></div>';
        }).join('') + '<div class="note">这些角色会在游戏开始前改变场上角色配置（例如增减外来者），请先按规则处理再开始夜晚。</div></div>';
    }

    html += '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">更多</div><div class="qbtns">' +
      '<button class="btn" data-gcopyall="1">复制全部角色卡（发群用）</button>' +
      '<button class="btn" data-gcards="1">生成玩家角色卡链接</button>' +
      '<button class="btn" data-gexport="1">导出对局快照</button>' +
      '<button class="btn" data-gimport="1">导入快照</button>' +
      (G.winner ? '' : '<button class="btn danger" data-gwin="good">判定善良胜利</button><button class="btn danger" data-gwin="evil">判定邪恶胜利</button>') +
      '<button class="btn danger" data-gdel="1">结束并删除本局</button>' +
      '</div><div class="note">数据保存在本机浏览器；换设备可用「导出 / 导入快照」继续。</div></div>';

    view().innerHTML = html;
  }

  /* ================= 座位操作面板 ================= */
  function openSeat(n) {
    var s = seat(n); if (!s) return;
    var r = roleOf(s);
    var ov = document.createElement('div');
    ov.className = 'ov';
    ov.id = 'seatov';
    var marks = (r && r.reminders ? r.reminders : []).concat(['已使用能力', '已提名', '已投票']);
    ov.innerHTML = '<div class="sheet"><div class="sh">' +
      '<div><b>' + s.n + '号 · ' + esc(s.name) + '</b><div class="sub">' + (r ? esc(r.name) + ' · ' + esc(TEAMCN[r.team]) : '无角色') + '</div></div>' +
      '<button class="x" data-gclose="1">✕</button></div>' +
      '<div class="sb">' +
      (r ? '<div class="ability-box" style="margin:0 0 10px">' + esc(r.ability) + '</div>' : '') +
      '<div class="ftl">状态标记</div><div class="chips">' +
      ['poison:中毒', 'drunk:醉酒', 'protect:保护', 'red:红鲱鱼'].map(function (x) {
        var k = x.split(':')[0], nm = x.split(':')[1];
        return '<button class="chip' + (s.st[k] ? ' on' : '') + '" data-gst="' + k + '">' + nm + '</button>';
      }).join('') +
      '<button class="chip' + (s.alive ? '' : ' on') + '" data-gkill="1">' + (s.alive ? '标记死亡' : '复活玩家') + '</button>' +
      '</div>' +
      '<div class="ftl">自定义提示标记</div><div class="chips">' +
      marks.map(function (m) {
        var on = (s.st.marks || []).indexOf(m) >= 0;
        return '<button class="chip' + (on ? ' on p' : '') + '" data-gmark="' + esc(m) + '">' + esc(m) + '</button>';
      }).join('') + '</div>' +
      '<div class="ftl">操作</div><div class="qbtns">' +
      '<button class="btn" data-gswap2="1">更换角色</button>' +
      (r ? '<button class="btn" data-gdetail="' + r.id + '">查看角色详解</button>' : '') +
      '<button class="btn" data-gcard="1">生成该玩家角色卡链接</button>' +
      (s.traveler ? '<button class="btn danger" data-gleave="1">旅行者离场</button>' : '') +
      '</div>' +
      '</div></div>';
    document.body.appendChild(ov);
    UI.sheetSeat = n;
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { closeSheet(); return; }
      var el;
      if ((el = e.target.closest('[data-gclose]'))) { closeSheet(); return; }
      if ((el = e.target.closest('[data-gdetail]'))) { closeSheet(); location.hash = '#/role/' + el.dataset.gdetail; return; }
      if ((el = e.target.closest('[data-gst]'))) {
        var k = el.dataset.gst; s.st[k] = !s.st[k];
        log((s.n + '号 ' + s.name + ' ' + (s.st[k] ? '获得' : '移除') + '标记：' + ({ poison: '中毒', drunk: '醉酒', protect: '保护', red: '红鲱鱼' }[k])), 'mark');
        save(); closeSheet(); renderGrimoire(); return;
      }
      if (e.target.closest('[data-gkill]')) {
        s.alive = !s.alive;
        if (!s.alive) { s.deadDay = G.day; log(s.n + '号 ' + s.name + ' 死亡（' + (r ? r.name : '?') + '）', 'death'); checkWin(); }
        else log(s.n + '号 ' + s.name + ' 复活', 'mark');
        save(); closeSheet(); renderGrimoire(); return;
      }
      if ((el = e.target.closest('[data-gmark]'))) {
        var m = el.dataset.gmark, arr = s.st.marks || (s.st.marks = []);
        var i = arr.indexOf(m); if (i >= 0) arr.splice(i, 1); else arr.push(m);
        save(); closeSheet(); renderGrimoire(); return;
      }
      if (e.target.closest('[data-gswap2]')) { closeSheet(); swapSheet(s.n); return; }
      if (e.target.closest('[data-gleave]')) {
        G.seats = G.seats.filter(function (x) { return x.n !== s.n; });
        log(s.n + '号 旅行者 ' + s.name + ' 离场', 'mark'); save(); closeSheet(); renderGrimoire(); return;
      }
      if (e.target.closest('[data-gcard]')) {
        copyText(cardUrl(s), '角色卡链接已复制，发给 ' + s.name + ' 即可：\n' + cardUrl(s));
        return;
      }
    });
  }
  function closeSheet() { var o = $('#seatov'); if (o) o.remove(); UI.sheetSeat = -1; }

  function swapSheet(n) {
    var s = seat(n); var r = roleOf(s);
    var ov = document.createElement('div'); ov.className = 'ov'; ov.id = 'seatov';
    var pool = D.roles.filter(function (x) { return !r || x.team === r.team || x.edition === G.edition; });
    ov.innerHTML = '<div class="sheet"><div class="sh"><div><b>更换 ' + n + '号 的角色</b><div class="sub">当前：' + (r ? esc(r.name) : '—') + '</div></div><button class="x" data-gclose="1">✕</button></div>' +
      '<div class="sb"><input id="swq" placeholder="搜索角色名" style="width:100%;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:14px;outline:none">' +
      '<div id="swlist" style="max-height:52vh;overflow:auto;margin-top:8px">' + swapList(pool, s) + '</div></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { closeSheet(); return; }
      if (e.target.closest('[data-gclose]')) { closeSheet(); return; }
      var el = e.target.closest('[data-gpick]');
      if (el) {
        var old = r ? r.name : '—';
        s.role = el.dataset.gpick;
        log(n + '号 ' + s.name + ' 角色由「' + old + '」改为「' + byId[s.role].name + '」', 'mark');
        save(); closeSheet(); renderGrimoire(); return;
      }
    });
    var q = $('#swq', ov);
    q.addEventListener('input', function () {
      var kw = q.value.trim();
      var p = pool.filter(function (x) { return !kw || x.name.indexOf(kw) >= 0 || (x.ability || '').indexOf(kw) >= 0; });
      $('#swlist', ov).innerHTML = swapList(p, s);
    });
  }
  function swapList(pool, s) {
    return pool.slice(0, 120).map(function (x) {
      return '<div class="nrow" data-gpick="' + x.id + '"><div class="no">' + (x.id === s.role ? '✓' : '·') + '</div><div><div class="nm">' + esc(x.name) +
        ' <span class="tag t-' + x.team + '">' + esc(TEAMCN[x.team]) + '</span></div><div class="rm">' + esc(x.ability) + '</div></div></div>';
    }).join('');
  }

  /* ================= 夜晚流程 ================= */
  /* 首夜的「恶魔与爪牙互认」：官方数据里没有这一条，这里补上并放在最前 */
  function evilMeetItem() {
    var has = G && G.seats.some(function (s) {
      var r = byId[s.role]; return r && (r.team === 'demon' || r.team === 'minion');
    });
    if (!has) return null;
    return {
      id: '__evil_meet', name: '恶魔与爪牙互认', team: '', tag: '邪恶', order: -1,
      reminder: '唤醒所有爪牙与恶魔，让他们互相认识（爪牙知道恶魔是谁、彼此是谁；恶魔知道爪牙是谁）。' +
        '然后单独给恶魔看 3 张「不在本局的善良角色」作为伪装（bluffs）。首夜之后不再互认。'
    };
  }

  function nightList() {
    var present = {};
    G.seats.forEach(function (s) { if (s.role) present[s.role] = s; });
    var fb = {}; (G.fabled || []).forEach(function (id) { fb[id] = 1; });
    var base = (D.nightOrder[G.night] || []).filter(function (x) { return present[x.id] || fb[x.id]; });
    if (G.night === 'first') { var em = evilMeetItem(); if (em) base = [em].concat(base); }
    return base;
  }

  function renderNight() {
    var list = nightList();
    var i = Math.min(G.nightStep, list.length);
    var html = '<div class="backbar"><button data-gback2="1">‹ 魔典</button><span style="font-size:12px;color:var(--text-faint)">' +
      (G.night === 'first' ? '首个夜晚' : '第 ' + G.day + ' 夜') + ' · ' + (i + 1) + '/' + list.length + '</span></div>';

    html += '<div class="card" style="padding:10px 12px"><div class="nprog"><div class="bar" style="width:' +
      (list.length ? Math.round(i / list.length * 100) : 0) + '%"></div></div></div>';

    if (i >= list.length) {
      html += '<div class="card" style="margin-top:12px;padding:14px;text-align:center">' +
        '<div style="font-size:16px;font-weight:700;margin-bottom:6px">夜晚流程已完成</div>' +
        '<div class="note">确认所有玩家都已行动后，进入白天。</div>' +
        '<div class="qbtns"><button class="btn primary" data-gendnight="1">进入第 ' + (G.day + 1) + ' 天 · 白天</button>' +
        '<button class="btn" data-gbackstep="1">上一步</button></div>' +
        '<div class="ordlist" style="margin-top:10px">' + orderRowsHtml(orderRows(G.night, true), true, G.night, true) + '</div>' +
        '</div>';
      view().innerHTML = html;
      return;
    }

    var x = list[i];
    var r = byId[x.id];
    var s = null;
    G.seats.forEach(function (p) { if (p.role === x.id) s = p; });
    var act = G.nightActs[G.night + ':' + i] || {};

    var isMeet = x.id === '__evil_meet';
    html += '<div class="card nightcard">' +
      '<div class="nh"><div class="no">' + (i + 1) + '</div><div><div class="nm">' + esc(x.name) +
      (x.team ? ' <span class="tag t-' + x.team + '">' + esc(TEAMCN[x.team] || x.team) + '</span>'
        : (x.tag ? ' <span class="tag">' + esc(x.tag) + '</span>' : '')) + '</div>' +
      '<div class="sub">' + (s ? (s.n + '号 · ' + esc(s.name) + (s.alive ? '' : '（已死亡）'))
        : (isMeet ? '全体邪恶玩家（爪牙 + 恶魔）' : (x.team === 'fabled' ? '传奇角色' : '—'))) + '</div></div></div>' +
      (r && r.ability ? '<div class="ability-box">' + esc(r.ability) + '</div>' : '') +
      (x.reminder ? '<div class="sttip"><b>说书人提示</b>' + esc(x.reminder) + '</div>' : '') +
      '</div>';

    html += '<div class="card" style="margin-top:12px;padding:10px 12px">' +
      '<div class="ftl">本夜完整行动顺序（点击可跳步）</div>' +
      '<div class="ordlist">' + orderRowsHtml(orderRows(G.night, true), true, G.night, true) + '</div></div>';

    if (s || isMeet) {
      var rid = isMeet ? x.id : r.id;
      var ab = (window.BOTCAbility && BOTCAbility.has(rid)) ? BOTCAbility.get(rid) : null;
      html += '<div class="card" style="margin-top:12px;padding:12px 14px">';
      if (ab) {
        html += '<div class="ftl">🪄 能力助手 · ' + esc(x.name) + '（自动计算）</div>' +
          '<div class="abhint">' + esc(ab.hint || '') + '</div>';
        if (ab.targets >= 1) html += selectHtml('tgt', '目标玩家', act.target, (ab.excludeSelf && s) ? s.n : 0);
        if (ab.targets >= 2) html += selectHtml('tgt2', '第二个目标', act.target2, (ab.excludeSelf && s) ? s.n : 0);
        if (ab.targets === 0) html += '<div class="note">该环节无需选择目标，直接查看下方计算结果。</div>';
        html += '<div id="abres"></div>';
      } else {
        html += '<div class="ftl">选择目标玩家（记录用）</div>' + selectHtml('tgt', '', act.target, 0) +
          '<div class="abauto">该角色暂未内置自动计算，请用下方快捷效果与备注手动处理，并参考上方「说书人提示」。</div>';
      }
      if (!isMeet) {
        html += '<div id="tgtinfo" class="sttip" style="background:var(--bg-soft);color:var(--text-dim)"></div>' +
          '<div class="ftl">快捷效果（对所选目标生效）</div><div class="chips">' +
          '<button class="chip" data-gneff="poison">标记中毒</button>' +
          '<button class="chip" data-gneff="drunk">标记醉酒</button>' +
          '<button class="chip" data-gneff="protect">标记保护</button>' +
          '<button class="chip" data-gneff="kill">杀死</button>' +
          '<button class="chip" data-gneff="clear">清除中毒/醉酒</button>' +
          '</div>';
      }
      html += '<div class="ftl">备注</div><input id="note" class="sel" placeholder="' +
        (isMeet ? '例如：已给恶魔看伪装牌' : '例如：得知 3 号是镇民') + '" value="' + esc(act.note || '') + '">' +
        '</div>';
    }

    html += '<div class="qbtns">' +
      '<button class="btn primary" data-gnext="1">完成，下一步 ›</button>' +
      '<button class="btn" data-gskip="1">跳过</button>' +
      (i > 0 ? '<button class="btn" data-gbackstep="1">‹ 上一步</button>' : '') +
      '<button class="btn" data-gendnight="1">结束夜晚 → 白天</button>' +
      '</div>';

    if (i > 0 && G.nightActs[G.night + ':' + (i - 1)]) {
      var pv = G.nightActs[G.night + ':' + (i - 1)];
      html += '<div class="note">上一步：' + esc(pv.label || '') + (pv.target ? ' → ' + pv.target + '号' : '') + (pv.note ? '（' + esc(pv.note) + '）' : '') + '</div>';
    }
    view().innerHTML = html;
    var sel = $('#tgt');
    if (sel) { sel.addEventListener('change', onTargetChange); updateTgtInfo(); }
    var s2 = $('#tgt2');
    if (s2) s2.addEventListener('change', onTargetChange);
    updateAbility();
  }

  function selectHtml(id, label, val, excludeN) {
    return (label ? '<div class="ftl">' + esc(label) + '</div>' : '') +
      '<select id="' + id + '" class="sel">' + G.seats.filter(function (p) { return p.n !== excludeN; }).map(function (p) {
        return '<option value="' + p.n + '"' + (val === p.n ? ' selected' : '') + '>' + p.n + '号 ' + esc(p.name) + (p.alive ? '' : '（死亡）') + '</option>';
      }).join('') + '</select>';
  }

  function onTargetChange() { updateTgtInfo(); updateAbility(); }

  /* ---------- 能力自动计算 ---------- */
  function computeAbility() {
    if (!window.BOTCAbility) return null;
    var list = nightList();
    var i = Math.min(G.nightStep, list.length);
    if (i >= list.length) return null;
    var x = list[i], r = byId[x.id];
    if (!r && x.id !== '__evil_meet') return null;
    if (!BOTCAbility.has(x.id)) return null;
    var s = null; G.seats.forEach(function (p) { if (p.role === x.id) s = p; });
    if (!s && x.id !== '__evil_meet') return null;
    var ctx = BOTCAbility.buildCtx(G, s, { byId: byId, log: log, save: save });
    var ab = BOTCAbility.get(x.id);
    var a1 = $('#tgt'), a2 = $('#tgt2');
    var t1 = a1 ? seat(+a1.value) : null;
    var t2 = a2 ? seat(+a2.value) : null;
    return { ab: ab, res: ab.calc(ctx, t1, t2), self: s };
  }

  function abResHtml(res) {
    if (!res) return '';
    var h = '<div class="abbox">' +
      '<div class="abinfo"' + (res.info && res.info.length > 22 ? ' style="font-size:16px;line-height:1.5"' : '') + '>' + esc(res.info) + '</div>' +
      (res.detail ? '<div class="abdetail">' + esc(res.detail) + '</div>' : '') +
      (res.say ? '<div class="absay"><b>给玩家</b>' + esc(res.say) + '</div>' : '') +
      '</div>' +
      (res.warn ? '<div class="abwarn">' + esc(res.warn) + '</div>' : '');
    if (res.actions && res.actions.length) {
      h += '<div class="ftl">执行</div><div class="chips">' + res.actions.map(function (a, i) {
        return '<button class="chip on p" data-gab="' + i + '">' + esc(a.label) + '</button>';
      }).join('') + '</div>';
    }
    if (res.reroll) h += '<div class="qbtns"><button class="btn" data-gabroll="1">重新生成一组</button></div>';
    return h;
  }

  function updateAbility() {
    var box = $('#abres'); if (!box) return;
    var c = computeAbility();
    if (!c) { box.innerHTML = ''; UI.abRes = null; return; }
    UI.abRes = c;
    var warn = (c.self && (c.self.st.poison || c.self.st.drunk))
      ? '<div class="abwarn">⚠ 该角色当前中毒 / 醉酒 —— 规则上你可以给出任意信息。下方是「真实」计算结果，仅供你参考（可故意给错）。</div>' : '';
    box.innerHTML = warn + abResHtml(c.res);
    var nt = $('#note');
    /* 只在信息很短时自动填入备注（互认环节这类长文本不自动填，避免污染记录） */
    if (nt && !nt.value && c.res && c.res.info && c.res.info !== '—' && c.res.info.length <= 24) nt.value = c.res.info;
  }

  function runAbility(i) {
    var c = UI.abRes;
    if (!c || !c.res || !c.res.actions || !c.res.actions[i]) return;
    c.res.actions[i].run();
    save();
    renderNight();
  }

  function updateTgtInfo() {
    var box = $('#tgtinfo'); if (!box) return;
    var sel = $('#tgt'); if (!sel) return;
    var s = seat(+sel.value); if (!s) { box.textContent = ''; return; }
    var r = roleOf(s), t = [s.alive ? '存活' : '已死亡'];
    if (s.st.poison) t.push('中毒');
    if (s.st.drunk) t.push('醉酒');
    if (s.st.protect) t.push('受保护');
    if (s.st.red) t.push('红鲱鱼');
    (s.st.marks || []).forEach(function (m) { t.push(m); });
    box.innerHTML = '<b>' + s.n + '号 ' + esc(s.name) + '</b> 当前：' + esc(t.join(' · ')) +
      (r ? '　｜　' + esc(r.name) : '');
  }

  function nightStepDone(skip) {
    var list = nightList();
    var i = Math.min(G.nightStep, list.length);
    if (i >= list.length) return;
    var x = list[i];
    var act = G.nightActs[G.night + ':' + i] || {};
    var tgt = null, note = '';
    var sel = $('#tgt'), nt = $('#note'), s2 = $('#tgt2');
    if (sel) tgt = +sel.value;
    if (nt) note = nt.value.trim();
    act.label = x.name;
    if (tgt) act.target = tgt;
    if (s2) act.target2 = +s2.value;
    if (note) act.note = note;
    act.skip = !!skip;
    G.nightActs[G.night + ':' + i] = act;
    log('夜晚 · ' + x.name + (skip ? '（跳过）' : (tgt ? ' → ' + tgt + '号' : '')) + (note ? '：' + note : ''), 'night');
    G.nightStep = i + 1;
    save();
    renderNight();
  }

  /* ---------- 白天 / 即时能力 ---------- */
  function dayAbilityHtml() {
    if (!window.BOTCAbility) return '';
    var list = G.seats.filter(function (s) {
      var r = roleOf(s);
      return r && BOTCAbility.has(r.id) && BOTCAbility.get(r.id).when === 'day';
    });
    if (!list.length) return '';
    return '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">⚡ 白天 / 即时能力（点击使用）</div><div class="chips">' +
      list.map(function (s) {
        var r = roleOf(s);
        return '<button class="chip" data-gday="' + s.n + '">' + esc(r.name) + ' · ' + s.n + '号</button>';
      }).join('') + '</div>' +
      '<div class="note">这些能力在白天或满足条件时发动；点击后弹出的面板会按当前局面自动计算并可直接执行。</div></div>';
  }

  function openAbilitySheet(n) {
    var s = seat(n); if (!s) return;
    var r = roleOf(s);
    if (!r || !window.BOTCAbility || !BOTCAbility.has(r.id)) { alert('该角色暂无内置能力助手，请按能力文本手动处理。'); return; }
    var ab = BOTCAbility.get(r.id);
    var ctx = BOTCAbility.buildCtx(G, s, { byId: byId, log: log, save: save });
    var ov = document.createElement('div'); ov.className = 'ov'; ov.id = 'seatov';
    ov.innerHTML = '<div class="sheet"><div class="sh">' +
      '<div><b>' + esc(r.name) + ' · 能力助手</b><div class="sub">' + s.n + '号 ' + esc(s.name) + '　' + esc(TEAMCN[r.team] || '') + '</div></div>' +
      '<button class="x" data-gclose="1">✕</button></div>' +
      '<div class="sb"><div class="ability-box" style="margin:0 0 8px">' + esc(r.ability) + '</div>' +
      '<div class="abhint">' + esc(ab.hint || '') + '</div>' +
      (ab.targets >= 1 ? selectHtml('atgt', '目标玩家', null, ab.excludeSelf ? s.n : 0) : '') +
      (ab.targets >= 2 ? selectHtml('atgt2', '第二个目标', null, ab.excludeSelf ? s.n : 0) : '') +
      '<div id="ares"></div></div></div>';
    document.body.appendChild(ov);
    function refresh() {
      var t1 = $('#atgt', ov) ? seat(+$('#atgt', ov).value) : null;
      var t2 = $('#atgt2', ov) ? seat(+$('#atgt2', ov).value) : null;
      var res = ab.calc(ctx, t1, t2);
      UI.abRes = { res: res, self: s };
      var warn = (s.st.poison || s.st.drunk)
        ? '<div class="abwarn">⚠ 该角色当前中毒 / 醉酒 —— 你可给出任意信息，下方为真实计算结果。</div>' : '';
      $('#ares', ov).innerHTML = warn + abResHtml(res);
    }
    refresh();
    ['atgt', 'atgt2'].forEach(function (id) { var e = $('#' + id, ov); if (e) e.addEventListener('change', refresh); });
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { closeSheet(); return; }
      if (e.target.closest('[data-gclose]')) { closeSheet(); return; }
      var el = e.target.closest('[data-gab]');
      if (el) {
        var c = UI.abRes;
        if (c && c.res && c.res.actions && c.res.actions[+el.dataset.gab]) {
          c.res.actions[+el.dataset.gab].run();
          save(); closeSheet(); renderDay();
        }
        return;
      }
      if (e.target.closest('[data-gabroll]')) { refresh(); return; }
    });
  }

  /* ================= 白天 ================= */
  function renderDay() {
    var al = aliveSeats();
    var need = Math.ceil(al.length / 2);
    var html = '<div class="backbar"><button data-gback2="1">‹ 魔典</button><span style="font-size:12px;color:var(--text-faint)">第 ' + G.day + ' 天 · 白天（存活 ' + al.length + ' 人，处决需 ' + need + ' 票）</span></div>';

    html += '<div class="card" style="padding:12px 14px"><div class="ftl">讨论计时</div>' +
      '<div class="chips">' + [1, 2, 3, 5, 10].map(function (m) {
        return '<button class="chip' + (UI.timerMin === m ? ' on p' : '') + '" data-gtm="' + m + '">' + m + ' 分钟</button>';
      }).join('') + '</div>' +
      '<div class="timer" id="timer">' + fmtTime(UI.timerLeft) + '</div>' +
      '<div class="qbtns"><button class="btn" data-gtstart="1">' + (UI.timer ? '暂停' : '开始') + '</button><button class="btn" data-gtreset="1">重置</button></div></div>';

    var today = G.noms.filter(function (v) { return v.day === G.day; });
    html += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">今日提名</div>' +
      (today.length ? today.map(function (v, k) {
        var yes = v.votes.filter(function (x) { return x.yes === 1; }).length;
        var no = v.votes.filter(function (x) { return x.yes === 0; }).length;
        var sk = v.votes.filter(function (x) { return x.yes === -1; }).length;
        return '<div class="nrow"><div class="no">' + (k + 1) + '</div><div><div class="nm">' + v.by + '号 → ' + v.to + '号</div>' +
          '<div class="rm">赞成 ' + yes + ' · 反对 ' + no + ' · 弃权 ' + sk +
          (v.result === 'exec' ? ' · <b style="color:var(--accent)">已处决</b>' : (v.result === 'tie' ? ' · 未通过' : (v.open ? ' · 投票中' : ''))) + '</div></div></div>';
      }).join('') : '<div class="note">还没有提名</div>') + '</div>';

    html += dayAbilityHtml();

    if (UI.vote) {
      var v = UI.vote;
      var order = al.slice();
      var pos = -1;
      order.forEach(function (s, k) { if (s.n === v.to) pos = k; });
      if (pos >= 0) order = order.slice(pos + 1).concat(order.slice(0, pos + 1));
      order = order.filter(function (s) { return s.n !== v.to; });
      html += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">投票：' + v.by + '号 提名 ' + v.to + '号 ' + esc(seat(v.to) ? seat(v.to).name : '') + '</div>' +
        order.map(function (s) {
          var rec = v.votes.filter(function (x) { return x.seat === s.n; })[0] || { yes: -1, extra: 0 };
          return '<div class="vrow"><div class="vn">' + s.n + '号 ' + esc(s.name) + '</div><div class="vb">' +
            '<button class="chip' + (rec.yes === 1 ? ' on p' : '') + '" data-gv="1|' + s.n + '">赞成</button>' +
            '<button class="chip' + (rec.yes === 0 ? ' on' : '') + '" data-gv="0|' + s.n + '">反对</button>' +
            '<button class="chip' + (rec.yes === -1 ? ' on' : '') + '" data-gv="-1|' + s.n + '">弃权</button>' +
            '<span class="ex">额外 ' + (rec.extra || 0) + '<button data-gvx="1|' + s.n + '">+</button><button data-gvx="-1|' + s.n + '">-</button></span>' +
            '</div></div>';
        }).join('') +
        '<div class="note">当前赞成 <b>' + v.votes.filter(function (x) { return x.yes === 1; }).length + '</b> 票（含额外票） · 处决门槛 ' + need + ' 票</div>' +
        '<div class="qbtns">' +
        '<button class="btn primary" data-gvoteend="1">结束投票</button>' +
        '<button class="btn danger" data-gvotecancel="1">取消提名</button>' +
        '</div></div>';
    } else if (G.execToday === G.day) {
      html += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">今日已处决一人</div>' +
        '<div class="note">规则限制：每个白天最多处决一名玩家。</div>' +
        '<div class="qbtns"><button class="btn primary" data-gtonight="1">结束白天 → 进入夜晚</button></div></div>';
    } else {
      html += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">发起提名</div>' +
        '<div class="npr">' +
        '<select id="nby" class="sel">' + al.filter(function (s) { return !s.nominated; }).map(function (s) {
          return '<option value="' + s.n + '">' + s.n + '号 ' + esc(s.name) + '</option>';
        }).join('') + '</select><span>提名</span>' +
        '<select id="nto" class="sel">' + al.filter(function (s) {
          return !G.noms.some(function (v) { return v.day === G.day && v.to === s.n; });
        }).map(function (s) { return '<option value="' + s.n + '">' + s.n + '号 ' + esc(s.name) + '</option>'; }).join('') + '</select>' +
        '</div>' +
        '<div class="qbtns"><button class="btn primary" data-gnominate="1">开始投票</button>' +
        '<button class="btn" data-gtonight="1">白天结束 → 进入夜晚</button></div>' +
        '<div class="note">规则：每名存活玩家每天只能提名一次、只能被提名一次；死亡玩家不能提名也不能投票；赞成票需 ≥ 存活人数的一半（向上取整）才会被处决。</div></div>';
      view().innerHTML = html;
      var sa = $('#nby'), sb = $('#nto');
      if (sa && sb && sa.value === sb.value && sb.options.length > 1) sb.selectedIndex = 1;
      return;
    }

    view().innerHTML = html;
  }

  function fmtTime(s) {
    s = Math.max(0, s | 0);
    var m = Math.floor(s / 60), q = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (q < 10 ? '0' : '') + q;
  }
  function tick() {
    if (!UI.timer) return;
    UI.timerLeft--;
    var el = $('#timer');
    if (el) el.textContent = fmtTime(UI.timerLeft);
    if (UI.timerLeft <= 0) {
      clearInterval(UI.timer); UI.timer = null;
      try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
      alert('讨论时间到');
    }
  }

  function endVote() {
    var v = UI.vote; if (!v) return;
    var yes = 0, no = 0;
    v.votes.forEach(function (x) { if (x.yes === 1) yes += (1 + (x.extra || 0)); else if (x.yes === 0) no += (1 + (x.extra || 0)); });
    var alive = aliveSeats().length;
    var need = Math.ceil(alive / 2);
    var today = G.noms.filter(function (x) { return x.day === G.day; });
    var maxYes = Math.max.apply(null, today.map(function (x) {
      return x.votes.filter(function (y) { return y.yes === 1; }).reduce(function (a, b) { return a + 1 + (b.extra || 0); }, 0);
    }).concat([0]));
    var ties = today.filter(function (x) {
      return x.votes.filter(function (y) { return y.yes === 1; }).reduce(function (a, b) { return a + 1 + (b.extra || 0); }, 0) === maxYes;
    });
    v.open = false;
    if (yes >= need && ties.length === 1 && ties[0] === v) {
      v.result = 'exec';
      var s = seat(v.to);
      if (s) { s.alive = false; s.deadDay = G.day; }
      G.execToday = G.day;
      log('第 ' + G.day + ' 天：' + v.to + '号 ' + (s ? s.name : '') + ' 被处决（赞成 ' + yes + '）', 'exec');
      checkWin();
    } else {
      v.result = 'tie';
      log('第 ' + G.day + ' 天：' + v.by + '号 提名 ' + v.to + '号 未通过（赞成 ' + yes + ' / 门槛 ' + need + (ties.length > 1 ? '，平票' : '') + '）', 'vote');
    }
    UI.vote = null;
    G.noms.forEach(function (x) { if (x.open) x.open = false; });
    save();
    renderDay();
  }

  /* ================= 胜负 ================= */
  function checkWin() {
    if (G.winner) return true;
    var al = aliveSeats();
    if (!al.length) { finish('evil'); return true; }
    var demons = al.filter(function (s) { var r = roleOf(s); return r && r.team === 'demon'; });
    if (!demons.length) { finish('good'); return true; }
    if (al.length <= 2) { finish('evil'); return true; }
    return false;
  }
  function finish(w) {
    G.winner = w; G.phase = 'over';
    log('对局结束：' + (w === 'good' ? '善良阵营胜利' : '邪恶阵营胜利') + '（请确认是否有恶魔继承类能力尚未结算）', 'mark');
    save();
  }

  /* ================= 日志 ================= */
  function renderLog() {
    var html = '<div class="backbar"><button data-gback2="1">‹ 魔典</button><span style="font-size:12px;color:var(--text-faint)">共 ' + G.log.length + ' 条</span></div>';
    var cur = null;
    html += '<div class="card">' + G.log.map(function (l) {
      var head = '';
      var key = l.day + '|' + (l.phase === 'night' ? '夜晚' : l.phase === 'day' ? '白天' : '准备');
      if (key !== cur) { cur = key; head = '<div class="logday">第 ' + l.day + ' ' + (l.phase === 'night' ? '夜' : l.phase === 'day' ? '天' : ' · 准备') + '</div>'; }
      var ic = { death: '💀', exec: '⚖️', night: '🌙', vote: '🗳', mark: '🏷', setup: '⚙' }[l.tag] || '•';
      return head + '<div class="logrow"><span class="li">' + ic + '</span><span>' + esc(l.text) + '</span></div>';
    }).join('') + '</div>';
    view().innerHTML = html;
  }

  /* ================= 公开看板 ================= */
  function renderBoard() {
    if (!G) { view().innerHTML = '<div class="empty">还没有进行中的对局</div>'; return; }
    var al = aliveSeats().length;
    var html = '<div class="ghead"><div class="l"><b>' + esc(EDNAME(G.edition)) + '</b><span>' +
      (G.phase === 'day' ? '第 ' + G.day + ' 天 · 白天' : G.phase === 'night' ? '夜晚' : '准备中') + '</span></div>' +
      '<div class="r"><span>存活 ' + al + '/' + G.seats.length + '</span></div></div>';
    html += '<div class="seatgrid big">' + G.seats.map(function (s) {
      return '<div class="seat ' + (s.alive ? '' : 'dead') + '"><div class="sn">' + s.n + '</div><div class="sn2">' + esc(s.name) + '</div>' +
        '<div class="sr">' + (s.alive ? '存活' : '死亡') + '</div></div>';
    }).join('') + '</div>';
    var today = G.noms.filter(function (v) { return v.day === G.day; });
    if (today.length) {
      html += '<div class="card" style="margin-top:12px"><div class="ftl" style="padding:12px 14px 0">今日提名与投票</div>' +
        today.map(function (v) {
          var yes = v.votes.filter(function (x) { return x.yes === 1; }).length;
          return '<div class="nrow"><div class="no">🗳</div><div><div class="nm">' + v.by + '号 → ' + v.to + '号</div>' +
            '<div class="rm">赞成 ' + yes + (v.result === 'exec' ? ' · 已处决' : v.result === 'tie' ? ' · 未通过' : '') + '</div></div></div>';
        }).join('') + '</div>';
    }
    if (G.winner) html += '<div class="card winbox" style="margin-top:12px"><div class="wt">' + (G.winner === 'good' ? '善良阵营胜利 🎉' : '邪恶阵营胜利 😈') + '</div></div>';
    html += '<div class="note">此页只显示公开信息，适合投屏 / 共享屏幕给玩家看。</div>';
    view().innerHTML = html;
  }

  /* ================= 玩家角色卡 ================= */
  function cardPayload(s) {
    var r = roleOf(s);
    return { n: s.n, name: s.name, role: r ? r.name : '', team: r ? TEAMCN[r.team] : '', ab: r ? r.ability : '' };
  }
  function cardUrl(s) {
    var j = JSON.stringify(cardPayload(s));
    var b = btoa(unescape(encodeURIComponent(j)));
    return location.origin + location.pathname + '#/pc/' + b;
  }
  function renderPCard(code) {
    var p = null;
    try { p = JSON.parse(decodeURIComponent(escape(atob(code)))); } catch (e) { }
    if (!p) { view().innerHTML = '<div class="empty">角色卡链接无效或已过期</div>'; return; }
    view().innerHTML = '<div class="card" style="margin-top:14px;text-align:center;padding:18px 14px">' +
      '<div style="font-size:13px;color:var(--text-faint)">' + p.n + '号 · ' + esc(p.name) + '</div>' +
      '<h1 style="margin:8px 0 4px;font-size:26px">' + esc(p.role) + '</h1>' +
      '<div><span class="tag">' + esc(p.team) + '</span></div>' +
      '<div class="ability-box" style="margin-top:14px">' + esc(p.ab) + '</div>' +
      '<div class="note" style="margin-top:14px">请对其他人保密你的角色。说书人会在夜晚唤醒你（如果需要）。</div></div>';
  }

  /* ================= 导入导出 ================= */
  function exportGame() {
    var blob = new Blob([JSON.stringify(G, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '血染对局_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importGame() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var o = JSON.parse(fr.result);
          if (!o || !o.seats) throw new Error('bad');
          G = o; save(); location.hash = '#/game';
        } catch (e) { alert('文件格式不正确'); }
      };
      fr.readAsText(f);
    };
    inp.click();
  }
  function copyText(text, msg) {
    var done = function () { alert(msg || text); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { prompt('复制以下内容：', text); });
    } else { prompt('复制以下内容：', text); }
  }

  /* ================= 事件委托 ================= */
  document.addEventListener('click', function (e) {
    var el;
    /* 新建对局 */
    if ((el = e.target.closest('[data-ged]'))) { UI.newCfg.ed = el.dataset.ged; UI.newCfg.roles = null; renderNew(); return; }
    if ((el = e.target.closest('[data-gn]'))) { UI.newCfg.n = +el.dataset.gn; UI.newCfg.roles = null; renderNew(); return; }
    if ((el = e.target.closest('[data-gtv]'))) {
      var a = UI.newCfg.travelers, id = el.dataset.gtv, i = a.indexOf(id);
      if (i >= 0) a.splice(i, 1); else a.push(id); renderNew(); return;
    }
    if ((el = e.target.closest('[data-gfb]'))) {
      var b = UI.newCfg.fabled, f = el.dataset.gfb, k = b.indexOf(f);
      if (k >= 0) b.splice(k, 1); else b.push(f); renderNew(); return;
    }
    if (e.target.closest('[data-gdeal]')) { syncNames(); doDeal(); return; }
    if (e.target.closest('[data-gstart]')) { syncNames(); startGame(); return; }
    if ((el = e.target.closest('[data-gseatshuffle]'))) { syncNames(); if (UI.newCfg && UI.newCfg.roles) { UI.newCfg.roles = shuffle(UI.newCfg.roles); renderNew(); } return; }
    if ((el = e.target.closest('[data-gswap]'))) { swapNew(+el.dataset.gswap); return; }

    /* 魔典 */
    if ((el = e.target.closest('[data-gork]'))) { UI.orderKey = el.dataset.gork; renderGrimoire(); return; }
    if (e.target.closest('[data-gora]')) { UI.orderAll = !UI.orderAll; renderGrimoire(); return; }
    if ((el = e.target.closest('[data-gojump]'))) { jumpNight(+el.dataset.gojump); return; }
    if ((el = e.target.closest('[data-gseat]'))) { openSeat(+el.dataset.gseat); return; }
    if (e.target.closest('[data-gback]') || e.target.closest('[data-gback2]')) { location.hash = G ? '#/game' : '#/home'; return; }
    if (e.target.closest('[data-gnight]')) { location.hash = '#/game/night'; return; }
    if (e.target.closest('[data-gtoday]')) { location.hash = '#/game/day'; return; }
    if (e.target.closest('[data-glog]')) { location.hash = '#/game/log'; return; }
    if (e.target.closest('[data-ganalyze]')) { location.hash = '#/analyze'; return; }
    if (e.target.closest('[data-gdraw]')) { location.hash = '#/draw'; return; }
    if (e.target.closest('[data-gboard]')) { location.hash = '#/board'; return; }
    if (e.target.closest('[data-gnew]')) { UI.newCfg = null; location.hash = '#/game/new'; return; }
    if (e.target.closest('[data-gtonight]')) { toNight(); return; }
    if (e.target.closest('[data-gendnight]')) { endNight(); return; }
    if (e.target.closest('[data-gnext]')) { nightStepDone(false); return; }
    if (e.target.closest('[data-gskip]')) { nightStepDone(true); return; }
    if (e.target.closest('[data-gbackstep]')) { G.nightStep = Math.max(0, G.nightStep - 1); save(); renderNight(); return; }
    if ((el = e.target.closest('[data-gab]'))) { runAbility(+el.dataset.gab); return; }
    if (e.target.closest('[data-gabroll]')) {
      /* 重抽：互认环节重抽的是「伪装牌」 */
      var lb = nightList(), bi = Math.min(G.nightStep, lb.length);
      if (lb[bi] && lb[bi].id === '__evil_meet') { G.bluffs = null; save(); }
      renderNight(); return;
    }
    if ((el = e.target.closest('[data-gneff]'))) { nightEffect(el.dataset.gneff); return; }
    if (e.target.closest('[data-gdel]')) {
      if (confirm('确定结束并删除当前对局？')) { G = null; save(); location.hash = '#/game/new'; }
      return;
    }
    if (e.target.closest('[data-gexport]')) { exportGame(); return; }
    if (e.target.closest('[data-gimport]')) { importGame(); return; }
    if ((el = e.target.closest('[data-gwin]'))) {
      G.winner = el.dataset.gwin; G.phase = 'over';
      log('对局结束：' + (G.winner === 'good' ? '善良阵营胜利' : '邪恶阵营胜利'), 'mark'); save(); renderGrimoire(); return;
    }
    if (e.target.closest('[data-gcopyall]')) {
      copyText(G.seats.map(function (s) {
        var r = roleOf(s);
        return s.n + '号 ' + s.name + '：' + (r ? r.name + '（' + TEAMCN[r.team] + '）\n' + r.ability : '—');
      }).join('\n\n'), '已复制全部角色卡文本，可直接发到群里（私信各自发送）');
      return;
    }
    if (e.target.closest('[data-gcards]')) {
      copyText(G.seats.map(function (s) { return s.n + '号 ' + s.name + '：' + cardUrl(s); }).join('\n'), '已复制全部角色卡链接，请分别私发给对应玩家');
      return;
    }

    /* 白天 */
    if ((el = e.target.closest('[data-gday]'))) { openAbilitySheet(+el.dataset.gday); return; }
    if ((el = e.target.closest('[data-gtm]'))) { UI.timerMin = +el.dataset.gtm; UI.timerLeft = UI.timerMin * 60; renderDay(); return; }
    if (e.target.closest('[data-gtstart]')) {
      if (UI.timer) { clearInterval(UI.timer); UI.timer = null; }
      else { if (!UI.timerLeft) UI.timerLeft = (UI.timerMin || 3) * 60; UI.timer = setInterval(tick, 1000); }
      renderDay(); return;
    }
    if (e.target.closest('[data-gtreset]')) {
      if (UI.timer) { clearInterval(UI.timer); UI.timer = null; }
      UI.timerLeft = (UI.timerMin || 3) * 60; renderDay(); return;
    }
    if (e.target.closest('[data-gnominate]')) {
      var by = +$('#nby').value, to = +$('#nto').value;
      if (!by || !to || by === to) { alert('请选择不同的提名者与被提名者'); return; }
      var v = { day: G.day, by: by, to: to, votes: [], open: true, result: '' };
      G.noms.push(v);
      (function (x) { G.seats.forEach(function (s) { if (s.n === x) s.nominated = true; }); })(by);
      UI.vote = v;
      log('第 ' + G.day + ' 天：' + by + '号 提名 ' + to + '号', 'vote');
      save(); renderDay(); return;
    }
    if ((el = e.target.closest('[data-gv]'))) {
      var parts = el.dataset.gv.split('|'), yes = +parts[0], sn = +parts[1];
      var rec = UI.vote.votes.filter(function (x) { return x.seat === sn; })[0];
      if (!rec) { rec = { seat: sn, yes: yes, extra: 0 }; UI.vote.votes.push(rec); }
      else rec.yes = yes;
      save(); renderDay(); return;
    }
    if ((el = e.target.closest('[data-gvx]'))) {
      var p2 = el.dataset.gvx.split('|'), d = +p2[0], s2 = +p2[1];
      var r2 = UI.vote.votes.filter(function (x) { return x.seat === s2; })[0];
      if (!r2) { r2 = { seat: s2, yes: -1, extra: 0 }; UI.vote.votes.push(r2); }
      r2.extra = (r2.extra || 0) + d;
      save(); renderDay(); return;
    }
    if (e.target.closest('[data-gvoteend]')) { endVote(); return; }
    if (e.target.closest('[data-gvotecancel]')) {
      var can = UI.vote;
      G.noms = G.noms.filter(function (x) { return x !== can; });
      if (can) G.seats.forEach(function (s) { if (s.n === can.by) s.nominated = false; });
      UI.vote = null; save(); renderDay(); return;
    }
  });

  function syncNames() {
    $$('.gname').forEach(function (i) { UI.newCfg.names[+i.dataset.gi] = i.value; });
  }
  function swapNew(i) {
    var cfg = UI.newCfg;
    var cur = byId[cfg.roles[i]];
    var pool = D.roles.filter(function (r) { return r.edition === cfg.ed && r.team === cur.team && r.id !== cur.id; });
    var names = pool.map(function (r, k) { return (k + 1) + '. ' + r.name; }).join('\n');
    var v = prompt('将 ' + (i + 1) + '号 的「' + cur.name + '」换成：\n' + names + '\n\n输入序号：');
    var k = parseInt(v, 10) - 1;
    if (!isNaN(k) && pool[k]) { cfg.roles[i] = pool[k].id; renderNew(); }
  }

  function nightEffect(kind) {
    var sel = $('#tgt'); if (!sel) return;
    var s = seat(+sel.value); if (!s) return;
    var nm = s.n + '号 ' + s.name;
    if (kind === 'poison') { s.st.poison = true; log(nm + ' 中毒', 'mark'); }
    if (kind === 'drunk') { s.st.drunk = true; log(nm + ' 醉酒', 'mark'); }
    if (kind === 'protect') { s.st.protect = true; log(nm + ' 获得保护', 'mark'); }
    if (kind === 'clear') { s.st.poison = false; s.st.drunk = false; log(nm + ' 清除中毒/醉酒', 'mark'); }
    if (kind === 'kill') {
      s.alive = false; s.deadDay = G.day;
      log(nm + ' 死亡（' + (roleOf(s) ? roleOf(s).name : '') + '）', 'death');
      checkWin();
    }
    save(); renderNight();
  }

  function jumpNight(i) {
    if (G.phase === 'setup') { G.phase = 'night'; G.night = 'first'; G.nightStep = 0; log('首个夜晚开始', 'night'); }
    else if (G.phase !== 'night') { alert('当前不在夜晚阶段，请先点「进入夜晚」。'); return; }
    G.nightStep = Math.max(0, Math.min(i, nightList().length));
    save();
    if (location.hash === '#/game/night') renderNight();
    else location.hash = '#/game/night';
  }

  function toNight() {
    G.seats.forEach(function (s) { s.st.poison = false; });
    G.phase = 'night';
    G.night = (G.day === 0) ? 'first' : 'other';
    G.nightStep = 0;
    G.nightActs = {};
    log((G.night === 'first' ? '首个夜晚' : '第 ' + G.day + ' 夜') + '开始（已清除全员中毒标记）', 'night');
    save();
    location.hash = '#/game/night';
  }
  function endNight() {
    G.day = G.day + 1;
    G.phase = 'day';
    G.seats.forEach(function (s) { s.voted = false; s.nominated = false; });
    UI.vote = null;
    log('进入第 ' + G.day + ' 天 · 白天', 'day');
    save();
    location.hash = '#/game/day';
  }

  window.BOTCGame = {
    route: route,
    hasGame: function () { return !!G; },
    get: function () { return G; },
    byId: byId,
    TEAMCN: TEAMCN,
    roleOf: function (id) { return byId[id] || null; },
    startWith: function (cfg) { beginGame(cfg); },
    edName: EDNAME,
    /* 抽签台用：按配比随机生成一池角色（不分配座位），返回角色 id 数组 */
    rollPool: function (ed, n) { return deal(ed, n).roles.map(function (r) { return r.id; }); },
    jinxCheck: function (ids) {
      var names = ids.map(function (i) { return (byId[i] || {}).name; }).filter(Boolean);
      if (!JX) JX = jinxPairs();
      var out = [];
      for (var i = 0; i < names.length; i++)
        for (var j = i + 1; j < names.length; j++)
          if (JX[names[i] + '|' + names[j]]) out.push(names[i] + ' × ' + names[j]);
      return out;
    },
    composition: function (n) { return D.composition[Math.min(Math.max(n - 5, 0), D.composition.length - 1)]; }
  };
})();
