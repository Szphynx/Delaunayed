/* ============================================================================
   DLNY chassis — mounts one effect spec into a phone body and/or a Live rack.

   Classic script, not an ES module: the prototypes are opened straight off
   disk by double-click, and file:// blocks module imports.

     <link rel="stylesheet" href="ui/chassis.css">
     <script src="ui/chassis.js"></script>
     <script src="ui/effects/delaunay.js"></script>
     <script>
       Chassis.mount(document.getElementById('phone'), DLNY.delaunay, 'phone');
       Chassis.mount(document.getElementById('rack'),  DLNY.delaunay, 'rack');
     </script>

   Both mounts of the same spec share its state object and re-render together,
   so a tab click or a slider move in one shows up in the other.

   Spec shape is documented in ui/README.md.
   ========================================================================= */
var Chassis = (function () {
  'use strict';

  /* ---------- tiny DOM helper ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  // ES5 on purpose, not String.padStart: everything in ui/ should stay portable
  // to Max's legacy js/jsui engine, which is pre-ES2017. See ui/README.md.
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------- value formatters ---------- */
  var fmt = {
    raw: function (v) { return '' + v; },
    pct: function (v) { return v + '%'; },
    ms:  function (v) { return v + 'ms'; },
    db:  function (v) { return (v > 0 ? '+' : '') + v + 'dB'; },
    hz:  function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v + ''; },
    pan: function (v) { return v === 0 ? 'C' : (v < 0 ? 'L' + (-v) : 'R' + v); },
    // fmt.list(DIVS) turns an index into its label — for note divisions, tile
    // names, scale degrees: anything a slider steps through by position.
    list: function (arr) { return function (v) { return arr[v] != null ? arr[v] : v; }; }
  };

  function fillTrack(r) {
    var span = (r.max - r.min) || 1;
    r.style.setProperty('--p', (((r.value - r.min) / span) * 100).toFixed(1) + '%');
  }

  /* ---------- registry: every mount of a spec renders together ---------- */
  var mounts = new WeakMap();
  function peers(spec) {
    if (!mounts.has(spec)) mounts.set(spec, []);
    return mounts.get(spec);
  }

  /* ---------- page pieces an effect can reuse ----------
     These are the two page bodies that aren't just a list of sliders. Pass
     `render: Chassis.strips(...)` / `Chassis.rack(...)` in a page spec. */

  // A mixer page: one strip per element, with fader, mute, solo and a live
  // level bar. `opts.items(s)` returns the array; `opts.level(item,s)` the
  // 0..1 bar height. `opts.extras` adds thin per-element sliders under the
  // fader — pan and tone belong on a channel strip, not on a parameter page.
  function strips(opts) {
    return function (host, s, api) {
      var w = el('div', 'strips');
      opts.items(s).forEach(function (item, i) {
        var sel = opts.selected ? opts.selected(s) === i : false;
        var st = el('div', 'strip' + (sel ? ' sel' : ''));
        var bar = el('div', 'bar'), lvl = el('i');
        lvl.style.height = ((opts.level(item, s) || 0) * 100).toFixed(0) + '%';
        bar.appendChild(lvl);

        var f = el('input');
        f.type = 'range'; f.className = 'fad'; f.min = 0; f.max = 100; f.value = item.vol;
        f.setAttribute('aria-label', 'Level ' + pad(i));
        f.oninput = function () { item.vol = +f.value; api.paint(); };

        var ms = el('div', 'ms');
        var mb = el('button', item.mute ? 'on' : '', 'M');
        var sb = el('button', item.solo ? 'on' : '', 'S');
        mb.setAttribute('aria-label', 'Mute ' + pad(i));
        sb.setAttribute('aria-label', 'Solo ' + pad(i));
        mb.onclick = function (e) { e.stopPropagation(); item.mute = !item.mute; api.render(); };
        sb.onclick = function (e) { e.stopPropagation(); item.solo = !item.solo; api.render(); };
        ms.append(mb, sb);

        var wrap = el('div');
        wrap.style.cssText = 'display:flex;gap:4px;flex:1';
        wrap.append(bar, f);
        st.appendChild(wrap);

        (opts.extras || []).forEach(function (x) {
          var e = el('input');
          e.type = 'range'; e.className = 'ex'; e.min = x.min; e.max = x.max;
          e.value = item[x.key];
          e.title = x.label;
          e.setAttribute('aria-label', x.label + ' ' + pad(i));
          fillTrack(e);
          e.oninput = function (ev) {
            ev.stopPropagation();
            item[x.key] = +e.value; fillTrack(e); api.paint();
          };
          e.onclick = function (ev) { ev.stopPropagation(); };
          st.appendChild(e);
        });

        st.append(ms, el('div', 'id', pad(i)));
        if (opts.select) st.onclick = function () { opts.select(i, s); api.render(); };
        w.appendChild(st);
      });
      host.appendChild(w);
    };
  }

  // An insert-FX page for whichever element is selected. `defs` maps a key to
  // [display name, param label, min, max, default].
  function rack(defs, opts) {
    return function (host, s, api) {
      var owner = opts.owner(s), list = owner ? owner.fx : null, w = el('div', 'rack');
      if (!list) { host.appendChild(el('div', 'empty', 'Nothing selected.')); return; }
      if (!list.length) w.appendChild(el('div', 'empty', opts.emptyText ? opts.emptyText(s) : 'No inserts yet.'));
      list.forEach(function (f, k) {
        var d = defs[f.t], slot = el('div', 'slot');
        slot.appendChild(el('span', 'nm', d[0]));
        var r = el('input');
        r.type = 'range'; r.min = d[2]; r.max = d[3]; r.step = (d[3] - d[2]) / 100; r.value = f.v;
        r.setAttribute('aria-label', d[0] + ' ' + d[1]);
        fillTrack(r);
        r.oninput = function () { f.v = +r.value; fillTrack(r); };
        var x = el('button', 'x', '×');
        x.setAttribute('aria-label', 'Remove ' + d[0]);
        x.onclick = function () { list.splice(k, 1); api.render(); };
        slot.append(r, x);
        w.appendChild(slot);
      });
      var free = Object.keys(defs).filter(function (k) {
        return !list.some(function (f) { return f.t === k; });
      });
      if (free.length) {
        var b = el('button', 'addfx', '+ ' + defs[free[0]][0]);
        b.onclick = function () { list.push({ t: free[0], v: defs[free[0]][4] }); api.render(); };
        w.appendChild(b);
      }
      host.appendChild(w);
    };
  }

  /* ---------- one control row ---------- */
  function controlRow(c, api, onLabelChange) {
    var row = el('div', 'ctl');
    var lb = el('label', null, c.label);
    var r = el('input');
    r.type = 'range';
    r.min = c.min; r.max = c.max;
    if (c.step) r.step = c.step;
    r.value = c.obj[c.key];
    r.setAttribute('aria-label', c.label);
    fillTrack(r);
    var format = c.fmt || fmt.raw;
    var v = el('span', 'v', format(c.obj[c.key]));
    r.oninput = function () {
      c.obj[c.key] = +r.value;
      v.textContent = format(c.obj[c.key]);
      fillTrack(r);
      if (c.commit === 'change') return;      // heavy work waits for pointerup
      if (c.onInput) c.onInput(r.value, api);
      if (onLabelChange) onLabelChange();
      api.paint();
    };
    // A control that rebuilds the DOM (element count, grid size) must commit on
    // 'change', not 'input' — rebuilding mid-drag destroys the slider you hold.
    if (c.commit === 'change') {
      r.onchange = function () {
        if (c.onInput) c.onInput(r.value, api);
        api.render();
      };
    }
    row.append(lb, r, v);
    return row;
  }

  /* ---------- mount ---------- */
  var VARIANTS = {
    phone: { canvas: [390, 352], tabsCls: 'tabrow', bodyCls: 'pbody',
             transportCls: 'ptransport', readoutCls: 'preadout readout', head: true },
    rack:  { canvas: [288, 156], tabsCls: 'rail',   bodyCls: 'rbody',
             transportCls: 'rtransport', readoutCls: 'rreadout readout', head: false }
  };

  function mount(host, spec, variant) {
    var V = VARIANTS[variant];
    if (!V) throw new Error('Chassis.mount: variant must be "phone" or "rack"');
    var s = spec.state;
    var tabs = spec.tabs || Object.keys(spec.pages);
    if (!s.tab || tabs.indexOf(s.tab) < 0) s.tab = tabs[0];

    host.className = 'dlny ' + (variant === 'phone' ? 'phone' : 'rack632');
    host.textContent = '';

    var cv = el('canvas', variant === 'phone' ? 'pcanvas' : 'rcanvas');
    cv.width = V.canvas[0]; cv.height = V.canvas[1];
    var tabHost = el('div', V.tabsCls);
    tabHost.setAttribute('role', 'tablist');
    var transport = el('div', V.transportCls);
    var body = el('div', V.bodyCls);
    var readout = el('div', V.readoutCls);

    if (variant === 'phone') {
      var status = el('div', 'statusbar');
      status.append(el('span', null, '9:41'), el('span', null, (spec.name || '').toUpperCase() + ' · ▮▮▮'));
      var bar = el('div', 'pbar');
      var pw = el('button', 'pw');
      pw.setAttribute('aria-label', 'Device on / bypass');
      pw.onclick = function () { s.on = !s.on; api.render(); };
      var title = el('div', 'ptitle', spec.name + '<span>.</span>');
      bar.append(pw, title, el('span', 'pmeta', spec.meta || 'AUDIO FX'));
      var home = el('div', 'phome'); home.appendChild(el('i'));
      var dev = el('div', 'pdev');
      dev.append(bar, cv, transport, tabHost, body, readout);
      host.append(status, dev, home);
    } else {
      var pane = el('div', 'rpane');
      pane.append(transport, body, readout);
      host.append(tabHost, cv, pane);
    }

    var api = {
      spec: spec, state: s, canvas: cv, variant: variant,
      render: function () { peers(spec).forEach(function (m) { m._draw(); }); },
      paint:  function () { peers(spec).forEach(function (m) { m._paint(); }); }
    };

    function buildTabs() {
      tabHost.textContent = '';
      tabs.forEach(function (t) {
        var b = el('button', 'tab', t);
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', s.tab === t);
        b.onclick = function () { s.tab = t; api.render(); };
        tabHost.appendChild(b);
      });
    }

    function buildTransport() {
      transport.textContent = '';
      (spec.transport ? spec.transport(s) : []).forEach(function (t) {
        var b = el('button', 'tbtn' + (t.accent ? ' acc' : '') + (t.on ? ' on' : ''), t.label);
        if (t.title) b.title = t.title;
        b.setAttribute('aria-pressed', !!t.on);
        b.onclick = function () { t.tap(s, api); api.render(); };
        transport.appendChild(b);
      });
    }

    function buildBody() {
      body.textContent = '';
      var page = spec.pages[s.tab];
      if (!page) return;
      var head = null;
      if (V.head) {
        head = el('div', 'phead');
        head.append(
          el('span', 'pg', s.tab),
          el('span', 'cx', page.context ? page.context(s) : ''),
          el('span', 'of', (tabs.indexOf(s.tab) + 1) + ' / ' + tabs.length)
        );
        body.appendChild(head);
      }
      var refreshHead = head ? function () {
        head.querySelector('.cx').textContent = page.context ? page.context(s) : '';
      } : null;

      if (page.render) { page.render(body, s, api); return; }

      // A page is otherwise just a list of controls. The phone stacks them in
      // a .rows box that distributes the slack; the rack drops them straight
      // into its 2x2 grid.
      var box = V.head ? el('div', 'rows') : body;
      (page.controls ? page.controls(s) : []).forEach(function (c) {
        box.appendChild(controlRow(c, api, refreshHead));
      });
      if (box !== body) body.appendChild(box);
    }

    /* canvas: normalized coords, pointer capture, 400ms hold.
       Long-press is how touch reaches what right-click reaches on desktop —
       both land on the same spec.pointer callback, so an effect writes it once. */
    function wireCanvas() {
      var active = false, held = false, timer = null;
      function q(e) {
        var r = cv.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height,
                 aspect: cv.width / cv.height, shift: !!e.shiftKey };
      }
      function send(phase, e) {
        if (!spec.pointer) return;
        if (spec.pointer(phase, q(e), s, api) !== false) api.paint();
      }
      cv.addEventListener('pointerdown', function (e) {
        cv.setPointerCapture(e.pointerId);
        active = true; held = false;
        send('down', e);
        timer = setTimeout(function () {
          held = true;
          if (spec.pointer) spec.pointer('hold', q(e), s, api);
          api.render();
        }, 400);
      });
      cv.addEventListener('pointermove', function (e) {
        if (!active) return;
        clearTimeout(timer);
        send(held ? 'holdmove' : 'move', e);
      });
      function up(e) {
        if (!active) return;
        clearTimeout(timer);
        active = false;
        send('up', e);
      }
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (spec.pointer) { spec.pointer('hold', q(e), s, api); api.render(); }
      });
    }

    var m = {
      _draw: function () {
        buildTabs(); buildTransport(); buildBody();
        if (variant === 'phone') pw.classList.toggle('off', s.on === false);
        m._paint();
      },
      _paint: function () {
        var ctx = cv.getContext('2d');
        ctx.save();
        if (s.on === false) ctx.globalAlpha = 0.25;
        spec.draw(ctx, cv.width, cv.height, s);
        ctx.restore();
        readout.innerHTML = spec.readout ? spec.readout(s) : '';
        body.querySelectorAll('.strip .bar i').forEach(function (bar, i) {
          var page = spec.pages[s.tab];
          if (page && page.levelAt) bar.style.height = (page.levelAt(i, s) * 100).toFixed(0) + '%';
        });
      }
    };
    // Re-mounting a spec (switching effects, then switching back) must not leave
    // the old mount in the peer list — render() would paint detached nodes.
    m._host = host;
    mounts.set(spec, peers(spec).filter(function (o) {
      return o._host !== host && o._host.isConnected;
    }).concat(m));

    wireCanvas();
    m._draw();
    return api;
  }

  return { mount: mount, el: el, pad: pad, fmt: fmt, fillTrack: fillTrack,
           strips: strips, rack: rack, controlRow: controlRow, VARIANTS: VARIANTS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Chassis;
