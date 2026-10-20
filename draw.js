/* 染·钟楼谜团 — 抽签台：让玩家自己抽角色（本机袋子 / 远程链接 + 回执） */
(function () {
  'use strict';

  var D = window.BOTC_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var view = function () { return $('#view'); };

  var byId = {};
  D.roles.concat(D.fabled).forEach(function (r) { byId[r.id] = r; });
  var TEAMCN = { townsfolk: '镇民', outsider: '外来者', minion: '爪牙', demon: '恶魔', traveler: '旅行者', fabled: '传奇' };
  var TEAMORDER = ['townsfolk', 'outsider', 'minion', 'demon'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('botcg_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('botcg_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  var DG = LS.get('draw', null);
  var UI = { tab: '', open: -1, msg: '', warn: '' };
  function save() { LS.set('draw', DG); }

  /* ---------------- 工具 ---------------- */
  function rnd(n) {
    if (window.crypto && crypto.getRandomValues) {
      try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { }
    }
    return Math.floor(Math.random() * n);
  }
  function b64u(s) {
    return btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }
  function chk(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return ('0000' + h.toString(36).toUpperCase()).slice(-4);
  }
  function roomId() {
    var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 4; i++) s += c[rnd(c.length)];
    return s;
  }
  function comp(n) {
    return D.composition[Math.min(Math.max(n - 5, 0), D.composition.length - 1)];
  }
  function idxOf(id) { for (var i = 0; i < D.roles.length; i++) if (D.roles[i].id === id) return i; return -1; }
  function edName(id) { var e = D.editions.filter(function (x) { return x.id === id; })[0]; return e ? e.name : id; }

  /* ---------------- 池 ---------------- */
  function newDraw() {
    DG = {
      id: roomId(), ed: 'tb', n: 9, pool: [], mode: 'bag',
      taken: {}, names: [], travelers: [], fabled: [], step: 'pool', cur: 1
    };
    for (var i = 1; i <= 15; i++) DG.names[i - 1] = '玩家' + i;
    UI.tab = ''; UI.open = -1; UI.msg = '';
    save();
  }
  function rollPool() {
    var c = comp(DG.n);
    var pool = D.roles.filter(function (r) { return r.edition === DG.ed; });
    var p = [];
    TEAMORDER.forEach(function (t) {
      var g = pool.filter(function (r) { return r.team === t; });
      g = g.slice();
      for (var i = g.length - 1; i > 0; i--) { var j = rnd(i + 1); var x = g[i]; g[i] = g[j]; g[j] = x; }
      p = p.concat(g.slice(0, c[t]));
    });
    DG.pool = p.map(function (r) { return r.id; });
    save();
  }
  function countTeam(ids) {
    var m = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
    ids.forEach(function (i) { var r = byId[i]; if (r && m[r.team] != null) m[r.team]++; });
    return m;
  }
  function jinxOf(ids) {
    var out = [];
    if (window.BOTCGame && BOTCGame.jinxCheck) return BOTCGame.jinxCheck(ids);
    return out;
  }
  function usedRoles() {
    var u = {};
    Object.keys(DG.taken).forEach(function (k) { u[DG.taken[k].role] = 1; });
    return u;
  }
  function remaining() {
    var u = usedRoles();
    return DG.pool.filter(function (id) { return !u[id]; });
  }

  /* ---------------- 抽签台（说书人端） ---------------- */
  function renderDesk() {
    if (!DG) newDraw();
    if (DG.step === 'draw') return renderDrawStep();
    return renderPoolStep();
  }

  function renderPoolStep() {
    var c = comp(DG.n);
    var cnt = countTeam(DG.pool);
    var jx = jinxOf(DG.pool);
    var edOpts = D.editions.filter(function (e) { return e.id !== 'ngj' && e.id !== 'luf'; });
    var tvPool = D.roles.filter(function (r) { return r.edition === DG.ed && r.team === 'traveler'; });

    var h = '<div class="backbar"><button data-dback="1">‹ 返回开局</button>' +
      '<span style="font-size:12px;color:var(--text-faint)">抽签台 · 第 1 步：准备角色池</span></div>';

    h += '<div class="card" style="padding:14px">' +
      '<div class="ftl">1. 剧本与人数</div><div class="chips">' +
      edOpts.map(function (e) { return '<button class="chip' + (DG.ed === e.id ? ' on' : '') + '" data-ded="' + e.id + '">' + esc(e.name) + '</button>'; }).join('') +
      '</div><div class="chips">' +
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (n) {
        return '<button class="chip' + (DG.n === n ? ' on p' : '') + '" data-dn="' + n + '">' + n + '</button>';
      }).join('') + '</div>' +
      '<div class="note">配比：镇民 ' + c.townsfolk + ' · 外来者 ' + c.outsider + ' · 爪牙 ' + c.minion + ' · 恶魔 ' + c.demon +
      '　｜　当前池 ' + DG.pool.length + '/' + DG.n + '</div></div>';

    h += '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">2. 角色池（本局会用到的角色，暂不分配到人）</div>' +
      '<div class="qbtns"><button class="btn primary" data-droll="1">🎲 按配比随机生成</button>' +
      '<button class="btn" data-dpick="1">✋ 我自己挑</button>' +
      '<button class="btn" data-dclear="1">清空</button></div>';

    if (DG.pool.length) {
      h += '<div class="ftl" style="margin-top:10px">当前池</div><div class="chips">' +
        TEAMORDER.map(function (t) {
          return DG.pool.filter(function (id) { return (byId[id] || {}).team === t; }).map(function (id) {
            return '<button class="chip on t-' + t + '" data-drm="' + esc(id) + '">' + esc(byId[id].name) + ' ✕</button>';
          }).join('');
        }).join('') + '</div>';
      h += '<div class="note">镇民 ' + cnt.townsfolk + '/' + c.townsfolk + ' · 外来者 ' + cnt.outsider + '/' + c.outsider +
        ' · 爪牙 ' + cnt.minion + '/' + c.minion + ' · 恶魔 ' + cnt.demon + '/' + c.demon +
        (DG.pool.length === DG.n ? '　✅ 数量正确' : '　⚠ 数量应为 ' + DG.n) + '</div>';
      if (jx.length) h += '<div class="abwarn">⚠ 相克：' + jx.map(esc).join('、') + '（同时在一个池里会触发相克规则）</div>';
    } else {
      h += '<div class="note">还没有角色。点「随机生成」或「我自己挑」。</div>';
    }

    if (UI.tab === 'pick') {
      h += '<div class="ftl" style="margin-top:12px">点角色加入池（再点池里的角色可移除）</div>';
      TEAMORDER.forEach(function (t) {
        var list = D.roles.filter(function (r) { return r.edition === DG.ed && r.team === t; });
        if (!list.length) return;
        h += '<div class="ftl" style="font-size:12px">' + TEAMCN[t] + '</div><div class="chips">' +
          list.map(function (r) {
            var on = DG.pool.indexOf(r.id) >= 0;
            return '<button class="chip' + (on ? ' on p' : '') + '" data-dadd="' + esc(r.id) + '">' + esc(r.name) + '</button>';
          }).join('') + '</div>';
      });
    }
    h += '</div>';

    h += '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">3. 座位与玩家名（按座位号就坐）</div><div class="namegrid">' +
      Array.apply(null, Array(DG.n)).map(function (_, i) {
        return '<label class="nrow-i"><span>' + (i + 1) + '</span><input class="gname" data-dgi="' + i + '" value="' + esc(DG.names[i] || '') + '" placeholder="玩家' + (i + 1) + '"></label>';
      }).join('') + '</div></div>';

    h += '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">4. 旅行者 / 传奇角色（可选）</div><div class="chips">' +
      tvPool.map(function (r) {
        return '<button class="chip' + (DG.travelers.indexOf(r.id) >= 0 ? ' on' : '') + '" data-dtv="' + r.id + '">' + esc(r.name) + '</button>';
      }).join('') + (tvPool.length ? '' : '<span class="note">该剧本没有旅行者</span>') + '</div>' +
      '<div class="chips">' + D.fabled.map(function (r) {
        return '<button class="chip' + (DG.fabled.indexOf(r.id) >= 0 ? ' on p' : '') + '" data-dfb="' + r.id + '">' + esc(r.name) + '</button>';
      }).join('') + '</div></div>';

    h += '<div class="qbtns"><button class="btn primary" data-dnext="1">下一步：开始抽取 ›</button></div>';
    if (UI.warn) h += '<div class="abwarn">' + esc(UI.warn) + '</div>';

    view().innerHTML = h;
  }

  function renderDrawStep() {
    var done = Object.keys(DG.taken).length;
    var h = '<div class="backbar"><button data-dprev="1">‹ 回到角色池</button>' +
      '<span style="font-size:12px;color:var(--text-faint)">抽签台 · 第 2 步：玩家抽取（' + done + '/' + DG.n + '）</span></div>';

    h += '<div class="card" style="padding:12px 14px"><div class="ftl">抽取方式</div><div class="chips">' +
      '<button class="chip' + (DG.mode === 'bag' ? ' on p' : '') + '" data-dmode="bag">🧰 本机袋子（同一台设备轮流点）</button>' +
      '<button class="chip' + (DG.mode === 'link' ? ' on p' : '') + '" data-dmode="link">🔗 远程链接（各自手机抽）</button>' +
      '</div>' +
      '<div class="note">' + (DG.mode === 'bag'
        ? '把设备递给每位玩家，让他自己点一下卡片抽取；抽到的角色只有他自己看到（说书人可以在他抽完后查看）。'
        : '把当前链接发给对应玩家 → 玩家在自己手机上点「抽取」→ 把页面上的「回执码」发回给你 → 你粘贴导入后自动进入下一位。角色由玩家自己随机抽到，你事先不知道。') +
      '</div></div>';

    if (DG.mode === 'bag') h += bagHtml(); else h += linkHtml();

    if (UI.msg) h += '<div class="card" style="margin-top:10px;padding:10px 12px;background:#eefaf0;border:1px solid #bfe3c8;font-size:13px">' + esc(UI.msg) + '</div>';
    if (UI.warn) h += '<div class="abwarn">' + esc(UI.warn) + '</div>';
    view().innerHTML = h;
  }

  function bagHtml() {
    var done = Object.keys(DG.taken).length;
    var h = '<div class="card" style="margin-top:12px;padding:12px 14px">' +
      '<div class="ftl">袋子 · 已抽取 ' + done + '/' + DG.n + '</div>' +
      '<div class="baggrid">' + Array.apply(null, Array(DG.n)).map(function (_, i) {
        var n = i + 1, t = DG.taken[n];
        if (!t) {
          return '<div class="bagcard back" data-dtake="' + n + '"><div class="bn">' + n + '</div>' +
            '<div class="bt">🎴</div><div class="bs">' + esc(DG.names[i] || ('玩家' + n)) + '</div>' +
            '<div class="bh">点击抽取</div></div>';
        }
        var r = byId[t.role];
        if (UI.open === n) {
          return '<div class="bagcard open t-' + r.team + '"><div class="bn">' + n + '</div>' +
            '<div class="bt">' + esc(r.name) + '</div><div class="bs">' + esc(TEAMCN[r.team]) + '</div>' +
            '<div class="bh">' + esc(r.ability.length > 26 ? r.ability.slice(0, 26) + '…' : r.ability) + '</div>' +
            '<div class="qbtns" style="margin-top:6px"><button class="btn primary" data-dhide="1">我记住了，翻回去</button></div></div>';
        }
        return '<div class="bagcard got" data-dshow="' + n + '"><div class="bn">' + n + '</div>' +
          '<div class="bt">✓</div><div class="bs">' + esc(t.name || DG.names[i] || ('玩家' + n)) + '</div>' +
          '<div class="bh">已抽取（说书人点开查看）</div></div>';
      }).join('') + '</div>' +
      '<div class="note">座位号就是卡片编号。全部抽完后点「开始对局」。</div>' +
      '<div class="qbtns">' + (done === DG.n ? '<button class="btn primary" data-dstart="1">开始对局 ›</button>' : '') +
      '<button class="btn" data-dreset2="1">全部重抽</button></div></div>';
    return h;
  }

  function claimUrl(seat) {
    var rest = remaining().map(idxOf).filter(function (i) { return i >= 0; });
    var p = { v: 1, r: DG.id, e: DG.ed, n: DG.n, s: seat, p: rest };
    return location.origin + location.pathname + '#/draw/' + b64u(JSON.stringify(p));
  }

  function linkHtml() {
    var done = Object.keys(DG.taken).length;
    var k = DG.cur;
    while (DG.taken[k] && k <= DG.n) k++;
    DG.cur = k; save();
    var url = k <= DG.n ? claimUrl(k) : '';
    var h = '<div class="card" style="margin-top:12px;padding:12px 14px">';
    if (k <= DG.n) {
      h += '<div class="ftl">发给第 ' + k + ' 位' + (DG.names[k - 1] ? '（' + esc(DG.names[k - 1]) + '）' : '') + ' 的抽取链接</div>' +
        '<textarea id="durl" class="sel" rows="3" readonly style="font-size:12px">' + esc(url) + '</textarea>' +
        '<div class="qbtns"><button class="btn primary" data-dcopyurl="1">复制链接</button>' +
        '<button class="btn" data-dcopyinvite="1">复制带说明的邀请语</button></div>' +
        '<div class="note">剩余可抽角色 ' + remaining().length + ' 个（已抽走的不会出现在链接里，不会撞角色）。</div>';
    } else {
      h += '<div class="ftl">✅ 全部玩家都已抽取</div>';
    }

    h += '<div class="ftl" style="margin-top:12px">粘贴玩家发回的回执码（可一次粘多行）</div>' +
      '<textarea id="dclaim" class="sel" rows="3" placeholder="例如：D-A1B2-3-045-K3X9"></textarea>' +
      '<div class="qbtns"><button class="btn primary" data-dimport="1">导入回执</button></div>';

    h += '<div class="ftl" style="margin-top:12px">已确认（' + done + '/' + DG.n + '）</div>';
    if (done) {
      h += '<div class="stwrap"><table class="sttable"><thead><tr><th>座</th><th>玩家</th><th>角色</th><th>阵营</th><th></th></tr></thead><tbody>' +
        Object.keys(DG.taken).map(function (n) {
          n = +n;
          var t = DG.taken[n], r = byId[t.role];
          return '<tr><td>' + n + '</td><td>' + esc(t.name || '') + '</td><td>' + esc(r ? r.name : '?') + '</td>' +
            '<td><span class="tag t-' + (r ? r.team : '') + '">' + esc(r ? TEAMCN[r.team] : '') + '</span></td>' +
            '<td><button class="btn danger" style="padding:3px 8px;font-size:12px" data-dundo="' + n + '">撤销</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    } else {
      h += '<div class="note">还没有玩家抽。</div>';
    }
    h += '<div class="qbtns" style="margin-top:10px">' +
      (done === DG.n ? '<button class="btn primary" data-dstart="1">开始对局 ›</button>' : '') +
      '<button class="btn" data-dreset2="1">重置抽签</button></div></div>';
    return h;
  }

  /* ---------------- 玩家端 ---------------- */
  function renderClaim(code) {
    var p = null;
    try { p = JSON.parse(unb64u(code)); } catch (e) { }
    if (!p || !p.p || !p.p.length) {
      view().innerHTML = '<div class="card" style="margin-top:14px"><div class="empty">链接无效或已过期，请找说书人要新的抽取链接。</div></div>';
      return;
    }
    var key = 'claim_' + p.r + '_' + p.s;
    var c = LS.get(key, null);
    var h = '<div class="card" style="margin-top:14px;text-align:center;padding:18px 14px">';
    h += '<div style="font-size:13px;color:var(--text-faint)">' + esc(edName(p.e)) + ' · 第 ' + p.s + ' 号位</div>';

    if (!c) {
      h += '<div style="margin:14px 0 6px;font-size:14px">下面是你的角色，点一下翻开。</div>' +
        '<div class="bagcard back" style="margin:0 auto;max-width:220px" data-ctake="1">' +
        '<div class="bn">' + p.s + '</div><div class="bt">🎴</div><div class="bs">点击抽取</div></div>' +
        '<div class="ftl" style="text-align:left;margin-top:14px">你的名字</div>' +
        '<input id="cname" class="sel" placeholder="玩家' + p.s + '" value="' + esc(p.n ? '' : '') + '">' +
        '<div class="note" style="text-align:left">抽到的角色只有你能看到。抽完后请把页面下方的「回执码」发给说书人。</div>';
    } else {
      var r = D.roles[c.i];
      if (!r) { view().innerHTML = '<div class="empty">角色数据异常</div>'; return; }
      var token = 'D-' + p.r + '-' + p.s + '-' + c.i + '-' + chk(p.r + '|' + p.s + '|' + c.i);
      h += '<h1 style="margin:8px 0 4px;font-size:26px">' + esc(r.name) + '</h1>' +
        '<div><span class="tag t-' + r.team + '">' + esc(TEAMCN[r.team]) + '</span></div>' +
        '<div class="ability-box" style="margin-top:14px">' + esc(r.ability) + '</div>' +
        '<div class="note" style="text-align:left;margin-top:12px">请对其他人保密。说书人会在需要时唤醒你。</div>' +
        '<div class="ftl" style="text-align:left;margin-top:14px">你的回执码（发给说书人）</div>' +
        '<textarea id="ctoken" class="sel" rows="2" readonly style="font-size:12px">' + esc(token) + '</textarea>' +
        '<div class="qbtns"><button class="btn primary" data-ccopy="1">复制回执码</button></div>' +
        '<div class="note" style="text-align:left">如果还没发给说书人，可以先复制保存；刷新页面也能再看到这个码。</div>';
    }
    h += '</div>';
    view().innerHTML = h;

    if (!c) {
      var box = $('#cname');
      view().addEventListener('click', function () { });
    }
  }

  /* ---------------- 动作 ---------------- */
  function takeFromBag(n) {
    var rest = remaining();
    if (!rest.length) { UI.warn = '袋子已经空了'; renderDrawStep(); return; }
    var id = rest[rnd(rest.length)];
    DG.taken[n] = { role: id, name: (DG.names[n - 1] || '玩家' + n) };
    UI.open = n; UI.warn = ''; UI.msg = '';
    save();
    renderDrawStep();
  }

  function importClaims(text) {
    var lines = String(text || '').split(/[\s,;，；]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
    var ok = 0, bad = [], dup = [];
    lines.forEach(function (ln) {
      var m = ln.match(/^D-([A-Z0-9]{4})-(\d{1,2})-(\d{1,4})-([A-Z0-9]{4})$/);
      if (!m) { bad.push(ln); return; }
      var room = m[1], seat = +m[2], idx = +m[3], ck = m[4];
      if (ck !== chk(room + '|' + seat + '|' + idx)) { bad.push(ln); return; }
      if (room !== DG.id) { bad.push(ln + '（房间码不符）'); return; }
      var r = D.roles[idx];
      if (!r) { bad.push(ln); return; }
      if (DG.taken[seat] && DG.taken[seat].role === r.id) { dup.push(ln); return; }
      if (DG.taken[seat]) { bad.push(ln + '（' + seat + '号已抽过）'); return; }
      if (DG.pool.indexOf(r.id) < 0) { bad.push(ln + '（该角色不在本局池内）'); return; }
      if (usedRoles()[r.id]) { bad.push(ln + '（该角色已被抽走）'); return; }
      DG.taken[seat] = { role: r.id, name: (DG.names[seat - 1] || '玩家' + seat) };
      ok++;
    });
    save();
    var msgs = [];
    if (ok) msgs.push('已导入 ' + ok + ' 位');
    if (dup.length) msgs.push('重复 ' + dup.length + ' 条（已忽略）');
    if (bad.length) { UI.warn = '无法识别：' + bad.join('、'); } else UI.warn = '';
    UI.msg = msgs.join(' · ');
    if (ok) {
      var k = 1; while (DG.taken[k] && k <= DG.n) k++;
      DG.cur = k; save();
    }
    renderDrawStep();
  }

  function startFromDraw() {
    var done = Object.keys(DG.taken).length;
    if (done !== DG.n) { alert('还有 ' + (DG.n - done) + ' 位玩家没有抽取'); return; }
    var roles = [], names = [];
    for (var i = 1; i <= DG.n; i++) {
      var t = DG.taken[i];
      if (!t) { alert('第 ' + i + ' 位还没有抽取'); return; }
      roles.push(t.role);
      names.push((t.name || ('玩家' + i)).trim() || ('玩家' + i));
    }
    var cfg = { ed: DG.ed, n: DG.n, names: names, roles: roles, travelers: DG.travelers || [], fabled: DG.fabled || [] };
    DG = null; save();
    if (window.BOTCGame && BOTCGame.startWith) BOTCGame.startWith(cfg);
    else location.hash = '#/game/new';
  }

  function copyText(text, msg) {
    var done = function () { alert(msg || text); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { prompt('复制以下内容：', text); });
    } else prompt('复制以下内容：', text);
  }

  /* ---------------- 路由 ---------------- */
  function route(r) {
    if (r.a) { renderClaim(r.a); return; }
    renderDesk();
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', function (e) {
    var el;
    if (e.target.closest('[data-dback]')) { location.hash = '#/game/new'; return; }
    if (e.target.closest('[data-dprev]')) { DG.step = 'pool'; UI.msg = ''; UI.warn = ''; save(); renderDesk(); return; }

    /* 池配置 */
    if ((el = e.target.closest('[data-ded]'))) { DG.ed = el.dataset.ded; DG.pool = []; UI.warn = ''; save(); renderDesk(); return; }
    if ((el = e.target.closest('[data-dn]'))) {
      DG.n = +el.dataset.dn; DG.pool = []; DG.taken = {}; UI.warn = ''; save(); renderDesk(); return;
    }
    if (e.target.closest('[data-droll]')) { rollPool(); UI.warn = ''; renderDesk(); return; }
    if (e.target.closest('[data-dpick]')) { UI.tab = UI.tab === 'pick' ? '' : 'pick'; renderDesk(); return; }
    if (e.target.closest('[data-dclear]')) { DG.pool = []; save(); renderDesk(); return; }
    if ((el = e.target.closest('[data-dadd]'))) {
      var id = el.dataset.dadd;
      if (DG.pool.indexOf(id) < 0) DG.pool.push(id);
      save(); renderDesk(); return;
    }
    if ((el = e.target.closest('[data-drm]'))) {
      var rid = el.dataset.drm, i = DG.pool.indexOf(rid);
      if (i >= 0) DG.pool.splice(i, 1);
      save(); renderDesk(); return;
    }
    if ((el = e.target.closest('[data-dtv]'))) {
      var a = DG.travelers, t1 = el.dataset.dtv, k1 = a.indexOf(t1);
      if (k1 >= 0) a.splice(k1, 1); else a.push(t1); save(); renderDesk(); return;
    }
    if ((el = e.target.closest('[data-dfb]'))) {
      var b = DG.fabled, f1 = el.dataset.dfb, k2 = b.indexOf(f1);
      if (k2 >= 0) b.splice(k2, 1); else b.push(f1); save(); renderDesk(); return;
    }
    if (e.target.closest('[data-dnext]')) {
      syncNames();
      if (DG.pool.length !== DG.n) {
        UI.warn = '角色池数量应为 ' + DG.n + '（当前 ' + DG.pool.length + '）。可以点「按配比随机生成」补齐。';
        renderDesk(); return;
      }
      DG.step = 'draw'; DG.taken = {}; DG.cur = 1; UI.warn = ''; UI.msg = ''; save(); renderDesk(); return;
    }

    /* 抽取 */
    if ((el = e.target.closest('[data-dmode]'))) { DG.mode = el.dataset.dmode; save(); renderDesk(); return; }
    if ((el = e.target.closest('[data-dtake]'))) { takeFromBag(+el.dataset.dtake); return; }
    if (e.target.closest('[data-dhide]')) { UI.open = -1; renderDesk(); return; }
    if ((el = e.target.closest('[data-dshow]'))) { UI.open = +el.dataset.dshow; renderDesk(); return; }
    if (e.target.closest('[data-dreset2]')) {
      if (confirm('清空已抽取结果，重新开始抽？')) { DG.taken = {}; DG.cur = 1; UI.open = -1; UI.msg = ''; save(); renderDesk(); }
      return;
    }
    if (e.target.closest('[data-dcopyurl]')) {
      var u = $('#durl'); copyText(u ? u.value : '', '已复制，发给玩家即可：\n' + (u ? u.value : '')); return;
    }
    if (e.target.closest('[data-dcopyinvite]')) {
      var u2 = $('#durl');
      copyText('【血染钟楼】请点这个链接抽你的角色（进去点一下"抽取"，然后把页面上的回执码发回给我）：\n' + (u2 ? u2.value : ''),
        '已复制邀请语，发给对应玩家');
      return;
    }
    if (e.target.closest('[data-dimport]')) {
      var t = $('#dclaim');
      importClaims(t ? t.value : '');
      return;
    }
    if ((el = e.target.closest('[data-dundo]'))) {
      delete DG.taken[+el.dataset.dundo];
      DG.cur = +el.dataset.dundo; UI.msg = ''; save(); renderDesk(); return;
    }
    if (e.target.closest('[data-dstart]')) { startFromDraw(); return; }

    /* 玩家端 */
    if (e.target.closest('[data-ctake]')) {
      var code = location.hash.replace(/^#\/draw\//, '');
      var p = null;
      try { p = JSON.parse(unb64u(code)); } catch (er) { }
      if (!p || !p.p || !p.p.length) { alert('链接无效'); return; }
      var nmEl = $('#cname');
      var nm = nmEl && nmEl.value.trim() ? nmEl.value.trim() : ('玩家' + p.s);
      var i2 = p.p[rnd(p.p.length)];
      LS.set('claim_' + p.r + '_' + p.s, { i: i2, name: nm, at: Date.now() });
      renderClaim(code);
      return;
    }
    if (e.target.closest('[data-ccopy]')) {
      var tk = $('#ctoken');
      copyText(tk ? tk.value : '', '已复制回执码，发给说书人：\n' + (tk ? tk.value : ''));
      return;
    }
  });

  function syncNames() {
    $$('.gname').forEach(function (i) { DG.names[+i.dataset.dgi] = i.value; });
    save();
  }

  window.BOTCDraw = { route: route };
})();
