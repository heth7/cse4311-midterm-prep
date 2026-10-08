/* Interactive demos for the CNN lesson: 1-D convolution, 2-D convolution, pooling, size calculator */
(function () {
  'use strict';
  var MP = window.MP, el = MP.el;

  function fmt(v) {
    var r = Math.round(v * 100) / 100;
    var str = Number.isInteger(r) ? String(Math.abs(r)) : Math.abs(r).toFixed(2);
    return (r < 0 ? '−' : '') + str;
  }
  function par(v, label) { return '(' + (label || fmt(v)) + ')'; }
  function cell(text, cls) { return el('div', 'c' + (cls ? ' ' + cls : ''), text); }
  function button(text, fn, cls) { var b = el('button', 'btn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function select(options, fn) {
    var sEl = document.createElement('select');
    options.forEach(function (o, i) { var op = document.createElement('option'); op.value = i; op.textContent = o.name; sEl.appendChild(op); });
    sEl.addEventListener('change', function () { fn(+sEl.value); });
    return sEl;
  }
  function player(step, atEnd) {
    var timer = null, btn;
    function stop() { clearInterval(timer); timer = null; btn.textContent = '▶ Play'; }
    btn = button('▶ Play', function () {
      if (timer) return stop();
      if (atEnd()) step(true);
      btn.textContent = '❚❚ Pause';
      timer = setInterval(function () { if (atEnd()) return stop(); step(); }, 900);
    });
    return { btn: btn, stop: stop };
  }

  /* ---------- 1-D convolution ---------- */
  MP.conv1d = function (sel) {
    var host = document.querySelector(sel); if (!host) return;
    var presets = [
      { name: 'Notes example: f = [1, 0, −1]', g: [0, 1, 2, -1, 1, 3, 0], f: [1, 0, -1], note: 'This is the exact filter and signal from the lecture notebook.' },
      { name: 'Edge detector: f = [−1, 1]', g: [1, 1, 1, 0, 0, 0, 1, 1, 1, 1], f: [-1, 1], note: 'Output is 0 where the signal is flat and ±1 exactly where it jumps. That is edge detection.' },
      { name: 'Smoothing: f = [⅓, ⅓, ⅓]', g: [0, 0, 3, 0, 0, 3, 3, 0, 0], f: [1 / 3, 1 / 3, 1 / 3], fl: ['⅓', '⅓', '⅓'], note: 'Each output is the average of 3 neighbours, so sharp spikes get flattened.' }
    ];
    var P = presets[0], p = 0;
    host.appendChild(el('div', 'demo-title', 'Try it: slide a 1-D filter'));
    var sub = el('div', 'demo-sub'); host.appendChild(sub);
    var gRow = el('div', 'strip'), fRow = el('div', 'strip'), oRow = el('div', 'strip');
    [['signal g', gRow], ['filter f (slides right)', fRow], ['output f ∗ g', oRow]].forEach(function (pair) {
      var lab = el('div', 'mx-lbl', pair[0]); lab.style.margin = '10px 0 5px'; host.appendChild(lab); host.appendChild(pair[1]);
    });
    var calc = el('div', 'calc'); host.appendChild(calc);
    function outLen() { return P.g.length - P.f.length + 1; }
    function out(i) { var sum = 0; P.f.forEach(function (w, t) { sum += w * P.g[i + t]; }); return sum; }
    function draw() {
      sub.textContent = P.note;
      gRow.innerHTML = ''; fRow.innerHTML = ''; oRow.innerHTML = '';
      P.g.forEach(function (v, i) { gRow.appendChild(cell(fmt(v), i >= p && i < p + P.f.length ? 'win' : '')); });
      for (var i = 0; i < p; i++) { var sp = cell('', 'empty'); sp.style.background = 'transparent'; sp.style.borderColor = 'transparent'; fRow.appendChild(sp); }
      P.f.forEach(function (v, t) { fRow.appendChild(cell(P.fl ? P.fl[t] : fmt(v), 'filt')); });
      for (var j = 0; j < outLen(); j++) oRow.appendChild(cell(fmt(out(j)), j === p ? 'cur' : j > p ? 'empty' : ''));
      var terms = P.f.map(function (w, t) { return par(w, P.fl && P.fl[t]) + par(P.g[p + t]); });
      calc.innerHTML = '(f ∗ g)[' + p + '] = ' + terms.join(' + ') + ' = <b>' + fmt(out(p)) + '</b>' +
        '<br>output length = ' + P.g.length + ' − ' + P.f.length + ' + 1 = ' + outLen();
    }
    function step(restart) { p = restart ? 0 : Math.min(p + 1, outLen() - 1); draw(); }
    var play = player(step, function () { return p >= outLen() - 1; });
    var ctl = el('div', 'ctl');
    ctl.appendChild(button('◀', function () { play.stop(); p = Math.max(0, p - 1); draw(); }));
    ctl.appendChild(button('▶ Next', function () { play.stop(); step(); }, 'primary'));
    ctl.appendChild(play.btn);
    ctl.appendChild(button('Reset', function () { play.stop(); p = 0; draw(); }));
    ctl.appendChild(select(presets, function (i) { play.stop(); P = presets[i]; p = 0; draw(); }));
    host.appendChild(ctl);
    draw();
  };

  /* ---------- 2-D convolution ---------- */
  MP.conv2d = function (sel) {
    var host = document.querySelector(sel); if (!host) return;
    var images = [
      { name: 'Image: vertical edge', m: [[0, 0, 1, 1, 1], [0, 0, 1, 1, 1], [0, 0, 1, 1, 1], [0, 0, 1, 1, 1], [0, 0, 1, 1, 1]] },
      { name: 'Image: horizontal edge', m: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]] },
      { name: 'Image: plus sign', m: [[0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [1, 1, 1, 1, 1], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0]] },
      { name: 'Image: mixed numbers', m: [[1, 0, 2, 1, 0], [0, 1, 1, 0, 2], [2, 1, 0, 1, 1], [1, 0, 1, 2, 0], [0, 2, 1, 0, 1]] }
    ];
    var n9 = 1 / 9;
    var filters = [
      { name: 'Filter: Sobel X (finds vertical edges)', k: [[1, 0, -1], [2, 0, -2], [1, 0, -1]] },
      { name: 'Filter: Sobel Y (finds horizontal edges)', k: [[1, 2, 1], [0, 0, 0], [-1, -2, -1]] },
      { name: 'Filter: box blur (smoothing)', k: [[n9, n9, n9], [n9, n9, n9], [n9, n9, n9]], l: '⅑' },
      { name: 'Filter: identity (copies the centre)', k: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] }
    ];
    var I = images[0], F = filters[0], pos = 0, N = 5, K = 3, O = N - K + 1;
    host.appendChild(el('div', 'demo-title', 'Try it: slide a 3×3 filter over a 5×5 image'));
    host.appendChild(el('div', 'demo-sub', 'Step through all 9 positions, or click any output cell to jump to the patch that produced it.'));
    var row = el('div', 'mx-row');
    function col(label) { var c = el('div', 'mx-col'); c.appendChild(el('div', 'mx-lbl', label)); var g = el('div', 'mx'); c.appendChild(g); row.appendChild(c); return g; }
    var gI = col('input g (5×5)'); row.appendChild(el('div', 'op', '∗'));
    var gF = col('filter f (3×3)'); row.appendChild(el('div', 'op', '='));
    var gO = col('activation map (3×3)');
    gI.style.gridTemplateColumns = 'repeat(5, auto)'; gF.style.gridTemplateColumns = 'repeat(3, auto)'; gO.style.gridTemplateColumns = 'repeat(3, auto)';
    gO.classList.add('clickable');
    host.appendChild(row);
    var calc = el('div', 'calc'); host.appendChild(calc);
    function out(r, c) { var sum = 0; for (var i = 0; i < K; i++) for (var j = 0; j < K; j++) sum += F.k[i][j] * I.m[r + i][c + j]; return sum; }
    function draw() {
      var r0 = Math.floor(pos / O), c0 = pos % O;
      gI.innerHTML = ''; gF.innerHTML = ''; gO.innerHTML = '';
      I.m.forEach(function (rw, r) { rw.forEach(function (v, c) { gI.appendChild(cell(fmt(v), r >= r0 && r < r0 + K && c >= c0 && c < c0 + K ? 'win' : '')); }); });
      F.k.forEach(function (rw) { rw.forEach(function (v) { gF.appendChild(cell(F.l || fmt(v), 'filt')); }); });
      for (var i = 0; i < O * O; i++) {
        (function (idx) {
          var c = cell(fmt(out(Math.floor(idx / O), idx % O)), idx === pos ? 'cur' : idx > pos ? 'empty' : '');
          c.addEventListener('click', function () { play.stop(); pos = idx; draw(); });
          gO.appendChild(c);
        })(i);
      }
      var lines = [];
      for (var a = 0; a < K; a++) {
        var t = [];
        for (var b = 0; b < K; b++) t.push(par(F.k[a][b], F.l) + par(I.m[r0 + a][c0 + b]));
        lines.push(t.join(' + '));
      }
      calc.innerHTML = 'output[' + r0 + '][' + c0 + '] = ' + lines.join('<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ ') + '<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= <b>' + fmt(out(r0, c0)) + '</b>';
    }
    function step(restart) { pos = restart ? 0 : Math.min(pos + 1, O * O - 1); draw(); }
    var play = player(step, function () { return pos >= O * O - 1; });
    var ctl = el('div', 'ctl');
    ctl.appendChild(button('◀', function () { play.stop(); pos = Math.max(0, pos - 1); draw(); }));
    ctl.appendChild(button('▶ Next', function () { play.stop(); step(); }, 'primary'));
    ctl.appendChild(play.btn);
    ctl.appendChild(button('Show all', function () { play.stop(); pos = O * O - 1; draw(); }));
    ctl.appendChild(select(images, function (i) { play.stop(); I = images[i]; pos = 0; draw(); }));
    ctl.appendChild(select(filters, function (i) { play.stop(); F = filters[i]; pos = 0; draw(); }));
    host.appendChild(ctl);
    draw();
  };

  /* ---------- pooling ---------- */
  MP.pool = function (sel) {
    var host = document.querySelector(sel); if (!host) return;
    var m = [[1, 3, 2, 4], [5, 6, 1, 2], [7, 2, 9, 0], [1, 4, 3, 8]], mode = 'max';
    host.appendChild(el('div', 'demo-title', 'Try it: 2×2 pooling on a 4×4 activation map'));
    host.appendChild(el('div', 'demo-sub', 'Each coloured 2×2 block collapses into one number. No weights are involved.'));
    var row = el('div', 'mx-row');
    function col(label) { var c = el('div', 'mx-col'); var l = el('div', 'mx-lbl', label); c.appendChild(l); var g = el('div', 'mx'); c.appendChild(g); row.appendChild(c); return { g: g, l: l }; }
    var a = col('input (4×4)'); row.appendChild(el('div', 'op', '→'));
    var b = col('output (2×2)');
    a.g.style.gridTemplateColumns = 'repeat(4, auto)'; b.g.style.gridTemplateColumns = 'repeat(2, auto)';
    host.appendChild(row);
    var calc = el('div', 'calc'); host.appendChild(calc);
    function draw() {
      a.g.innerHTML = ''; b.g.innerHTML = '';
      var outs = [], lines = [];
      for (var q = 0; q < 4; q++) {
        var r0 = Math.floor(q / 2) * 2, c0 = (q % 2) * 2;
        var vals = [m[r0][c0], m[r0][c0 + 1], m[r0 + 1][c0], m[r0 + 1][c0 + 1]];
        var v = mode === 'max' ? Math.max.apply(null, vals) : vals.reduce(function (x, y) { return x + y; }, 0) / 4;
        outs.push(v);
        lines.push((mode === 'max' ? 'max' : 'avg') + '(' + vals.join(', ') + ') = <b>' + fmt(v) + '</b>');
      }
      m.forEach(function (rw, r) {
        rw.forEach(function (v, c) {
          var q = Math.floor(r / 2) * 2 + Math.floor(c / 2);
          a.g.appendChild(cell(v, 'q' + q + (mode === 'max' && v === outs[q] ? ' max' : '')));
        });
      });
      outs.forEach(function (v, q) { b.g.appendChild(cell(fmt(v), 'q' + q)); });
      b.l.textContent = (mode === 'max' ? 'max' : 'average') + ' pooled (2×2)';
      calc.innerHTML = lines.join('<br>');
    }
    var ctl = el('div', 'ctl');
    var bMax = button('Max pooling', function () { mode = 'max'; paint(); }, 'primary');
    var bAvg = button('Average pooling', function () { mode = 'avg'; paint(); });
    function paint() { bMax.classList.toggle('primary', mode === 'max'); bAvg.classList.toggle('primary', mode === 'avg'); draw(); }
    ctl.appendChild(bMax); ctl.appendChild(bAvg);
    ctl.appendChild(button('New numbers', function () {
      m = m.map(function (rw) { return rw.map(function () { return Math.floor(Math.random() * 10); }); });
      draw();
    }));
    host.appendChild(ctl);
    draw();
  };

  /* ---------- output-size & parameter calculator ---------- */
  MP.sizeCalc = function (sel) {
    var host = document.querySelector(sel); if (!host) return;
    host.appendChild(el('div', 'demo-title', 'Output-size and parameter calculator'));
    host.appendChild(el('div', 'demo-sub', 'Leave padding at 0 and stride at 1 for the plain case used in the notes.'));
    var ctl = el('div', 'ctl'); ctl.style.marginTop = '0';
    var fields = [['N', 'input size N', 32], ['F', 'filter size F', 5], ['P', 'padding P', 0], ['S', 'stride S', 1], ['C', 'input channels', 3], ['K', 'number of filters', 6]];
    var inputs = {};
    fields.forEach(function (f) {
      var lab = el('label', '', f[1] + ' ');
      var inp = document.createElement('input'); inp.type = 'number'; inp.min = f[0] === 'P' ? 0 : 1; inp.value = f[2];
      inp.addEventListener('input', draw);
      lab.appendChild(inp); ctl.appendChild(lab); inputs[f[0]] = inp;
    });
    host.appendChild(ctl);
    var calc = el('div', 'calc'); calc.style.whiteSpace = 'normal'; host.appendChild(calc);
    function draw() {
      var v = {}; for (var k in inputs) v[k] = Math.max(k === 'P' ? 0 : 1, parseInt(inputs[k].value, 10) || 0);
      var span = v.N + 2 * v.P - v.F;
      if (span < 0) { calc.innerHTML = 'The filter is larger than the (padded) input, so it does not fit.'; return; }
      var o = Math.floor(span / v.S) + 1;
      var per = v.F * v.F * v.C;
      calc.innerHTML =
        'output size = (N + 2P − F) / S + 1 = (' + v.N + ' + ' + (2 * v.P) + ' − ' + v.F + ') / ' + v.S + ' + 1 = <b>' + o + '</b>' +
        (span % v.S ? ' <span class="muted">(rounded down)</span>' : '') +
        '<br>output volume = ' + o + ' × ' + o + ' × ' + v.K + ' <span class="muted">(one activation map per filter)</span>' +
        '<br>weights per filter = F × F × input channels = ' + v.F + ' × ' + v.F + ' × ' + v.C + ' = ' + per +
        '<br>parameters = (' + per + ' + 1 bias) × ' + v.K + ' filters = <b>' + ((per + 1) * v.K) + '</b>' +
        '<br><span class="muted">A fully connected layer from the same ' + v.N + '×' + v.N + '×' + v.C + ' input to ' + (o * o * v.K) +
        ' outputs would need about ' + (v.N * v.N * v.C * o * o * v.K).toLocaleString() + ' weights.</span>';
    }
    draw();
  };
})();
