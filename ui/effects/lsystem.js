/* L-system Branching Delay Tree, as a chassis spec.
 *
 * The tree is regrown every tick from the wind field, so `s.nodes` is always
 * the current shape — the engine in prototypes/lsystem_chassis.html reads that
 * same array and writes it into its voices. Geometry stays in the grower's own
 * units; TreeTravel.paint fits it to whichever body is drawing.
 */
var DLNY = window.DLNY || (window.DLNY = {});

(function () {
  var F = Chassis.fmt;
  var KEYS = Object.keys(LSystem.KEYS);
  var FACTORY = [
    ['Cathedral',    { key:'minor_pentatonic', angle:34, ratio:0.88, decay:0.82, baseLen:0.45, branch:2, maxDepth:4, windAmount:0.35, windRate:0.10, gust:0.5 }],
    ['Drone Web',    { key:'natural_minor',    angle:20, ratio:0.95, decay:0.88, baseLen:0.50, branch:2, maxDepth:4, windAmount:0.60, windRate:0.06, gust:0.7 }],
    ['Koto Rain',    { key:'hirajoshi',        angle:26, ratio:0.70, decay:0.74, baseLen:0.22, branch:3, maxDepth:3, windAmount:0.50, windRate:0.30, gust:0.4 }],
    ['Hijaz Veil',   { key:'hijaz',            angle:40, ratio:0.90, decay:0.80, baseLen:0.30, branch:2, maxDepth:4, windAmount:0.45, windRate:0.14, gust:0.6 }],
    ['Fifths',       { key:'fifths',           angle:44, ratio:0.92, decay:0.84, baseLen:0.38, branch:2, maxDepth:4, windAmount:0.30, windRate:0.09, gust:0.3 }],
    ['Storm',        { key:'phrygian',         angle:30, ratio:0.86, decay:0.80, baseLen:0.35, branch:2, maxDepth:4, windAmount:1.60, windRate:0.50, gust:0.9 }],
    ['Still Air',    { key:'minor_pentatonic', angle:34, ratio:0.88, decay:0.82, baseLen:0.45, branch:2, maxDepth:4, windAmount:0,    windRate:0.10, gust:0 }]
  ];

  /* ---- user presets: saved to this browser, kept alongside the factory set
     rather than replacing it. A missing or corrupt store is just an empty
     list — nothing here is load-bearing for the device to work. */
  var USER_KEY = 'dlny.lsystem.userPresets';
  var userPresets = (function () {
    try { return JSON.parse(window.localStorage.getItem(USER_KEY)) || []; }
    catch (e) { return []; }
  })();
  function persistUser() {
    try { window.localStorage.setItem(USER_KEY, JSON.stringify(userPresets)); } catch (e) {}
  }
  function presetAt(idx) {
    if (idx < FACTORY.length) return { name: FACTORY[idx][0], params: FACTORY[idx][1] };
    var u = userPresets[idx - FACTORY.length];
    return u ? { name: u.name, params: u.params } : { name: '—', params: {} };
  }
  function presetGroups() {
    var g = [{ label: 'Factory Presets', options: FACTORY.map(function (p, i) {
      return { value: i, label: p[0] }; }) }];
    if (userPresets.length) g.push({ label: 'User Presets', options: userPresets.map(function (u, i) {
      return { value: FACTORY.length + i, label: u.name }; }) });
    return g;
  }

  var S = {
    on: true, play: false, tab: 'TREE',
    preset: 0,
    branch: 2, maxDepth: 4, angle: 34, ratio: 0.88,
    baseLen: 0.45, decay: 0.82, tone: 6500, spread: 100,
    keyIdx: KEYS.indexOf('minor_pentatonic'), rootSemi: 0, centsPerDeg: 8,
    windAmount: 0.35, windRate: 0.10, gust: 0.5,
    master: 80, dry: 70, wet: 85, feedback: 0,
    // experimental — default to 0, a hard no-op: nothing about an existing
    // preset changes until one of these is turned up by hand. Family Hue is
    // the one exception (defaults on) -- proven enough to want as the normal
    // look, while staying a toggle here rather than a permanent behavior.
    speed: 0, hueRoot: 1, audioReact: 0, levels: [], flowField: 0,
    gusts: [], gustTimer: 0,
    // live
    t: 0, w: 0, hold: null, nodes: [], dirty: true
  };

  function params(s) {
    return { branch: s.branch, angle: s.angle, ratio: s.ratio, decay: s.decay,
             baseLen: s.baseLen, maxDepth: s.maxDepth, centsPerDeg: s.centsPerDeg,
             key: KEYS[s.keyIdx], rootSemi: s.rootSemi,
             windAmount: s.windAmount, windRate: s.windRate, gust: s.gust,
             flowField: s.flowField };
  }

  // Flow Field (EXP): arrows only in a small cluster around each gust's
  // CURRENT head, not a grid across the whole tree -- the field is only
  // shown where the traveling line/arrow actually is right now, so it reads
  // as local turbulence around the gust rather than wallpaper. No gusts (no
  // real wind in the area, per updateGusts' own gate) means no arrows at
  // all. Plain {x,y,fx,fy,m} numbers, so TreeTravel never needs to know
  // LSystem exists (see its own comment on this).
  var FLOW_RADIUS = 55;
  // The cluster's own outer edge (a corner sample is sqrt(2) radii out) is
  // where it fades to nothing, tapering over the outer 20% of that edge
  // distance -- full strength near the gust, gone by the boundary, instead
  // of a hard-edged box of arrows around it.
  var FLOW_EDGE = Math.SQRT2 * FLOW_RADIUS;
  function flowGrid(gusts, t) {
    var out = [];
    (gusts || []).forEach(function (g) {
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          var x = g.x + dx * FLOW_RADIUS, y = g.y + dy * FLOW_RADIUS;
          var fl = LSystem.flow(x, y, t), m = Math.hypot(fl.fx, fl.fy);
          if (m < 0.1) continue;
          var frac = Math.hypot(dx, dy) * FLOW_RADIUS / FLOW_EDGE;
          var fade = frac <= 0.8 ? 1 : Math.max(0, 1 - (frac - 0.8) / 0.2);
          if (fade <= 0) continue;
          out.push({ x: x, y: y, fx: fl.fx, fy: fl.fy, m: m * fade });
        }
      }
    });
    return out;
  }

  // Gusts: a couple of traveling streaks, not a static grid, so "the rush of
  // wind" reads as something passing THROUGH the space rather than a fixed
  // decoration. Each one is a point advected by LSystem.flow() itself (so it
  // literally traces a streamline of the same field the arrows show), with a
  // short trailing path for the line and an age that kills it -- no physics
  // engine, just position += velocity * dt against the one field function
  // that already exists.
  var MAX_GUSTS = 2, GUST_LIFE = 2.2, GUST_STEP = 70, GUST_TRAIL = 16;
  function spawnGust(nodes, t) {
    var xs = nodes.map(function (n) { return n.x; }).concat([0]);
    var ys = nodes.map(function (n) { return n.y; }).concat([0]);
    var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs);
    var miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
    // 6 random candidates, keep the windiest -- a gust starts where the
    // field is actually strong, not anywhere in the box.
    var best = null, bestM = -1;
    for (var i = 0; i < 6; i++) {
      var x = minx + Math.random() * (maxx - minx), y = miny + Math.random() * (maxy - miny);
      var fl = LSystem.flow(x, y, t), m = Math.hypot(fl.fx, fl.fy);
      if (m > bestM) { bestM = m; best = { x: x, y: y }; }
    }
    return { x: best.x, y: best.y, age: 0, path: [] };
  }
  function updateGusts(s, p, t, dt, w) {
    s.gusts = s.gusts || [];
    // "Only when there's wind in the area": gate spawning on the same
    // engagement the arrows use (how hard the global field is blowing right
    // now), not just on the toggle being on -- Still Air (windAmount 0)
    // stays gust-free even with Flow Field switched on.
    var engagement = Math.min(1, Math.abs(w) * p.windAmount);
    s.gustTimer = (s.gustTimer == null ? 0 : s.gustTimer) - dt;
    if (engagement > 0.12 && s.gusts.length < MAX_GUSTS && s.gustTimer <= 0 && s.nodes.length) {
      s.gusts.push(spawnGust(s.nodes, t));
      s.gustTimer = 1.1 + Math.random() * 1.6;
    }
    s.gusts.forEach(function (g) {
      var fl = LSystem.flow(g.x, g.y, t);
      g.x += fl.fx * GUST_STEP * dt;
      g.y += fl.fy * GUST_STEP * dt;
      g.age += dt;
      g.path.push({ x: g.x, y: g.y });
      if (g.path.length > GUST_TRAIL) g.path.shift();
    });
    s.gusts = s.gusts.filter(function (g) { return g.age < GUST_LIFE; });
  }

  function applyPreset(s) {
    var p = presetAt(s.preset).params;
    Object.keys(p).forEach(function (k) {
      if (k === 'key') s.keyIdx = KEYS.indexOf(p.key);
      else s[k] = p[k];
    });
    s.dirty = true;
  }

  DLNY.lsystem = {
    name: 'Tree',
    meta: 'AUDIO FX · LSY-01',
    state: S,
    tabs: ['TREE', 'TIME', 'KEY', 'WIND', 'OUT', 'EXP'],

    transport: function (s) {
      return [
        { label: '▶', accent: true, on: s.play, tap: function () { s.play = !s.play; } },
        { label: 'CALM', on: s.windAmount === 0, title: 'still the wind',
          tap: function (st) { st.windAmount = st.windAmount ? 0 : 0.45; } },
        { label: 'SAVE', title: 'save the current tree as a user preset',
          tap: function (st) {
            var name = window.prompt('Save preset as:', presetAt(st.preset).name + ' copy');
            if (!name) return;
            userPresets.push({ name: name, params: params(st) });
            persistUser();
            st.preset = FACTORY.length + userPresets.length - 1;
          } }
      ];
    },

    pages: {
      TREE: {
        context: function (s) { return presetAt(s.preset).name; },
        controls: function (s) {
          return [
            { label: 'Preset', type: 'select', obj: s, key: 'preset',
              min: 0, max: FACTORY.length + userPresets.length - 1,
              groups: presetGroups(), commit: 'change',
              onInput: function () { applyPreset(s); } },
            { label: 'Children', obj: s, key: 'branch', min: 1, max: 3, commit: 'change',
              onInput: function () { s.dirty = true; } },
            { label: 'Depth', obj: s, key: 'maxDepth', min: 1, max: 5, commit: 'change',
              onInput: function () { s.dirty = true; } },
            { label: 'Angle', obj: s, key: 'angle', min: 6, max: 60, fmt: function (v) { return v + '°'; } }
          ];
        }
      },
      TIME: {
        context: function (s) {
          return s.nodes.length ? s.nodes.length + ' nodes · ' +
            TreeTravel.span(s.nodes).toFixed(2) + ' s' : 'growing';
        },
        controls: function (s) {
          return [
            // Trunk is also the pre-delay: the very first tap's time is
            // exactly baseLen (n.t at depth 0 = baseLen * ratio^0). 0.05
            // (50ms) used to be the floor, so a hit could never land closer
            // than that -- Decay doesn't touch it, since Decay is gain per
            // depth, not time. Down to 2ms now, close enough to feel attached
            // to the transient rather than a fixed slapback.
            { label: 'Trunk', obj: s, key: 'baseLen', min: 0.002, max: 0.7, step: 0.002,
              fmt: function (v) { return Math.round(v * 1000) + 'ms'; } },
            { label: 'Ratio', obj: s, key: 'ratio', min: 0.4, max: 0.98, step: 0.01,
              fmt: function (v) { return (+v).toFixed(2); } },
            { label: 'Decay', obj: s, key: 'decay', min: 0.4, max: 0.92, step: 0.01,
              fmt: function (v) { return (+v).toFixed(2); } },
            // Graduated out of EXP: the 0.85 hard ceiling (see build() in the
            // engine) keeps it safe at every Decay setting, so it no longer
            // needs the "unproven" page to sit on.
            { label: 'Feedback', obj: s, key: 'feedback', min: 0, max: 90, fmt: F.pct }
          ];
        }
      },
      KEY: {
        context: function (s) { return KEYS[s.keyIdx].replace(/_/g, ' '); },
        controls: function (s) {
          return [
            { label: 'Scale', obj: s, key: 'keyIdx', min: 0, max: KEYS.length - 1,
              fmt: F.list(KEYS.map(function (k) { return k.slice(0, 6); })) },
            { label: 'Root', obj: s, key: 'rootSemi', min: -12, max: 12,
              fmt: function (v) { return LSystem.noteName(+v + 12).replace(/\d/, ''); } },
            { label: 'Spread', obj: s, key: 'centsPerDeg', min: 2, max: 24,
              fmt: function (v) { return v + '¢/°'; } },
            { label: 'Width', obj: s, key: 'spread', min: 0, max: 100, fmt: F.pct }
          ];
        }
      },
      WIND: {
        context: function (s) { return s.hold == null ? 'field' : 'hand on the tree'; },
        controls: function (s) {
          return [
            { label: 'Amount', obj: s, key: 'windAmount', min: 0, max: 2, step: 0.01,
              fmt: function (v) { return (+v).toFixed(2); } },
            { label: 'Rate', obj: s, key: 'windRate', min: 0.02, max: 1.2, step: 0.01,
              fmt: function (v) { return (+v).toFixed(2) + 'Hz'; } },
            { label: 'Gust', obj: s, key: 'gust', min: 0, max: 1, step: 0.01, fmt: function (v) { return Math.round(v * 100) + '%'; } },
            // wind() is one number shared by the whole tree at any instant
            // (bent per-depth, never per-location); Flow Field is what
            // actually varies wind BY WHERE a branch sits, so it lives here
            // with the rest of wind rather than off in EXP.
            { label: 'Flow Field', obj: s, key: 'flowField', min: 0, max: 1, step: 1,
              fmt: function (v) { return v ? 'On' : 'Off'; } }
          ];
        }
      },
      EXP: {
        // Untested ideas live here, not in TREE/TIME/WIND, so trying one can
        // never quietly change what a saved preset sounds like — every
        // control on this page defaults to a no-op and stays one until it's
        // turned up by hand (Family Hue is the exception: it starts on, see
        // its own state comment).
        context: function () { return 'unproven'; },
        controls: function (s) {
          return [
            { label: 'Speed', obj: s, key: 'speed', min: 0, max: 100, fmt: F.pct },
            { label: 'Family Hue', obj: s, key: 'hueRoot', min: 0, max: 1, step: 1,
              fmt: function (v) { return v ? 'On' : 'Off'; } },
            // Off (default) costs nothing extra: the chassis never reads the
            // per-voice analysers it already keeps running. Level is the raw
            // per-frame peak (jittery, exact). Envelope runs that peak through
            // a fast-attack/slow-release follower instead -- the dots snap up
            // on a transient and decay after it, a peak-hold meter rather
            // than a twitchy one. Either way draw() reads s.levels, written
            // every frame by the audio engine; this spec stays audio-agnostic.
            { label: 'Audio React', obj: s, key: 'audioReact', min: 0, max: 2, step: 1,
              fmt: function (v) { return ['Off', 'Level', 'Envelope'][v]; } }
          ];
        }
      },
      OUT: {
        // Master leads: it is the loudest control on the device and the one a
        // player reaches for without thinking, so it goes first in the page a
        // player already reaches for by name.
        context: function () { return 'Master bus'; },
        controls: function (s) {
          return [
            { label: 'Master', obj: s, key: 'master', min: 0, max: 100, fmt: F.pct },
            { label: 'Dry', obj: s, key: 'dry', min: 0, max: 100, fmt: F.pct },
            { label: 'Wet', obj: s, key: 'wet', min: 0, max: 100, fmt: F.pct },
            { label: 'Tone', obj: s, key: 'tone', min: 400, max: 16000, step: 100, fmt: F.hz }
          ];
        }
      }
    },

    /* Drag anywhere on the tree to put your hand on it: the horizontal
       position becomes the wind while you hold, and the field takes back over
       when you let go. It is the one gesture that explains the whole device. */
    pointer: function (phase, q, s) {
      if (phase === 'up') { s.hold = null; return; }
      s.hold = (q.x - 0.5) * 2;
      s.dirty = true;
    },

    tick: function (s, seconds) {
      var dt = Math.max(0, Math.min(0.1, seconds - s.t));
      s.t = seconds;
      var w = s.hold == null ? LSystem.wind(seconds, params(s)) : s.hold * 1.6;
      var p = params(s);
      // Gusts advect (and spawn/die) every frame regardless of whether the
      // tree itself needs regrowing below -- they're drawn, not modelled,
      // so nothing about the tree's own state should gate them.
      if (p.flowField) updateGusts(s, p, seconds, dt, w);
      // The wind-delta check alone used to be the only reason to regrow, so
      // moving a non-structural knob (Trunk, Ratio, Decay, Angle, Tone,
      // Scale, Root, Spread, Width) only took visible/audible effect once
      // the wind next happened to drift -- on a calm preset (Amount near 0)
      // that could be seconds away, or never. A cheap signature of every
      // param regrow() reads catches a real change immediately; the wind
      // check on top of it is still what keeps a still knob from regrowing
      // 60 times a second for no reason while the wind sways on its own.
      var sig = p.branch + '|' + p.angle + '|' + p.ratio + '|' + p.decay + '|' +
        p.baseLen + '|' + p.maxDepth + '|' + p.centsPerDeg + '|' + p.key + '|' +
        p.rootSemi + '|' + p.windAmount + '|' + p.windRate + '|' + p.gust + '|' + p.flowField;
      // Flow Field ties bend to wallT directly (see LSystem.flow), not just
      // to how much w has drifted, so the wind-delta shortcut below would
      // freeze it between w's own updates. Skip the shortcut while it's on.
      if (!p.flowField && !s.dirty && sig === s.paramSig && Math.abs(w - s.w) < 0.002) {
        s.w = w; return true;
      }
      s.paramSig = sig;
      s.w = w;
      s.nodes = LSystem.grow(p, w, seconds);
      s.dirty = false;
      return true;
    },

    draw: function (ctx, W, H, s) {
      if (!s.nodes.length) s.nodes = LSystem.grow(params(s), 0);
      TreeTravel.paint(ctx, W, H, s.nodes, (s.t * 0.3) % (TreeTravel.span(s.nodes) + 1.2),
                       { labels: W > 320, familyHue: !!s.hueRoot, rootSemi: s.rootSemi,
                         levels: s.audioReact ? s.levels : null,
                         flowArrows: s.flowField ? flowGrid(s.gusts, s.t) : null,
                         gusts: s.flowField ? s.gusts : null, gustLife: GUST_LIFE });
    },

    // Master sits in every readout, not just the OUT page — the one thing on
    // this device that stays visible no matter which tab is open.
    readout: function (s) {
      var tip = s.nodes[s.nodes.length - 1];
      return 'wind <b>' + s.w.toFixed(2) + '</b> · bend <b>' +
        (tip ? tip.bend.toFixed(0) : 0) + '°</b> · tip <b>' + (tip ? tip.note : '—') +
        '</b> · <b>' + s.nodes.length + '</b> voices · master <b>' + s.master + '%</b>';
    }
  };
})();
