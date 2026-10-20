/* 染·钟楼谜团 — 对局分析 / 复盘 */
(function () {
  'use strict';

  var D = window.BOTC_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = function () { return $('#view'); };
  var byId = {}; D.roles.concat(D.fabled).forEach(function (r) { byId[r.id] = r; });
  var TEAMCN = (window.BOTCGame && BOTCGame.TEAMCN) || { townsfolk: '镇民', outsider: '外来者', minion: '爪牙', demon: '恶魔', traveler: '旅行者', fabled: '传奇' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var UI = { spoiler: true };

  function game() { return window.BOTCGame ? BOTCGame.get() : null; }
  function edName(id) { var e = D.editions.filter(function (x) { return x.id === id; })[0]; return e ? e.name : id; }
  function roleOf(s) { return s && s.role ? byId[s.role] : null; }
  function isEvil(r) { return r && (r.team === 'minion' || r.team === 'demon'); }
  function isGood(r) { return r && (r.team === 'townsfolk' || r.team === 'outsider'); }

  /* ---------------- 数据抽取 ---------------- */
  function nightInfos(G) {
    var out = [];
    G.log.forEach(function (l) {
      if (l.tag !== 'night') return;
      var m = /^夜晚 · (.+?)(?:（跳过）)?(?: → (\d+)号)?(?:：(.+))?$/.exec(l.text);
      if (!m) return;
      var who = m[1].trim();
      if (!who || who.indexOf('开始') >= 0) return;
      out.push({ day: l.day, who: who, target: m[2] ? +m[2] : null, info: (m[3] || '').trim(), skip: /（跳过）/.test(l.text) });
    });
    return out;
  }
  function deaths(G) {
    var out = [];
    G.log.forEach(function (l) {
      if (l.tag !== 'death' && l.tag !== 'exec') return;
      out.push({ day: l.day, kind: l.tag === 'exec' ? '处决' : '死亡', text: l.text });
    });
    return out;
  }
  function playerStats(G) {
    var st = {};
    G.seats.forEach(function (s) {
      st[s.n] = { n: s.n, name: s.name, nom: 0, nomed: 0, yes: 0, yesEvil: 0, no: 0, skip: 0, votes: 0, role: roleOf(s) };
    });
    G.noms.forEach(function (v) {
      var to = st[v.to];
      if (to) to.nomed++;
      var by = st[v.by];
      if (by) by.nom++;
      (v.votes || []).forEach(function (x) {
        var p = st[x.seat]; if (!p) return;
        p.votes++;
        if (x.yes === 1) {
          p.yes++;
          if (isEvil(to && to.role)) p.yesEvil++;
        } else if (x.yes === 0) p.no++;
        else p.skip++;
      });
    });
    return Object.keys(st).map(function (k) { return st[k]; });
  }
  function fmtDur(ms) {
    if (!ms || ms < 0) return '—';
    var m = Math.round(ms / 60000);
    if (m < 60) return m + ' 分钟';
    return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
  }

  /* ---------------- 结论生成 ---------------- */
  function conclusions(G) {
    var out = [];
    var alive = G.seats.filter(function (s) { return s.alive; });
    var dead = G.seats.filter(function (s) { return !s.alive; });
    var evilAlive = alive.filter(function (s) { return isEvil(roleOf(s)); });
    var demons = G.seats.filter(function (s) { var r = roleOf(s); return r && r.team === 'demon'; });

    out.push('本局共 ' + G.seats.length + ' 人，进行了 ' + G.day + ' 个白天，最终 ' +
      (G.winner === 'good' ? '善良阵营胜利' : G.winner === 'evil' ? '邪恶阵营胜利' : '尚未结束') + '。');

    demons.forEach(function (s) {
      var r = roleOf(s);
      out.push('恶魔是 ' + s.n + '号 ' + s.name + '（' + (r ? r.name : '?') + '），' + (s.alive ? '存活到最后' : '在第 ' + (s.deadDay || '?') + ' 天出局') + '。');
    });
    out.push('结束时存活 ' + alive.length + ' 人，其中邪恶方 ' + evilAlive.length + ' 人；出局 ' + dead.length + ' 人。');

    var infos = nightInfos(G);
    if (infos.length) {
      out.push('全夜共记录 ' + infos.length + ' 条夜晚信息（含跳过 ' + infos.filter(function (x) { return x.skip; }).length + ' 条）。');
    }

    var execs = G.noms.filter(function (v) { return v.result === 'exec'; });
    if (execs.length) {
      var hit = execs.filter(function (v) { var s = seatOf(G, v.to); return isEvil(roleOf(s)); }).length;
      out.push('共处决 ' + execs.length + ' 人，其中 ' + hit + ' 人是邪恶方（命中率 ' + Math.round(hit / execs.length * 100) + '%）。');
    } else out.push('本局没有成功处决任何玩家。');

    var st = playerStats(G);
    var best = st.filter(function (p) { return p.yes >= 2; }).sort(function (a, b) { return (b.yesEvil / b.yes) - (a.yesEvil / a.yes); })[0];
    if (best) {
      out.push('票型最准的是 ' + best.n + '号 ' + best.name + '：赞成票 ' + best.yes + ' 张中有 ' + best.yesEvil + ' 张投给邪恶（' + Math.round(best.yesEvil / best.yes * 100) + '%）。');
    }
    var evilyes = st.filter(function (p) { return isEvil(p.role) && p.yes; });
    if (evilyes.length) {
      out.push('邪恶玩家的投票：' + evilyes.map(function (p) {
        return p.n + '号 ' + p.yes + ' 赞成（其中投给同伴 ' + (p.yes - p.yesEvil) + '）';
      }).join('、') + '。');
    }
    var quiet = st.filter(function (p) { return p.votes === 0 && p.nom === 0; });
    if (quiet.length) out.push('全程未投票也未提名：' + quiet.map(function (p) { return p.n + '号 ' + p.name; }).join('、') + '。');
    return out;
  }
  function seatOf(G, n) { for (var i = 0; i < G.seats.length; i++) if (G.seats[i].n === n) return G.seats[i]; return null; }

  /* ---------------- 战报 ---------------- */
  function report(G) {
    var L = [];
    L.push('# 染·钟楼谜团 对局复盘');
    L.push('');
    L.push('- 剧本：' + edName(G.edition) + ' · ' + G.seats.length + ' 人');
    L.push('- 结果：' + (G.winner === 'good' ? '善良阵营胜利' : G.winner === 'evil' ? '邪恶阵营胜利' : '进行中') +
      '（第 ' + G.day + ' 天' + (G.startedAt ? '，用时约 ' + fmtDur(Date.now() - G.startedAt) : '') + '）');
    L.push('');
    L.push('## 座位与角色');
    L.push('| 座 | 玩家 | 角色 | 阵营 | 结局 |');
    L.push('|---|---|---|---|---|');
    G.seats.forEach(function (s) {
      var r = roleOf(s);
      L.push('| ' + s.n + ' | ' + s.name + ' | ' + (r ? r.name : '—') + ' | ' + (r ? TEAMCN[r.team] : '—') + ' | ' +
        (s.alive ? '存活' : ('第 ' + (s.deadDay || '?') + ' 天出局')) + ' |');
    });
    L.push('');
    var infos = nightInfos(G);
    if (infos.length) {
      L.push('## 夜晚信息');
      L.push('| 夜 | 角色 | 目标 | 信息 |');
      L.push('|---|---|---|---|');
      infos.forEach(function (x) {
        L.push('| 第 ' + x.day + ' 夜 | ' + x.who + ' | ' + (x.target ? x.target + '号' : '—') + ' | ' + (x.skip ? '（跳过）' : (x.info || '—')) + ' |');
      });
      L.push('');
    }
    var ds = deaths(G);
    if (ds.length) {
      L.push('## 出局时间线');
      ds.forEach(function (d) { L.push('- 第 ' + d.day + ' 天 · ' + d.kind + '：' + d.text); });
      L.push('');
    }
    if (G.noms.length) {
      L.push('## 提名与投票');
      L.push('| 天 | 提名人 | 被提名 | 赞成 | 反对 | 弃权 | 结果 |');
      L.push('|---|---|---|---|---|---|---|');
      G.noms.forEach(function (v) {
        L.push('| ' + v.day + ' | ' + v.by + '号 | ' + v.to + '号 | ' +
          v.votes.filter(function (x) { return x.yes === 1; }).length + ' | ' +
          v.votes.filter(function (x) { return x.yes === 0; }).length + ' | ' +
          v.votes.filter(function (x) { return x.yes === -1; }).length + ' | ' +
          (v.result === 'exec' ? '处决' : v.result === 'tie' ? '未通过' : '—') + ' |');
      });
      L.push('');
    }
    L.push('## 玩家数据');
    L.push('| 座 | 玩家 | 角色 | 提名 | 被提名 | 赞成 | 命中邪恶 |');
    L.push('|---|---|---|---|---|---|---|');
    playerStats(G).forEach(function (p) {
      L.push('| ' + p.n + ' | ' + p.name + ' | ' + (p.role ? p.role.name : '—') + ' | ' + p.nom + ' | ' + p.nomed + ' | ' + p.yes + ' | ' + p.yesEvil + ' |');
    });
    L.push('');
    L.push('## 复盘要点');
    conclusions(G).forEach(function (c) { L.push('- ' + c); });
    L.push('');
    return L.join('\n');
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    var G = game();
    if (!G) {
      view().innerHTML = '<div class="card" style="margin-top:14px"><div class="empty">还没有进行中的对局。先去「🕯️ 开局」抽签发牌。</div>' +
        '<div class="qbtns"><button class="btn primary" data-anew="1">去开局 ›</button></div></div>';
      return;
    }
    var al = G.seats.filter(function (s) { return s.alive; }).length;
    var infos = nightInfos(G), ds = deaths(G), st = playerStats(G);

    var h = '<div class="backbar"><button data-aback="1">‹ 魔典</button>' +
      '<span style="font-size:12px;color:var(--text-faint)">对局分析 · 复盘</span></div>';

    /* 概览 */
    h += '<div class="card" style="padding:12px 14px"><div class="ftl">概览</div>' +
      '<div class="kv"><span>剧本</span><b>' + esc(edName(G.edition)) + '</b></div>' +
      '<div class="kv"><span>人数</span><b>' + G.seats.length + ' 人（存活 ' + al + '）</b></div>' +
      '<div class="kv"><span>进度</span><b>第 ' + G.day + ' 天 · ' +
      (G.phase === 'night' ? '夜晚' : G.phase === 'day' ? '白天' : G.phase === 'setup' ? '准备' : '已结束') + '</b></div>' +
      '<div class="kv"><span>结果</span><b>' + (G.winner === 'good' ? '善良阵营胜利 🎉' : G.winner === 'evil' ? '邪恶阵营胜利 😈' : '进行中') + '</b></div>' +
      '<div class="kv"><span>用时</span><b>' + (G.startedAt ? fmtDur(Date.now() - G.startedAt) : '—') + '</b></div>' +
      '<div class="qbtns" style="margin-top:10px"><button class="btn" data-aspoil="1">' + (UI.spoiler ? '隐藏角色真相' : '显示角色真相') + '</button></div></div>';

    /* 座位真相 */
    h += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">座位 · 角色 · 结局</div>' +
      '<div class="stwrap"><table class="sttable"><thead><tr><th>座</th><th>玩家</th><th>角色</th><th>阵营</th><th>结局</th></tr></thead><tbody>' +
      G.seats.map(function (s) {
        var r = roleOf(s);
        var nm = UI.spoiler ? (r ? esc(r.name) : '—') : '？？？';
        var tm = UI.spoiler ? (r ? TEAMCN[r.team] : '—') : '？';
        return '<tr class="' + (s.alive ? '' : 'dead') + '"><td>' + s.n + '</td><td>' + esc(s.name) + '</td>' +
          '<td>' + nm + '</td><td>' + (UI.spoiler && r ? '<span class="tag t-' + r.team + '">' + esc(tm) + '</span>' : tm) + '</td>' +
          '<td>' + (s.alive ? '存活' : '第 ' + (s.deadDay || '?') + ' 天出局') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    /* 夜晚信息 */
    h += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">夜晚信息流（' + infos.length + ' 条）</div>' +
      (infos.length ? '<div class="stwrap"><table class="sttable"><thead><tr><th>夜</th><th>角色</th><th>目标</th><th>信息</th></tr></thead><tbody>' +
        infos.map(function (x) {
          var ts = x.target ? seatOf(G, x.target) : null;
          var tr = roleOf(ts);
          return '<tr><td>第' + x.day + '夜</td><td>' + esc(x.who) + '</td>' +
            '<td>' + (ts ? x.target + '号 ' + esc(ts.name) + (UI.spoiler && tr ? '（' + esc(tr.name) + '）' : '') : '—') + '</td>' +
            '<td>' + (x.skip ? '跳过' : esc(x.info || '—')) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="note">还没有夜晚记录</div>') + '</div>';

    /* 出局时间线 */
    h += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">出局时间线（' + ds.length + '）</div>' +
      (ds.length ? ds.map(function (d) {
        return '<div class="nrow"><div class="no">' + (d.kind === '处决' ? '⚖️' : '💀') + '</div><div><div class="nm">第 ' + d.day + ' 天</div>' +
          '<div class="rm">' + esc(d.text) + '</div></div></div>';
      }).join('') : '<div class="note">还没有人出局</div>') + '</div>';

    /* 提名投票 */
    h += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">提名与投票（' + G.noms.length + ' 次）</div>' +
      (G.noms.length ? '<div class="stwrap"><table class="sttable"><thead><tr><th>天</th><th>提名</th><th>对象</th><th>赞成</th><th>反对</th><th>弃权</th><th>结果</th></tr></thead><tbody>' +
        G.noms.map(function (v) {
          var ts = seatOf(G, v.to), tr = roleOf(ts);
          return '<tr><td>' + v.day + '</td><td>' + v.by + '号</td>' +
            '<td>' + v.to + '号' + (UI.spoiler && tr ? '（' + esc(tr.name) + '）' : '') + '</td>' +
            '<td>' + v.votes.filter(function (x) { return x.yes === 1; }).length + '</td>' +
            '<td>' + v.votes.filter(function (x) { return x.yes === 0; }).length + '</td>' +
            '<td>' + v.votes.filter(function (x) { return x.yes === -1; }).length + '</td>' +
            '<td>' + (v.result === 'exec' ? '处决' : v.result === 'tie' ? '未通过' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="note">还没有提名</div>') + '</div>';

    /* 玩家数据 */
    h += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">玩家数据（提名 / 投票倾向）</div>' +
      '<div class="stwrap"><table class="sttable"><thead><tr><th>座</th><th>玩家</th><th>角色</th><th>提名</th><th>被提名</th><th>赞成</th><th>命中邪恶</th><th>弃权</th></tr></thead><tbody>' +
      st.map(function (p) {
        return '<tr class="' + (seatOf(G, p.n) && seatOf(G, p.n).alive ? '' : 'dead') + '"><td>' + p.n + '</td><td>' + esc(p.name) + '</td>' +
          '<td>' + (UI.spoiler && p.role ? esc(p.role.name) : '？') + '</td>' +
          '<td>' + p.nom + '</td><td>' + p.nomed + '</td><td>' + p.yes + '</td><td>' + p.yesEvil + '</td><td>' + p.skip + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="note">「命中邪恶」= 该玩家投出的赞成票中，对象确实是爪牙 / 恶魔的票数。复盘时看这个数，可以判断谁在带节奏、谁在被带。</div></div>';

    /* 结论 */
    h += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">复盘要点</div>' +
      conclusions(G).map(function (c) { return '<div class="nrow"><div class="no">·</div><div><div class="rm">' + esc(c) + '</div></div></div>'; }).join('') +
      '</div>';

    h += '<div class="qbtns"><button class="btn primary" data-acopy="1">复制战报（Markdown）</button>' +
      '<button class="btn" data-adown="1">下载战报 .md</button>' +
      '<button class="btn" data-alog="1">查看完整日志</button></div>';

    view().innerHTML = h;
  }

  function copyText(text, msg) {
    var done = function () { alert(msg || text); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { prompt('复制以下内容：', text); });
    } else prompt('复制以下内容：', text);
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-aback]')) { location.hash = '#/game'; return; }
    if (e.target.closest('[data-anew]')) { location.hash = '#/game/new'; return; }
    if (e.target.closest('[data-alog]')) { location.hash = '#/game/log'; return; }
    if (e.target.closest('[data-aspoil]')) { UI.spoiler = !UI.spoiler; render(); return; }
    if (e.target.closest('[data-acopy]')) { var g = game(); if (g) copyText(report(g), '战报已复制，可直接发到群里'); return; }
    if (e.target.closest('[data-adown]')) {
      var g2 = game(); if (!g2) return;
      var blob = new Blob([report(g2)], { type: 'text/markdown;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '血染复盘_' + new Date().toISOString().slice(0, 10) + '.md';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      return;
    }
  });

  window.BOTCAnalyze = { route: render };
})();
