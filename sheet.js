/* ============================================================
 *  sheet.js —— 板子角色一览表（海报版，可打印/存 PDF）
 *  路由： #/sheet/<id>   id = 官方剧本 id（tb/bmr/snv…）或自制板子 id（cs_*）
 *  仿官方角色速查表排版：左侧夜晚顺序栏 + 右侧按阵营分组的角色卡
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

  /* ---------- 配比表（5..15+ 人） ---------- */
  function compTable() {
    var comp = D.composition; /* index 0 = 5人 */
    var ns = [], i;
    for (i = 5; i <= 15; i++) ns.push(i);
    function row(key, label, cls) {
      var tds = ns.map(function (n) {
        var v = comp[Math.min(n, 15) - 5][key];
        return '<td class="' + cls + '">' + v + '</td>';
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

  /* ---------- 左侧夜晚顺序栏 ---------- */
  function nightRail(roles) {
    var fn = roles.filter(function (r) { return r.firstNight > 0; }).sort(function (a, b) { return a.firstNight - b.firstNight; });
    var on = roles.filter(function (r) { return r.otherNight > 0; }).sort(function (a, b) { return a.otherNight - b.otherNight; });
    function col(list, title) {
      return '<div class="sh-nr-g"><div class="sh-nr-t">' + title + '</div>' +
        list.map(function (r, i) {
          return '<div class="sh-nr-i" title="' + esc(r.name) + ' · 第' + (i + 1) + '位">' +
            '<span class="sh-ic">' + icon(r) + '</span><b>' + (i + 1) + '</b></div>';
        }).join('') + (list.length ? '' : '<div class="sh-nr-e">—</div>') + '</div>';
    }
    return '<div class="sh-rail">' + col(fn, '首夜') + col(on, '其他夜') +
      '<div class="sh-nr-lg">数字 = 当夜行动顺序</div></div>';
  }

  /* ---------- 角色图标（官方头像，加载失败回退首字） ---------- */
  function icon(r) {
    var ch = esc((r.name || '?').slice(0, 1));
    return '<span class="sh-icwrap ' + TEAM_CLS[r.team] + '"><span class="sh-fb">' + ch + '</span>' +
      (r.image ? '<img src="' + esc(r.image) + '" alt="' + esc(r.name) + '" loading="lazy" onerror="this.remove()">' : '') +
      '</span>';
  }

  /* ---------- 角色分组区块 ---------- */
  function group(team, roles) {
    var g = roles.filter(function (r) { return r.team === team; });
    if (!g.length) return '';
    return '<div class="sh-sec ' + TEAM_CLS[team] + '"><div class="sh-sec-t">' + TEAM_TITLE[team] +
      ' <span>' + g.length + '</span></div>' +
      '<div class="sh-grid">' + g.map(function (r) {
        return '<div class="sh-item" data-role="' + r.id + '">' + icon(r) +
          '<div class="sh-b"><div class="sh-nm">' + esc(r.name) +
          (r.setup ? ' <i class="sh-st" title="该角色会修改开局设置">⚙</i>' : '') +
          (r.otherNight > 0 && r.firstNight === 0 ? ' <i class="sh-st" title="仅在其他夜行动">★</i>' : '') +
          '</div><div class="sh-ab">' + esc(r.ability) + '</div></div></div>';
      }).join('') + '</div></div>';
  }

  /* ---------- 主渲染 ---------- */
  function render(id) {
    var b = resolve(id);
    if (!b) { view().innerHTML = '<div class="empty">未找到板子</div>'; return; }
    var e = b.e;
    var sub = [e.playerNum || '', b.custom ? '自制板子' : (e.level ? '官方剧本 · 难度 ' + e.level : '官方剧本')]
      .filter(Boolean).join(' · ');

    var html = '<div class="backbar noprint"><button data-back="1">‹ 返回</button>' +
      '<button class="btn sh-print" onclick="window.print()">🖨️ 打印 / 存为 PDF</button></div>';

    /* 头部横幅 */
    html += '<div class="sh-hero">' +
      (b.cs ? '<span class="sh-em">' + b.cs.em + '</span>' : '<span class="sh-em">🕰️</span>') +
      '<div class="sh-ht"><h1>' + esc(e.name) + '</h1><div class="sh-hs">' + esc(sub) + '</div>' +
      (b.cs ? '<div class="sh-tag">“' + esc(b.cs.tag) + '”</div>' : '') + '</div></div>';

    html += compTable();

    /* 主体：左栏夜序 + 右侧角色卡 */
    html += '<div class="sh-body">' + nightRail(b.roles) + '<div class="sh-main">';
    html += group('townsfolk', b.roles) + group('outsider', b.roles);
    html += group('minion', b.roles) + group('demon', b.roles);
    html += group('traveler', b.roles) + group('fabled', b.roles);
    html += '</div></div>';

    /* 自制规则脚注（打印时一并带走） */
    if (b.cs && b.cs.rules && b.cs.rules.length) {
      html += '<div class="sh-rules"><div class="sh-sec-t">本板子专属规则（开局前宣读）</div>' +
        b.cs.rules.map(function (r) {
          return '<div class="sh-rule"><b>' + esc(r.t) + '</b><span>' + esc(r.d) + '</span></div>';
        }).join('') + '</div>';
    }

    html += '<div class="sh-foot">左侧栏为夜晚行动顺序（官方魔典口径）· ⚙ = 会修改开局设置 · ★ = 仅在其他夜行动 · 点击任意角色可查看详情与相克</div>';

    view().innerHTML = html;
    window.scrollTo(0, 0);
  }

  window.BOTCSheet = {
    route: function (r) { render(r.a); }
  };
})();
