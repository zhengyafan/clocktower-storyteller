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
    },

    {
      id: 'cs_heart', em: '💞', name: '心动不如行动 V9 · 沉沦与救赎', tag: '你以为的队友，可能下一秒就不是了',
      players: '8-15人', best: '10-13人', n0: 11, level: '自制 · ★★★★★',
      style: '阵营流动 · 沉沦救赎 · 高互动', hot: 1, customRoles: 1,
      intro: '这是在你 V8 自制板子基础上重做的一版：保留了「沉沦 / 心动连结 / 第三方阵营」三大原创机制的味道，把说书人无法判定、玩家容易吵架的地方全部改成客观规则，并新增 6 个角色把玩法闭环补上——善良方第一次有了「救赎」的手段，邪恶方第一次有了「连环沉沦」的钥匙。',
      mech: [
        {
          t: '⛓ 沉沦（本板子核心）',
          d: '转变阵营为邪恶，保留原有角色与能力。\n· 本人会得知自己已沉沦；\n· 沉沦者不与恶魔、爪牙互认（恶魔不知道谁被沉沦了）；\n· 沉沦者计入邪恶玩家人数（影响胜利判定）；\n· 永久生效，不可逆转——守心人免疫，回心人可以解除一次。'
        },
        {
          t: '💞 心动连结',
          d: '由月老 / 备胎 / 月老神产生。\n· 连结双方互相得知对方的阵营（不是角色）；\n· 连结中任意一人死亡 → 另一人立刻沉沦；\n· 红线人可以切断连结：切断后双方互知真实角色，且该连结不再触发沉沦。'
        },
        {
          t: '🎭 第三方阵营（含完整结算规则）',
          d: '由心动嘉宾产生：恶魔 + 心动嘉宾两人组成（史蒂夫的加入者算第三方成员）。\n\n【怎么赢】场上存活玩家恰好 2 名，且这 2 名都是第三方成员 → 第三方阵营独自获胜，游戏立即结束。即使其中一人是恶魔，也算第三方赢，邪恶方（爪牙）与善良方都算输。\n\n【怎么散】\n· 心动嘉宾死亡 → 第三方解散，恶魔回归邪恶阵营，游戏照常继续；\n· 恶魔死亡 → 第三方解散，心动嘉宾回归他原本的阵营与角色（不再享受第三方）；\n· 小丑／恶魔宝宝接任的新恶魔，不会自动恢复第三方（第三方是一次性的）。\n\n【结算顺序】每次死亡（夜里被杀或白天被处决）后，说书人按 ①→②→③ 检查，命中即结算：\n① 第三方胜利：存活恰好 2 人且都是第三方成员；\n② 邪恶胜利：存活善良玩家仅剩 1 名且恶魔存活（沉沦者算邪恶，不计入善良）；若第三方仍存在，还需第三方两位均已死亡，爪牙才算赢；\n③ 善良胜利：恶魔全部死亡且无存活的第三方成员。'
        }
      ],
      fixes: [
        '【主观 → 客观】宠儿的「最不被怀疑」改为「当天未被提名且未投票」；造谣者的「造谣成功」改为「陈述是真还是假」；判官的「公开审判信息」改为「提问—测谎」。',
        '【补漏洞】犟种中和成功时说书人必须告知「你今夜格外清醒」；双面人补上不互认／无能力／死亡才公开；恶魔宝宝补上养成时点（第三夜）与知情规则；心动嘉宾补上「嘉宾死亡则回归邪恶」。',
        '【消歧义】占星师明确由玩家指定谁免疫、谁醉酒且不能选自己；叩门者明确双向互换与异常即错误信息；守心人明确「告知是谁」与免疫范围；邪恶鼠鼠从「可能毒 3-4 人」改为只毒 1 人。',
        '【删不可执行】愚者的「你不知道场上发生了什么」改为官方口径的假身份 + 死后永久醉酒；放肆猫猫删除「首夜杀外来者额外 +1 外来者」（破坏人数配比，实操无法执行）。',
        '【数值封顶】审判限 2 次且得知恶魔则中毒；叩门者限 2 次；迷途行者限 3 次；疯批每局最多造成 2 次沉沦；预言家猜错自己去死。',
        '【新增 6 个角色】回心人（救赎沉沦者）、倾听者（善良方信息锚点）、备胎（外来者版连结）、第三者（爪牙的连环沉沦钥匙）、情圣（把杀人和沉沦绑定）、月老神（保证每局都有连结）。',
        '【新增 3 条自制规则】沉沦次数上限、连结对数公开、沉沦者死亡时公开阵营——专治 V8 邪恶滚雪球。'
      ],
      why: [
        '① 阵营真的会流动：沉沦、连结、第三方三条线让「谁是哪一边的」随时可能刷新，任何铁逻辑都可能在夜里失效。',
        '② 善良方第一次有救赎手段：回心人可以把沉沦者拉回来，代价是可能把自己搭进去——白天公开点名本身就是一次豪赌。',
        '③ 邪恶方有连环操作的快感：第三者摸清连结网后一次性「挖人」，可以让两个人同时沉沦；情圣让每一次击杀都可能改变阵营。',
        '④ 每个人都在参与：连结、备胎、沉沦都是「我可能随时变坏」的紧张感，全场没有真正的旁观者。',
        '⑤ 保留了你原版的灵魂：所有角色名、主题、沉沦与心动的味道都还在，只是把规则说清楚了。'
      ],
      cp: [
        '沉沦的恐惧：你不知道谁已经被沉沦了，也不知道自己什么时候会变——恶魔同样不知道。',
        '连结的双刃：互知阵营是强信息，但对方一死你就变邪恶，所以「保住连结对象」成了真实的战术目标。',
        '公开豪赌：预言家、回心人、判官都要在白天公开点名，点错了代价惨重。',
        '第三方搅局：心动嘉宾一出现，胜负条件就多了一条，所有人都要重新算人数。'
      ],
      rules: [
        {
          t: '⛓ 沉沦上限（重要平衡阀）',
          d: '本局沉沦总次数上限 = 向上取整（在场玩家数 ÷ 4）（例如 11 人局 = 3 次）。\n达到上限后不再触发新的沉沦，说书人应在每次沉沦后公开已用次数（如「沉沦 2/3」）。\n※ 这是防止 V8「邪恶滚雪球」最关键的一条，强烈建议启用。'
        },
        {
          t: '💞 连结对数公开',
          d: '首夜结束后，说书人公开宣布：「本局存在 N 对心动连结。」（不点名）\n让连结成为公共推理线索，红线人、第三者、备胎也因此有了用武之地。'
        },
        {
          t: '⚰️ 沉沦者死亡时公开阵营',
          d: '沉沦玩家死亡（无论被处决还是被杀）时，说书人公开宣布其真实阵营。\n否则善良方永远算不清场上还有几个邪恶，人数推理会彻底失效。'
        },
        {
          t: '🎭 第三方阵营公告',
          d: '第三方阵营产生时，说书人公开宣布「本局出现了第三方阵营」，但不说明是谁。\n若嘉宾死亡，同样公开宣布「第三方阵营已解散」。'
        },
        {
          t: '🏁 结算顺序（每次死亡后按顺序检查）',
          d: '① 第三方胜利：存活恰好 2 人、且都是第三方成员；\n② 邪恶胜利：存活善良玩家仅剩 1 名且恶魔存活（沉沦者算邪恶；若本局出现过第三方，还需第三方两位均已死亡，爪牙才算赢）；\n③ 善良胜利：恶魔全部死亡且没有存活的第三方成员。\n命中第一条即结束，不要再往下判。\n※ 常见边界：剩 2 人（第三方恶魔 + 1 名善良）→ 不满足「两人都是第三方」，走②：善良仅剩 1 名且恶魔存活 → 邪恶获胜；剩 2 人（嘉宾 + 1 名善良，恶魔已死）→ 第三方已解散，嘉宾回归原阵营，按②③正常判定。'
        }
      ],
      townsfolk: ['hr_darling', 'hr_strayer', 'hr_heartpick', 'hr_trial', 'hr_gossiper', 'hr_angel',
        'hr_knocker', 'hr_astrologer', 'hr_matchmaker', 'hr_magistrate', 'hr_redline', 'hr_guardian',
        'hr_prophet', 'hr_returns', 'hr_listener'],
      outsider: ['hr_heartbreak', 'hr_fool2', 'hr_stubborn', 'hr_twoface', 'hr_spare'],
      minion: ['hr_grudge', 'hr_madman', 'hr_bulwark', 'hr_jester', 'hr_phantom', 'hr_third'],
      demon: ['hr_baby', 'hr_rat', 'hr_cat', 'hr_guest', 'hr_twin', 'hr_lover'],
      traveler: ['beggar', 'gunslinger', 'thief', 'barista', 'gnome'],
      fabled: ['hr_steve', 'hr_master12', 'hr_cupid'],
      tips: [
        '开局前必须宣读三条定义：沉沦、心动连结、第三方阵营。这是整个板子的地基，说不清楚后面全是争议。',
        '沉沦不互认是核心设定：恶魔不知道谁被沉沦了，沉沦者也不知道谁是恶魔。请不要好心补充信息。',
        '犟种中和成功时必须明确告诉他「你今夜格外清醒」，否则这个角色等于白板。',
        '双面人的阵营要记在魔典上：若他为邪恶，不要让他参与首夜互认；他死亡时公开真实阵营。',
        '恶魔宝宝：首夜选的角色若不在场，就没有宝宝（提前在魔典上记好）；宝宝接任恶魔后游戏正常继续。',
        '小丑接任恶魔需满足「存活邪恶玩家 ≥ 2」，接任当夜与存活爪牙互认一次。',
        '每次沉沦后记得公开「沉沦 N/上限」，并在魔典上标记该玩家（阵营变了但角色不变）。',
        '建议第一次玩用 10-12 人，并启用沉沦上限；熟手局再考虑放宽。',
        '结算时严格按「第三方 → 邪恶 → 善良」顺序检查，命中即停；沉沦者算邪恶、不计入善良人数，别数错。'
      ],
      balance: [
        '新手较多：移除第三者与悍卫（沉沦连锁对新手太苦），恶魔只用邪恶鼠鼠／放肆猫猫／双生花。',
        '邪恶连胜：沉沦上限收紧到 向上取整（人数 ÷ 6），并把疯批换成魅影。',
        '善良连胜：加入情圣与第三者，沉沦上限放宽到 向上取整（人数 ÷ 3）。',
        '8 人及以下：去掉心动嘉宾与恶魔宝宝——小局里第三方阵营几乎必胜。',
        '如果出现「全场连环沉沦」的雪球：立刻启用沉沦上限，并公开宣布已用次数与剩余次数。',
        '想要更欢乐：加入月老神 + 备胎，让连结成为每局必有的变量。'
      ]
    }
  ];

  /* ============================================================
   *  注入到 editions，使其可在开局中直接选用
   * ============================================================ */
  function allIds(s) {
    return s.townsfolk.concat(s.outsider, s.minion, s.demon, s.traveler || [], s.fabled || []);
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
    var cr = (window.BOTCCustom && BOTCCustom.get) ? BOTCCustom.get(r.id) : null;
    var fixTxt = cr ? (cr.fix || cr.why || '') : '';
    return '<a class="rcard" href="#/role/' + r.id + '">' +
      '<div class="rcnm">' + esc(r.name) + ' <span class="tag t-' + r.team + '">' + esc(r.teamCn) + '</span>' +
      (cr && cr.isNew ? '<span class="rcnote" style="background:#1e7a3c;color:#fff;border-color:#1e7a3c">新增</span>' : '') +
      (note ? '<span class="rcnote">' + esc(note) + '</span>' : '') + '</div>' +
      '<div class="rcab">' + esc(r.ability) + '</div>' +
      (fixTxt ? '<div class="rcfix"><b>' + (cr.isNew ? '为什么加他' : 'V8 → V9 优化了什么') + '</b>' + esc(fixTxt) + '</div>' : '') +
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

    /* 核心机制定义（自制板子） */
    if (s.mech && s.mech.length) {
      h += '<div class="sec-title"><h2>🧬 核心机制定义（开局前必读）</h2></div><div class="card">' +
        s.mech.map(function (m) {
          return '<div class="cite2"><div class="csrc">' + esc(m.t) + '</div>' +
            '<div class="ctext" style="white-space:pre-line">' + esc(m.d) + '</div></div>';
        }).join('') + '</div>';
    }

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
    h += roleRows(s, 'fabled', '传奇角色（说书人可选）', 't-fabled');

    /* 相克提示 */
    h += '<div class="sec-title"><h2>⚔️ 板子内相克提醒</h2></div>' +
      '<div class="card" style="padding:12px 14px">' +
      (jx.length ? jx.map(function (j) {
        return '<div class="cite2"><div class="csrc">' + esc(j.a) + ' × ' + esc(j.b) + '</div>' +
          '<div class="ctext">' + esc(j.reason || '官方相克规则') + '</div></div>';
      }).join('') : '<div class="note">该板子角色池内部没有官方相克记录，可自由组合。</div>') +
      '</div>';

    /* V8 → V9 优化点 */
    if (s.fixes && s.fixes.length) {
      h += '<div class="sec-title"><h2>🔧 V8 → V9 优化了什么</h2></div>' +
        '<div class="card" style="padding:12px 14px"><div class="anstep">' +
        s.fixes.map(function (x) { return '<div class="ansd" style="margin:6px 0">· ' + esc(x) + '</div>'; }).join('') +
        '</div></div>';
    }

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
    build: '20261106-1',      /* 版本自检用：新增板子/功能时同步改 index.html 里的 WANT */
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
