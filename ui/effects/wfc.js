/* ============================================================================
   WFC Multitap — chassis spec for prototypes/wfc_multitap.html.

   Here as the second consumer of the chassis: a discrete grid rather than a
   continuous plane, six *different* tabs, and a paint tool instead of a
   playhead. If a change to ui/chassis.js breaks this, the chassis had a
   Delaunay assumption baked into it.

   Grid transposes in portrait. 16 steps across a 390px phone gives ~22 CSS px
   cells; painting needs 44. Steps run down the tall axis instead, which costs
   one swap in draw() and cellAt() and buys ~48px cells. The rack keeps
   landscape, where 16 steps across 288px is a mouse target, not a thumb one.
   ========================================================================= */
var DLNY = window.DLNY || (window.DLNY = {});

(function () {
  'use strict';
  var F = Chassis.fmt, pad = Chassis.pad;

  var TILES = [
    { k: 'silent',  c: '#151a24', label: 'rest'   },
    { k: 'rise',    c: '#5ad1c8', label: 'rise'   },
    { k: 'sustain', c: '#f2a65a', label: 'sustain'},
    { k: 'fall',    c: '#c86bfa', label: 'fall'   },
    { k: 'accent',  c: '#ff2a2a', label: 'accent' },
    { k: 'junction',c: '#4af626', label: 'fb junc'}
  ];
  var STEPDIV = ['1/16', '1/8T', '1/8', '1/4T', '1/4', '1/2', '1/1'];
  var FXDEF = { phaser:  ['Phaser',   'Rate', 0.05, 8, 0.4],
                ringmod: ['Ring Mod', 'Freq', 20, 2000, 220],
                grain:   ['Grain',    'Size', 20, 200, 80] };

  var S = {
    on: true, play: false, tab: 'MIX', engine: 'grain',
    cols: 16, lanes: 6, cells: [], lanesMeta: [], sel: 0, playCol: 0,
    brush: 2, rules: 'hand', entropy: 62,
    wet: 78, fb: 34, glide: 60, glen: 170,
    out: 100, tone: 78, bpm: 132, stepdiv: 0
  };

  function reseed() {
    S.cells = [];
    for (var i = 0; i < S.cols * S.lanes; i++) {
      S.cells.push(Math.random() < 0.52 ? 0 : 1 + Math.floor(Math.random() * (TILES.length - 1)));
    }
    S.lanesMeta = [];
    for (var l = 0; l < S.lanes; l++) {
      S.lanesMeta.push({ vol: 80 + Math.round(Math.random() * 20), mute: false, solo: false,
                         fx: [], i: l });
    }
    if (S.sel >= S.lanes) S.sel = 0;
  }
  function at(col, lane) { return S.cells[lane * S.cols + col]; }
  function put(col, lane, t) { S.cells[lane * S.cols + col] = t; }

  function laneLevel(l) {
    var meta = S.lanesMeta[l];
    if (!meta) return 0;
    var soloed = S.lanesMeta.some(function (m) { return m.solo; });
    if (meta.mute || (soloed && !meta.solo)) return 0;
    var live = at(S.playCol, l) !== 0 ? 1 : 0.18;
    return live * (meta.vol / 100);
  }

  /* Portrait puts steps on the long axis; landscape keeps them across. */
  function portrait(W, H) { return H > W; }
  function geom(W, H) {
    var p = portrait(W, H);
    var padL = 4, padT = 4;
    var across = p ? S.lanes : S.cols, down = p ? S.cols : S.lanes;
    return { p: p, padL: padL, padT: padT, across: across, down: down,
             cw: (W - padL * 2) / across, ch: (H - padT * 2) / down };
  }
  function cellAt(q, W, H) {
    var g = geom(W, H);
    var a = Math.floor((q.x * W - g.padL) / g.cw), d = Math.floor((q.y * H - g.padT) / g.ch);
    if (a < 0 || d < 0 || a >= g.across || d >= g.down) return null;
    return g.p ? { col: d, lane: a } : { col: a, lane: d };
  }

  function draw(g, W, H, s) {
    g.fillStyle = '#0c1018'; g.fillRect(0, 0, W, H);
    var G = geom(W, H);
    for (var col = 0; col < s.cols; col++) {
      for (var lane = 0; lane < s.lanes; lane++) {
        var a = G.p ? lane : col, d = G.p ? col : lane;
        var x = G.padL + a * G.cw, y = G.padT + d * G.ch;
        var t = TILES[at(col, lane)] || TILES[0];
        var meta = s.lanesMeta[lane];
        var soloed = s.lanesMeta.some(function (m) { return m.solo; });
        var dim = meta && (meta.mute || (soloed && !meta.solo));

        g.globalAlpha = (g.globalAlpha || 1);
        g.fillStyle = t.c;
        var old = g.globalAlpha;
        if (dim) g.globalAlpha = old * 0.25;
        g.fillRect(x + 1, y + 1, G.cw - 2, G.ch - 2);
        g.globalAlpha = old;

        if (lane === s.sel) {
          g.strokeStyle = 'rgba(234,234,234,.5)'; g.lineWidth = 1;
          g.strokeRect(x + 1.5, y + 1.5, G.cw - 3, G.ch - 3);
        }
      }
    }
    // playhead: a column in landscape, a row in portrait
    var ph = G.padL, pv = G.padT;
    g.fillStyle = 'rgba(255,42,42,.22)';
    g.strokeStyle = '#ff2a2a'; g.lineWidth = 1.5;
    if (G.p) {
      g.fillRect(ph, pv + s.playCol * G.ch, W - G.padL * 2, G.ch);
      g.strokeRect(ph, pv + s.playCol * G.ch, W - G.padL * 2, G.ch);
    } else {
      g.fillRect(ph + s.playCol * G.cw, pv, G.cw, H - G.padT * 2);
      g.strokeRect(ph + s.playCol * G.cw, pv, G.cw, H - G.padT * 2);
    }
  }

  var painting = null;
  function pointer(phase, q, s, api) {
    var cv = api.canvas, cell = cellAt(q, cv.width, cv.height);
    if (!cell) return;
    if (phase === 'down') { painting = s.brush; s.sel = cell.lane; put(cell.col, cell.lane, painting); api.render(); return; }
    if (phase === 'hold') { painting = 0; put(cell.col, cell.lane, 0); return; }   // hold = erase
    if (phase === 'move' || phase === 'holdmove') { if (painting != null) put(cell.col, cell.lane, painting); return; }
    if (phase === 'up') painting = null;
  }

  DLNY.wfc = {
    name: 'Collapse',
    meta: 'AUDIO FX · WFC-01',
    state: S,
    tabs: ['MIX', 'LVL', 'GRID', 'RULE', 'LANE', 'OUT'],

    transport: function (s) {
      return [
        { label: '▶', accent: true, on: s.play, tap: function () { s.play = !s.play; } },
        { label: 'GRN', on: s.engine === 'grain', title: 'Grain sequencer',
          tap: function () { s.engine = 'grain'; } },
        { label: 'GATE', on: s.engine === 'gate', title: 'Multitap gate',
          tap: function () { s.engine = 'gate'; } },
        { label: '⟐', title: 'Collapse', tap: function () { reseed(); } },
        { label: '↻', title: 'Re-seed', tap: function () { reseed(); } }
      ];
    },

    // Lane faders live in the LVL strips, which declare no controls.
    randomize: function (s) {
      return s.lanesMeta.map(function (m) {
        return { obj: m, key: 'vol', min: 0, max: 100 };
      });
    },

    // The tile map is the patch. Amount reads here as the share of cells that
    // get re-thrown — same distribution reseed() uses — so one knob nudges the
    // pattern and the mix together instead of the grid being all-or-nothing
    // behind the Collapse button. Grid size stays put: changing it reseeds.
    roll: function (s, amount, rand) {
      var moved = 0, i;
      for (i = 0; i < s.cells.length; i++) {
        if (rand() * 100 >= amount) continue;
        s.cells[i] = rand() < 0.52 ? 0 : 1 + Math.floor(rand() * (TILES.length - 1));
        moved++;
      }
      return moved;
    },

    pages: {
      MIX: {
        context: function () { return 'Master bus'; },
        controls: function (s) {
          return [
            { label: 'Dry/Wet',  obj: s, key: 'wet',   min: 0, max: 100, fmt: F.pct },
            { label: 'Feedback', obj: s, key: 'fb',    min: 0, max: 90,  fmt: F.pct },
            { label: 'Glide',    obj: s, key: 'glide', min: 0, max: 800, fmt: F.ms },
            { label: 'Grain',    obj: s, key: 'glen',  min: 40, max: 600, fmt: F.ms }
          ];
        }
      },
      LVL: {
        context: function (s) { return s.lanes + ' lanes'; },
        levelAt: function (i) { return laneLevel(i); },
        render: Chassis.strips({
          items: function (s) { return s.lanesMeta; },
          level: function (m, s) { return laneLevel(s.lanesMeta.indexOf(m)); },
          selected: function (s) { return s.sel; },
          select: function (i, s) { s.sel = i; }
        })
      },
      GRID: {
        context: function (s) { return s.cols + ' × ' + s.lanes + ' · ' + STEPDIV[s.stepdiv]; },
        controls: function (s) {
          return [
            { label: 'Steps', obj: s, key: 'cols',  min: 8, max: 32, fmt: F.raw,
              commit: 'change', onInput: function () { reseed(); } },
            { label: 'Lanes', obj: s, key: 'lanes', min: 3, max: 8,  fmt: F.raw,
              commit: 'change', onInput: function () { reseed(); } },
            { label: 'Step',  obj: s, key: 'stepdiv', min: 0, max: 6, fmt: F.list(STEPDIV) },
            { label: 'Tempo', obj: s, key: 'bpm',   min: 40, max: 220, fmt: F.raw }
          ];
        }
      },
      RULE: {
        context: function (s) { return s.rules === 'hand' ? 'Hand-written' : 'Learned'; },
        controls: function (s) {
          return [
            { label: 'Entropy', obj: s, key: 'entropy', min: 0, max: 100, fmt: F.pct },
            { label: 'Brush',   obj: s, key: 'brush', min: 0, max: TILES.length - 1,
              fmt: F.list(TILES.map(function (t) { return t.label; })) }
          ];
        }
      },
      LANE: {
        context: function (s) {
          var n = s.lanesMeta[s.sel] ? s.lanesMeta[s.sel].fx.length : 0;
          return 'Lane ' + pad(s.sel) + ' · ' + (n || 'no') + ' insert' + (n === 1 ? '' : 's');
        },
        render: Chassis.rack(FXDEF, {
          owner: function (s) { return s.lanesMeta[s.sel]; },
          emptyText: function (s) { return 'Nothing inserted on lane ' + pad(s.sel) + ' yet.'; }
        })
      },
      OUT: {
        context: function () { return 'Device out'; },
        controls: function (s) {
          return [
            { label: 'Output', obj: s, key: 'out',  min: 0, max: 150, fmt: F.pct },
            { label: 'Tone',   obj: s, key: 'tone', min: 0, max: 100, fmt: F.pct }
          ];
        }
      }
    },

    draw: draw,
    pointer: pointer,

    readout: function (s) {
      return 'step <b>' + pad(s.playCol) + '/' + s.cols + '</b> · lane <b>' + pad(s.sel) +
             '</b> · <i>' + (TILES[at(s.playCol, s.sel)] || TILES[0]).label + '</i> · ' +
             STEPDIV[s.stepdiv] + ' @ ' + s.bpm;
    },

    tick: function (s, seconds) {
      if (!s.play) return false;
      var col = Math.floor(seconds * (s.bpm / 60) * 4) % s.cols;
      if (col === s.playCol) return false;
      s.playCol = col;
      return true;
    },

    _internals: { at: at, put: put, reseed: reseed, geom: geom, cellAt: cellAt,
                  laneLevel: laneLevel, TILES: TILES }
  };

  reseed();
})();
