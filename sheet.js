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

  function poCover(b) {
    var e = b.e;
    var credit = b.custom ? '自制剧本' : (e.level ? '官方剧本 · 难度 ' + e.level : '官方剧本');
    var em = b.cs ? b.cs.em : '🕰️';
    return '<div class="po-cover">' +
      '<div class="po-orn">✦ ────────── ✦</div>' +
      '<div class="po-en">BLOOD ON THE CLOCKTOWER</div>' +
      '<div class="po-title"><span class="po-titem">' + em + '</span>' + esc(e.name) + '</div>' +
      '<div class="po-sub">支持 ' + esc(e.playerNum || '5-15人') + '</div>' +
      '<div class="po-credit">' + esc(credit) + '</div>' +
      (b.cs ? '<div class="po-quote">“' + esc(b.cs.tag) + '”</div>' : '') +
      poComp() +
      '<div class="po-orn">❦</div>' +
      '<div class="po-note">打印后沿边框裁开，即是一张标准的说书人速查海报</div>' +
      '</div>';
  }

  function poRail(roles, key, title) {
    var list = roles.filter(function (r) { return r[key] > 0; }).sort(function (a, b) { return a[key] - b[key]; });
    return '<div class="po-rail"><div class="po-rail-t">' + title + '</div>' +
      list.map(function (r, i) {
        return '<div class="po-rail-i" title="' + esc(r.name) + ' · 第' + (i + 1) + '位">' + poIcon(r, 30) + '<b>' + (i + 1) + '</b></div>';
      }).join('') + (list.length ? '' : '<div class="po-rail-e">—</div>') + '</div>';
  }

  function poSec(team, roles) {
    var g = roles.filter(function (r) { return r.team === team; });
    if (!g.length) return '';
    return '<div class="po-sec ' + TEAM_CLS[team] + '"><div class="po-sect"><i></i>' + TEAM_TITLE[team] +
      '<span>' + g.length + ' 名</span></div>' +
      '<div class="po-list">' + g.map(function (r) {
        return '<div class="po-item" data-role="' + r.id + '">' + poIcon(r, 38) +
          '<div class="po-tx"><div class="po-nmh"><b class="po-nm">' + esc(r.name) + '</b>' +
          (r.setup ? '<i class="po-mk" title="会修改开局设置">⚙</i>' : '') +
          (r.otherNight > 0 && r.firstNight === 0 ? '<i class="po-mk" title="仅在其他夜行动">*</i>' : '') +
          '</div><div class="po-ab">' + kw(r.ability) + '</div></div></div>';
      }).join('') + '</div></div>';
  }

  function renderPoster(b, host) {
    var e = b.e;
    var html = '<div class="poster">';

    html += poCover(b);

    html += '<div class="po-inner">' +
      '<div class="po-head"><span class="po-hem">' + (b.cs ? b.cs.em : '🕰️') + '</span><b>' + esc(e.name) + '</b>' +
      '<span class="po-hs">支持 ' + esc(e.playerNum || '5-15人') + '</span></div>';

    html += '<div class="po-grid">' +
      poRail(b.roles, 'firstNight', '首夜') +
      '<div class="po-mid">' +
      poSec('townsfolk', b.roles) + poSec('outsider', b.roles) +
      poSec('minion', b.roles) + poSec('demon', b.roles) +
      '</div>' +
      poRail(b.roles, 'otherNight', '其他夜') +
      '</div>';

    var trav = b.roles.filter(function (r) { return r.team === 'traveler'; });
    var fab = b.roles.filter(function (r) { return r.team === 'fabled'; });
    if (trav.length || fab.length) {
      html += '<div class="po-fab"><div class="po-sect"><i></i>' +
        (trav.length ? '旅行者（可选） · ' : '') + '传奇角色 · 说书人<span>' + (trav.length + fab.length) + ' 名</span></div>' +
        '<div class="po-list po-fablist">' +
        trav.concat(fab).map(function (r) {
          return '<div class="po-item" data-role="' + r.id + '">' + poIcon(r, 32) +
            '<div class="po-tx"><div class="po-nmh"><b class="po-nm ' + TEAM_CLS[r.team] + '">' + esc(r.name) + '</b>' +
            '<span class="po-tm">' + esc(r.teamCn) + '</span></div>' +
            '<div class="po-ab">' + kw(r.ability) + '</div></div></div>';
        }).join('') + '</div></div>';
    }

    if (b.cs && b.cs.rules && b.cs.rules.length) {
      html += '<div class="po-rules"><b>本板子专属规则（开局前宣读）</b>' +
        b.cs.rules.map(function (r) { return '<span><i>' + esc(r.t) + '</i>' + esc(r.d) + '</span>'; }).join('') +
        '</div>';
    }

    html += '<div class="po-legend">* 代表仅在其他夜行动　⚙ 代表会修改开局设置　左右两栏为夜晚行动顺序（数字 = 当夜第几步）' +
      '　·　角色能力以官方魔典口径为准，点击任意角色可查看详情</div>';

    html += '</div></div>';
    host.innerHTML = html;
  }

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
      '<button class="btn sh-print" onclick="window.print()">🖨️ 打印 / 存为 PDF</button></div>';

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
