/* ============================================================
 *  sheet.js —— 板子角色一览表（仿官方海报版式，可打印/存 PDF）
 *  路由： #/sheet/<id>   id = 官方剧本 id（tb/bmr/snv…）或自制板子 id（cs_*）
 *  版式：海报版（封面页 + 内页速查表，打印 A4 分页）/ 紧凑版（屏幕阅读）
 *  可切换，localStorage 记忆；app.js 是旧缓存时 selfHeal 自愈接管
 * ============================================================ */
(function () {
  var D = window.BOTC_DATA;
  if (!D) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function view() { return document.getElementById('view'); }
  function byId(id) {
    for (var i = 0; i < D.roles.length; i++) if (D.roles[i].id === id) return D.roles[i];
    return null;
  }

  var TEAM_TITLE = {
    townsfolk: '善良阵营 · 镇民',
    outsider: '善良阵营 · 外来者',
    minion: '邪恶阵营 · 爪牙',
    demon: '邪恶阵营 · 恶魔',
    traveler: '旅行者（可选）',
    fabled: '传奇角色 · 说书人'
  };
  var TEAM_CLS = { townsfolk: 'good', outsider: 'good', minion: 'evil', demon: 'evil', traveler: 'trav', fabled: 'fab' };

  function resolve(id) {
    var e = null;
    D.editions.forEach(function (x) { if (x.id === id) e = x; });
    if (!e) return null;
    var ids = e.roleIds || e.roles || [];
    var roles = ids.map(byId).filter(function (r) { return r; });
    var cs = (window.BOTCScripts && BOTCScripts.get) ? BOTCScripts.get(id) : null;
    return { e: e, roles: roles, cs: cs, custom: !!e.custom };
  }

  function mode() {
    var m = null;
    try { m = localStorage.getItem('botc_sheetmode'); } catch (e) { }
    return m === 'compact' ? 'compact' : 'poster';
  }
  function setMode(m) {
    try { localStorage.setItem('botc_sheetmode', m); } catch (e) { }
  }

  /* 能力文本关键词高亮（打印黑白也能看出重点） */
  function kw(t) {
    t = esc(t);
    ['沉沦', '心动连结', '连结', '中毒', '醉酒', '杀死', '死亡', '处决', '清醒', '免受中毒',
      '镇民', '外来者', '爪牙', '恶魔', '阵营'].forEach(function (k) {
        t = t.split(k).join('<b class="po-kw">' + k + '</b>');
      });
    return t;
  }

  function poIcon(r, sz) {
    var ch = esc((r.name || '?').slice(0, 1));
    return '<span class="po-ic ' + TEAM_CLS[r.team] + '" style="width:' + (sz || 38) + 'px;height:' + (sz || 38) + 'px">' +
      '<span class="po-fb">' + ch + '</span>' +
      (r.image ? '<img src="' + esc(r.image) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
      '</span>';
  }

  /* ============================================================
   *  海报版
   * ============================================================ */
  function poComp() {
    var comp = D.composition;
    var ns = [7, 8, 9, 10, 11, 12, 13, 14, 15];
    function row(key, label, cls) {
      return '<tr><th class="' + cls + '">' + label + '</th>' + ns.map(function (n) {
        return '<td>' + comp[Math.min(n, 15) - 5][key] + '</td>';
      }).join('') + '</tr>';
    }
    return '<table class="po-comp"><tr><th>玩家数量</th>' + ns.map(function (n) {
      return '<td>' + n + (n === 15 ? '+' : '') + '</td>';
    }).join('') + '</tr>' +
      row('townsfolk', '镇民', 'c-good') +
      row('outsider', '外来者', 'c-good') +
      row('minion', '爪牙', 'c-evil') +
      row('demon', '恶魔', 'c-evil') +
      '</table>';
  }

  /* ---------- 夜晚行动顺序：底部横条 ---------- */
  function poNightStrip(roles) {
    function row(key, title) {
      var list = roles.filter(function (r) { return r[key] > 0; }).sort(function (a, b) { return a[key] - b[key]; });
      return '<div class="po-ns-r"><i>' + title + '</i><div class="po-ns-l">' +
        list.map(function (r, i) {
          return '<span class="po-ns-i" title="' + esc(r.name) + ' · 第' + (i + 1) + '位">' +
            poIcon(r, 16) + '<b>' + (i + 1) + '</b></span>';
        }).join('') + (list.length ? '' : '<span class="po-ns-e">—</span>') + '</div></div>';
    }
    return '<div class="po-ns"><div class="po-ns-t">夜晚行动顺序（数字 = 当夜第几步）　·　⚙ 修改开局设置　* 仅在其他夜行动</div>' +
      row('firstNight', '首夜') + row('otherNight', '其他夜') + '</div>';
  }

  /* ---------- 正面：善良 + 邪恶角色（3 栏流式，能力完整文本） ---------- */
  function poItem(r, cls) {
    return '<div class="po-item" data-role="' + r.id + '">' + poIcon(r, 14) +
      '<div class="po-tx"><div class="po-nmh"><b class="po-nm ' + cls + '">' + esc(r.name) + '</b>' +
      (r.setup ? '<i class="po-mk" title="会修改开局设置">⚙</i>' : '') +
      (r.otherNight > 0 && r.firstNight === 0 ? '<i class="po-mk" title="仅在其他夜行动">*</i>' : '') +
      '</div><div class="po-ab">' + kw(esc(r.ability)) + '</div></div></div>';
  }
  function poBand(cls, title, n) {
    return '<div class="po-band ' + cls + '"><i></i>' + title + '<span>' + n + ' 名</span></div>';
  }
  function poAll(b) {
    var h = '<div class="po-flow">', teams = ['townsfolk', 'outsider', 'minion', 'demon'];
    teams.forEach(function (t) {
      var g = b.roles.filter(function (r) { return r.team === t; });
      if (!g.length) return;
      h += poBand(TEAM_CLS[t], TEAM_TITLE[t], g.length);
      g.forEach(function (r) { h += poItem(r, TEAM_CLS[t]); });
    });
    return h + '</div>';
  }

  /* ---------- 背面：旅行者 / 传奇角色（正面放不下，且属可选与说书人用） ---------- */
  function poSpecial(b) {
    var trav = b.roles.filter(function (r) { return r.team === 'traveler'; });
    var fab = b.roles.filter(function (r) { return r.team === 'fabled'; });
    if (!trav.length && !fab.length) return '';
    var h = '<div class="po-bk po-sp"><b>🎒 旅行者（可选） · 传奇角色 · 说书人<span class="po-spn">' +
      (trav.length + fab.length) + ' 名</span></b>';
    if (trav.length) {
      h += '<div class="po-band trav"><i></i>旅行者（可选）<span>' + trav.length + ' 名</span></div>';
      trav.forEach(function (r) { h += poItem(r, 'trav'); });
    }
    if (fab.length) {
      h += '<div class="po-band fab"><i></i>传奇角色 · 说书人<span>' + fab.length + ' 名</span></div>';
      fab.forEach(function (r) { h += poItem(r, 'fab'); });
    }
    return h + '</div>';
  }
  /* ---------- 背面：压缩版封面（标题 + 配比表） ---------- */
  function poCoverCompact(b) {
    var e = b.e;
    var credit = b.custom ? '自制剧本' : (e.level ? '官方剧本 · 难度 ' + e.level : '官方剧本');
    var em = b.cs ? b.cs.em : '🕰️';
    return '<div class="po-cover po-c2">' +
      '<div class="po-orn">✦ ────────── ✦</div>' +
      '<div class="po-en">BLOOD ON THE CLOCKTOWER</div>' +
      '<div class="po-title"><span class="po-titem">' + em + '</span>' + esc(e.name) + '</div>' +
      '<div class="po-sub">支持 ' + esc(e.playerNum || '5-15人') + ' · ' + esc(credit) + '</div>' +
      (b.cs ? '<div class="po-quote">“' + esc(b.cs.tag) + '”</div>' : '') +
      poComp() +
      '</div>';
  }

  /* ---------- 背面：规则文本去掉多余换行，连续排版省行数 ---------- */
  function flat(t) {
    return String(t || '').replace(/\r/g, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  function poRulesBlock(b) {
    var cs = b.cs;
    if (!cs) {
      return '<div class="po-bk"><b>✎ 说书人笔记</b><div class="po-lines"></div></div>' +
        '<div class="po-backtip">本剧本为官方剧本，规则以官方魔典为准。</div>';
    }
    var h = '';
    function block(title, list) {
      if (!list || !list.length) return '';
      return '<div class="po-bk"><b>' + title + '</b>' +
        list.map(function (m) {
          return '<div class="po-bkr"><i>' + esc(m.t) + '</i><span>' + esc(flat(m.d)) + '</span></div>';
        }).join('') + '</div>';
    }
    h += block('🧬 核心机制定义（开局前必读）', cs.mech);
    h += block('🧪 板子专属规则（开局前宣读）', cs.rules);
    if (cs.tips && cs.tips.length) {
      h += '<div class="po-bk"><b>🎙 说书人提示</b><div class="po-bkr"><span class="po-ol">' +
        cs.tips.map(function (t, i) { return (i + 1) + '. ' + esc(t); }).join('\n') +
        '</span></div></div>';
    }
    return h;
  }

  function renderPoster(b, host) {
    var e = b.e, em = b.cs ? b.cs.em : '🕰️';
    var head = '<div class="po-head"><span class="po-hem">' + em + '</span><b>' + esc(e.name) + '</b>' +
      '<span class="po-hs">支持 ' + esc(e.playerNum || '5-15人') + '</span></div>';

    /* 1 张 A4 双面：第 1 页正面 = 全部角色；第 2 页背面 = 封面 + 完整规则 */
    var pgs = [
      { c: 'po-front', h: head + poAll(b) + poNightStrip(b.roles) },
      {
        c: 'po-back', h: poCoverCompact(b) + '<div class="po-cols">' + poSpecial(b) + poRulesBlock(b) + '</div>' +
          '<div class="po-note">' + (b.cs ? '背面 · 封面 / 配比表 / 核心机制 / 专属规则 / 说书人提示' : '背面 · 封面 / 配比表 / 说书人笔记') + '</div>'
      }
    ];

    var html = '<div class="poster">' + pgs.map(function (p, i) {
      return '<div class="po-page ' + p.c + '"><div class="po-fit">' + p.h + '</div>' +
        '<div class="po-pgno">' + (i === 0 ? '正面' : '背面') + ' · ' + (i + 1) + ' / 2</div></div>';
    }).join('') + '</div>';

    host.innerHTML = html;
    setTimeout(fitPages, 30);
    setTimeout(fitPages, 300);
    setTimeout(fitPages, 900);
  }

  /* 把每页内容按 A4 画布等比缩放，确保一页装得下。
   * 二分收敛：排版宽度随缩放变化，高度也会跟着变，一次算不准。 */
  function fitPages() {
    var pages = document.querySelectorAll('.po-page');
    Array.prototype.forEach.call(pages, function (pg) {
      var inner = pg.querySelector('.po-fit');
      if (!inner) return;
      var cs = window.getComputedStyle(pg);
      var pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
      var pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
      var availW = pg.clientWidth - pl - pr;
      var availH = pg.clientHeight - pt - pb;
      if (availH <= 0 || availW <= 0) return;
      inner.style.transform = 'none';
      var lo = 0.3, hi = 1, s = 1, k;
      for (k = 0; k < 9; k++) {
        s = (lo + hi) / 2;
        inner.style.width = (availW / s) + 'px';
        if (inner.scrollHeight * s <= availH) lo = s; else hi = s;
      }
      s = lo;
      inner.style.width = (availW / s) + 'px';
      inner.style.transformOrigin = 'top left';
      inner.style.transform = s < 0.999 ? 'scale(' + s.toFixed(4) + ')' : 'none';
    });
  }
  window.addEventListener('beforeprint', fitPages);
  window.addEventListener('resize', function () { setTimeout(fitPages, 60); });

  /* ============================================================
   *  紧凑版（屏幕阅读）
   * ============================================================ */
  function nightRailCompact(roles) {
    var fn = roles.filter(function (r) { return r.firstNight > 0; }).sort(function (a, b) { return a.firstNight - b.firstNight; });
    var on = roles.filter(function (r) { return r.otherNight > 0; }).sort(function (a, b) { return a.otherNight - b.otherNight; });
    function col(list, title) {
      return '<div class="sh-nr-g"><div class="sh-nr-t">' + title + '</div>' +
        list.map(function (r, i) {
          return '<div class="sh-nr-i" title="' + esc(r.name) + ' · 第' + (i + 1) + '位">' +
            '<span class="sh-ic">' + poIcon(r, 34) + '</span><b>' + (i + 1) + '</b></div>';
        }).join('') + (list.length ? '' : '<div class="sh-nr-e">—</div>') + '</div>';
    }
    return '<div class="sh-rail">' + col(fn, '首夜') + col(on, '其他夜') +
      '<div class="sh-nr-lg">数字 = 当夜行动顺序</div></div>';
  }

  function group(team, roles) {
    var g = roles.filter(function (r) { return r.team === team; });
    if (!g.length) return '';
    return '<div class="sh-sec ' + TEAM_CLS[team] + '"><div class="sh-sec-t">' + TEAM_TITLE[team] +
      ' <span>' + g.length + '</span></div>' +
      '<div class="sh-grid">' + g.map(function (r) {
        return '<div class="sh-item" data-role="' + r.id + '">' + poIcon(r, 42) +
          '<div class="sh-b"><div class="sh-nm">' + esc(r.name) +
          (r.setup ? ' <i class="sh-st" title="该角色会修改开局设置">⚙</i>' : '') +
          (r.otherNight > 0 && r.firstNight === 0 ? ' <i class="sh-st" title="仅在其他夜行动">★</i>' : '') +
          '</div><div class="sh-ab">' + esc(r.ability) + '</div></div></div>';
      }).join('') + '</div></div>';
  }

  function compTableCompact() {
    var comp = D.composition;
    var ns = [], i;
    for (i = 5; i <= 15; i++) ns.push(i);
    function row(key, label, cls) {
      var tds = ns.map(function (n) {
        return '<td class="' + cls + '">' + comp[Math.min(n, 15) - 5][key] + '</td>';
      }).join('');
      return '<tr><th>' + label + '</th>' + tds + '</tr>';
    }
    return '<div class="sh-comp"><div class="sh-comp-t">玩家数量与阵营配比</div>' +
      '<table><tr><th>玩家数量</th>' + ns.map(function (n) { return '<td>' + n + (n === 15 ? '+' : '') + '</td>'; }).join('') + '</tr>' +
      row('townsfolk', '镇民', 'c-good') +
      row('outsider', '外来者', 'c-good') +
      row('minion', '爪牙', 'c-evil') +
      row('demon', '恶魔', 'c-evil') +
      '</table></div>';
  }

  function renderCompact(b, host) {
    var e = b.e;
    var sub = [e.playerNum || '', b.custom ? '自制板子' : (e.level ? '官方剧本 · 难度 ' + e.level : '官方剧本')]
      .filter(Boolean).join(' · ');

    var html = '<div class="sh-hero">' +
      (b.cs ? '<span class="sh-em">' + b.cs.em + '</span>' : '<span class="sh-em">🕰️</span>') +
      '<div class="sh-ht"><h1>' + esc(e.name) + '</h1><div class="sh-hs">' + esc(sub) + '</div>' +
      (b.cs ? '<div class="sh-tag">“' + esc(b.cs.tag) + '”</div>' : '') + '</div></div>';

    html += compTableCompact();

    html += '<div class="sh-body">' + nightRailCompact(b.roles) + '<div class="sh-main">';
    html += group('townsfolk', b.roles) + group('outsider', b.roles);
    html += group('minion', b.roles) + group('demon', b.roles);
    html += group('traveler', b.roles) + group('fabled', b.roles);
    html += '</div></div>';

    if (b.cs && b.cs.rules && b.cs.rules.length) {
      html += '<div class="sh-rules"><div class="sh-sec-t">本板子专属规则（开局前宣读）</div>' +
        b.cs.rules.map(function (r) {
          return '<div class="sh-rule"><b>' + esc(r.t) + '</b><span>' + esc(r.d) + '</span></div>';
        }).join('') + '</div>';
    }

    html += '<div class="sh-foot">左侧栏为夜晚行动顺序（官方魔典口径）· ⚙ = 会修改开局设置 · ★ = 仅在其他夜行动 · 点击任意角色可查看详情与相克</div>';

    host.innerHTML = html;
  }

  /* ============================================================
   *  主渲染
   * ============================================================ */
  function render(id) {
    var b = resolve(id);
    if (!b) { view().innerHTML = '<div class="empty">未找到板子</div>'; return; }
    var m = mode();

    var bar = '<div class="backbar noprint"><button data-back="1">‹ 返回</button>' +
      '<span class="po-tabs">' +
      '<button class="chip' + (m === 'poster' ? ' on' : '') + '" data-pomode="poster">🖼️ 海报版</button>' +
      '<button class="chip' + (m === 'compact' ? ' on' : '') + '" data-pomode="compact">📄 紧凑版</button>' +
      '</span>' +
      '<button class="btn sh-print" onclick="window.print()">🖨️ 打印 / 存为 PDF</button></div>' +
      (m === 'poster' ? '<div class="po-hint noprint">📄 <b>1 张 A4 双面 = 2 页</b>：<b>正面</b>全部角色速查 + 夜晚行动顺序，<b>背面</b>封面 / 配比表 / 核心机制 / 板子专属规则 / 说书人提示。<br>页面已按 A4 实际尺寸（210×297mm）排版，打印时缩放选「默认／100%」、方向纵向、勾选「双面打印（长边翻转）」即可。</div>' : '');

    var wrap = document.createElement('div');
    if (m === 'poster') renderPoster(b, wrap);
    else renderCompact(b, wrap);

    view().innerHTML = bar + wrap.innerHTML;
    window.scrollTo(0, 0);
  }

  /* ---------- 版式切换 ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-pomode]');
    if (!t) return;
    setMode(t.dataset.pomode);
    var h = location.hash || '';
    if (h.indexOf('#/sheet/') === 0) render((h.replace(/^#\/sheet\/?/, '') || '').split('/')[0]);
  });

  /* ---------- 自愈（app.js 为旧缓存时接管渲染） ---------- */
  function selfHeal() {
    var h = location.hash || '';
    if (h.indexOf('#/sheet/') !== 0) return;
    var v = document.getElementById('view');
    if (!v) return;
    if (v.querySelector('.sh-hero, .sh-comp, .po-cover, .poster')) return;
    render((h.replace(/^#\/sheet\/?/, '') || '').split('/')[0]);
  }
  window.addEventListener('hashchange', function () { setTimeout(selfHeal, 80); });
  window.addEventListener('load', function () { setTimeout(selfHeal, 150); });
  setTimeout(selfHeal, 500);
  setTimeout(selfHeal, 1500);

  window.BOTCSheet = {
    route: function (r) { render(r.a); },
    selfHeal: selfHeal
  };
})();
