/* 染·钟楼谜团 说书人备考手册 — 前端逻辑 */
(function () {
  'use strict';

  var D = window.BOTC_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var view = $('#view');

  /* ---------------- 基础索引 ---------------- */
  var ALL = D.roles.concat(D.fabled);
  var byId = {}, byName = {};
  ALL.forEach(function (r) { byId[r.id] = r; byName[r.name] = r; });
  D.rules.forEach(function (r) { byName[r.title] = null; });
  var ruleByTitle = {};
  D.rules.forEach(function (r) { ruleByTitle[r.title] = r; });

  var jinxByRole = {};
  D.jinxes.forEach(function (j, i) {
    j._i = i;
    [j.a, j.b].forEach(function (n) {
      (jinxByRole[n] = jinxByRole[n] || []).push(j);
    });
  });

  var ED_NAME = {};
  D.editions.forEach(function (e) { ED_NAME[e.id] = e.name; });

  /* ---------------- 本地存储 ---------------- */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('botc_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('botc_' + k, JSON.stringify(v)); } catch (e) { } }
  };
  var favs = LS.get('favs', []);
  var recent = LS.get('recent', []);
  var stat = LS.get('stat', { total: 0, right: 0, streak: 0, best: 0 });
  var wrongs = LS.get('wrongs', []);

  function isFav(id) { return favs.indexOf(id) >= 0; }
  function toggleFav(id) {
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.unshift(id);
    favs = favs.slice(0, 200); LS.set('favs', favs);
  }
  function pushRecent(id) {
    recent = [id].concat(recent.filter(function (x) { return x !== id; })).slice(0, 12);
    LS.set('recent', recent);
  }

  /* ---------------- 工具 ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function teamCls(t) { return 't-' + t; }
  function avatar(r, cls) {
    var c = cls || 'avatar';
    var ini = r.name.charAt(0);
    return '<div class="' + c + '" data-ini="' + esc(ini) + '">' +
      (r.image ? '<img src="' + esc(r.image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.textContent=this.parentNode.dataset.ini;">' : esc(ini)) +
      '</div>';
  }
  function nightTag(r) {
    var p = [];
    if (r.firstNight) p.push('首夜 ' + r.firstNight);
    if (r.otherNight) p.push('夜 ' + r.otherNight);
    return p.length ? '<span class="tag night">' + p.join(' · ') + '</span>' : '';
  }

  /* ---------------- 搜索索引（首次搜索时构建） ---------------- */
  var IDX = null;
  function buildIndex() {
    IDX = [];
    ALL.forEach(function (r) {
      var w = r.wiki ? r.wiki.html.replace(/<[^>]+>/g, ' ') : '';
      IDX.push({ t: 'role', id: r.id, name: r.name, sub: r.teamCn + (r.editionCn ? ' · ' + r.editionCn : ''),
        text: (r.name + ' ' + r.ability + ' ' + r.flavor + ' ' + w).replace(/\s+/g, ' ') });
    });
    D.rules.forEach(function (r) {
      IDX.push({ t: 'rule', id: r.id, name: r.title, sub: r.catName, text: (r.title + ' ' + r.text).replace(/\s+/g, ' ') });
    });
    D.jinxes.forEach(function (j) {
      IDX.push({ t: 'jinx', id: 'j' + j._i, name: j.a + ' × ' + j.b, sub: '相克规则', text: j.a + ' ' + j.b + ' ' + j.reason });
    });
  }
  function search(kw, limit) {
    if (!IDX) buildIndex();
    var keys = kw.trim().split(/[\s,，]+/).filter(Boolean);
    if (!keys.length) return [];
    var out = [];
    for (var i = 0; i < IDX.length; i++) {
      var it = IDX[i], score = 0, ok = true;
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var pos = it.text.indexOf(key);
        if (pos < 0) { ok = false; break; }
        score += (it.name === key ? 1000 : 0) + (it.name.indexOf(key) >= 0 ? 200 : 0) + Math.max(0, 60 - pos / 200);
      }
      if (ok) out.push({ it: it, s: score });
    }
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, limit || 30).map(function (o) { return o.it; });
  }

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    if (!h) return { p: 'home' };
    var seg = h.split('/');
    return { p: seg[0], a: seg[1], b: seg[2] };
  }
  function go(path) { location.hash = path; }

  function route() {
    var r = parseHash();
    window.scrollTo(0, 0);
    switch (r.p) {
      case 'home': renderHome(); break;
      case 'roles': renderRoles(); break;
      case 'role': renderRole(r.a); break;
      case 'rules': renderRules(r.a); break;
      case 'rule': renderRule(r.a); break;
      case 'jinxes': renderJinxes(); break;
      case 'night': renderNight(r.a || 'first'); break;
      case 'quiz': renderQuiz(); break;
      case 'tools': renderTools(); break;
      case 'edition': renderEdition(r.a); break;
      case 'favs': renderFavs(); break;
      case 'q': renderSearchPage(decodeURIComponent(r.a || '')); break;
      default: renderHome();
    }
    $$('#tabbar a').forEach(function (a) {
      a.classList.toggle('on', a.dataset.p === r.p);
    });
    $('#q').blur();
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    var favHtml = '';
    if (favs.length) {
      favHtml = '<div class="sec-title"><h2>我的收藏</h2><span class="more">' + favs.length + ' 项</span></div>' +
        '<div class="card">' + favs.slice(0, 8).map(function (id) {
          var r = byId[id]; if (!r) return '';
          return '<div class="ritem" data-role="' + r.id + '">' + avatar(r) +
            '<div class="body"><div class="nm">' + esc(r.name) +
            ' <span class="tag ' + teamCls(r.team) + '">' + r.teamCn + '</span></div>' +
            '<div class="ab">' + esc(r.ability) + '</div></div></div>';
        }).join('') + (favs.length > 8 ? '<div class="note"><a href="#/favs">查看全部收藏 →</a></div>' : '') + '</div>';
    }
    var recHtml = '';
    if (recent.length) {
      recHtml = '<div class="sec-title"><h2>最近浏览</h2></div><div class="chips">' +
        recent.map(function (id) { var r = byId[id]; return r ? '<a class="chip" href="#/role/' + r.id + '">' + esc(r.name) + '</a>' : ''; }).join('') +
        '</div>';
    }

    view.innerHTML =
      '<div class="hero">' +
      '<h1>说书人备考手册</h1>' +
      '<p>基于官方魔典角色数据 + 钟楼百科全文整理，覆盖角色能力、特殊规则与相克规则。</p>' +
      '<div class="stats">' +
      '<div><b>' + D.meta.roleCount + '</b>角色</div>' +
      '<div><b>' + D.meta.fabledCount + '</b>传奇角色</div>' +
      '<div><b>' + D.meta.ruleCount + '</b>规则条目</div>' +
      '<div><b>' + D.meta.jinxCount + '</b>相克规则</div>' +
      '</div></div>' +

      '<div class="sec-title"><h2>剧本 / 角色合集</h2></div>' +
      '<div class="grid2">' + D.editions.map(function (e) {
        var c = e.counts || {};
        return '<div class="tile" data-ed="' + e.id + '"><div class="em">📖</div><div class="t">' + esc(e.name) + '</div>' +
          '<div class="d">' + esc(e.playerNum || '') + ' · 镇民' + (c.townsfolk || 0) + ' 外来' + (c.outsider || 0) +
          ' 爪牙' + (c.minion || 0) + ' 恶魔' + (c.demon || 0) + ' 旅行' + (c.traveler || 0) + '</div></div>';
      }).join('') +
      '<div class="tile" data-team="traveler"><div class="em">🎒</div><div class="t">旅行者合集</div><div class="d">18 名旅行者</div></div>' +
      '<div class="tile" data-team="fabled"><div class="em">✨</div><div class="t">传奇角色</div><div class="d">27 个传奇角色</div></div>' +
      '</div>' +

      '<div class="sec-title"><h2>规则专题</h2></div>' +
      '<div class="grid3">' +
      D.ruleCats.map(function (c) {
        return '<div class="tile" data-rulecat="' + c.id + '"><div class="em">📜</div><div class="t">' + esc(c.name) + '</div></div>';
      }).join('') +
      '</div>' +

      '<div class="sec-title"><h2>常用工具</h2></div>' +
      '<div class="grid2">' +
      '<div class="tile" data-go="#/jinxes"><div class="em">⚔️</div><div class="t">相克规则</div><div class="d">' + D.meta.jinxCount + ' 条，可搜索</div></div>' +
      '<div class="tile" data-go="#/night"><div class="em">🌙</div><div class="t">夜晚行动顺序</div><div class="d">首夜 / 其他夜晚</div></div>' +
      '<div class="tile" data-go="#/quiz"><div class="em">🎯</div><div class="t">答题练习</div><div class="d">能力↔角色 / 相克</div></div>' +
      '<div class="tile" data-go="#/tools"><div class="em">🧰</div><div class="t">说书人工具</div><div class="d">人数配比 / 随机组局</div></div>' +
      '</div>' +
      recHtml + favHtml +
      '<div class="note" style="margin-top:18px">数据来源：官方魔典角色接口（clocktower.gstonegames.com）+ 钟楼百科（clocktower-wiki.gstonegames.com），生成于 ' + D.meta.generated + '。</div>';
  }

  /* ---------------- 角色列表 ---------------- */
  var roleFilter = { ed: '', team: '', q: '', fav: false };

  function renderRoles() {
    var kw = roleFilter.q;
    var list = ALL.filter(function (r) {
      if (roleFilter.ed && r.edition !== roleFilter.ed) return false;
      if (roleFilter.team && r.team !== roleFilter.team) return false;
      if (roleFilter.fav && !isFav(r.id)) return false;
      if (kw) {
        var w = r.wiki ? r.wiki.html.replace(/<[^>]+>/g, ' ') : '';
        var hay = (r.name + r.ability + r.flavor + w).toLowerCase();
        if (hay.indexOf(kw.toLowerCase()) < 0) return false;
      }
      return true;
    });

    var order = ['townsfolk', 'outsider', 'minion', 'demon', 'traveler', 'fabled'];
    var html = '<div class="chips">' +
      '<button class="chip' + (roleFilter.ed === '' ? ' on' : '') + '" data-fed="">全部剧本</button>' +
      D.editions.filter(function (e) { return e.id !== 'ngj' && e.id !== 'luf'; }).map(function (e) {
        return '<button class="chip' + (roleFilter.ed === e.id ? ' on' : '') + '" data-fed="' + e.id + '">' + esc(e.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="chips">' +
      '<button class="chip' + (roleFilter.team === '' ? ' on p' : '') + '" data-fteam="">全部阵营</button>' +
      D.teams.map(function (t) {
        return '<button class="chip' + (roleFilter.team === t.id ? ' on p' : '') + '" data-fteam="' + t.id + '">' + esc(t.name) + '</button>';
      }).join('') +
      '<button class="chip' + (roleFilter.fav ? ' on p' : '') + '" data-ffav="1">★ 收藏</button>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-faint);margin:2px 2px 6px">共 ' + list.length + ' 个角色' + (kw ? '（关键词：' + esc(kw) + '）' : '') + '</div>';

    if (!list.length) { view.innerHTML = html + '<div class="empty">没有匹配的角色</div>'; return; }

    html += order.map(function (t) {
      var g = list.filter(function (r) { return r.team === t; });
      if (!g.length) return '';
      g.sort(function (a, b) { return (a.firstNight || 999) - (b.firstNight || 999) || a.name.localeCompare(b.name); });
      return '<div class="rgroup"><div class="gh"><span class="bar"></span>' + TEAMCN[t] + '<span class="n">' + g.length + '</span></div>' +
        g.map(function (r) {
          return '<div class="ritem" data-role="' + r.id + '">' + avatar(r) +
            '<div class="body"><div class="nm">' + esc(r.name) +
            ' <span class="tag ' + teamCls(r.team) + '">' + r.teamCn + '</span>' +
            (isFav(r.id) ? ' <span class="tag">★</span>' : '') + '</div>' +
            '<div class="ab">' + esc(r.ability) + '</div>' +
            '<div class="tags">' + (r.editionCn ? '<span class="tag ed">' + esc(r.editionCn) + '</span>' : '') + nightTag(r) + '</div>' +
            '</div></div>';
        }).join('') + '</div>';
    }).join('');

    view.innerHTML = html;
  }
  var TEAMCN = { townsfolk: '镇民', outsider: '外来者', minion: '爪牙', demon: '恶魔', traveler: '旅行者', fabled: '传奇角色' };

  /* ---------------- 角色详情 ---------------- */
  function renderRole(id) {
    var r = byId[id];
    if (!r) { view.innerHTML = '<div class="empty">未找到角色</div>'; return; }
    pushRecent(id);
    var jx = jinxByRole[r.name] || [];
    var w = r.wiki;
    var secs = (w && w.sections) ? w.sections.filter(function (s) { return s.title !== '背景故事' && s.title !== '角色能力'; }) : [];

    view.innerHTML =
      '<div class="backbar"><button data-back="1">‹ 返回</button>' +
      '<button class="star' + (isFav(r.id) ? ' on' : '') + '" data-fav="' + r.id + '">' + (isFav(r.id) ? '★ 已收藏' : '☆ 收藏') + '</button></div>' +
      '<div class="card"><div class="detail-head">' + avatar(r, 'avatar') +
      '<div><h1>' + esc(r.name) + '</h1><div class="sub">' +
      '<span class="tag ' + teamCls(r.team) + '">' + r.teamCn + '</span> ' +
      (r.editionCn ? '<span class="tag ed">' + esc(r.editionCn) + '</span> ' : '') +
      '<span class="tag">' + esc(r.id) + '</span></div></div></div>' +
      '<div class="ability-box">' + esc(r.ability) + '</div>' +
      (r.flavor ? '<div class="flavor">' + esc(r.flavor) + '</div>' : '') +
      '<dl class="kv">' +
      '<dt>夜晚顺序</dt><dd>' + (r.firstNight ? '首夜第 ' + r.firstNight + ' 位' : '首夜不行动') + ' ／ ' + (r.otherNight ? '其他夜晚第 ' + r.otherNight + ' 位' : '其他夜晚不行动') + '</dd>' +
      (r.setup ? '<dt>设置阶段</dt><dd>需要在游戏开始前进行设置</dd>' : '') +
      ((r.reminders && r.reminders.length) ? '<dt>提示标记</dt><dd>' + r.reminders.map(function (x) { return '<span class="pill">' + esc(x) + '</span>'; }).join('') + '</dd>' : '') +
      ((r.remindersGlobal && r.remindersGlobal.length) ? '<dt>全局提示</dt><dd>' + r.remindersGlobal.map(function (x) { return '<span class="pill">' + esc(x) + '</span>'; }).join('') + '</dd>' : '') +
      ((r.firstNightReminder || r.otherNightReminder) ? '<dt>说书人提示</dt><dd>' +
        (r.firstNightReminder ? '<div>首夜：' + esc(r.firstNightReminder) + '</div>' : '') +
        (r.otherNightReminder ? '<div>其他夜：' + esc(r.otherNightReminder) + '</div>' : '') + '</dd>' : '') +
      '</dl></div>';

    if (secs.length) {
      view.innerHTML += '<div class="card" style="margin-top:12px"><div class="wiki">' +
        secs.map(function (s) { return '<h4>' + esc(s.title) + '</h4>' + s.html; }).join('') +
        '</div></div>';
    }
    if (jx.length) {
      view.innerHTML += '<div class="sec-title"><h2>相关相克规则</h2><span class="more">' + jx.length + ' 条</span></div>' +
        jx.map(function (j) {
          return '<div class="jx"><div class="pair"><a href="#/role/' + (j.aid || '') + '">' + esc(j.a) + '</a><span class="x">×</span><a href="#/role/' + (j.bid || '') + '">' + esc(j.b) + '</a></div>' +
            '<div class="rs">' + esc(j.reason) + '</div></div>';
        }).join('');
    }
  }

  /* ---------------- 规则 ---------------- */
  function renderRules(cat) {
    cat = cat || 'core';
    var list = D.rules.filter(function (r) { return r.cat === cat; });
    view.innerHTML =
      '<div class="chips">' + D.ruleCats.map(function (c) {
        return '<button class="chip' + (c.id === cat ? ' on' : '') + '" data-rulecat="' + c.id + '">' + esc(c.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="card">' + list.map(function (r) {
        return '<div class="nrow" data-rule="' + r.id + '"><div class="no">§</div><div><div class="nm">' + esc(r.title) + '</div>' +
          '<div class="rm">' + esc((r.text || '').replace(/\s+/g, ' ').slice(0, 46)) + '…</div></div></div>';
      }).join('') + '</div>';
  }

  function renderRule(id) {
    var r = null;
    D.rules.forEach(function (x) { if (x.id === id) r = x; });
    if (!r) { view.innerHTML = '<div class="empty">未找到规则</div>'; return; }
    view.innerHTML = '<div class="backbar"><button data-back="1">‹ 返回</button><span style="font-size:12px;color:var(--text-faint)">' + esc(r.catName) + '</span></div>' +
      '<div class="card"><div style="padding:14px 14px 0"><h1 style="margin:0;font-size:19px">' + esc(r.title) + '</h1></div>' +
      '<div class="rule-html">' + r.html + '</div></div>';
  }

  /* ---------------- 相克规则 ---------------- */
  var jxQ = '';
  function renderJinxes() {
    var q = jxQ.trim();
    var list = D.jinxes.filter(function (j) { return !q || (j.a + j.b + j.reason).indexOf(q) >= 0; });
    view.innerHTML =
      '<div class="card" style="padding:12px 14px"><div style="font-size:13px;line-height:1.75">' + D.jinxIntro + '</div></div>' +
      '<div class="sec-title"><h2>相克规则列表</h2><span class="more">' + list.length + ' / ' + D.jinxes.length + ' 条</span></div>' +
      '<div class="card" style="padding:10px 12px;display:flex;gap:8px;align-items:center">' +
      '<input id="jxq" value="' + esc(jxQ) + '" placeholder="搜索角色名或规则内容" style="flex:1;border:1px solid var(--line);border-radius:999px;padding:7px 12px;font-size:14px;outline:none">' +
      (q ? '<button class="btn" style="flex:0 0 auto;width:auto;padding:7px 12px" data-jxclear="1">清除</button>' : '') + '</div>' +
      (list.length ? list.map(function (j) {
        return '<div class="jx"><div class="pair">' + linkRole(j.a, j.aid) + '<span class="x">×</span>' + linkRole(j.b, j.bid) + '</div>' +
          '<div class="rs">' + esc(j.reason) + '</div></div>';
      }).join('') : '<div class="empty">没有匹配的相克规则</div>');
    var inp = $('#jxq');
    if (inp) {
      inp.addEventListener('input', function () {
        jxQ = inp.value;
        var pos = inp.selectionStart;
        renderJinxes();
        var n = $('#jxq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } }
      });
    }
  }
  function linkRole(name, id) {
    if (id && byId[id]) return '<a href="#/role/' + id + '">' + esc(name) + '</a>';
    return esc(name);
  }

  /* ---------------- 夜晚顺序 ---------------- */
  function renderNight(which) {
    var list = D.nightOrder[which] || [];
    view.innerHTML =
      '<div class="chips"><button class="chip' + (which === 'first' ? ' on' : '') + '" data-night="first">首个夜晚</button>' +
      '<button class="chip' + (which === 'other' ? ' on' : '') + '" data-night="other">其他夜晚</button></div>' +
      '<div class="card">' + list.map(function (x, i) {
        var r = byId[x.id] || {};
        return '<div class="nrow" data-role="' + x.id + '"><div class="no">' + (i + 1) + '</div>' +
          '<div style="flex:1"><div class="nm">' + esc(x.name) + ' <span class="tag ' + teamCls(x.team) + '">' + (TEAMCN[x.team] || x.team) + '</span></div>' +
          (x.reminder ? '<div class="rm">' + esc(x.reminder) + '</div>' : '') + '</div>' +
          '<div style="color:var(--text-faint);font-size:11px">#' + x.order + '</div></div>';
      }).join('') + '</div>' +
      '<div class="note">序号 # 为该角色在官方夜晚顺序表中的原始编号；列表已按编号排序。点击行可查看角色详情。</div>';
  }

  /* ---------------- 搜索结果页 ---------------- */
  function renderSearchPage(kw) {
    var res = kw ? search(kw, 60) : [];
    var groups = { role: [], rule: [], jinx: [] };
    res.forEach(function (r) { groups[r.t].push(r); });
    var html = '<div class="backbar"><button data-back="1">‹ 返回</button><span style="font-size:13px">搜索：' + esc(kw) + '</span></div>';
    if (!res.length) { view.innerHTML = html + '<div class="empty">没有找到相关内容</div>'; return; }
    function block(title, arr) {
      if (!arr.length) return '';
      return '<div class="sec-title"><h2>' + title + '</h2><span class="more">' + arr.length + '</span></div><div class="card">' +
        arr.map(function (x) {
          var href = x.t === 'role' ? '#/role/' + x.id : (x.t === 'rule' ? '#/rule/' + x.id : '#/jinxes');
          return '<div class="nrow" data-go="' + href + '"><div class="no">' + (x.t === 'role' ? '🎭' : x.t === 'rule' ? '📜' : '⚔️') + '</div>' +
            '<div><div class="nm">' + esc(x.name) + '</div><div class="rm">' + esc(x.sub) + '</div></div></div>';
        }).join('') + '</div>';
    }
    view.innerHTML = html + block('角色', groups.role) + block('规则条目', groups.rule) + block('相克规则', groups.jinx);
  }

  /* ---------------- 收藏 ---------------- */
  function renderFavs() {
    var list = favs.map(function (id) { return byId[id]; }).filter(Boolean);
    view.innerHTML = '<div class="backbar"><button data-back="1">‹ 返回</button><span style="font-size:13px">我的收藏（' + list.length + '）</span></div>' +
      (list.length ? '<div class="card">' + list.map(function (r) {
        return '<div class="ritem" data-role="' + r.id + '">' + avatar(r) +
          '<div class="body"><div class="nm">' + esc(r.name) + ' <span class="tag ' + teamCls(r.team) + '">' + r.teamCn + '</span></div>' +
          '<div class="ab">' + esc(r.ability) + '</div></div></div>';
      }).join('') + '</div>' : '<div class="empty">还没有收藏，点击角色详情页的 ☆ 收藏按钮</div>');
  }

  /* ---------------- 剧本页 ---------------- */
  function renderEdition(id) {
    var e = null;
    D.editions.forEach(function (x) { if (x.id === id) e = x; });
    if (!e) { view.innerHTML = '<div class="empty">未找到剧本</div>'; return; }
    var order = ['townsfolk', 'outsider', 'minion', 'demon', 'traveler'];
    var html = '<div class="backbar"><button data-back="1">‹ 返回</button></div>' +
      '<div class="card"><div style="padding:14px"><h1 style="margin:0 0 4px;font-size:20px">' + esc(e.name) + '</h1>' +
      '<div class="sub" style="font-size:12px;color:var(--text-faint)">' + esc(e.playerNum) + (e.level ? ' · 难度 ' + e.level : '') + '</div></div>' +
      (e.description ? '<div class="rule-html" style="padding-top:0">' + e.description + '</div>' : '') + '</div>';
    if (e.wiki) html += '<div class="card" style="margin-top:12px"><div class="wiki">' + e.wiki.html + '</div></div>';
    html += '<div class="sec-title"><h2>角色一览</h2><span class="more">' + e.roles.length + ' 个</span></div>';
    html += order.map(function (t) {
      var g = e.roles.map(function (i) { return byId[i]; }).filter(function (r) { return r && r.team === t; });
      if (!g.length) return '';
      return '<div class="rgroup"><div class="gh"><span class="bar"></span>' + TEAMCN[t] + '<span class="n">' + g.length + '</span></div>' +
        g.map(function (r) {
          return '<div class="ritem" data-role="' + r.id + '">' + avatar(r) +
            '<div class="body"><div class="nm">' + esc(r.name) + '</div><div class="ab">' + esc(r.ability) + '</div></div></div>';
        }).join('') + '</div>';
    }).join('');
    view.innerHTML = html;
  }

  /* ---------------- 练习 ---------------- */
  var quiz = null;
  var quizCfg = LS.get('quizcfg', { scope: 'tb,bmr,snv', mode: 'a2r' });

  function poolByScope(scope) {
    if (scope === 'all') return ALL.slice();
    if (scope === 'traveler') return ALL.filter(function (r) { return r.team === 'traveler'; });
    if (scope === 'fabled') return ALL.filter(function (r) { return r.team === 'fabled'; });
    var eds = scope.split(',');
    return ALL.filter(function (r) { return r.edition && eds.indexOf(r.edition) >= 0; });
  }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function newQuestion() {
    var pool = poolByScope(quizCfg.scope);
    if (quizCfg.mode === 'jx') {
      var jl = D.jinxes.filter(function (j) {
        return pool.some(function (r) { return r.name === j.a; }) || pool.some(function (r) { return r.name === j.b; });
      });
      if (jl.length < 4) jl = D.jinxes;
      var j = rnd(jl);
      var others = shuffle(D.jinxes.filter(function (x) { return x !== j; })).slice(0, 3);
      var opts = shuffle([j].concat(others));
      return {
        type: 'jx',
        stem: '<span class="big">' + esc(j.a) + ' × ' + esc(j.b) + '</span>以下哪一条是这两个角色之间的相克规则？',
        opts: opts.map(function (x) { return { id: 'j' + x._i, text: x.reason }; }),
        answer: 'j' + j._i,
        explain: '<b>' + esc(j.a) + ' × ' + esc(j.b) + '</b>：' + esc(j.reason)
      };
    }
    if (pool.length < 4) pool = ALL.slice();
    var target = rnd(pool);
    var sameTeam = pool.filter(function (r) { return r.team === target.team && r.id !== target.id; });
    var others = shuffle(sameTeam.length >= 3 ? sameTeam : pool.filter(function (r) { return r.id !== target.id; })).slice(0, 3);
    var opts = shuffle([target].concat(others));
    if (quizCfg.mode === 'a2r') {
      return {
        type: 'a2r',
        stem: '<span class="big">以下能力属于哪个角色？</span>' + esc(target.ability),
        opts: opts.map(function (r) { return { id: r.id, text: r.name + '（' + r.teamCn + '）' }; }),
        answer: target.id,
        explain: '<b>' + esc(target.name) + '</b>（' + target.teamCn + ' · ' + (target.editionCn || '—') + '）：' + esc(target.ability) +
          (target.wiki && target.wiki.sections ? '<br><br>' + (target.wiki.sections.filter(function (s) { return s.title === '角色简介'; })[0] || { html: '' }).html : '')
      };
    }
    return {
      type: 'r2a',
      stem: '<span class="big">' + esc(target.name) + '</span>' + target.teamCn + (target.editionCn ? ' · ' + target.editionCn : '') + ' —— 他的能力是？',
      opts: opts.map(function (r) { return { id: r.id, text: r.ability }; }),
      answer: target.id,
      explain: '<b>' + esc(target.name) + '</b>：' + esc(target.ability)
    };
  }

  function renderQuiz() {
    if (!quiz) quiz = { q: newQuestion(), picked: null, done: false };
    var scopes = [
      { id: 'tb,bmr,snv', n: '三大官方剧本' },
      { id: 'tb', n: '暗流涌动' }, { id: 'bmr', n: '黯月初升' }, { id: 'snv', n: '梦殒春宵' },
      { id: 'hdcs', n: '华灯初上' }, { id: 'syyl', n: '山雨欲来' }, { id: 'exp', n: '实验性角色' },
      { id: 'traveler', n: '旅行者' }, { id: 'fabled', n: '传奇角色' }, { id: 'all', n: '全部角色' }
    ];
    var modes = [
      { id: 'a2r', n: '能力 → 角色' },
      { id: 'r2a', n: '角色 → 能力' },
      { id: 'jx', n: '相克规则' }
    ];
    var acc = stat.total ? Math.round(stat.right / stat.total * 100) : 0;

    view.innerHTML =
      '<div class="card" style="padding:12px 14px">' +
      '<div style="font-size:12px;color:var(--text-faint);margin-bottom:6px">范围</div><div class="chips">' +
      scopes.map(function (s) { return '<button class="chip' + (quizCfg.scope === s.id ? ' on' : '') + '" data-qscope="' + s.id + '">' + s.n + '</button>'; }).join('') + '</div>' +
      '<div style="font-size:12px;color:var(--text-faint);margin-bottom:6px">题型</div><div class="chips">' +
      modes.map(function (m) { return '<button class="chip' + (quizCfg.mode === m.id ? ' on p' : '') + '" data-qmode="' + m.id + '">' + m.n + '</button>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:14px;font-size:12px;color:var(--text-dim);margin-top:4px">' +
      '<span>本题库 ' + poolByScope(quizCfg.scope).length + ' 角色</span>' +
      '<span>正确率 ' + acc + '%（' + stat.right + '/' + stat.total + '）</span>' +
      '<span>连对 ' + stat.streak + '</span>' +
      (wrongs.length ? '<a href="#/quiz?wrong" data-wrong="1">错题 ' + wrongs.length + '</a>' : '') +
      '</div></div>' +

      '<div class="card qwrap" style="margin-top:12px">' +
      '<div class="qmeta"><span>第 ' + (stat.total + 1) + ' 题</span><span>' + esc(modes.filter(function (m) { return m.id === quizCfg.mode; })[0].n) + '</span></div>' +
      '<div class="qstem">' + quiz.q.stem + '</div>' +
      quiz.q.opts.map(function (o, i) {
        var cls = 'opt';
        if (quiz.done) {
          if (o.id === quiz.q.answer) cls += ' right';
          else if (o.id === quiz.picked) cls += ' wrong';
        } else if (o.id === quiz.picked) cls += ' sel';
        return '<div class="' + cls + '" data-opt="' + esc(o.id) + '"><span class="idx">' + 'ABCD'[i] + '</span>' + esc(o.text) + '</div>';
      }).join('') +
      (quiz.done ? '<div class="explain">' + quiz.q.explain + '</div>' : '') +
      '<div class="qbtns">' +
      (quiz.done ? '<button class="btn primary" data-next="1">下一题 ›</button>' :
        '<button class="btn primary" data-submit="1" ' + (quiz.picked ? '' : 'disabled') + '>确认作答</button>') +
      '<button class="btn" data-skip="1">' + (quiz.done ? '换一题' : '跳过') + '</button>' +
      '</div>' +
      (quiz.q.type !== 'jx' && quiz.done && byId[quiz.q.answer] ? '<div style="margin-top:10px;text-align:center"><a href="#/role/' + quiz.q.answer + '" style="font-size:13px">查看「' + esc(byId[quiz.q.answer].name) + '」完整词条 →</a></div>' : '') +
      '</div>' +
      (wrongs.length ? '<div class="note"><a href="#" data-clearwrong="1">清空错题本</a></div>' : '');
  }

  /* ---------------- 工具 ---------------- */
  function renderTools() {
    var rows = '';
    var comp = D.composition;
    for (var i = 0; i < comp.length; i++) {
      var c = comp[i], n = 5 + i;
      rows += '<tr><td>' + n + ' 人</td><td>' + c.townsfolk + '</td><td>' + c.outsider + '</td><td>' + c.minion + '</td><td>' + c.demon + '</td></tr>';
    }
    view.innerHTML =
      '<div class="sec-title"><h2>玩家人数与角色配比</h2></div>' +
      '<div style="overflow-x:auto"><table class="tb"><tr><th>人数</th><th>镇民</th><th>外来者</th><th>爪牙</th><th>恶魔</th></tr>' + rows + '</table></div>' +
      '<div class="note">该表为标准设置表；部分角色（如 [[男爵]]、[[教父]]、[[哨兵]] 等）会额外调整外来者数量。旅行者不计入表中人数。</div>' +

      '<div class="sec-title"><h2>随机组局</h2></div>' +
      '<div class="card" style="padding:12px 14px">' +
      '<div class="chips" id="tgEd">' +
      ['tb', 'bmr', 'snv', 'hdcs', 'syyl', 'exp'].map(function (e, i) {
        return '<button class="chip' + (i === 0 ? ' on' : '') + '" data-ted="' + e + '">' + esc(ED_NAME[e] || e) + '</button>';
      }).join('') + '</div>' +
      '<div class="chips" id="tgNum">' +
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (n, i) {
        return '<button class="chip' + (n === 9 ? ' on p' : '') + '" data-tnum="' + n + '">' + n + '人</button>';
      }).join('') + '</div>' +
      '<div class="qbtns"><button class="btn primary" data-roll="1">随机生成一套角色</button></div>' +
      '<div id="rollOut"></div></div>' +

      '<div class="sec-title"><h2>数据来源</h2></div>' +
      '<div class="card note">角色能力、提示标记、夜晚顺序：官方魔典角色接口（clocktower.gstonegames.com/ct/grimoireRoleJson/）。<br>' +
      '角色详解、范例、运作方式、规则细节、特殊规则词条、相克规则：钟楼百科（clocktower-wiki.gstonegames.com）对应条目。<br>' +
      '整理时间：' + D.meta.generated + '。共 ' + D.meta.roleCount + ' 角色 / ' + D.meta.fabledCount + ' 传奇 / ' + D.meta.ruleCount + ' 规则条目 / ' + D.meta.jinxCount + ' 相克规则。</div>';

    var curEd = 'tb', curNum = 9;
    $('#tgEd').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ted]'); if (!b) return;
      curEd = b.dataset.ted;
      $$('#tgEd .chip').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
    $('#tgNum').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tnum]'); if (!b) return;
      curNum = +b.dataset.tnum;
      $$('#tgNum .chip').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
    $('[data-roll]').addEventListener('click', function () {
      var idx = Math.min(Math.max(curNum - 5, 0), comp.length - 1);
      var c = comp[idx];
      var pool = D.roles.filter(function (r) { return r.edition === curEd; });
      function pick(team, n) {
        var g = shuffle(pool.filter(function (r) { return r.team === team; }));
        return g.slice(0, n);
      }
      var picked = pick('townsfolk', c.townsfolk).concat(pick('outsider', c.outsider), pick('minion', c.minion), pick('demon', c.demon));
      $('#rollOut').innerHTML = '<div style="margin-top:10px">' + picked.map(function (r) {
        return '<span class="pill pill-' + r.team + '" style="display:inline-block;margin:0 5px 6px 0">' + esc(r.name) + '</span>';
      }).join('') + '</div><div class="note">共 ' + picked.length + ' 个角色（镇民' + c.townsfolk + ' 外来' + c.outsider + ' 爪牙' + c.minion + ' 恶魔' + c.demon + '）。仅供参考，实际设置请以剧本说明为准。</div>';
    });
  }

  /* ---------------- 事件委托 ---------------- */
  view.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-role]'))) { go('#/role/' + el.dataset.role); return; }
    if ((el = e.target.closest('[data-rule]'))) { go('#/rule/' + el.dataset.rule); return; }
    if ((el = e.target.closest('[data-go]'))) { go(el.dataset.go); return; }
    if ((el = e.target.closest('[data-ed]'))) { go('#/edition/' + el.dataset.ed); return; }
    if ((el = e.target.closest('[data-team]'))) {
      roleFilter = { ed: '', team: el.dataset.team, q: '', fav: false }; go('#/roles'); return;
    }
    if ((el = e.target.closest('[data-rulecat]'))) {
      if (location.hash.indexOf('#/rules') === 0) renderRules(el.dataset.rulecat);
      else go('#/rules/' + el.dataset.rulecat);
      return;
    }
    if ((el = e.target.closest('[data-night]'))) { renderNight(el.dataset.night); return; }
    if ((el = e.target.closest('[data-fed]'))) { roleFilter.ed = el.dataset.fed; renderRoles(); return; }
    if ((el = e.target.closest('[data-fteam]'))) { roleFilter.team = el.dataset.fteam; renderRoles(); return; }
    if ((el = e.target.closest('[data-ffav]'))) { roleFilter.fav = !roleFilter.fav; renderRoles(); return; }
    if ((el = e.target.closest('[data-fav]'))) {
      toggleFav(el.dataset.fav); var b = $('[data-fav="' + el.dataset.fav + '"]');
      var on = isFav(el.dataset.fav);
      b.classList.toggle('on', on); b.textContent = on ? '★ 已收藏' : '☆ 收藏'; return;
    }
    if ((el = e.target.closest('[data-qscope]'))) { quizCfg.scope = el.dataset.qscope; LS.set('quizcfg', quizCfg); quiz = null; renderQuiz(); return; }
    if ((el = e.target.closest('[data-qmode]'))) { quizCfg.mode = el.dataset.qmode; LS.set('quizcfg', quizCfg); quiz = null; renderQuiz(); return; }
    if ((el = e.target.closest('[data-opt]'))) {
      if (quiz.done) return;
      quiz.picked = el.dataset.opt;
      $$('.opt').forEach(function (o) { o.classList.toggle('sel', o.dataset.opt === quiz.picked); });
      var sb = $('[data-submit]'); if (sb) sb.disabled = false;
      return;
    }
    if (e.target.closest('[data-submit]')) {
      if (!quiz.picked) return;
      quiz.done = true; stat.total++;
      if (quiz.picked === quiz.q.answer) { stat.right++; stat.streak++; if (stat.streak > stat.best) stat.best = stat.streak; }
      else { stat.streak = 0; var key = quiz.q.type + ':' + quiz.q.answer; if (wrongs.indexOf(key) < 0) wrongs.unshift(key); wrongs = wrongs.slice(0, 200); LS.set('wrongs', wrongs); }
      LS.set('stat', stat); renderQuiz(); return;
    }
    if (e.target.closest('[data-next]') || e.target.closest('[data-skip]')) { quiz = null; renderQuiz(); return; }
    if (e.target.closest('[data-clearwrong]')) { e.preventDefault(); wrongs = []; LS.set('wrongs', wrongs); renderQuiz(); return; }
    if (e.target.closest('[data-wrong]')) { e.preventDefault(); alert('错题本共 ' + wrongs.length + ' 条，继续刷题即可反复遇到相关知识点。'); return; }
    if (e.target.closest('[data-jxclear]')) { jxQ = ''; renderJinxes(); return; }
    if ((el = e.target.closest('[data-back]'))) { history.back(); return; }
    if ((el = e.target.closest('.wl'))) {
      var name = el.dataset.l;
      if (byName[name]) go('#/role/' + byName[name].id);
      else if (ruleByTitle[name]) go('#/rule/' + ruleByTitle[name].id);
      else { $('#q').value = name; $('#q').dispatchEvent(new Event('input')); }
      return;
    }
  });

  /* ---------------- 顶部搜索 ---------------- */
  var qInput = $('#q'), sugg = $('#sugg'), sbox = $('#sbox');
  function showSugg() {
    var kw = qInput.value.trim();
    sbox.classList.toggle('has', !!kw);
    if (!kw) { sugg.classList.remove('show'); return; }
    var res = search(kw, 24);
    if (!res.length) { sugg.innerHTML = '<div class="it"><b>无结果</b></div>'; sugg.classList.add('show'); return; }
    var g = { role: '角色', rule: '规则', jinx: '相克' };
    var order = ['role', 'rule', 'jinx'];
    var html = '';
    order.forEach(function (t) {
      var arr = res.filter(function (x) { return x.t === t; });
      if (!arr.length) return;
      html += '<div class="g">' + g[t] + '</div>' + arr.map(function (x) {
        var href = x.t === 'role' ? '#/role/' + x.id : (x.t === 'rule' ? '#/rule/' + x.id : '#/jinxes');
        return '<div class="it" data-go="' + href + '"><b>' + esc(x.name) + '</b><span>' + esc(x.sub) + '</span></div>';
      }).join('');
    });
    sugg.innerHTML = html; sugg.classList.add('show');
  }
  qInput.addEventListener('input', showSugg);
  qInput.addEventListener('focus', showSugg);
  qInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var kw = qInput.value.trim(); if (kw) { sugg.classList.remove('show'); go('#/q/' + encodeURIComponent(kw)); } }
  });
  $('#qclear').addEventListener('click', function () { qInput.value = ''; sbox.classList.remove('has'); sugg.classList.remove('show'); });
  sugg.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go]');
    if (!el) return;
    sugg.classList.remove('show');
    go(el.dataset.go);
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#sbox')) sugg.classList.remove('show');
  });

  /* ---------------- 启动 ---------------- */
  window.addEventListener('hashchange', route);
  if (!location.hash) location.hash = '#/home';
  route();
})();
