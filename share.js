/* ============================================================
 *  share.js —— 对外分享页 #/share
 *  生成工具链接二维码 / 复制链接 / 系统分享 / 分享文案 / 装桌面说明
 * ============================================================ */
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function home() {
    return location.origin + location.pathname.replace(/index\.html$/, '');
  }
  var PAGE = home();

  var TEXT = '染·钟楼谜团 · 说书人魔典 —— 205 个角色 + 全部规则与相克，还能直接开局：' +
    '夜晚行动顺序、角色能力自动计算、玩家自己抽角色、恶魔出局自动复盘。免登录，手机扫码直接开：';

  function copy(text, btn) {
    var done = function (ok) {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = ok ? '✓ 已复制' : '复制失败，请长按链接手动复制';
      setTimeout(function () { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback(text)); });
      return;
    }
    done(fallback(text));
  }
  function fallback(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function uaInfo() {
    var ua = navigator.userAgent;
    var iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var android = /Android/i.test(ua);
    var weixin = /MicroMessenger/i.test(ua);
    var standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    return { iOS: iOS, android: android, weixin: weixin, standalone: standalone };
  }

  function render() {
    var view = document.getElementById('view');
    var u = uaInfo();
    var h = '<div class="backbar"><button data-shback="1">‹ 首页</button>' +
      '<span style="font-size:12px;color:var(--text-faint)">分享给朋友 / 玩家</span></div>';

    /* 1. 二维码 */
    h += '<div class="card shqr">' +
      '<div class="ftl">扫码直接打开</div>' +
      '<div class="qrbox"><canvas id="shcv"></canvas></div>' +
      '<div class="shurl" id="shurl">' + esc(PAGE) + '</div>' +
      '<div class="qbtns">' +
      '<button class="btn primary" data-shcopy="1">📋 复制链接</button>' +
      '<button class="btn" id="shsys" data-shshare="1">📤 系统分享</button>' +
      '<button class="btn" data-shdl="1">🖼️ 保存二维码</button>' +
      '</div>' +
      '<div class="note">免登录、无需注册，任何手机浏览器打开即用。长按二维码可直接在微信里识别。</div>' +
      '</div>';

    /* 2. 分享文案 */
    h += '<div class="card" style="padding:12px 14px">' +
      '<div class="ftl">一键复制推荐语</div>' +
      '<div class="shtext">' + esc(TEXT) + '<b>' + esc(PAGE) + '</b></div>' +
      '<div class="qbtns"><button class="btn" data-shtext="1">📋 复制这段文字</button></div>' +
      '</div>';

    /* 3. 一起玩 */
    h += '<div class="card" style="padding:12px 14px">' +
      '<div class="ftl">线上开局怎么用</div>' +
      '<div class="shsteps">' +
      '<div class="shstep"><span>1</span><div><b>你（说书人）开「抽签台」</b>选剧本人数 → 生成角色池 → 选「远程链接」</div></div>' +
      '<div class="shstep"><span>2</span><div><b>把链接依次发给玩家</b>每人点开抽自己的角色，把回执码发回给你</div></div>' +
      '<div class="shstep"><span>3</span><div><b>你导入回执码</b>角色自动落到座位上，然后开始夜晚流程</div></div>' +
      '</div>' +
      '<div class="qbtns"><button class="btn" data-shdraw="1">🎲 打开抽签台</button>' +
      '<button class="btn" data-shboard="1">📺 公开看板说明</button></div>' +
      '<div class="note">看板是只显示存活/提名/投票的投屏页，不泄露角色，可直接在视频会议里共享。</div>' +
      '</div>';

    /* 4. 装到桌面 */
    h += '<div class="card" style="padding:12px 14px">' +
      '<div class="ftl">装到手机桌面（像 App 一样打开）</div>' +
      (u.standalone ? '<div class="abox tip"><b>当前状态</b>已经以 App 模式运行 ✓</div>' : '') +
      (u.iOS ? '<div class="shhow">Safari 打开本页 → 点底部「分享」按钮 → 选「添加到主屏幕」</div>'
        : u.android ? '<div class="shhow">Chrome 打开本页 → 右上角菜单 → 「添加到主屏幕 / 安装应用」</div>'
          : '<div class="shhow">手机浏览器菜单里选「添加到主屏幕」；电脑上可用 Chrome 地址栏右侧的「安装」按钮。</div>') +
      '<div class="note">装好后：全屏无地址栏、断网也能打开（内容已缓存）、启动更快。</div>' +
      '</div>';

    /* 5. 数据说明 */
    h += '<div class="card" style="padding:12px 14px">' +
      '<div class="ftl">需要知道的几点</div>' +
      '<div class="shnote">' +
      '<div>· 每个人的对局数据保存在<b>各自浏览器本地</b>，互相看不到，也不会上传服务器 —— 所以朋友打开是一个干净的新工具。</div>' +
      '<div>· 换设备 / 清缓存会把对局清空，重要对局请在魔典页用「导出快照」保存。</div>' +
      '<div>· 完全免费，没有账号体系，链接就是 <b>' + esc(PAGE.replace(/^https?:\/\//, '')) + '</b>，随时可分享。</div>' +
      '</div></div>';

    if (u.weixin) {
      h += '<div class="abox warn" style="margin-top:12px"><b>微信内置浏览器</b>' +
        '若页面显示异常，请点右上角「···」→ 在浏览器中打开。</div>';
    }

    view.innerHTML = h;

    var cv = document.getElementById('shcv');
    if (cv && window.BOTCQR) {
      var box = Math.min(300, Math.floor(Math.min(window.innerWidth - 80, 300)));
      window.BOTCQR.draw(cv, PAGE, { px: box, margin: 3, level: 'M' });
    }
    var sys = document.getElementById('shsys');
    if (sys && !navigator.share) sys.style.display = 'none';
  }

  document.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-shback]'))) { location.hash = '#/home'; return; }
    if ((el = e.target.closest('[data-shcopy]'))) { copy(PAGE, el); return; }
    if ((el = e.target.closest('[data-shtext]'))) { copy(TEXT + PAGE, el); return; }
    if ((el = e.target.closest('[data-shshare]'))) {
      if (navigator.share) navigator.share({ title: '染·钟楼谜团 说书人魔典', text: TEXT, url: PAGE }).catch(function () { });
      return;
    }
    if ((el = e.target.closest('[data-shdl]'))) {
      if (!window.BOTCQR) return;
      var url = window.BOTCQR.dataURL(PAGE, { px: 900, margin: 4 });
      var a = document.createElement('a');
      a.href = url;
      a.download = '钟楼说书人魔典-二维码.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return;
    }
    if ((el = e.target.closest('[data-shdraw]'))) { location.hash = '#/draw'; return; }
    if ((el = e.target.closest('[data-shboard]'))) {
      alert('魔典页底部有「公开看板（投屏）」按钮，打开后把该页地址投屏即可：只显示存活状态、提名与投票，不显示角色。');
      return;
    }
  });

  window.BOTCShare = { route: function () { render(); } };
})();
