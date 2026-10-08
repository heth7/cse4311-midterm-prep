/* CSE 4311 midterm prep — shared behaviour: theme, TOC, checklists, quizzes, computational graphs */
(function () {
  'use strict';
  var MP = (window.MP = window.MP || {});
  var root = document.documentElement;

  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  MP.save = save; MP.load = load; MP.drop = drop;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  MP.el = el;

  MP.math = function (node) {
    if (window.renderMathInElement) {
      window.renderMathInElement(node || document.body, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  };

  /* ---------- theme ---------- */
  function initTheme() {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    function isDark() {
      var t = root.dataset.theme;
      if (t) return t === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    function paint() { btn.textContent = isDark() ? '☀' : '☾'; btn.title = isDark() ? 'Switch to light' : 'Switch to dark'; }
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next; save('mp-theme', next); paint();
    });
    paint();
  }

  /* ---------- table of contents ---------- */
  function initToc() {
    var toc = document.querySelector('.toc');
    if (!toc) return;
    var heads = document.querySelectorAll('main h2[id]');
    if (!heads.length) return;
    toc.appendChild(el('div', 'toc-title', 'On this page'));
    var links = {};
    heads.forEach(function (h) {
      var a = el('a');
      a.href = '#' + h.id;
      a.textContent = h.dataset.toc || h.textContent;
      toc.appendChild(a);
      links[h.id] = a;
    });
    var current = null, queued = false;
    function spy() {
      queued = false;
      var hit = null;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top <= 96) hit = heads[i]; else break;
      }
      var next = hit ? links[hit.id] : null;
      if (next === current) return;
      if (current) current.classList.remove('on');
      if (next) next.classList.add('on');
      current = next;
    }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(spy); } }, { passive: true });
    spy();
  }

  /* ---------- persistent checklists ---------- */
  function initChecks() {
    document.querySelectorAll('input[type="checkbox"][data-key]').forEach(function (cb) {
      var k = 'mp-check-' + cb.dataset.key;
      cb.checked = load(k) === '1';
      cb.addEventListener('change', function () { save(k, cb.checked ? '1' : '0'); });
    });
  }

  /* ---------- quizzes ----------
     questions: [{ q, o: [..], a: index, why, t: topic }]
     opts: { id, exam: bool }  — exam mode hides feedback until MP.grade(id) */
  var quizzes = {};
  MP.quiz = function (target, questions, opts) {
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) return;
    opts = opts || {};
    var id = opts.id || host.id || 'quiz';
    var key = 'mp-quiz-' + id;
    var state = {};
    try { state = JSON.parse(load(key) || '{}') || {}; } catch (e) { state = {}; }
    var graded = !opts.exam;

    var bar = el('div', 'quiz-bar');
    var score = el('span', 'score');
    var prog = el('div', 'bar', '<i></i>');
    var retry = el('button', 'btn', 'Retry missed');
    var reset = el('button', 'btn', 'Reset');
    bar.appendChild(score); bar.appendChild(prog);
    if (!opts.exam) bar.appendChild(retry);
    bar.appendChild(reset);
    host.appendChild(bar);

    var list = el('ol', 'qs');
    host.appendChild(list);
    var items = [];

    // Options are shown in a fixed shuffled order per question; state stores the original option index.
    function order(qi, n) {
      var seed = 2166136261, str = id + ':' + qi;
      for (var i = 0; i < str.length; i++) { seed ^= str.charCodeAt(i); seed = Math.imul(seed, 16777619); }
      var idx = [];
      for (var k = 0; k < n; k++) idx.push(k);
      for (var j = n - 1; j > 0; j--) {
        seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 | 0;
        var r = (seed >>> 0) % (j + 1), tmp = idx[j]; idx[j] = idx[r]; idx[r] = tmp;
      }
      return idx;
    }

    questions.forEach(function (Q, qi) {
      var li = el('li', 'q');
      var qt = el('p', 'qt', (Q.t ? '<span class="pill topic">' + Q.t + '</span>' : '') + Q.q);
      li.appendChild(qt);
      var box = el('div', 'opts');
      var perm = order(qi, Q.o.length), btns = [];
      perm.forEach(function (oi, pos) {
        var b = el('button', 'opt', '<span class="k">' + 'ABCDE'.charAt(pos) + '</span><span>' + Q.o[oi] + '</span>');
        b.type = 'button';
        b.addEventListener('click', function () { choose(qi, oi); });
        box.appendChild(b);
        btns[oi] = b;
      });
      li.appendChild(box);
      var why = el('div', 'why');
      why.hidden = true;
      li.appendChild(why);
      list.appendChild(li);
      items.push({ li: li, btns: btns, why: why, letter: 'ABCDE'.charAt(perm.indexOf(Q.a)) });
    });

    function choose(qi, oi) {
      if (graded && state[qi] != null) return;
      state[qi] = oi;
      save(key, JSON.stringify(state));
      paint();
    }

    function paint() {
      var answered = 0, right = 0;
      questions.forEach(function (Q, qi) {
        var it = items[qi], pick = state[qi];
        it.li.classList.remove('ok', 'no');
        it.btns.forEach(function (b, oi) {
          b.classList.remove('sel', 'right', 'wrong');
          b.disabled = false;
          if (pick == null) return;
          if (!graded) { if (oi === pick) b.classList.add('sel'); return; }
          b.disabled = true;
          if (oi === Q.a) b.classList.add('right');
          else if (oi === pick) b.classList.add('wrong');
        });
        if (pick != null) {
          answered++;
          if (pick === Q.a) right++;
        }
        if (graded && (pick != null || opts.exam)) {
          var ok = pick === Q.a;
          it.li.classList.add(ok ? 'ok' : 'no');
          it.why.hidden = false;
          it.why.innerHTML = '<b class="v">' + (pick == null ? 'Not answered.' : ok ? 'Correct.' : 'Not quite.') + '</b> ' +
            (ok ? '' : 'Answer: <b>' + it.letter + '</b>. ') + (Q.why || '');
          if (opts.exam) it.btns.forEach(function (b, oi) {
            b.disabled = true;
            if (oi === Q.a) b.classList.add('right');
          });
        } else {
          it.why.hidden = true;
        }
      });
      var n = questions.length;
      if (graded) {
        score.textContent = right + ' correct · ' + answered + ' / ' + n + ' answered';
        prog.firstChild.style.width = (100 * right / n) + '%';
      } else {
        score.textContent = answered + ' / ' + n + ' answered';
        prog.firstChild.style.width = (100 * answered / n) + '%';
      }
      retry.disabled = !questions.some(function (Q, qi) { return state[qi] != null && state[qi] !== Q.a; });
      MP.math(list);
      if (opts.onChange) opts.onChange({ answered: answered, right: right, total: n, graded: graded });
    }

    retry.addEventListener('click', function () {
      questions.forEach(function (Q, qi) { if (state[qi] != null && state[qi] !== Q.a) delete state[qi]; });
      save(key, JSON.stringify(state));
      paint();
    });
    reset.addEventListener('click', function () {
      state = {}; drop(key);
      graded = !opts.exam;
      paint();
    });

    quizzes[id] = {
      grade: function () { graded = true; paint(); return result(); },
      result: result
    };
    function result() {
      var right = 0, missed = [];
      questions.forEach(function (Q, qi) { if (state[qi] === Q.a) right++; else missed.push(Q.t || 'General'); });
      return { right: right, total: questions.length, missed: missed };
    }
    paint();
  };
  MP.grade = function (id) { return quizzes[id] && quizzes[id].grade(); };

  /* ---------- computational graphs ----------
     spec: { w, h, nodes: [{id,x,y,label,kind:'in'|'op'|'out', tot}], edges: [{from,to,f,b,t}] }
     f = forward value on the edge (green), b = gradient flowing back along it (red), tot = total gradient at an input */
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  MP.graph = function (target, spec) {
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) return;
    host.classList.add('graph');
    if (spec.hideBackward !== false) host.classList.add('hide-b');
    var scroll = el('div', 'g-scroll');
    var svg = s('svg', { viewBox: '0 0 ' + spec.w + ' ' + spec.h, role: 'img', 'aria-label': spec.label || 'Computational graph' });
    var byId = {};
    spec.nodes.forEach(function (n) { byId[n.id] = n; });
    var R = 19;
    function half(n) {
      if (n.kind === 'in' || n.kind === 'out') return { w: Math.max(22, 6 + 4.6 * String(n.label).length), h: 16, box: true };
      var r = Math.max(R, 7 + 4.4 * String(n.label).length);
      return { w: r, h: r, box: false };
    }
    function edgePoint(n, tx, ty) {
      var hf = half(n), dx = tx - n.x, dy = ty - n.y, len = Math.hypot(dx, dy) || 1;
      if (!hf.box) return [n.x + dx / len * hf.w, n.y + dy / len * hf.w];
      var sx = dx === 0 ? Infinity : hf.w / Math.abs(dx), sy = dy === 0 ? Infinity : hf.h / Math.abs(dy);
      var k = Math.min(sx, sy);
      return [n.x + dx * k, n.y + dy * k];
    }
    var gEdges = s('g', {}), gText = s('g', {}), gNodes = s('g', {});
    spec.edges.forEach(function (e) {
      var a = byId[e.from], b = byId[e.to];
      var p1 = edgePoint(a, b.x, b.y), p2 = edgePoint(b, a.x, a.y);
      var dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy) || 1;
      var ux = dx / len, uy = dy / len;
      var tip = [p2[0], p2[1]], base = [p2[0] - ux * 8, p2[1] - uy * 8];
      gEdges.appendChild(s('line', { class: 'edge', x1: p1[0], y1: p1[1], x2: base[0], y2: base[1] }));
      gEdges.appendChild(s('polygon', {
        class: 'arrow',
        points: [tip[0], tip[1], base[0] - uy * 4, base[1] + ux * 4, base[0] + uy * 4, base[1] - ux * 4].join(',')
      }));
      var t = e.t == null ? 0.5 : e.t;
      var mx = p1[0] + dx * t, my = p1[1] + dy * t;
      if (e.f != null) gText.appendChild(s('text', { class: 'ev f', x: mx, y: my - 7 }, e.f));
      if (e.b != null) gText.appendChild(s('text', { class: 'ev b', x: mx, y: my + 17 }, e.b));
    });
    spec.nodes.forEach(function (n) {
      var g = s('g', { class: 'node ' + (n.kind || 'op') });
      var hf = half(n);
      if (hf.box) g.appendChild(s('rect', { x: n.x - hf.w, y: n.y - hf.h, width: hf.w * 2, height: hf.h * 2, rx: 7 }));
      else g.appendChild(s('circle', { cx: n.x, cy: n.y, r: hf.w }));
      g.appendChild(s('text', { x: n.x, y: n.y }, n.label));
      gNodes.appendChild(g);
      if (n.tot != null) gText.appendChild(s('text', { class: 'tot', x: n.x + (n.totDx || 0), y: n.y + (n.totDy == null ? 34 : n.totDy) }, n.tot));
    });
    svg.appendChild(gEdges); svg.appendChild(gNodes); svg.appendChild(gText);
    scroll.appendChild(svg);
    host.appendChild(scroll);
    var bar = el('div', 'g-bar');
    var btn = el('button', 'btn', '');
    function paint() { btn.textContent = host.classList.contains('hide-b') ? 'Show backward pass' : 'Hide backward pass'; }
    btn.addEventListener('click', function () { host.classList.toggle('hide-b'); paint(); });
    paint();
    bar.appendChild(btn);
    bar.appendChild(el('span', 'legend', '<span class="fwd">green</span> = forward value · <span class="bwd">red</span> = gradient'));
    host.appendChild(bar);
  };

  document.addEventListener('DOMContentLoaded', function () {
    initTheme(); initToc(); initChecks(); MP.math(document.body);
  });
})();
