/* 染·钟楼谜团 — 角色能力自动计算引擎
 * 参考 bra1n/townsquare 的魔典数据组织方式，按官方能力文本实现逐角色计算。
 * 每个能力定义：{ targets: 0|1|2, excludeSelf: bool, hint: '', calc(ctx, t1, t2) }
 *   calc 返回 { info, detail, say, warn, actions:[{label, run}] }
 */
window.BOTCAbility = (function () {
  'use strict';
  var A = {};

  function def(id, o) { A[id] = o; }

  /* ---------- 通用小工具（挂在 ctx 上） ---------- */
  function buildCtx(G, self, h) {
    var seats = G.seats.slice().sort(function (a, b) { return a.n - b.n; });
    var byId = h.byId;
    function role(s) { return s && s.role ? byId[s.role] : null; }
    function isEvil(s) { var r = role(s); return !!r && (r.team === 'minion' || r.team === 'demon'); }
    function isGood(s) { return !isEvil(s); }
    function alive() { return seats.filter(function (s) { return s.alive; }); }
    function nm(s) { return s ? (s.n + '号 ' + s.name) : '—'; }
    function idx(s) { return seats.map(function (x) { return x.n; }).indexOf(s.n); }
    function adj(s) {           /* 左右最近的两名存活玩家 */
      var i = idx(s), L = null, R = null, k, t;
      for (k = 1; k <= seats.length; k++) { t = seats[(i - k + seats.length) % seats.length]; if (t.alive && t.n !== s.n) { L = t; break; } }
      for (k = 1; k <= seats.length; k++) { t = seats[(i + k) % seats.length]; if (t.alive && t.n !== s.n) { R = t; break; } }
      return { left: L, right: R };
    }
    function ringNeighbors(s) {  /* 座位环上直接相邻的两人（不论死活） */
      var i = idx(s), n = seats.length;
      return [seats[(i - 1 + n) % n], seats[(i + 1) % n]];
    }
    function bad(s) { return !!(s && (s.st.poison || s.st.drunk)); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function shuffled(arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    }
    function seatsWithRole(roleId) { return seats.filter(function (s) { return s.role === roleId; }); }
    function teamSeats(team) { return seats.filter(function (s) { var r = role(s); return r && r.team === team; }); }
    function info(s) {          /* 用于展示的阵营描述 */
      var r = role(s);
      return nm(s) + (r ? '（' + r.name + '·' + (isEvil(s) ? '邪恶' : '善良') + '）' : '');
    }
    return {
      G: G, self: self, seats: seats, byId: byId, day: G.day,
      role: role, evil: isEvil, good: isGood, alive: alive, nm: nm, name: nm,
      adj: adj, ring: ringNeighbors, bad: bad, pick: pick, shuffle: shuffled,
      withRole: seatsWithRole, team: teamSeats, info: info, log: h.log, save: h.save,
      ROLECN: h.ROLECN || {}, noms: G.noms || [], nightActs: G.nightActs || {}, night: G.night
    };
  }

  /* 生成一个"选角色"用的候选（按阵营） */
  function roleOptions(c, teams, exclude) {
    var seen = {}, out = [];
    c.seats.forEach(function (s) {
      var r = c.role(s); if (!r) return;
      if (teams.indexOf(r.team) < 0) return;
      if (exclude && exclude.indexOf(r.id) >= 0) return;
      if (seen[r.id]) return; seen[r.id] = 1; out.push(r);
    });
    return out;
  }

  /* =========================================================
   *  暗流涌动 Trouble Brewing
   * ========================================================= */
  def('washerwoman', {
    targets: 0,
    hint: '首夜：自动生成一对玩家，说书人可反复重抽。',
    calc: function (c) {
      var towns = c.seats.filter(function (s) { var r = c.role(s); return r && r.team === 'townsfolk' && r.id !== 'washerwoman'; });
      if (!towns.length) return { info: '—', detail: '场上没有其他镇民' };
      var real = c.pick(towns), rr = c.role(real);
      var others = c.seats.filter(function (s) { return s.n !== real.n && (!c.role(s) || c.role(s).id !== rr.id); });
      var fake = c.pick(others);
      return {
        info: c.nm(real) + ' 或 ' + c.nm(fake),
        detail: '镇民角色：' + rr.name + '。真身 = ' + c.nm(real) + '，另一人 = ' + c.nm(fake),
        say: '展示「' + rr.name + '」角色标记，指向 ' + real.n + '号 与 ' + fake.n + '号',
        reroll: true
      };
    }
  });
  def('librarian', {
    targets: 0,
    hint: '首夜：自动生成一对玩家。中毒/醉酒时可改为告知「没有外来者」。',
    calc: function (c) {
      var outs = c.seats.filter(function (s) { var r = c.role(s); return r && r.team === 'outsider'; });
      if (!outs.length) return { info: '0', detail: '场上没有外来者角色，告知「没有外来者在场」', say: '告知：没有外来者在场' };
      var real = c.pick(outs), rr = c.role(real);
      var others = c.seats.filter(function (s) { return s.n !== real.n && (!c.role(s) || c.role(s).id !== rr.id); });
      var fake = c.pick(others);
      return {
        info: c.nm(real) + ' 或 ' + c.nm(fake),
        detail: '外来者角色：' + rr.name + '。真身 = ' + c.nm(real) + '，另一人 = ' + c.nm(fake),
        say: '展示「' + rr.name + '」角色标记，指向 ' + real.n + '号 与 ' + fake.n + '号',
        reroll: true
      };
    }
  });
  def('investigator', {
    targets: 0,
    hint: '首夜：自动生成一对玩家。',
    calc: function (c) {
      var mins = c.seats.filter(function (s) { var r = c.role(s); return r && r.team === 'minion'; });
      if (!mins.length) return { info: '0', detail: '场上没有爪牙，告知「没有爪牙在场」', say: '告知：没有爪牙在场' };
      var real = c.pick(mins), rr = c.role(real);
      var others = c.seats.filter(function (s) { return s.n !== real.n && (!c.role(s) || c.role(s).id !== rr.id); });
      var fake = c.pick(others);
      return {
        info: c.nm(real) + ' 或 ' + c.nm(fake),
        detail: '爪牙角色：' + rr.name + '。真身 = ' + c.nm(real) + '，另一人 = ' + c.nm(fake),
        say: '展示「' + rr.name + '」角色标记，指向 ' + real.n + '号 与 ' + fake.n + '号',
        reroll: true
      };
    }
  });
  def('chef', {
    targets: 0,
    hint: '首夜：统计座位环上相邻且都是邪恶的对数（含已死亡玩家）。',
    calc: function (c) {
      var n = c.seats.length, cnt = 0, pairs = [];
      for (var i = 0; i < n; i++) {
        var a = c.seats[i], b = c.seats[(i + 1) % n];
        if (c.evil(a) && c.evil(b)) { cnt++; pairs.push(a.n + '-' + b.n); }
      }
      return {
        info: String(cnt),
        detail: '邪恶邻座对：' + (pairs.length ? pairs.join('、') : '无') + '（环上共 ' + n + ' 座）',
        say: '展示数字手势 ' + cnt
      };
    }
  });
  def('empath', {
    targets: 0,
    hint: '计算左右最近的两名「存活」玩家中邪恶玩家的数量。',
    calc: function (c) {
      var a = c.adj(c.self);
      var list = [a.left, a.right].filter(Boolean);
      var n = list.filter(c.evil).length;
      return {
        info: String(n),
        detail: '邻近存活玩家：' + (list.length ? list.map(function (s) {
          return c.nm(s) + '（' + (c.evil(s) ? '邪恶' : '善良') + '）';
        }).join('、') : '无'),
        say: '展示数字手势 ' + n + '（邪恶玩家数量）'
      };
    }
  });
  def('fortune_teller', {
    targets: 2,
    hint: '选择两名玩家。命中恶魔或「红鲱鱼」则点头。',
    calc: function (c, t1, t2) {
      if (!t1 || !t2 || t1 === t2) return { info: '—', detail: '请选择两名不同的玩家' };
      var hit = false, why = [];
      [t1, t2].forEach(function (t) {
        var r = c.role(t); if (!r) return;
        if (r.team === 'demon') { hit = true; why.push(c.nm(t) + ' 是恶魔'); }
        if (t.st.red) { hit = true; why.push(c.nm(t) + ' 是红鲱鱼（干扰项）'); }
      });
      return {
        info: hit ? '是' : '否',
        detail: (why.length ? why.join('；') : '两人都不是恶魔，也非红鲱鱼') + '。选中：' + c.nm(t1) + '、' + c.nm(t2),
        say: hit ? '点头（是）' : '摇头（否）'
      };
    }
  });
  def('undertaker', {
    targets: 0,
    hint: '今天白天死于处决的玩家角色（首夜不发动）。',
    calc: function (c) {
      var ex = (c.G.noms || []).filter(function (v) { return v.day === c.G.day && v.result === 'exec'; })[0];
      if (!ex) return { info: '—', detail: '今天没有人被处决', say: '不唤醒' };
      var s = c.seats.filter(function (x) { return x.n === ex.to; })[0];
      var r = c.role(s);
      return { info: r ? r.name : '—', detail: c.nm(s) + ' 今天被处决', say: '展示「' + (r ? r.name : '') + '」角色标记' };
    }
  });
  def('monk', {
    targets: 1, excludeSelf: true,
    hint: '选择除自己外的一名玩家：当晚恶魔的负面能力对他无效。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      return {
        info: c.nm(t), detail: '当晚受保护，恶魔的负面能力对其无效',
        actions: [{ label: '标记保护', run: function () { t.st.protect = true; c.log(c.nm(t) + ' 获得保护（僧侣）'); } }]
      };
    }
  });
  def('butler', {
    targets: 1, excludeSelf: true,
    hint: '选择主人：明天白天只有主人投票时管家才能投票。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      return {
        info: c.nm(t), detail: '明天白天：只有 ' + t.n + '号 投票时，' + c.nm(c.self) + ' 才能投票',
        actions: [{ label: '记录主人', run: function () { c.log(c.nm(c.self) + ' 的主人设为 ' + c.nm(t)); } }]
      };
    }
  });
  def('ravenkeeper', {
    targets: 1,
    hint: '守鸦人在夜晚死亡后被唤醒，选择一名玩家得知其角色。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      var r = c.role(t);
      return {
        info: r ? r.name : '—', detail: c.nm(t) + ' 的角色',
        say: '展示「' + (r ? r.name : '') + '」角色标记'
      };
    }
  });
  def('poisoner', {
    targets: 1,
    hint: '选择一名玩家：他在当晚和明天白天中毒。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      return {
        info: c.nm(t), detail: '当晚 + 明天白天中毒（能力失效/信息不可靠）',
        actions: [{ label: '标记中毒', run: function () { t.st.poison = true; c.log(c.nm(t) + ' 中毒（投毒者）'); } }]
      };
    }
  });
  def('imp', {
    targets: 1,
    hint: '选择一名玩家：他死亡。若选自己，一名存活爪牙变为小恶魔。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家（可以是自己）' };
      if (t === c.self) {
        var mins = c.team('minion').filter(function (s) { return s.alive; });
        return {
          info: '自杀 → ' + (mins.length ? c.nm(mins[0]) : '无爪牙'),
          detail: '小恶魔自杀：一名存活爪牙变成新的小恶魔；若没有存活爪牙则邪恶直接落败',
          actions: [{
            label: '执行：爪牙变恶魔', run: function () {
              c.self.alive = false; c.self.deadDay = c.G.day;
              if (mins.length) { mins[0].role = c.self.role; c.log(c.nm(mins[0]) + ' 变成小恶魔'); }
              c.log(c.nm(c.self) + ' 自杀（小恶魔）');
            }
          }]
        };
      }
      var r = c.role(t);
      var blocked = [];
      if (t.st.protect) blocked.push('受保护');
      if (r && r.id === 'soldier') blocked.push('士兵免疫');
      if (c.bad(t)) blocked.push('中毒/醉酒');
      return {
        info: c.nm(t), detail: '该玩家死亡' + (blocked.length ? '（注意：' + blocked.join('、') + '，按规则判断）' : ''),
        actions: [{ label: '杀死该玩家', run: function () { t.alive = false; t.deadDay = c.G.day; c.log(c.nm(t) + ' 死亡（小恶魔）'); } }]
      };
    }
  });
  def('spy', {
    targets: 0,
    hint: '间谍可查看魔典。下方为当前全场角色，仅供说书人核对。',
    calc: function (c) {
      return {
        info: '查看魔典',
        detail: c.seats.map(function (s) { var r = c.role(s); return s.n + '号 ' + s.name + '=' + (r ? r.name : '—'); }).join('；'),
        say: '把魔典展示给间谍'
      };
    }
  });
  def('scarlet_woman', {
    targets: 0,
    hint: '若存活玩家 ≥5 且恶魔死亡，红唇女郎变成恶魔。',
    calc: function (c) {
      var demons = c.team('demon');
      var deadDemon = demons.filter(function (s) { return !s.alive; });
      var aliveN = c.alive().filter(function (s) { return !s.traveler; }).length;
      if (deadDemon.length && c.self.alive && aliveN >= 5) {
        return {
          info: '变身为恶魔', detail: '恶魔已死亡且存活玩家 ' + aliveN + ' ≥ 5，' + c.nm(c.self) + ' 变成那个恶魔',
          actions: [{
            label: '执行变身', run: function () {
              c.self.role = deadDemon[0].role;
              c.log(c.nm(c.self) + ' 变身为' + (c.byId[c.self.role] ? c.byId[c.self.role].name : '恶魔'));
            }
          }]
        };
      }
      return { info: '—', detail: '触发条件未满足（需恶魔死亡且存活玩家≥5）' };
    }
  });
  def('soldier', {
    targets: 0, hint: '被动：恶魔的负面能力对其无效。',
    calc: function () { return { info: '免疫', detail: '恶魔的负面能力对士兵无效（中毒/醉酒时失效）', say: '无需唤醒' }; }
  });
  def('mayor', {
    targets: 0, hint: '若只剩 3 人存活且白天无人被处决，你的阵营获胜。',
    calc: function (c) {
      var al = c.alive();
      var exec = (c.G.noms || []).filter(function (v) { return v.day === c.G.day && v.result === 'exec'; }).length;
      return {
        info: al.length <= 3 ? '触发判定' : '—',
        detail: '当前存活 ' + al.length + ' 人，今日处决 ' + exec + ' 人' + (al.length <= 3 && !exec ? ' → 镇长阵营获胜' : '')
      };
    }
  });
  def('recluse', {
    targets: 0, hint: '陌客可能被当作邪恶/爪牙/恶魔。',
    calc: function (c) { return { info: '可伪装邪恶', detail: c.nm(c.self) + ' 可被当作邪恶阵营、爪牙或恶魔角色', say: '说书人自行决定其被检测到的阵营/角色' }; }
  });
  def('saint', {
    targets: 0, hint: '圣徒死于处决则其阵营落败。',
    calc: function (c) {
      var ex = (c.G.noms || []).filter(function (v) { return v.day === c.G.day && v.result === 'exec' && v.to === c.self.n; })[0];
      return { info: ex ? '阵营落败' : '—', detail: ex ? c.nm(c.self) + ' 今日被处决 → 其阵营落败' : '今日未被处决' };
    }
  });
  def('drunk', {
    targets: 0, hint: '设置阶段：酒鬼以为自己是某个镇民角色（说书人在开局告知其假身份）。',
    calc: function (c) {
      return { info: '酒鬼', detail: c.nm(c.self) + ' 以为自己是某个镇民角色，实际没有能力。请私下告知他一个镇民身份。', say: '开局私下告知其假镇民身份' };
    }
  });
  def('baron', {
    targets: 0, hint: '设置阶段：额外 +2 外来者（发牌时已按配比处理，此处提醒确认）。',
    calc: function (c) {
      var o = c.team('outsider');
      return { info: '+2 外来者', detail: '当前场上外来者 ' + o.length + ' 名：' + (o.map(function (s) { var r = c.role(s); return c.nm(s) + '(' + (r ? r.name : '?') + ')'; }).join('、') || '无') };
    }
  });
  def('virgin', {
    targets: 0, hint: '首次被提名时，若提名者是镇民，提名者立刻被处决（白天触发）。',
    calc: function (c) {
      var noms = (c.G.noms || []).filter(function (v) { return v.day === c.G.day && v.to === c.self.n; });
      if (!noms.length) return { info: '—', detail: '今日尚未被提名' };
      var by = c.seats.filter(function (s) { return s.n === noms[0].by; })[0];
      var r = c.role(by);
      if (r && r.team === 'townsfolk') {
        return {
          info: c.nm(by) + ' 被处决', detail: '提名者 ' + c.nm(by) + ' 是' + r.name + '（镇民）→ 立刻被处决',
          actions: [{ label: '执行处决', run: function () { by.alive = false; by.deadDay = c.G.day; c.log(c.nm(by) + ' 被处决（贞洁者能力）'); } }]
        };
      }
      return { info: '—', detail: '提名者 ' + c.nm(by) + ' 不是镇民，不触发' };
    }
  });
  def('slayer', {
    targets: 1, hint: '白天公开能力：选择一名玩家，若他是恶魔则他死亡（每局限一次）。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      var r = c.role(t);
      if (r && r.team === 'demon') {
        return {
          info: '命中！', detail: c.nm(t) + ' 是' + r.name + '（恶魔）→ 死亡',
          actions: [{ label: '杀死恶魔', run: function () { t.alive = false; t.deadDay = c.G.day; c.log(c.nm(t) + ' 被猎手击杀'); } }]
        };
      }
      return { info: '未命中', detail: c.nm(t) + ' 不是恶魔，能力消耗掉但无效果' };
    }
  });
  def('thief', {
    targets: 1, excludeSelf: true, hint: '选择一名玩家：明天白天他的票算作负一票。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      return {
        info: c.nm(t), detail: '明天白天该玩家的投票算作 -1 票',
        actions: [{ label: '记录负票', run: function () { c.log(c.nm(t) + ' 明天投票计为负票（窃贼）'); } }]
      };
    }
  });
  def('bureaucrat', {
    targets: 1, excludeSelf: true, hint: '选择一名玩家：明天白天他的票算作三票。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      return {
        info: c.nm(t), detail: '明天白天该玩家的投票算作 3 票',
        actions: [{ label: '记录三票', run: function () { c.log(c.nm(t) + ' 明天投票计为 3 票（官员）'); } }]
      };
    }
  });
  def('gunslinger', {
    targets: 1, hint: '白天：首次投票统计后可选择一名刚投过票的玩家：他死亡。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名刚投过票的玩家' };
      return {
        info: c.nm(t), detail: '该玩家死亡（需他今天确实投过票）',
        actions: [{ label: '击杀', run: function () { t.alive = false; t.deadDay = c.G.day; c.log(c.nm(t) + ' 被枪手击杀'); } }]
      };
    }
  });

  /* =========================================================
   *  黯月初升 Bad Moon Rising
   * ========================================================= */
  def('grandmother', {
    targets: 0, hint: '首夜：得知一名善良玩家及其角色（孙子）。',
    calc: function (c) {
      var goods = c.seats.filter(function (s) { return s.n !== c.self.n && c.good(s); });
      if (!goods.length) return { info: '—', detail: '无可用目标' };
      var s = c.pick(goods), r = c.role(s);
      return { info: (r ? r.name : '?'), detail: '孙子 = ' + c.nm(s) + '（善良）', say: '指向 ' + s.n + '号 并展示「' + (r ? r.name : '') + '」标记', reroll: true };
    }
  });
  def('sailor', {
    targets: 1, hint: '选择一名存活玩家：你或他之一醉酒到下个黄昏。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名存活玩家' };
      return {
        info: c.nm(t), detail: '说书人决定：让水手自己醉酒，或让 ' + c.nm(t) + ' 醉酒',
        actions: [
          { label: '目标醉酒', run: function () { t.st.drunk = true; c.log(c.nm(t) + ' 醉酒（水手）'); } },
          { label: '水手自己醉酒', run: function () { c.self.st.drunk = true; c.log(c.nm(c.self) + ' 醉酒（水手自选）'); } }
        ]
      };
    }
  });
  def('chambermaid', {
    targets: 2, hint: '选择两名存活玩家：得知他们中有几人今晚因自身能力被唤醒。',
    calc: function (c, t1, t2) {
      if (!t1 || !t2 || t1 === t2) return { info: '—', detail: '请选择两名不同的存活玩家' };
      var woke = {};
      var key = c.G.night || 'first';
      Object.keys(c.G.nightActs || {}).forEach(function (k) {
        if (k.indexOf(key + ':') !== 0) return;
        var a = c.G.nightActs[k];
        if (!a || a.skip) return;
        c.seats.forEach(function (s) { var r = c.role(s); if (r && r.name === a.label) woke[s.n] = 1; });
      });
      var n = [t1, t2].filter(function (t) { return woke[t.n]; }).length;
      return {
        info: String(n),
        detail: c.nm(t1) + '：' + (woke[t1.n] ? '今晚被唤醒' : '未因能力被唤醒') + '；' + c.nm(t2) + '：' + (woke[t2.n] ? '今晚被唤醒' : '未因能力被唤醒'),
        say: '展示数字手势 ' + n
      };
    }
  });
  def('exorcist', {
    targets: 1, hint: '选择一名玩家（与上个夜晚不同）：若选中恶魔，他得知「你是驱魔人」。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      var r = c.role(t);
      if (r && r.team === 'demon') return { info: '命中恶魔', detail: c.nm(t) + ' 是' + r.name + '，他得知「你是驱魔人」', say: '告知恶魔：驱魔人是 ' + c.nm(c.self) };
      return { info: '未命中', detail: c.nm(t) + ' 不是恶魔' };
    }
  });
  def('innkeeper', {
    targets: 2, hint: '选择两名玩家：他们当晚不会死亡，但其中一人醉酒到下个黄昏。',
    calc: function (c, t1, t2) {
      if (!t1 || !t2 || t1 === t2) return { info: '—', detail: '请选择两名不同的玩家' };
      return {
        info: c.nm(t1) + ' + ' + c.nm(t2),
        detail: '两人当晚免死；说书人选择其中一人醉酒到下个黄昏',
        actions: [
          { label: '保护 ' + t1.n + '号并使其醉酒', run: function () { t1.st.protect = true; t1.st.drunk = true; t2.st.protect = true; c.log(c.nm(t1) + ' 醉酒、' + c.nm(t1) + '与' + c.nm(t2) + ' 免死（旅店老板）'); } },
          { label: '保护 ' + t2.n + '号并使其醉酒', run: function () { t2.st.protect = true; t2.st.drunk = true; t1.st.protect = true; c.log(c.nm(t2) + ' 醉酒、' + c.nm(t1) + '与' + c.nm(t2) + ' 免死（旅店老板）'); } }
        ]
      };
    }
  });
  def('gambler', {
    targets: 1, hint: '选择一名玩家并猜测他的角色：猜错则自己死亡。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家并猜他的角色' };
      return { info: c.nm(t), detail: '让赌徒说出猜测的角色；猜错则赌徒死亡（由说书人判定后在此处记录）', say: '让赌徒公开/私下说出猜测' };
    }
  });
  def('courtier', {
    targets: 0, hint: '每局限一次：选择一个角色，若在场则该角色之一从当晚起醉酒 3 夜。',
    calc: function (c) {
      return { info: '选择一个角色', detail: '由侍臣说出一个角色名；若该角色在场，其持有者醉酒 3 个夜晚。请在座位面板为目标标记「醉酒」。', say: '让侍臣说出角色名' };
    }
  });
  def('professor', {
    targets: 1, hint: '每局限一次：选择一名已死亡的玩家，若他是镇民则复活。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名死亡的玩家' };
      var r = c.role(t);
      if (r && r.team === 'townsfolk') {
        return {
          info: '可复活', detail: c.nm(t) + ' 是' + r.name + '（镇民）→ 复活',
          actions: [{ label: '复活该玩家', run: function () { t.alive = true; c.log(c.nm(t) + ' 复活（教授）'); } }]
        };
      }
      return { info: '不可复活', detail: c.nm(t) + ' 不是镇民，能力消耗但无效果' };
    }
  });
  def('lunatic', {
    targets: 0, hint: '疯子以为自己是恶魔。给他看「假的」恶魔信息与假的击杀结果。',
    calc: function (c) {
      var al = c.alive().filter(function (s) { return s.n !== c.self.n; });
      return { info: '假信息', detail: '给疯子展示你是（恶魔标记）与一个假的目标选择结果。建议虚构目标：' + (al.length ? c.nm(c.pick(al)) : '—'), say: '展示恶魔标记 + 虚构的击杀信息' };
    }
  });
  def('godfather', {
    targets: 0, hint: '首夜：得知有哪些外来者角色在场。',
    calc: function (c) {
      var os = roleOptions(c, ['outsider']);
      var names = os.map(function (r) { return r.name; });
      return { info: names.length ? names.join('、') : '无', detail: '场上外来者角色：' + (names.length ? names.join('、') : '没有外来者'), say: '展示外来者角色标记' };
    }
  });
  def('devils_advocate', {
    targets: 1, hint: '选择一名存活玩家（与上个夜晚不同）：若明天他被处决则不死亡。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名存活玩家' };
      return {
        info: c.nm(t), detail: '明天白天若被处决也不会死亡',
        actions: [{ label: '记录免死', run: function () { t.st.protect = true; c.log(c.nm(t) + ' 获得免死保护（魔鬼代言人）'); } }]
      };
    }
  });
  def('assassin', {
    targets: 1, hint: '每局限一次：选择一名玩家：他死亡，即使因任何原因本应免死。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      return {
        info: c.nm(t), detail: '直接死亡（无视保护/免死）',
        actions: [{ label: '击杀（无视保护）', run: function () { t.st.protect = false; t.alive = false; t.deadDay = c.G.day; c.log(c.nm(t) + ' 被刺客击杀'); } }]
      };
    }
  });
  def('pukka', {
    targets: 1, hint: '选择一名玩家：他中毒。上个因你中毒的玩家死亡并恢复健康。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      return {
        info: c.nm(t), detail: '该玩家中毒；上一名中毒者死亡并恢复健康（请手动处理上一名）',
        actions: [{ label: '标记中毒', run: function () { t.st.poison = true; c.log(c.nm(t) + ' 中毒（普卡）'); } }]
      };
    }
  });
  def('shabaloth', {
    targets: 2, hint: '选择两名玩家：他们死亡。上夜选择且当前死亡的玩家可能复活。',
    calc: function (c, t1, t2) {
      if (!t1 || !t2 || t1 === t2) return { info: '—', detail: '请选择两名不同的玩家' };
      return {
        info: c.nm(t1) + ' + ' + c.nm(t2), detail: '两人死亡（上夜的目标可能复活，由说书人决定）',
        actions: [{
          label: '杀死两人', run: function () {
            [t1, t2].forEach(function (t) { t.alive = false; t.deadDay = c.G.day; });
            c.log(c.nm(t1) + '、' + c.nm(t2) + ' 死亡（沙巴洛斯）');
          }
        }]
      };
    }
  });
  def('po', {
    targets: 1, hint: '选择一名玩家：他死亡。若上一次没有选择任何玩家，则改为杀死三名。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家（或本夜不选择 → 下夜三人死亡）' };
      return {
        info: c.nm(t), detail: '该玩家死亡',
        actions: [{ label: '杀死', run: function () { t.alive = false; t.deadDay = c.G.day; c.log(c.nm(t) + ' 死亡（珀）'); } }]
      };
    }
  });
  def('zombuul', {
    targets: 1, hint: '若今天白天无人死亡，才被唤醒并选择一名玩家杀死。',
    calc: function (c, t) {
      var diedToday = (c.G.log || []).filter(function (l) { return l.day === c.G.day && l.tag === 'death'; }).length;
      if (diedToday) return { info: '不发动', detail: '今天白天已有玩家死亡，僵怖本夜不行动' };
      if (!t) return { info: '—', detail: '今天无人死亡 → 选择一名玩家杀死' };
      return {
        info: c.nm(t), detail: '该玩家死亡',
        actions: [{ label: '杀死', run: function () { t.alive = false; t.deadDay = c.G.day; c.log(c.nm(t) + ' 死亡（僵怖）'); } }]
      };
    }
  });
  def('tea_lady', {
    targets: 0, hint: '被动：若与你邻近的两名存活玩家都是善良，他们不会死亡。',
    calc: function (c) {
      var a = c.adj(c.self);
      var l = a.left, r = a.right;
      var ok = l && r && c.good(l) && c.good(r) && l.alive && r.alive;
      return {
        info: ok ? '生效（两侧免死）' : '不生效',
        detail: '邻近存活：' + (l ? c.nm(l) + '（' + (c.good(l) ? '善良' : '邪恶') + '）' : '无') + '、' + (r ? c.nm(r) + '（' + (c.good(r) ? '善良' : '邪恶') + '）' : '无'),
        say: ok ? '给 ' + (l ? l.n : '') + '、' + (r ? r.n : '') + ' 号标记免死' : '本夜不生效'
      };
    }
  });
  def('fool', {
    targets: 0, hint: '被动：首次将要死亡时不会死亡。',
    calc: function (c) { return { info: '免死一次', detail: c.nm(c.self) + ' 首次将要死亡时改为不死（之后正常死亡）' }; }
  });
  def('tinker', {
    targets: 0, hint: '被动：你随时可能死亡（说书人决定）。',
    calc: function (c) { return { info: '随时可能死亡', detail: '说书人可自行决定修补匠在任意夜晚死亡' }; }
  });
  def('moonchild', {
    targets: 1, hint: '当你死亡时公开选择一名存活玩家：若他善良则他当晚死亡。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名存活玩家' };
      if (c.good(t)) {
        return {
          info: c.nm(t) + ' 死亡', detail: '该玩家善良 → 当晚死亡',
          actions: [{ label: '杀死', run: function () { t.alive = false; t.deadDay = c.G.day; c.log(c.nm(t) + ' 死亡（月之子）'); } }]
        };
      }
      return { info: '不死亡', detail: c.nm(t) + ' 是邪恶，不死亡' };
    }
  });
  def('goon', {
    targets: 0, hint: '被动：每个夜晚首个用自身能力选择你的玩家会醉酒，且你转变为他的阵营。',
    calc: function (c) { return { info: '阵营可变', detail: '首个选中 ' + c.nm(c.self) + ' 的玩家醉酒，莽夫转变为该玩家阵营' }; }
  });

  /* =========================================================
   *  梦殒春宵 Sects & Violets
   * ========================================================= */
  def('clockmaker', {
    targets: 0, hint: '首夜：得知恶魔与最近的爪牙之间的距离（邻座为 1）。',
    calc: function (c) {
      var demons = c.team('demon'), mins = c.team('minion');
      if (!demons.length || !mins.length) return { info: '—', detail: '场上没有恶魔或爪牙' };
      var best = 99, who = '';
      demons.forEach(function (d) {
        mins.forEach(function (m) {
          var i = c.seats.map(function (x) { return x.n; }).indexOf(d.n);
          var j = c.seats.map(function (x) { return x.n; }).indexOf(m.n);
          var n = c.seats.length;
          var dist = Math.min(Math.abs(i - j), n - Math.abs(i - j));
          if (dist < best) { best = dist; who = d.n + '号 与 ' + m.n + '号'; }
        });
      });
      return { info: String(best), detail: '最近距离：' + who + ' = ' + best + '（邻座为 1）', say: '展示数字手势 ' + best };
    }
  });
  def('dreamer', {
    targets: 1, excludeSelf: true, hint: '选择一名玩家：得知一个善良角色与一个邪恶角色（其中之一不是他的角色）。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择除自己和旅行者外的一名玩家' };
      var r = c.role(t);
      var goods = roleOptions(c, ['townsfolk'], [r ? r.id : '']);
      var evils = roleOptions(c, ['minion', 'demon'], [r ? r.id : '']);
      if (!goods.length || !evils.length) return { info: '—', detail: '角色库不足，请手动给出' };
      var g = c.pick(goods), e = c.pick(evils);
      var drop = Math.random() < 0.5 ? g : e;   /* 两个角色之一必须不是他的角色 */
      var keep = drop === g ? e : g;
      if (r && keep.id === r.id) { /* 保留的那个不能等于他的角色 */
        return { info: drop.name, detail: '（仅展示一个角色：' + drop.name + '，另一个与其真实角色重合）', say: '展示「' + drop.name + '」标记', reroll: true };
      }
      return { info: g.name + ' / ' + e.name, detail: '善良：' + g.name + '；邪恶：' + e.name + '。其中之一不是 ' + c.nm(t) + ' 的角色', say: '展示两个角色标记', reroll: true };
    }
  });
  def('snake_charmer', {
    targets: 1, hint: '选择一名存活玩家：若选中恶魔，你与他交换角色和阵营，然后他中毒。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名存活玩家' };
      var r = c.role(t);
      if (r && r.team === 'demon') {
        return {
          info: '命中恶魔！', detail: c.nm(t) + ' 是' + r.name + ' → 交换角色与阵营，新恶魔中毒',
          actions: [{
            label: '执行交换', run: function () {
              var tmp = c.self.role; c.self.role = t.role; t.role = tmp; t.st.poison = true;
              c.log(c.nm(c.self) + ' 与 ' + c.nm(t) + ' 交换角色（舞蛇人），' + c.nm(t) + ' 中毒');
            }
          }]
        };
      }
      return { info: '未命中', detail: c.nm(t) + ' 不是恶魔，无效果' };
    }
  });
  def('mathematician', {
    targets: 0, hint: '得知有多少名玩家的能力因其他角色的能力而未正常生效。',
    calc: function (c) {
      var n = c.seats.filter(function (s) { return c.bad(s); }).length;
      return { info: String(n), detail: '当前中毒/醉酒玩家数：' + n + '（' + c.seats.filter(function (s) { return c.bad(s); }).map(function (s) { return s.n + '号'; }).join('、') + '）', say: '展示数字手势 ' + n };
    }
  });
  def('flowergirl', {
    targets: 0, hint: '得知今天白天是否有恶魔投过票。',
    calc: function (c) {
      var voted = {};
      (c.G.noms || []).forEach(function (v) {
        if (v.day !== c.G.day) return;
        (v.votes || []).forEach(function (x) { if (x.yes === 1) voted[x.seat] = 1; });
      });
      var demonVoted = c.team('demon').filter(function (s) { return voted[s.n]; });
      return { info: demonVoted.length ? '是' : '否', detail: demonVoted.length ? '恶魔 ' + demonVoted.map(function (s) { return s.n + '号'; }).join('、') + ' 今天投了票' : '今天没有恶魔投票', say: demonVoted.length ? '点头（是）' : '摇头（否）' };
    }
  });
  def('town_crier', {
    targets: 0, hint: '得知今天白天是否有爪牙发起过提名。',
    calc: function (c) {
      var noms = (c.G.noms || []).filter(function (v) { return v.day === c.G.day; });
      var mins = c.team('minion').filter(function (s) { return noms.some(function (v) { return v.by === s.n; }); });
      return { info: mins.length ? '是' : '否', detail: mins.length ? '爪牙 ' + mins.map(function (s) { return s.n + '号'; }).join('、') + ' 今天发起过提名' : '今天没有爪牙提名', say: mins.length ? '点头（是）' : '摇头（否）' };
    }
  });
  def('oracle', {
    targets: 0, hint: '得知有多少名已死亡的玩家是邪恶的。',
    calc: function (c) {
      var dead = c.seats.filter(function (s) { return !s.alive; });
      var n = dead.filter(c.evil).length;
      return { info: String(n), detail: '死亡 ' + dead.length + ' 人，其中邪恶 ' + n + ' 人', say: '展示数字手势 ' + n };
    }
  });
  def('seamstress', {
    targets: 2, hint: '每局限一次：选择两名玩家：得知他们是否为同一阵营。',
    calc: function (c, t1, t2) {
      if (!t1 || !t2 || t1 === t2) return { info: '—', detail: '请选择两名不同的玩家' };
      var same = c.evil(t1) === c.evil(t2);
      return { info: same ? '是' : '否', detail: c.nm(t1) + '（' + (c.evil(t1) ? '邪恶' : '善良') + '）与 ' + c.nm(t2) + '（' + (c.evil(t2) ? '邪恶' : '善良') + '）', say: same ? '点头（同阵营）' : '摇头（不同阵营）' };
    }
  });
  def('sage', {
    targets: 0, hint: '若被恶魔杀死，当晚得知两名玩家，其中一名是杀死你的恶魔。',
    calc: function (c) {
      if (c.self.alive) return { info: '—', detail: '贤者仍存活，不发动' };
      var demons = c.team('demon');
      var others = c.seats.filter(function (s) { return s.n !== c.self.n && (!c.role(s) || c.role(s).team !== 'demon'); });
      var o = others.length ? c.pick(others) : null;
      var d = demons.length ? demons[0] : null;
      if (!d || !o) return { info: '—', detail: '无法生成' };
      return { info: d.n + '号 或 ' + o.n + '号', detail: '两名玩家中一名是恶魔（' + c.nm(d) + '）', say: '指向 ' + d.n + '号 与 ' + o.n + '号', reroll: true };
    }
  });
  def('witch', {
    targets: 1, hint: '选择一名玩家：若他明天白天发起提名，他死亡。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      return {
        info: c.nm(t), detail: '明天白天若他发起提名则死亡',
        actions: [{ label: '记录诅咒', run: function () { c.log(c.nm(t) + ' 被女巫诅咒：明天提名即死'); } }]
      };
    }
  });
  def('cerenovus', {
    targets: 1, hint: '选择一名玩家和一个善良角色：他明天需「疯狂」证明自己是该角色。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      var gs = roleOptions(c, ['townsfolk']);
      var r = gs.length ? c.pick(gs) : null;
      return { info: r ? r.name : '—', detail: c.nm(t) + ' 明天需疯狂证明自己是「' + (r ? r.name : '某善良角色') + '」', say: '告知 ' + t.n + '号 其疯狂角色', reroll: true };
    }
  });
  def('evil_twin', {
    targets: 0, hint: '设置：与一名对立阵营玩家互相知道对方角色；若善良方被处决，邪恶立即获胜。',
    calc: function (c) {
      var others = c.seats.filter(function (s) { return c.evil(s) !== c.evil(c.self); });
      var o = others.length ? c.pick(others) : null;
      return { info: o ? c.nm(o) : '—', detail: o ? '双子另一人 = ' + c.nm(o) + '（对立阵营）' : '无对立阵营玩家', say: '首夜告知双方彼此身份', reroll: true };
    }
  });
  def('fang_gu', {
    targets: 1, hint: '选择一名玩家：他死亡。被其杀死的外来者改为变成邪恶的方古，且你不再行动。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      var r = c.role(t);
      var note = (r && r.team === 'outsider') ? '（外来者 → 可改为变成邪恶方古，本恶魔之后不再行动）' : '';
      return {
        info: c.nm(t), detail: '该玩家死亡' + note,
        actions: [{ label: '杀死', run: function () { t.alive = false; t.deadDay = c.G.day; c.log(c.nm(t) + ' 死亡（方古）'); } }]
      };
    }
  });
  def('no_dashii', {
    targets: 1, hint: '选择一名玩家：他死亡。与你邻近的两名镇民中毒。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      var nb = c.ring(c.self).filter(function (s) { var r = c.role(s); return r && r.team === 'townsfolk'; });
      return {
        info: c.nm(t) + ' 死亡',
        detail: '邻近镇民中毒：' + (nb.length ? nb.map(function (s) { return c.nm(s); }).join('、') : '无'),
        actions: [{
          label: '杀死并毒化邻座镇民', run: function () {
            t.alive = false; t.deadDay = c.G.day;
            nb.forEach(function (s) { s.st.poison = true; });
            c.log(c.nm(t) + ' 死亡（诺-达鲺）；' + nb.map(function (s) { return s.n + '号'; }).join('、') + ' 中毒');
          }
        }]
      };
    }
  });
  def('vortox', {
    targets: 1, hint: '选择一名玩家：他死亡。镇民玩家的能力都会产生错误信息。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家' };
      return {
        info: c.nm(t), detail: '该玩家死亡；本夜所有镇民获得的信息必须为「错误」信息',
        actions: [{ label: '杀死', run: function () { t.alive = false; t.deadDay = c.G.day; c.log(c.nm(t) + ' 死亡（涡流）'); } }]
      };
    }
  });
  def('pit-hag', {
    targets: 1, hint: '选择一名玩家和一个角色：若该角色不在场，他变成该角色。',
    calc: function (c, t) {
      if (!t) return { info: '—', detail: '选择一名玩家（并在座位面板「更换角色」执行变身）' };
      return { info: c.nm(t), detail: '由麻脸巫婆说出角色名；若不在场则目标变为该角色。请用座位面板的「更换角色」执行。', say: '让麻脸巫婆说出角色名' };
    }
  });
  def('philosopher', {
    targets: 0, hint: '每局限一次：选择一个善良角色，你获得其能力（若该角色在场，其持有者醉酒）。',
    calc: function (c) {
      var gs = roleOptions(c, ['townsfolk']);
      var r = gs.length ? c.pick(gs) : null;
      return { info: r ? r.name : '—', detail: r ? '哲学家获得「' + r.name + '」的能力' + (c.withRole(r.id).length ? '（该角色在场 → 其持有者醉酒）' : '') : '无候选', say: '告知哲学家其获得的能力', reroll: true };
    }
  });

  /* ---------- 对外接口 ---------- */
  /* 白天 / 即时发动的能力（在白天页单独列出） */
  ['slayer', 'virgin', 'gunslinger', 'mayor', 'saint', 'recluse', 'soldier', 'fool',
    'tea_lady', 'goon', 'tinker', 'baron', 'drunk', 'moonchild', 'evil_twin', 'witch',
    'cerenovus', 'professor', 'assassin', 'pacifist', 'minstrel', 'klutz', 'mutant',
    'beggar', 'scapegoat', 'judge', 'bishop', 'voudon', 'matron', 'philosopher'
  ].forEach(function (id) { if (A[id]) A[id].when = 'day'; });

  return {
    buildCtx: buildCtx,
    has: function (id) { return !!A[id]; },
    get: function (id) { return A[id]; },
    ids: function () { return Object.keys(A); }
  };
})();
