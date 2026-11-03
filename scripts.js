/* ============================================================
 *  scripts.js —— 自制板子（Custom Scripts）
 *  路由： #/scripts（板子列表） / #/script/<id>（板子详情）
 *  板子会被注入 BOTC_DATA.editions（custom=1），因此可以直接在
 *  「开局」里选中，发牌、夜晚、复盘、抽签台全部照常工作。
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

  /* ============================================================
   *  板子数据
   * ============================================================ */
  var SCRIPTS = [
    {
      id: 'cs_echo', em: '🩸', name: '长夜回响', tag: '每一次死亡，都是一次发言',
      players: '8-15人', best: '10-13人', n0: 11, level: '进阶 · ★★★★☆',
      style: '信息密集 · 死亡博弈 · 高强度对抗', hot: 1,
      intro: '在这个板子里，死亡不是退场，而是发言。守鸦人、贤者、送葬者、赏金猎人把每一具尸体变成一条线索——恶魔每杀一个人，都可能给善良方递上一把刀。与此同时，投毒者、间谍、洗脑师、主谋在制造噪音与拖延。你要判断的不是"谁说了什么"，而是"哪些话值得信"。',
      why: [
        '① 死亡价值最大化：常规板子里夜里被杀的好人最容易坐牢，这里他们反而是信息源（守鸦人／贤者／送葬者／赏金猎人），全场参与度拉满。',
        '② 信息过载而非信息匮乏：博学者、杂耍艺人、女裁缝、占卜师、共情者让白天永远有话可谈，几乎不会出现"冷场局"。',
        '③ 邪恶有真反制：投毒者污染信息、间谍看魔典、洗脑师制造疯狂、主谋拖入加时赛、红唇女郎接任——邪恶靠的是操作，不是运气。',
        '④ 终局能翻盘：僵怖假死 + 红唇女郎接任 + 主谋加时，让最后一天照样充满变数，不会"处决完恶魔就索然无味"。'
      ],
      cp: [
        '杀谁变成高风险决策：恶魔动手前必须算"杀了他会不会送信息"。',
        '白天的公开博弈：杂耍艺人首日当众猜身份、博学者每天两条一真一假、猎手一击定胜负。',
        '提名本身就是武器：贞洁者反杀提名自己的镇民，猎手可以在讨论阶段直接处决恶魔。',
        '回响规则把"中毒／醉酒"变成公开读数，逼迫投毒者计算下毒时机。'
      ],
      rules: [
        {
          t: '🔔 回响（公开读数）',
          d: '每个白天开始时，说书人公开宣布："昨夜有 N 名玩家的能力未正常生效。"（N = 中毒 + 醉酒人数，不点名）。\n相当于全场共享一个"数学家式"读数：投毒者毒得越多，善良方越警觉；但反过来，邪恶也可以用"多毒几个人"来制造"有异常≠有线索"的迷雾。\n※ 工具会在白天页面顶部自动算出这个数字，说书人直接念出来即可。'
        },
        {
          t: '⏳ 沙漏（限时讨论）',
          d: '每个白天讨论阶段限时 4 分钟，时间到立刻进入提名阶段（说书人可用工具内的计时器）。\n目的：防止长考拖沓，把节奏压到竞技级别；也让"最后一分钟才抛出信息"成为一种战术。'
        },
        {
          t: '🌒 沉默之夜（可选）',
          d: '从第 3 夜起，如果某夜没有任何玩家死亡，天亮时说书人公开说一句："钟楼沉默了。"\n这是一条真实信息（说明当晚出现了保护／免死／恶魔放弃杀人），给善良方一个可验证的锚点。'
        }
      ],
      townsfolk: ['washerwoman', 'empath', 'fortune_teller', 'undertaker', 'ravenkeeper', 'sage',
        'bounty_hunter', 'slayer', 'virgin', 'savant', 'juggler', 'seamstress', 'mayor'],
      outsider: ['drunk', 'recluse', 'lunatic', 'moonchild'],
      minion: ['poisoner', 'spy', 'scarlet_woman', 'mastermind', 'cerenovus'],
      demon: ['imp', 'zombuul', 'pukka', 'fang_gu'],
      traveler: ['beggar', 'gunslinger', 'thief', 'barista', 'gnome'],
      echo: 1, timer: 240,
      tips: [
        '首夜务必给恶魔 3 张伪装牌。本板子镇民信息强，伪装牌必须"能自证"，优先给共情者／占卜师／送葬者这类可以随时编出数字的角色。',
        '疯子在场时：恶魔会知道疯子是谁以及他每夜选了谁，按规则照常执行即可，不要额外暗示。',
        '投毒者优先毒信息位（共情者／占卜师／赏金猎人／送葬者），但提醒他：回响规则会公开异常人数，毒太多等于当众宣布"今晚有鬼"。',
        '主谋在场且恶魔被处决 → 额外进行一个夜晚和一个白天。开局前就告诉玩家这个板子有这种可能，避免终局混乱。',
        '赏金猎人：目标死亡后当晚要换一个新目标，别忘了每夜更新（工具里标记为"信息"即可）。',
        '博学者：每天两条信息一真一假，两条都要看起来可信，且真实那条必须真的有价值——否则博学者会变成废牌。',
        '杂耍艺人：首日公开猜测，听到的人越多越危险，提醒玩家注意发言顺序（谁在他之后发言）。'
      ],
      balance: [
        '新手较多：移除主谋与洗脑师，恶魔只用小恶魔／普卡，去掉僵怖（假死对新手不友好）。',
        '想更快节奏：去掉镇长（避免"3 人和局"拖长），沙漏改成 3 分钟。',
        '邪恶连胜 2 局：从爪牙池移除主谋；善良连胜 2 局：把洗脑师换成镜像双子或女巫，给邪恶更多操作空间。',
        '人数 8 人及以下：建议去掉贤者与赏金猎人（信息链太长，邪恶很难打）。'
      ]
    },

    {
      id: 'cs_masque', em: '🎭', name: '双面假面', tag: '你以为的队友，明天可能是敌人',
      players: '9-14人', best: '10-12人', n0: 11, level: '混乱娱乐 · ★★★★★',
      style: '阵营流动 · 疯狂机制 · 翻盘频繁',
      intro: '阵营会流动、信息会反转、胜负会对调。这个板子里最危险的不是说谎的人，而是"真的换了阵营"的人。笑点密集、翻盘频繁，适合彼此熟悉的熟手局，不建议新手第一次就上。',
      why: [
        '① 阵营随时变化：食人魔、政客、异端分子、灵言师、舞蛇人、方古让"谁是哪一边"每夜都可能刷新。',
        '② 疯狂机制：鹰身女妖、镜像双子制造"不能说的秘密"，玩家必须用暗示和表演传达信息。',
        '③ 恶魔身份本身不确定：小怪宝让"谁是恶魔"每天都可能换人，方古会凭空造出第二个恶魔。',
        '④ 社交拉满：造谣者、艺术家、渔夫、哲学家给足了发言与表演空间，冷场是不可能冷场的。'
      ],
      cp: [
        '站队不可靠：今天的盟友明天可能是敌人，任何"铁逻辑"都可能在夜里失效。',
        '信息要会"演"：被洗脑的玩家必须疯狂证明自己是另一个角色，演技直接影响阵营收益。',
        '提名风险高：政客、异端分子、呆瓜类效果让"随便投一个人"代价极大。',
        '胜负可能对调：异端分子在场时，胜负结果会被翻转——终局前必须确认她是否还在场。'
      ],
      rules: [
        {
          t: '🎭 假面公告',
          d: '首夜结束后，说书人公开宣布："本局中至少有一名玩家的阵营会发生改变。"\n注意：这句话由说书人负责保证为真（本板子阵营变化极多，通常自然成立）。它的作用是让所有人从第一天起就互相怀疑。'
        },
        {
          t: '📣 公开质询',
          d: '每个白天第一次提名之前，任意玩家可以公开点名另一名玩家，要求他"公开声称自己的角色"，被点名者必须回答（可以撒谎）。每局限 3 次，用完为止。\n目的：给善良方一个主动制造信息的手段，同时给邪恶方一个"必须当众撒谎"的压力时刻。'
        }
      ],
      townsfolk: ['chambermaid', 'snake_charmer', 'philosopher', 'artist', 'gossip',
        'fisherman', 'courtier', 'seamstress', 'clockmaker'],
      outsider: ['ogre', 'politician', 'heretic', 'zealot'],
      minion: ['mezepheles', 'harpy', 'witch', 'evil_twin'],
      demon: ['fang_gu', 'imp', 'lil_monsta'],
      traveler: ['beggar', 'harlot', 'apprentice', 'butcher', 'deviant'],
      tips: [
        '首夜顺序很关键：灵言师、镜像双子、食人魔、小怪宝都在首夜行动，务必按夜序逐项处理，别漏。',
        '小怪宝：每夜由爪牙秘密决定"谁今天当恶魔"，说书人要在夜晚开始前确认他们的选择。',
        '方古：被他杀死的外来者变成邪恶的方古，且他自身中毒——场上会出现两名恶魔，记得及时更新魔典。',
        '灵言师：关键词要选一个"很容易脱口而出"的词（如"但是""真的吗"），否则整局都不会触发。',
        '政客：终局时说书人需要判断"谁对落败责任最大"，建议提前想好口径，避免玩家不服。',
        '异端分子：胜负结果对调，且她死后依然生效——终局宣布结果前一定确认她是否在场过。'
      ],
      balance: [
        '新手 ≥ 3 人：换回《长夜回响》或官方剧本，这个板子信息太不稳定。',
        '觉得太混乱：移除小怪宝和异端分子，恶魔只用小恶魔／方古。',
        '觉得邪恶太强：加入猎手或贞洁者（从镇民池替换女裁缝）。',
        '人数 ≥ 13：建议加入"侍女"之外的更多首夜信息位，避免首日完全无话可说。'
      ]
    },

    {
      id: 'cs_silent', em: '🌑', name: '寂夜无声', tag: '没有信息，只有人心',
      players: '7-12人', best: '8-10人', n0: 9, level: '硬核读人 · ★★★☆☆',
      style: '零信息位 · 投票读人 · 短平快',
      intro: '这个板子里几乎没有"得知某名玩家"的信息型镇民。所有结论都只能来自行为：谁提了名、谁投了票、谁在关键时刻沉默。适合熟悉规则的熟手，也适合人数少、节奏快的高强度局。',
      why: [
        '① 没有信息位：没有共情者、占卜师、送葬者，善良方只能靠读人和投票轨迹推理。',
        '② 防守与干扰密集：僧侣、士兵、茶艺师、和平主义者、弄臣让恶魔的刀经常砍空，每一夜的"谁没死"本身就是信息。',
        '③ 处决风险极高：圣徒、呆瓜、畸形秀演员让"随便投一个人"可能直接送掉整局。',
        '④ 恶魔选择多：诺-达鲺（邻座中毒）、涡流（镇民信息全错）、沙巴洛斯（双杀＋复活）三种完全不同的压力。'
      ],
      cp: [
        '读人即全部：没有数字可对，只能靠发言节奏、投票时机与微表情。',
        '防守博弈：僧侣守谁、士兵站哪、茶艺师坐哪，位置本身就是战略。',
        '处决是双刃剑：投错人可能触发圣徒／呆瓜直接落败，门槛计算必须精确。',
        '短平快：人数少、信息少，30-45 分钟能打完一局，适合连打多局比胜负。'
      ],
      rules: [
        {
          t: '🤫 无声投票',
          d: '投票环节所有玩家闭眼举手（或低头投票），说书人只公布"是否达到门槛"以及"谁被处决"，不公布谁投了谁。\n目的：抹掉投票轨迹这条线索，让"读人"真正回到发言与行为上；同时给邪恶方更大的伪装空间。'
        },
        {
          t: '🌫 沉默首夜',
          d: '首夜说书人不提供任何额外提示（不提示"有几人被唤醒"之类），天亮只宣布死亡情况。\n目的：把首日的信息量压到最低，让"沉默"本身成为可被解读的信号。'
        }
      ],
      townsfolk: ['monk', 'soldier', 'virgin', 'slayer', 'mayor', 'savant',
        'artist', 'pacifist', 'tea_lady', 'fool'],
      outsider: ['saint', 'klutz', 'mutant', 'tinker'],
      minion: ['poisoner', 'witch', 'assassin', 'devils_advocate'],
      demon: ['imp', 'no_dashii', 'vortox', 'shabaloth'],
      traveler: ['beggar', 'scapegoat', 'judge', 'bone_collector', 'thief'],
      tips: [
        '圣徒、呆瓜在场：处决前提醒玩家"这一票可能直接结束游戏"，必要时在提名阶段口头确认一次。',
        '涡流在场：镇民能力全部产生错误信息——本板子镇民信息少，但博学者／艺术家仍会受影响，注意给假信息。',
        '魔鬼代言人：每夜要选一名存活玩家（且与上夜不同），被选者明天被处决也不会死，务必记录。',
        '和平主义者：被处决的善良玩家"可能"不死，说书人自行决定——建议保持一致性（要么全救要么不救）。',
        '沙巴洛斯：可以复活上次杀过的死者，恶魔很容易打出"双杀"节奏，注意控制局势别一边倒。',
        '无声投票：建议用纸笔或手机备忘录记录票数，避免说书人自己记混。'
      ],
      balance: [
        '新手较多：加入共情者或占卜师（替换弄臣／和平主义者），给善良方一点抓手。',
        '觉得太闷：把沙漏改成"每白天限时 3 分钟"，并把无声投票改回公开举手。',
        '善良胜率过高：保留涡流，加入刺客；邪恶胜率过高：移除刺客，加入猎手。',
        '7 人局：建议移除圣徒（小局里圣徒被处决直接落败，运气成分太重）。'
      ]
    }
  ];

  /* ============================================================
   *  注入到 editions，使其可在开局中直接选用
   * ============================================================ */
  function allIds(s) {
    return s.townsfolk.concat(s.outsider, s.minion, s.demon, s.traveler || []);
  }
  function install() {
    SCRIPTS.forEach(function (s) {
      if (D.editions.some(function (e) { return e.id === s.id; })) return;
      D.editions.push({
        id: s.id, name: s.name, level: s.level, playerNum: s.players,
        description: s.intro, custom: 1, roleIds: allIds(s),
        counts: {
          townsfolk: s.townsfolk.length, outsider: s.outsider.length,
          minion: s.minion.length, demon: s.demon.length, traveler: (s.traveler || []).length
        },
        echo: s.echo || 0, timer: s.timer || 0
      });
    });
  }
  install();

  function get(id) {
    for (var i = 0; i < SCRIPTS.length; i++) if (SCRIPTS[i].id === id) return SCRIPTS[i];
    return null;
  }

  /* ============================================================
   *  随机阵容（按人数配比 + 尽量避免相克）
   * ============================================================ */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var JX = null;
  function jinxMap() {
    if (JX) return JX;
    JX = {};
    D.jinxes.forEach(function (j) { JX[j.a + '|' + j.b] = j; JX[j.b + '|' + j.a] = j; });
    return JX;
  }
  function jinxOf(list) {           /* list: role 对象数组 → 返回命中的相克数组 */
    var m = jinxMap(), out = [];
    for (var i = 0; i < list.length; i++)
      for (var j = i + 1; j < list.length; j++) {
        var k = m[list[i].name + '|' + list[j].name];
        if (k) out.push({ a: list[i].name, b: list[j].name, reason: k.reason || '' });
      }
    return out;
  }
  function pickRoles(s, n) {
    var idx = Math.min(Math.max(n - 5, 0), D.composition.length - 1);
    var comp = D.composition[idx];
    var need = { townsfolk: comp.townsfolk, outsider: comp.outsider, minion: comp.minion, demon: comp.demon };
    var best = null;
    for (var t = 0; t < 80; t++) {
      var p = [];
      ['townsfolk', 'outsider', 'minion', 'demon'].forEach(function (k) {
        var src = s[k] || [];
        var g = shuffle(src).slice(0, need[k]).map(byId).filter(Boolean);
        p = p.concat(g);
      });
      var jx = jinxOf(p);
      if (!best) best = p;
      if (p.length === n && !jx.length) return { roles: shuffle(p), comp: comp, jinx: [] };
      if (p.length === n && (!best || best.length !== n)) best = p;
    }
    return { roles: shuffle(best || []), comp: comp, jinx: jinxOf(best || []) };
  }

  /* ============================================================
   *  渲染
   * ============================================================ */
  var UI = { n: {}, deal: {} };

  function roleCard(r, note) {
    var np = [];
    if (r.firstNight) np.push('首夜 ' + nightPosOf(r, 'first'));
    if (r.otherNight) np.push('其他夜 ' + nightPosOf(r, 'other'));
    if (!np.length) np.push('夜晚不行动（白天或被动）');
    var jn = D.jinxes.filter(function (j) { return j.aid === r.id || j.bid === r.id; }).length;
    return '<a class="rcard" href="#/role/' + r.id + '">' +
      '<div class="rcnm">' + esc(r.name) + ' <span class="tag t-' + r.team + '">' + esc(r.teamCn) + '</span>' +
      (note ? '<span class="rcnote">' + esc(note) + '</span>' : '') + '</div>' +
      '<div class="rcab">' + esc(r.ability) + '</div>' +
      '<div class="rcmeta">' + esc(r.editionCn || '') + ' · ' + np.join(' ／ ') + (jn ? ' · ⚠相克 ' + jn + ' 条' : '') + '</div>' +
      '</a>';
  }
  /* 在官方夜序表里查出该角色的真实位次 */
  function nightPosOf(r, key) {
    var list = D.nightOrder[key] || [], i;
    for (i = 0; i < list.length; i++) if (list[i].id === r.id) return '第 ' + (i + 1) + ' 位';
    var v = key === 'first' ? r.firstNight : r.otherNight, c = 0;
    list.forEach(function (x) { if (x.order < v) c++; });
    return '第 ' + (c + 1) + ' 位';
  }

  function roleRows(s, key, title, cls) {
    var list = (s[key] || []).map(byId).filter(Boolean);
    if (!list.length) return '';
    return '<div class="sec-title"><h2>' + title + '</h2><span class="more">' + list.length + ' 名</span></div>' +
      '<div class="card">' + list.map(function (r) { return roleCard(r); }).join('') + '</div>';
  }

  function renderList() {
    var v = view();
    v.innerHTML =
      '<div class="backbar"><button data-scback="1">‹ 首页</button><span style="font-size:12px;color:var(--text-faint)">自制板子</span></div>' +
      '<div class="hero" style="background:linear-gradient(135deg,#3b2130,#8b1e2d)">' +
      '<h1>🧪 自制板子</h1>' +
      '<p>用官方 205 个角色重新洗牌组合出的原创剧本：每个板子都有自己的主题、节奏、自制规则与说书人指南，并且可以直接在「开局」里开局使用（发牌／夜晚／抽签／复盘全部照常）。</p>' +
      '</div>' +
      SCRIPTS.map(function (s) {
        var n = allIds(s).length;
        return '<div class="sctile" data-sgo="#/script/' + s.id + '">' +
          '<div class="sct-em">' + s.em + '</div>' +
          '<div class="sct-b"><div class="sct-t">' + esc(s.name) + (s.hot ? '<span class="sct-hot">主推</span>' : '') + '</div>' +
          '<div class="sct-tag">' + esc(s.tag) + '</div>' +
          '<div class="sct-m">' + esc(s.players) + ' · 推荐 ' + esc(s.best) + ' · ' + n + ' 角色</div>' +
          '<div class="sct-c"><span class="tag t-townsfolk">' + esc(s.style) + '</span>' +
          ' <a class="tag" href="#/sheet/' + s.id + '" onclick="event.stopPropagation()">📋 一览表</a></div>' +
          '</div></div>';
      }).join('') +
      '<div class="card" style="margin-top:14px;padding:12px 14px">' +
      '<div class="ftl">怎么用</div>' +
      '<div class="note" style="white-space:pre-line">' +
      '① 点开一个板子 → 看主题、角色池与自制规则；\n' +
      '② 点「🕯️ 用这个板子开局」→ 自动带到开局页（已选好该板子与推荐人数）；\n' +
      '③ 在板子页还能先随机生成一副阵容，满意了再拿去开局；\n' +
      '④ 玩家自己抽角色、夜晚自动排顺序、恶魔出局自动跳复盘，都和官方剧本一样。' +
      '</div></div>' +
      '<div class="note" style="margin-top:14px">说明：板子里的角色全部来自官方魔典，能力、夜序、相克均按官方规则执行；「自制规则」是本板子额外约定的玩法，开局前请向所有玩家宣读一次。</div>';

    v.onclick = function (e) {
      if (e.target.closest('[data-scback]')) { location.hash = '#/home'; return; }
      var t = e.target.closest('[data-sgo]');
      if (t) { location.hash = t.dataset.sgo; return; }
    };
  }

  function renderDetail(s) {
    var v = view();
    var n = UI.n[s.id] || s.n0;
    var d = UI.deal[s.id];
    var jx = jinxOf(allIds(s).map(byId).filter(Boolean));

    var h = '<div class="backbar"><button data-scback2="1">‹ 板子列表</button>' +
      '<span style="font-size:12px;color:var(--text-faint)">' + esc(s.name) + '</span></div>';

    h += '<div class="hero" style="background:linear-gradient(135deg,#3b2130,#8b1e2d)">' +
      '<h1>' + s.em + ' ' + esc(s.name) + '</h1>' +
      '<p style="font-size:14px;font-weight:600">' + esc(s.tag) + '</p>' +
      '<div class="stats">' +
      '<div><b>' + esc(s.players) + '</b>适用人数</div>' +
      '<div><b>' + esc(s.best) + '</b>推荐</div>' +
      '<div><b>' + allIds(s).length + '</b>角色池</div>' +
      '<div><b>' + esc(s.level) + '</b>难度</div>' +
      '</div></div>';

    h += '<div class="card" style="margin-top:12px;padding:12px 14px"><div class="ftl">板子主题</div>' +
      '<div class="abox"><div style="font-size:13.5px;line-height:1.8">' + esc(s.intro) + '</div></div></div>';

    h += '<div class="card" style="margin-top:10px;padding:12px 14px"><div class="ftl">为什么好玩 / 设计思路</div>' +
      '<div class="anstep">' + s.why.map(function (x) {
        return '<div class="ansd" style="margin:6px 0">' + esc(x) + '</div>';
      }).join('') + '</div></div>';

    h += '<div class="card" style="margin-top:10px;padding:12px 14px"><div class="ftl">⚔️ 竞技点</div>' +
      '<div class="anstep">' + s.cp.map(function (x) {
        return '<div class="ansd" style="margin:6px 0">· ' + esc(x) + '</div>';
      }).join('') + '</div></div>';

    /* 自制规则 */
    h += '<div class="sec-title"><h2>🧪 板子专属规则</h2></div><div class="card">' +
      s.rules.map(function (r) {
        return '<div class="cite2"><div class="csrc">' + esc(r.t) + '</div>' +
          '<div class="ctext" style="white-space:pre-line">' + esc(r.d) + '</div></div>';
      }).join('') + '</div>';

    /* 随机阵容 */
    h += '<div class="sec-title"><h2>🎲 先随机生成一副阵容</h2></div>' +
      '<div class="card" style="padding:12px 14px">' +
      '<div class="chips">' + [7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (x) {
        return '<button class="chip' + (n === x ? ' on p' : '') + '" data-scn="' + x + '">' + x + '人</button>';
      }).join('') + '</div>' +
      '<div class="qbtns" style="margin-top:10px"><button class="btn primary" data-scdeal="1">🎲 生成阵容</button></div>';
    if (d && d.roles && d.roles.length) {
      h += '<div class="ftl" style="margin-top:12px">本次阵容（镇民 ' + d.comp.townsfolk + ' · 外来者 ' + d.comp.outsider +
        ' · 爪牙 ' + d.comp.minion + ' · 恶魔 ' + d.comp.demon + '）</div>' +
        '<div class="dealbox">' + d.roles.map(function (r, i) {
          var tn = { townsfolk: '镇民', outsider: '外来', minion: '爪牙', demon: '恶魔' }[r.team];
          return '<div class="dealc t-' + r.team + '"><b>' + (i + 1) + '</b><span>' + esc(r.name) + '</span><i>' + tn + '</i></div>';
        }).join('') + '</div>' +
        (d.jinx.length ? '<div class="warnbox">⚠ 本副阵容命中相克：' + d.jinx.map(function (j) { return j.a + ' × ' + j.b; }).join('、') + '（按官方相克规则处理即可）</div>' : '') +
        '<div class="qbtns" style="margin-top:10px"><button class="btn primary" data-scuse2="1">🕯️ 用这副阵容开局</button></div>';
    }
    h += '</div>';

    /* 角色池 */
    h += roleRows(s, 'townsfolk', '镇民', 't-townsfolk');
    h += roleRows(s, 'outsider', '外来者', 't-outsider');
    h += roleRows(s, 'minion', '爪牙', 't-minion');
    h += roleRows(s, 'demon', '恶魔', 't-demon');
    h += roleRows(s, 'traveler', '旅行者（可选加入）', 't-traveler');

    /* 相克提示 */
    h += '<div class="sec-title"><h2>⚔️ 板子内相克提醒</h2></div>' +
      '<div class="card" style="padding:12px 14px">' +
      (jx.length ? jx.map(function (j) {
        return '<div class="cite2"><div class="csrc">' + esc(j.a) + ' × ' + esc(j.b) + '</div>' +
          '<div class="ctext">' + esc(j.reason || '官方相克规则') + '</div></div>';
      }).join('') : '<div class="note">该板子角色池内部没有官方相克记录，可自由组合。</div>') +
      '</div>';

    /* 说书人指南 */
    h += '<div class="sec-title"><h2>🎙 说书人要点</h2></div>' +
      '<div class="card" style="padding:12px 14px"><div class="anstep">' +
      s.tips.map(function (x) { return '<div class="ansd" style="margin:6px 0">· ' + esc(x) + '</div>'; }).join('') +
      '</div></div>';

    h += '<div class="sec-title"><h2>⚖️ 平衡调整建议</h2></div>' +
      '<div class="card" style="padding:12px 14px"><div class="anstep">' +
      s.balance.map(function (x) { return '<div class="ansd" style="margin:6px 0">· ' + esc(x) + '</div>'; }).join('') +
      '</div></div>';

    h += '<div class="qbtns" style="margin:16px 0 8px">' +
      '<button class="btn primary" data-scuse="1">🕯️ 用这个板子开局</button>' +
      '<a class="btn" href="#/sheet/' + esc(s.id) + '">📋 角色一览表（海报版）</a>' +
      '<button class="btn" data-sccopy="1">📋 复制板子清单</button>' +
      '<a class="btn" href="#/scripts">← 换一个板子</a>' +
      '</div>' +
      '<div class="note">开局前请把「板子专属规则」向所有玩家宣读一次；规则以官方魔典为准，自制规则仅为本板子附加约定。</div>';

    v.innerHTML = h;

    v.onclick = function (e) {
      if (e.target.closest('[data-scback2]')) { location.hash = '#/scripts'; return; }
      var cn = e.target.closest('[data-scn]');
      if (cn) { UI.n[s.id] = +cn.dataset.scn; renderDetail(s); return; }
      if (e.target.closest('[data-scdeal]')) {
        var res = pickRoles(s, UI.n[s.id] || s.n0);
        UI.deal[s.id] = { roles: res.roles, comp: res.comp, jinx: res.jinx };
        renderDetail(s);
        window.scrollTo(0, 0);
        return;
      }
      if (e.target.closest('[data-scuse]')) { useScript(s, n); return; }
      if (e.target.closest('[data-scuse2]')) {
        var dd = UI.deal[s.id];
        if (!dd || !dd.roles) return;
        useScript(s, dd.roles.length, dd.roles.map(function (r) { return r.id; }));
        return;
      }
      if (e.target.closest('[data-sccopy]')) { copyList(s); return; }
    };
  }

  function useScript(s, n, roles) {
    try {
      localStorage.setItem('botcg_newcfg', JSON.stringify({ ed: s.id, n: n, roles: roles || null }));
    } catch (e) { }
    location.hash = '#/game/new';
  }

  function copyList(s) {
    var txt = '【' + s.name + '】' + s.tag + '\n人数：' + s.players + '（推荐 ' + s.best + '）\n\n';
    ['townsfolk', 'outsider', 'minion', 'demon', 'traveler'].forEach(function (k) {
      var cn = { townsfolk: '镇民', outsider: '外来者', minion: '爪牙', demon: '恶魔', traveler: '旅行者' }[k];
      var list = (s[k] || []).map(byId).filter(Boolean).map(function (r) { return r.name; });
      if (list.length) txt += cn + '：' + list.join('、') + '\n';
    });
    txt += '\n板子专属规则：\n' + s.rules.map(function (r) { return '・' + r.t + '：' + r.d.split('\n')[0]; }).join('\n');
    var ok = false;
    try {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { }
    if (!ok && navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { alert('板子清单已复制'); });
    else alert(ok ? '板子清单已复制' : '复制失败，请手动选择文本复制');
  }

  /* ============================================================
   *  对外
   * ============================================================ */
  window.BOTCScripts = {
    list: SCRIPTS,
    get: get,
    pickRoles: pickRoles,
    route: function (r) {
      if (r.p === 'script') {
        var s = get(r.a);
        if (s) renderDetail(s); else renderList();
      } else renderList();
    }
  };
})();
