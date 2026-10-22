/* 染·钟楼谜团 — 可选 AI 增强客户端
 * 纯前端直连大模型（OpenAI 兼容 /chat/completions），配置只存本机 localStorage，不传任何第三方中转。
 * 未配置时全部功能由 qa.js 的本地规则引擎兜底，页面完全可用。
 */
window.BOTCAI = (function () {
  'use strict';
  var KEY = 'botc_ai_cfg';
  var PRESETS = {
    deepseek: { name: 'DeepSeek（推荐·便宜）', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    openai: { name: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    moonshot: { name: 'Moonshot / Kimi', url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    qwen: { name: '通义千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    zhipu: { name: '智谱 GLM', url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    custom: { name: '自定义（自建代理 / 其他兼容接口）', url: '', model: '' }
  };

  function cfg() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c || {})); } catch (e) { }
    return cfg();
  }
  function on() {
    var c = cfg();
    return !!(c && c.enabled !== false && c.key && c.url && c.model);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  /* 极简 Markdown → HTML（只处理标题 / 粗体 / 列表 / 代码 / 引用 / 换行） */
  function md(s) {
    s = esc(s || '');
    var blocks = [], re = /```[\s\S]*?```/g, m;
    while ((m = re.exec(s))) blocks.push(m[0]);
    blocks.forEach(function (b, i) {
      s = s.replace(b, '\u0000B' + i + '\u0000');
    });
    s = s.replace(/^######\s*(.+)$/gm, '<div class="mdh6">$1</div>')
      .replace(/^#####\s*(.+)$/gm, '<div class="mdh5">$1</div>')
      .replace(/^####\s*(.+)$/gm, '<div class="mdh4">$1</div>')
      .replace(/^###\s*(.+)$/gm, '<div class="mdh3">$1</div>')
      .replace(/^##\s*(.+)$/gm, '<div class="mdh2">$1</div>')
      .replace(/^#\s*(.+)$/gm, '<div class="mdh1">$1</div>')
      .replace(/^&gt;\s*(.+)$/gm, '<div class="mdq">$1</div>')
      .replace(/^\s*[-*]\s+(.+)$/gm, '<div class="mdli">• $1</div>')
      .replace(/^\s*(\d+)[.、)]\s+(.+)$/gm, '<div class="mdli">$1. $2</div>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n{2,}/g, '<div style="height:6px"></div>')
      .replace(/\n/g, '<br>');
    blocks.forEach(function (b, i) {
      var code = b.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
      s = s.replace('\u0000B' + i + '\u0000', '<pre class="mdpre">' + code + '</pre>');
    });
    return s;
  }

  /* 流式调用
   * opts: { system, user, temperature, onDelta(text), onDone(full), onError(msg), signal }
   */
  function call(opts) {
    var c = cfg();
    if (!on()) { opts.onError && opts.onError('未配置 AI'); return null; }
    var url = c.url.replace(/\/+$/, '') + '/chat/completions';
    var body = {
      model: c.model,
      messages: [{ role: 'system', content: opts.system || '' }, { role: 'user', content: opts.user || '' }],
      temperature: opts.temperature == null ? 0.3 : opts.temperature,
      stream: true
    };
    var ctl = new AbortController();
    var full = '';
    var timer = setTimeout(function () { try { ctl.abort(); } catch (e) { } }, 90000);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
      body: JSON.stringify(body),
      signal: ctl.signal
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('HTTP ' + res.status + ' ' + String(t || '').slice(0, 200));
        });
      }
      if (!res.body) { throw new Error('该接口不支持流式返回'); }
      var reader = res.body.getReader(), dec = new TextDecoder('utf-8'), buf = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { clearTimeout(timer); opts.onDone && opts.onDone(full); return; }
          buf += dec.decode(r.value || new Uint8Array(), { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(function (ln) {
            ln = ln.trim();
            if (ln.indexOf('data:') !== 0) return;
            var d = ln.slice(5).trim();
            if (d === '[DONE]') return;
            try {
              var j = JSON.parse(d);
              var t = j.choices && j.choices[0] && (j.choices[0].delta ? j.choices[0].delta.content : j.choices[0].message && j.choices[0].message.content);
              if (t) { full += t; opts.onDelta && opts.onDelta(t, full); }
            } catch (e) { }
          });
          return pump();
        });
      }
      return pump();
    }).catch(function (e) {
      clearTimeout(timer);
      var msg = String(e && e.message || e);
      if (msg.indexOf('Failed to fetch') >= 0 || msg.indexOf('NetworkError') >= 0) {
        msg = '请求失败：可能是浏览器跨域（CORS）限制或网络不通。可改用自建代理地址（自定义 Base URL）。';
      }
      opts.onError && opts.onError(msg, full);
    });
    return { abort: function () { clearTimeout(timer); try { ctl.abort(); } catch (e) { } } };
  }

  /* 非流式（用于连接测试） */
  function ping(cb) {
    var c = cfg();
    if (!c.url || !c.key || !c.model) { cb(false, '请先把 Base URL / API Key / 模型名填完整'); return; }
    var url = c.url.replace(/\/+$/, '') + '/chat/completions';
    var ctl = new AbortController();
    var timer = setTimeout(function () { try { ctl.abort(); } catch (e) { } }, 20000);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
      body: JSON.stringify({ model: c.model, messages: [{ role: 'user', content: '回复两个字：正常' }], max_tokens: 8, stream: false }),
      signal: ctl.signal
    }).then(function (r) {
      return r.text().then(function (t) {
        clearTimeout(timer);
        if (!r.ok) return cb(false, 'HTTP ' + r.status + ' ' + String(t).slice(0, 160));
        try {
          var j = JSON.parse(t);
          var txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          cb(true, '连接成功 · 模型回复：' + String(txt || '').slice(0, 20));
        } catch (e) { cb(false, '返回无法解析：' + String(t).slice(0, 160)); }
      });
    }).catch(function (e) {
      clearTimeout(timer);
      var m = String(e && e.message || e);
      if (m.indexOf('Failed to fetch') >= 0) m = '浏览器跨域（CORS）或网络不通，请换自建代理地址';
      cb(false, m);
    });
  }

  return { PRESETS: PRESETS, cfg: cfg, save: save, on: on, call: call, ping: ping, md: md, esc: esc };
})();
