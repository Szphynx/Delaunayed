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
    master: 80, dry: 70, wet: 85,
    // live
    t: 0, w: 0, hold: null, nodes: [], dirty: true
  };

  function params(s) {
    return { branch: s.branch, angle: s.angle, ratio: s.ratio, decay: s.decay,
             baseLen: s.baseLen, maxDepth: s.maxDepth, centsPerDeg: s.centsPerDeg,
             key: KEYS[s.keyIdx], rootSemi: s.rootSemi,
             windAmount: s.windAmount, windRate: s.windRate, gust: s.gust };
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
    tabs: ['TREE', 'TIME', 'KEY', 'WIND', 'OUT'],

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
            { label: 'Trunk', obj: s, key: 'baseLen', min: 0.05, max: 0.7, step: 0.01,
              fmt: function (v) { return Math.round(v * 1000) + 'ms'; } },
            { label: 'Ratio', obj: s, key: 'ratio', min: 0.4, max: 0.98, step: 0.01,
              fmt: function (v) { return (+v).toFixed(2); } },
            { label: 'Decay', obj: s, key: 'decay', min: 0.4, max: 0.92, step: 0.01,
              fmt: function (v) { return (+v).toFixed(2); } },
            { label: 'Tone', obj: s, key: 'tone', min: 400, max: 16000, step: 100, fmt: F.hz }
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
            { label: 'Gust', obj: s, key: 'gust', min: 0, max: 1, step: 0.01, fmt: function (v) { return Math.round(v * 100) + '%'; } }
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
            { label: 'Wet', obj: s, key: 'wet', min: 0, max: 100, fmt: F.pct }
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
      s.t = seconds;
      var w = s.hold == null ? LSystem.wind(seconds, params(s)) : s.hold * 1.6;
      if (!s.dirty && Math.abs(w - s.w) < 0.002) { s.w = w; return true; }
      s.w = w;
      s.nodes = LSystem.grow(params(s), w);
      s.dirty = false;
      return true;
    },

    draw: function (ctx, W, H, s) {
      if (!s.nodes.length) s.nodes = LSystem.grow(params(s), 0);
      TreeTravel.paint(ctx, W, H, s.nodes, (s.t * 0.3) % (TreeTravel.span(s.nodes) + 1.2),
                       { labels: W > 320 });
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
