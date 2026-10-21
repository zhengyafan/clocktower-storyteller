/* ============================================================
 *  qr.js —— 二维码薄封装（底层为 kazuhikoarase qrcode-generator v1.4.4，MIT）
 *  纯离线：不调用任何外部接口，断网 / 国内网络均可生成
 *  接口：BOTCQR.matrix(text) / .draw(canvas,text,opt) / .svg(text,opt) / .dataURL(text,opt)
 * ============================================================ */
(function () {
  var Q = window.qrcode;

  function matrix(text, level) {
    if (!Q) return null;
    level = level || 'M';
    for (var v = 1; v <= 25; v++) {
      try {
        var q = Q(v, level);
        q.addData(text);
        q.make();
        var n = q.getModuleCount(), rows = [];
        for (var r = 0; r < n; r++) {
          var row = '';
          for (var c = 0; c < n; c++) row += q.isDark(r, c) ? '1' : '0';
          rows.push(row);
        }
        return { size: n, version: v, level: level, rows: rows };
      } catch (e) { /* 容量不足，换下一个版本 */ }
    }
    return null;
  }

  function metrics(m, opt) {
    opt = opt || {};
    var margin = opt.margin == null ? 4 : opt.margin;
    var n = m.size + margin * 2;
    var px = opt.px || 320;
    var scale = Math.max(1, Math.floor(px / n));
    return { margin: margin, n: n, scale: scale, css: n * scale };
  }

  /* 画到 canvas（白底黑码，支持高清屏） */
  function draw(cv, text, opt) {
    opt = opt || {};
    var m = matrix(text, opt.level);
    if (!m) return null;
    var g = metrics(m, opt);
    var dev = Math.min(3, window.devicePixelRatio || 1);
    cv.width = g.css * dev;
    cv.height = g.css * dev;
    cv.style.width = g.css + 'px';
    cv.style.height = g.css + 'px';
    var ctx = cv.getContext('2d');
    ctx.fillStyle = opt.light || '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = opt.dark || '#171018';
    for (var r = 0; r < m.size; r++) {
      var row = m.rows[r];
      for (var c = 0; c < m.size; c++) {
        if (row.charAt(c) === '1') {
          ctx.fillRect((c + g.margin) * g.scale * dev, (r + g.margin) * g.scale * dev, g.scale * dev, g.scale * dev);
        }
      }
    }
    return { m: m, px: g.css };
  }

  /* 返回 SVG 字符串（矢量，任意缩放不糊） */
  function svg(text, opt) {
    opt = opt || {};
    var m = matrix(text, opt.level);
    if (!m) return '';
    var g = metrics(m, opt);
    var d = [];
    for (var r = 0; r < m.size; r++) {
      var row = m.rows[r];
      for (var c = 0; c < m.size; c++) {
        if (row.charAt(c) === '1') d.push('M' + (c + g.margin) + ' ' + (r + g.margin) + 'h1v1h-1z');
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + g.css + '" height="' + g.css +
      '" viewBox="0 0 ' + g.n + ' ' + g.n + '" shape-rendering="crispEdges">' +
      '<rect width="' + g.n + '" height="' + g.n + '" fill="' + (opt.light || '#ffffff') + '"/>' +
      '<path d="' + d.join('') + '" fill="' + (opt.dark || '#171018') + '"/></svg>';
  }

  /* 返回 PNG dataURL（用于下载 / 长按保存） */
  function dataURL(text, opt) {
    opt = opt || {};
    var cv = document.createElement('canvas');
    var r = draw(cv, text, opt);
    if (!r) return '';
    return cv.toDataURL('image/png');
  }

  window.BOTCQR = { matrix: matrix, draw: draw, svg: svg, dataURL: dataURL };
})();
