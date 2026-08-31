/* ============================================================================
   Delaunay Navigable Delay — chassis spec for engine A of
   prototypes/delaunay_delay.html.

   Sites live in normalized [0,1] so one constellation renders correctly in the
   phone's 390x352 square AND the rack's 288x156 letterbox. This is the whole
   reason two chassis can share one geometry — keep new effects normalized too.

   ponytail: Bowyer-Watson is duplicated here, in prototypes/delaunay_delay.html
   and in max/dlny.map.js. max/dlny.map.js is the source of truth (it has the
   test suite); jsui can't load from ui/, so a shared module would only merge
   two of the three. Fold the two web copies together if they ever disagree.
   ========================================================================= */
var DLNY = window.DLNY || (window.DLNY = {});

(function () {
  'use strict';
  var F = Chassis.fmt, pad = Chassis.pad;
  var semis = function (v) { return v === 0 ? '0' : (v > 0 ? '+' : '') + v + 'st'; };

  /* ---------- geometry (verbatim from max/dlny.map.js) ---------- */
  function cc(a, b, c) {
    var ax = a.x, ay = a.y, bx = b.x, by = b.y, cx = c.x, cy = c.y;
    var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-12) return null;   // collinear: no circumcircle
    var a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    var ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    var uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return { x: ux, y: uy, r2: (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy) };
  }
  function triHasEdge(t, a, b) { return t.indexOf(a) >= 0 && t.indexOf(b) >= 0; }

  function delaunay(pts) {
    var mnX = 1e9, mnY = 1e9, mxX = -1e9, mxY = -1e9;
    pts.forEach(function (p) {
      mnX = Math.min(mnX, p.x); mnY = Math.min(mnY, p.y);
      mxX = Math.max(mxX, p.x); mxY = Math.max(mxY, p.y);
    });
    var dmax = Math.max((mxX - mnX) || 1, (mxY - mnY) || 1);
    var mx = (mnX + mxX) / 2, my = (mnY + mxY) / 2;
    var s1 = { x: mx - 20 * dmax, y: my - dmax, sup: 1 },
        s2 = { x: mx, y: my + 20 * dmax, sup: 1 },
        s3 = { x: mx + 20 * dmax, y: my - dmax, sup: 1 };
    var tris = [[s1, s2, s3]];
    pts.forEach(function (p) {
      var bad = tris.filter(function (t) {
        var o = cc(t[0], t[1], t[2]);
        return o && ((p.x - o.x) * (p.x - o.x) + (p.y - o.y) * (p.y - o.y)) <= o.r2;
      });
      var edges = [];
      bad.forEach(function (t) {
        [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(function (e) {
          var shared = bad.some(function (t2) { return t2 !== t && triHasEdge(t2, e[0], e[1]); });
          if (!shared) edges.push(e);
        });
      });
      tris = tris.filter(function (t) { return bad.indexOf(t) < 0; });
      edges.forEach(function (e) { tris.push([e[0], e[1], p]); });
    });
    return tris.filter(function (t) { return !t[0].sup && !t[1].sup && !t[2].sup; });
  }

  function bary(p, a, b, c) {
    var v0x = b.x - a.x, v0y = b.y - a.y, v1x = c.x - a.x, v1y = c.y - a.y,
        v2x = p.x - a.x, v2y = p.y - a.y;
    var d00 = v0x * v0x + v0y * v0y, d01 = v0x * v1x + v0y * v1y,
        d11 = v1x * v1x + v1y * v1y, d20 = v2x * v0x + v2y * v0y,
        d21 = v2x * v1x + v2y * v1y;
    var den = (d00 * d11 - d01 * d01) || 1e-9;
    var v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
    return [1 - v - w, v, w];
  }

  /* ---------- data ---------- */
  var DIVS = ['1/16', '1/8T', '1/16.', '1/8', '1/4T', '1/8.',
              '1/4', '1/2T', '1/4.', '1/2', '1/2.', '1/1'];
  // Ascending by length, in quarter-note beats. T = triplet, . = dotted.
  var DIV_BEATS = [0.25, 1 / 3, 0.375, 0.5, 2 / 3, 0.75, 1, 4 / 3, 1.5, 2, 3, 4];
  // Delay time for a tap: division x tempo x the Time feel (1/2, 1, 2).
  function divSec(divIndex, bpm, mult) {
    return DIV_BEATS[divIndex] * (60 / bpm) * (mult || 1);
  }
  var TIME_MULT = [0.5, 1, 2], TIME_LBL = ['½×', '1×', '2×'];
  var COLS = ['#5ad1c8', '#f2a65a', '#c86bfa', '#f26b8a', '#4af626'];
  var FXDEF = { phaser:  ['Phaser',   'Rate', 0.05, 8, 0.4],
                ringmod: ['Ring Mod', 'Freq', 20, 2000, 220],
                grain:   ['Grain',    'Size', 20, 200, 80] };

  var S = {
    on: true, play: false, tab: 'MIX', engine: 'delay', drift: false,
    sel: 0, editing: null, head: { x: 0.5, y: 0.55 }, pts: [], tris: [], w: null, wtri: null,
    wet: 72, fb: 42, glide: 80, width: 100, out: 100, tone: 78,
    bpm: 110, ntaps: 14, flen: 320, ffb: 0, latch: false, timeMult: 1
  };

  function regen(n) {
    S.pts = [];
    var count = n || S.ntaps;
    for (var i = 0; i < count; i++) {
      S.pts.push({
        x: 0.08 + Math.random() * 0.84, y: 0.08 + Math.random() * 0.84, i: i,
        div: Math.floor(Math.random() * 12),
        cut: Math.round(800 + Math.random() * 11000),
        pan: Math.round(-90 + Math.random() * 180),
        pitch: 0,
        fb: Math.round(Math.random() * 70),
        vol: 80 + Math.round(Math.random() * 20),
        mute: false, solo: false,
        fx: Math.random() < 0.28 ? [{ t: 'phaser', v: FXDEF.phaser[4] }] : []
      });
    }
    if (S.sel >= S.pts.length) S.sel = 0;
    retriangulate();
  }
  function retriangulate() { S.tris = delaunay(S.pts); voroDirty = true; solve(); }

  function solve() {
    S.w = null; S.wtri = null;
    for (var i = 0; i < S.tris.length; i++) {
      var t = S.tris[i], b = bary(S.head, t[0], t[1], t[2]);
      if (b[0] >= -1e-6 && b[1] >= -1e-6 && b[2] >= -1e-6) {
        S.w = b.map(function (v) { return Math.max(0, v); });
        S.wtri = t; return;
      }
    }
    // Outside the hull (or a degenerate 3-point constellation): fall back to
    // the nearest site so gains still sum to 1 and audio keeps running.
    var best = S.pts[0], bd = 1e9;
    S.pts.forEach(function (p) {
      var d = (p.x - S.head.x) * (p.x - S.head.x) + (p.y - S.head.y) * (p.y - S.head.y);
      if (d < bd) { bd = d; best = p; }
    });
    S.w = [1, 0, 0]; S.wtri = [best, best, best];
  }

  function weightOf(p) {
    if (!S.wtri) return 0;
    var w = 0;
    for (var i = 0; i < 3; i++) if (S.wtri[i] === p) w += S.w[i];
    var soloed = S.pts.some(function (q) { return q.solo; });
    if (p.mute || (soloed && !p.solo)) return 0;
    return w * (p.vol / 100);
  }

  /* ---------- Voronoi dual, cached until the geometry moves ---------- */
  var voroDirty = true, voroCache = {};
  function voro(W, H) {
    var key = W + 'x' + H;
    if (voroDirty) { voroCache = {}; voroDirty = false; }
    if (voroCache[key]) return voroCache[key];
    var step = 4, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.globalAlpha = 0.13;
    for (var y = 0; y < H; y += step) for (var x = 0; x < W; x += step) {
      var bi = 0, bd = 1e18;
      for (var i = 0; i < S.pts.length; i++) {
        var dx = S.pts[i].x * W - x, dy = S.pts[i].y * H - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; bi = i; }
      }
      g.fillStyle = COLS[bi % COLS.length];
      g.fillRect(x, y, step, step);
    }
    voroCache[key] = c;
    return c;
  }

  /* ---------- draw ---------- */
  function draw(g, W, H, s) {
    g.fillStyle = '#0c1018'; g.fillRect(0, 0, W, H);
    var P = function (p) { return [p.x * W, p.y * H]; };

    if (s.engine === 'freeze') {
      g.drawImage(voro(W, H), 0, 0);
      g.strokeStyle = 'rgba(255,255,255,.10)';
    } else {
      g.strokeStyle = 'rgba(234,234,234,.17)';
    }
    g.lineWidth = 1;
    s.tris.forEach(function (t) {
      var a = P(t[0]), b = P(t[1]), c = P(t[2]);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]);
      g.closePath(); g.stroke();
    });

    if (s.engine === 'delay' && s.wtri && s.wtri[0] !== s.wtri[1]) {
      var A = P(s.wtri[0]), B = P(s.wtri[1]), C = P(s.wtri[2]);
      g.fillStyle = 'rgba(255,42,42,.09)'; g.strokeStyle = 'rgba(255,42,42,.55)';
      g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]);
      g.closePath(); g.fill(); g.stroke();
      var h = [s.head.x * W, s.head.y * H], base = g.globalAlpha;
      for (var i = 0; i < 3; i++) {
        var v = P(s.wtri[i]);
        g.globalAlpha = base * (0.15 + s.w[i] * 0.75);
        g.strokeStyle = '#ff2a2a'; g.lineWidth = 1 + s.w[i] * 2.4;
        g.beginPath(); g.moveTo(h[0], h[1]); g.lineTo(v[0], v[1]); g.stroke();
      }
      g.globalAlpha = base;
    }

    var r = Math.max(3.4, Math.min(W, H) * 0.021), alpha = g.globalAlpha;
    s.pts.forEach(function (p, i) {
      var xy = P(p), w = weightOf(p);
      if (w > 0.01) {
        g.globalAlpha = alpha * w * 0.5; g.fillStyle = COLS[i % COLS.length];
        g.beginPath(); g.arc(xy[0], xy[1], r + w * r * 2.6, 0, 7); g.fill();
        g.globalAlpha = alpha;
      }
      g.fillStyle = p.mute ? '#3a3a3a' : COLS[i % COLS.length];
      g.beginPath(); g.arc(xy[0], xy[1], r, 0, 7); g.fill();
      if (p.fx.length) {
        g.strokeStyle = '#c86bfa'; g.lineWidth = 1;
        g.beginPath(); g.arc(xy[0], xy[1], r + 2.6, 0, 7); g.stroke();
      }
      if (i === s.sel) {
        g.strokeStyle = '#eaeaea'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(xy[0], xy[1], r + 5, 0, 7); g.stroke();
      }
    });

    if (s.engine === 'delay') {
      var hh = [s.head.x * W, s.head.y * H], hr = Math.max(4, Math.min(W, H) * 0.017);
      g.fillStyle = '#ff2a2a';
      g.beginPath(); g.arc(hh[0], hh[1], hr, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,42,42,.45)'; g.lineWidth = 1;
      g.beginPath(); g.arc(hh[0], hh[1], hr * 2.5, 0, 7); g.stroke();
    }

    if (s.editing != null && s.pts[s.editing]) drawEditHUD(g, W, H, s);
  }

  /* While hold-dragging, the two axes have to be legible on the canvas — the
     page below can't be read with a thumb parked on top of the node. */
  function drawEditHUD(g, W, H, s) {
    var p = s.pts[s.editing], x = p.x * W, y = p.y * H;
    var small = Math.min(W, H) < 200;
    var fs = small ? 9 : 12, padX = small ? 6 : 8, lh = fs + 4;
    var lines = [DIVS[p.div], p.fb + '% fb'];

    g.font = '700 ' + fs + "px 'JetBrains Mono',ui-monospace,monospace";
    var wBox = 0;
    lines.forEach(function (t) { wBox = Math.max(wBox, g.measureText(t).width); });
    wBox += padX * 2;
    var hBox = lh * lines.length + 6;

    // keep the badge on-canvas whichever edge the node is against
    var bx = x + 14, by = y - hBox - 10;
    if (bx + wBox > W - 4) bx = x - 14 - wBox;
    if (by < 4) by = y + 14;
    bx = Math.max(4, Math.min(bx, W - wBox - 4));
    by = Math.max(4, Math.min(by, H - hBox - 4));

    g.fillStyle = 'rgba(10,10,10,.92)';
    g.fillRect(bx, by, wBox, hBox);
    g.strokeStyle = '#ff2a2a'; g.lineWidth = 1;
    g.strokeRect(bx + .5, by + .5, wBox - 1, hBox - 1);
    g.fillStyle = '#eaeaea';
    g.textBaseline = 'top';
    lines.forEach(function (t, i) { g.fillText(t, bx + padX, by + 4 + i * lh); });

    // axis hint: vertical is time, horizontal is feedback
    g.strokeStyle = 'rgba(255,42,42,.35)';
    g.beginPath();
    g.moveTo(x, y - 26); g.lineTo(x, y + 26);
    g.moveTo(x - 26, y); g.lineTo(x + 26, y);
    g.stroke();
  }

  /* ---------- pointer ----------
     Empty space          drags the playhead
     Tap a node           selects it and reveals TAP
     Hold a node + drag   edits it in place: up/down = delay time, left/right =
                          feedback. Two parameters under one thumb, no page.
     Shift-drag a node    repositions it and re-triangulates (desktop only —
                          the edit gesture took the plain drag) */
  var mode = null, grab = null;
  // How far you drag for the full range of each axis. Vertical covers the 12
  // divisions in about half a canvas; horizontal covers 0-90% feedback in a
  // little over half. Tune these before touching PICK_R2.
  var DRAG_DIV = 22, DRAG_FB = 120;
  // Pick radius, squared, in normalized units. Tuning knob: 0.0055 is ~26 px on
  // the phone canvas and ~15 px on the rack. Raising it makes nodes easier to
  // hit but eats the empty space the playhead needs — at 14 taps, 0.013 (~40 px)
  // already claims about half the phone canvas. Nearest always wins, so a bigger
  // radius never creates ambiguity, only crowding.
  var PICK_R2 = 0.0055;
  function nearest(q) {
    var bi = -1, bd = 1e9;
    S.pts.forEach(function (p, i) {
      var dx = (p.x - q.x) * q.aspect, dy = p.y - q.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = i; }
    });
    return bd < PICK_R2 ? bi : -1;
  }
  // Picking a node brings its parameters forward. Staying put would leave the
  // selection visible only as a ring on the map and a word in the readout.
  // TAP and FX are already about the selected node, so don't yank the user off
  // the insert rack just because they picked a different tap to edit.
  var NODE_TABS = ['TAP', 'FX'];
  function reveal(s) {
    if (NODE_TABS.indexOf(s.tab) < 0) s.tab = 'TAP';
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function pointer(phase, q, s, api) {
    if (phase === 'down') {
      var i = nearest(q);
      if (i >= 0) {
        s.sel = i; reveal(s);
        // Shift is a desktop-only shortcut past the 400ms hold, straight into
        // repositioning. Touch reaches the same thing through hold, below.
        mode = q.shift ? 'move' : 'pick';
        if (mode === 'move') grab = null;
        api.render();
        return;
      }
      mode = 'head'; s.drift = false; s.head = { x: q.x, y: q.y }; solve();
      return;
    }

    // hold is also where right-click lands, so it reveals too — the contract
    // ui/README.md claims for reaching a node's editor on either input.
    if (phase === 'hold') {
      var h = nearest(q);
      if (h < 0) return;
      s.sel = h; reveal(s);
      if (mode === 'head') return;
      // Anchor the edit on the values the tap had when grabbed, so the drag is
      // relative. Reading absolute position would snap the tap on first touch.
      var p = s.pts[h];
      grab = { x: q.x, y: q.y, div: p.div, fb: p.fb };
      s.editing = h;
      mode = 'edit';
      return;
    }

    if (phase === 'move' || phase === 'holdmove') {
      if (mode === 'head') { s.head = { x: q.x, y: q.y }; solve(); return; }
      if (mode === 'move') {
        var m = s.pts[s.sel];
        m.x = clamp(q.x, 0.03, 0.97);
        m.y = clamp(q.y, 0.03, 0.97);
        retriangulate();
        return;
      }
      if (mode === 'edit' && grab) {
        var e = s.pts[s.sel];
        e.div = clamp(Math.round(grab.div + (grab.y - q.y) * DRAG_DIV), 0, 11);
        e.fb  = clamp(Math.round(grab.fb + (q.x - grab.x) * DRAG_FB), 0, 90);
        return;
      }
      return;
    }

    if (phase === 'up') {
      var wasEditing = mode === 'edit' || mode === 'move';
      mode = null; grab = null; s.editing = null;
      if (wasEditing) api.render();   // page values must catch up with the drag
    }
  }

  /* ---------- the spec ---------- */
  DLNY.delaunay = {
    name: 'Delaunay',
    meta: 'AUDIO FX · DLNY-01',
    state: S,
    tabs: ['MIX', 'LVL', 'TAP', 'FX', 'FRZ', 'OUT'],

    transport: function (s) {
      return [
        { label: '▶', accent: true, on: s.play, tap: function () { s.play = !s.play; } },
        { label: 'DLY', on: s.engine === 'delay',  title: 'Delaunay morph',
          tap: function () { s.engine = 'delay'; } },
        { label: 'FRZ', on: s.engine === 'freeze', title: 'Voronoi freeze',
          tap: function () { s.engine = 'freeze'; } },
        { label: 'DRIFT', on: s.drift, tap: function () { s.drift = !s.drift; } },
        { label: '⟳', title: 'Regenerate constellation', tap: function () { regen(); } },
        // Time feel cycles rather than banking three buttons — it is one
        // parameter with three values, like Live's own x2/:2 controls.
        { label: TIME_LBL[TIME_MULT.indexOf(s.timeMult)], title: 'Time feel',
          on: s.timeMult !== 1,
          tap: function () {
            s.timeMult = TIME_MULT[(TIME_MULT.indexOf(s.timeMult) + 1) % TIME_MULT.length];
          } }
      ];
    },

    pages: {
      MIX: {
        context: function () { return 'Master bus'; },
        controls: function (s) {
          return [
            { label: 'Dry/Wet',  obj: s, key: 'wet',   min: 0, max: 100, fmt: F.pct },
            { label: 'Feedback', obj: s, key: 'fb',    min: 0, max: 90,  fmt: F.pct },
            { label: 'Glide',    obj: s, key: 'glide', min: 0, max: 800, fmt: F.ms },
            { label: 'Width',    obj: s, key: 'width', min: 0, max: 150, fmt: F.pct }
          ];
        }
      },
      LVL: {
        context: function (s) { return s.pts.length + ' taps'; },
        levelAt: function (i, s) { return weightOf(s.pts[i]); },
        render: Chassis.strips({
          items: function (s) { return s.pts; },
          level: function (p) { return weightOf(p); },
          selected: function (s) { return s.sel; },
          select: function (i, s) { s.sel = i; },
          extras: [ { key: 'pan', min: -100, max: 100, label: 'Pan' },
                    { key: 'cut', min: 300,  max: 18000, label: 'Tone' } ]
        })
      },
      TAP: {
        context: function (s) {
          var p = s.pts[s.sel];
          return 'Tap ' + pad(s.sel) + ' · ' + DIVS[p.div] + ' · ' + semis(p.pitch) +
                 ' · vol ' + p.vol;
        },
        controls: function (s) {
          var p = s.pts[s.sel];
          return [
            { label: 'Time',     obj: p, key: 'div',   min: 0,   max: 11,  fmt: F.list(DIVS) },
            { label: 'Pitch',    obj: p, key: 'pitch', min: -12, max: 12,  fmt: semis },
            { label: 'Volume',   obj: p, key: 'vol',   min: 0,   max: 100, fmt: F.pct },
            { label: 'Feedback', obj: p, key: 'fb',    min: 0,   max: 90,  fmt: F.pct }
          ];
        }
      },
      FX: {
        context: function (s) {
          var n = s.pts[s.sel].fx.length;
          return 'Tap ' + pad(s.sel) + ' · ' + (n || 'no') + ' insert' + (n === 1 ? '' : 's');
        },
        render: Chassis.rack(FXDEF, {
          owner: function (s) { return s.pts[s.sel]; },
          emptyText: function (s) { return 'Nothing inserted on tap ' + pad(s.sel) + ' yet.'; }
        })
      },
      FRZ: {
        context: function (s) { return 'Voronoi · ' + (s.latch ? 'held' : 'open'); },
        controls: function (s) {
          return [
            { label: 'Freeze len', obj: s, key: 'flen', min: 40, max: 1500, fmt: F.ms },
            { label: 'Freeze F/B', obj: s, key: 'ffb',  min: 0,  max: 95,   fmt: F.pct }
          ];
        }
      },
      OUT: {
        context: function () { return 'Device out'; },
        controls: function (s) {
          return [
            { label: 'Output', obj: s, key: 'out',   min: 0,  max: 150, fmt: F.pct },
            { label: 'Tone',   obj: s, key: 'tone',  min: 0,  max: 100, fmt: F.pct },
            { label: 'Tempo',  obj: s, key: 'bpm',   min: 40, max: 220, fmt: F.raw },
            // Changes the element count, so it commits on pointerup — committing
            // on input would rebuild the page under the slider you're holding.
            { label: 'Taps',   obj: s, key: 'ntaps', min: 6,  max: 20,  fmt: F.raw,
              commit: 'change', onInput: function (v) { regen(+v); } }
          ];
        }
      }
    },

    draw: draw,
    pointer: pointer,

    readout: function (s) {
      if (!s.wtri) return '';
      if (s.engine === 'freeze') {
        return 'VORONOI · cell <b>' + pad(s.sel) + '</b> · held <i>' +
               (s.latch ? s.pts.length : 0) + '</i> · len <i>' + s.flen + 'ms</i>';
      }
      var ids = s.wtri.map(function (p) { return pad(p.i); }).join('·');
      var ws = s.w.map(function (v) { return v.toFixed(2).slice(1); }).join(' ');
      var p = s.pts[s.sel];
      return 'tri <b>' + ids + '</b> · w <i>' + ws + '</i> · tap <b>' + pad(s.sel) +
             '</b> <i>' + DIVS[p.div] + '</i> · pitch <i>' + semis(p.pitch) +
             '</i> · vol <i>' + p.vol + '</i> · fb <i>' + p.fb + '%</i>';
    },

    // Hands-free Lissajous sweep, driven by Chassis-less rAF in the host page.
    tick: function (s, seconds) {
      if (!s.drift) return false;
      s.head = { x: 0.5 + 0.36 * Math.sin(seconds * 0.41),
                 y: 0.5 + 0.32 * Math.sin(seconds * 0.63 + 1.1) };
      solve();
      return true;
    },

    // exported for ui/test_chassis.js
    _internals: { delaunay: delaunay, bary: bary, regen: regen, solve: solve,
                  weightOf: weightOf, nearest: nearest, retriangulate: retriangulate,
                  pointer: pointer, NODE_TABS: NODE_TABS, PICK_R2: PICK_R2,
                  DIVS: DIVS, DIV_BEATS: DIV_BEATS, divSec: divSec, COLS: COLS,
                  TIME_MULT: TIME_MULT }
  };

  regen();
})();
