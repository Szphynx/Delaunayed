/* Self-check for the chassis logic that fails silently.
 *
 *   node ui/test_chassis.js
 *
 * DOM assembly isn't tested — that throws loudly in the browser the first time
 * you open index.html. What's tested is the part that would quietly render the
 * wrong number: formatters, control binding, page/tab resolution, and the two
 * geometry invariants the effects depend on.
 */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = { localStorage: { getItem: () => null, setItem: () => {} } };
global.Chassis = require('./chassis.js');
require('./effects/delaunay.js');
require('./effects/wfc.js');
global.LSystem = require('./lsystem.js');
global.TreeTravel = require('./tree-travel.js');
require('./effects/lsystem.js');

const { fmt, pad } = global.Chassis;
const D = global.window.DLNY.delaunay;
const W = global.window.DLNY.wfc;
const L = global.window.DLNY.lsystem;
let n = 0;
const check = (name, fn) => { fn(); n++; process.stdout.write('  ok  ' + name + '\n'); };

/* ---------- formatters ---------- */
check('fmt.hz thousands', () => {
  assert.strictEqual(fmt.hz(800), '800');
  assert.strictEqual(fmt.hz(18000), '18.0k');
  assert.strictEqual(fmt.hz(1000), '1.0k');
});
check('fmt.pan centre and sides', () => {
  assert.strictEqual(fmt.pan(0), 'C');
  assert.strictEqual(fmt.pan(-40), 'L40');
  assert.strictEqual(fmt.pan(40), 'R40');
});
check('fmt.list maps index to label, passes through out of range', () => {
  const f = fmt.list(['a', 'b', 'c']);
  assert.strictEqual(f(0), 'a');
  assert.strictEqual(f(2), 'c');
  assert.strictEqual(f(9), 9);
});
check('pad', () => { assert.strictEqual(pad(3), '03'); assert.strictEqual(pad(12), '12'); });

/* ---------- spec shape: every tab must resolve to a page ---------- */
for (const [label, spec] of [['delaunay', D], ['wfc', W], ['lsystem', L]]) {
  check(label + ': every tab has a page', () => {
    spec.tabs.forEach(t => assert.ok(spec.pages[t], 'no page for tab ' + t));
  });
  check(label + ': every page renders or lists controls', () => {
    spec.tabs.forEach(t => {
      const p = spec.pages[t];
      assert.ok(p.render || p.controls, t + ' has neither render nor controls');
    });
  });
  check(label + ': control descriptors are bound and in range', () => {
    spec.tabs.forEach(t => {
      const p = spec.pages[t];
      if (!p.controls) return;
      p.controls(spec.state).forEach(c => {
        assert.ok(c.obj && c.key in c.obj, t + '/' + c.label + ' is not bound to a state key');
        assert.strictEqual(typeof c.obj[c.key], 'number', t + '/' + c.label + ' is not numeric');
        assert.ok(c.min < c.max, t + '/' + c.label + ' has min >= max');
        assert.ok(c.obj[c.key] >= c.min && c.obj[c.key] <= c.max,
          t + '/' + c.label + ' starts outside [' + c.min + ',' + c.max + ']: ' + c.obj[c.key]);
        assert.ok(Number.isFinite(Number(String((c.fmt || fmt.raw)(c.obj[c.key])).replace(/[^\d.-]/g, '')))
          || typeof (c.fmt || fmt.raw)(c.obj[c.key]) === 'string');
      });
    });
  });
  check(label + ': a control set never overflows the rack 2x2 grid', () => {
    spec.tabs.forEach(t => {
      const p = spec.pages[t];
      if (!p.controls) return;
      assert.ok(p.controls(spec.state).length <= 4,
        t + ' has ' + p.controls(spec.state).length + ' controls; the rack grid fits 4');
    });
  });
  check(label + ': readout and page contexts are strings', () => {
    assert.strictEqual(typeof spec.readout(spec.state), 'string');
    spec.tabs.forEach(t => {
      const c = spec.pages[t].context;
      if (c) assert.strictEqual(typeof c(spec.state), 'string', t + ' context is not a string');
    });
  });
  check(label + ': commit:"change" on every control that resizes the element list', () => {
    spec.tabs.forEach(t => {
      const p = spec.pages[t];
      if (!p.controls) return;
      p.controls(spec.state).forEach(c => {
        // onInput that rebuilds must not fire per input event, or it destroys
        // the slider mid-drag. This is the bug the mockup shipped with once.
        if (c.onInput) assert.strictEqual(c.commit, 'change',
          t + '/' + c.label + ' has onInput without commit:"change"');
      });
    });
  });
}

/* ---------- delaunay: the two invariants the morph depends on ---------- */
check('delaunay: triangulation is empty-circumcircle valid', () => {
  const { delaunay } = D._internals;
  for (let trial = 0; trial < 60; trial++) {
    const pts = [];
    for (let i = 0; i < 4 + Math.floor(Math.random() * 14); i++) {
      pts.push({ x: Math.random(), y: Math.random(), i });
    }
    const tris = delaunay(pts);
    for (const t of tris) {
      // circumcircle of each triangle must contain no other site
      const [a, b, c] = t;
      const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      if (Math.abs(d) < 1e-12) continue;
      const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
      const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
      const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
      const r2 = (a.x - ux) ** 2 + (a.y - uy) ** 2;
      for (const p of pts) {
        if (p === a || p === b || p === c) continue;
        assert.ok((p.x - ux) ** 2 + (p.y - uy) ** 2 >= r2 - 1e-9,
          'site inside a circumcircle — triangulation is not Delaunay');
      }
    }
  }
});
check('delaunay: barycentric gains sum to 1 and stay in [0,1]', () => {
  const { regen, solve, weightOf } = D._internals;
  for (let trial = 0; trial < 40; trial++) {
    regen(4 + Math.floor(Math.random() * 12));
    D.state.head = { x: Math.random(), y: Math.random() };
    solve();
    const sum = D.state.w.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6, 'weights sum to ' + sum);
    D.state.w.forEach(v => assert.ok(v >= 0 && v <= 1, 'weight out of [0,1]: ' + v));
    D.state.pts.forEach(p => {
      const w = weightOf(p);
      assert.ok(Number.isFinite(w) && w >= 0 && w <= 1, 'gain out of range: ' + w);
    });
  }
});
check('delaunay: sites stay normalized so both chassis can share them', () => {
  D._internals.regen(14);
  D.state.pts.forEach(p => {
    assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1,
      'site outside [0,1] — it will clip in one of the two bodies');
  });
});

check('delaunay: divSec maps divisions to seconds and scales with tempo', () => {
  const { divSec, DIVS, DIV_BEATS } = D._internals;
  assert.strictEqual(DIVS.length, DIV_BEATS.length, 'labels and beats out of step');
  // a 1/4 at 120bpm is half a second, by definition
  assert.ok(Math.abs(divSec(DIVS.indexOf('1/4'), 120, 1) - 0.5) < 1e-9);
  assert.ok(Math.abs(divSec(DIVS.indexOf('1/8'), 120, 1) - 0.25) < 1e-9);
  assert.ok(Math.abs(divSec(DIVS.indexOf('1/1'), 120, 1) - 2) < 1e-9);
  // triplet is two thirds of the straight division above it
  assert.ok(Math.abs(divSec(DIVS.indexOf('1/4T'), 120, 1) / divSec(DIVS.indexOf('1/4'), 120, 1) - 2 / 3) < 1e-9);
  // dotted is one and a half
  assert.ok(Math.abs(divSec(DIVS.indexOf('1/8.'), 120, 1) / divSec(DIVS.indexOf('1/8'), 120, 1) - 1.5) < 1e-9);
  // the Time feel is a straight multiplier, and halving tempo doubles the time
  assert.ok(Math.abs(divSec(3, 120, 2) - divSec(3, 60, 1)) < 1e-9);
  // every division must stay inside a WebAudio DelayNode's declared maxDelayTime
  DIVS.forEach((_, i) => {
    assert.ok(divSec(i, 40, 2) <= 12,
      DIVS[i] + ' at 40bpm x2 is ' + divSec(i, 40, 2).toFixed(2) + 's; allocate a longer DelayNode');
  });
});

check('delaunay: picking a node reveals its parameters', () => {
  const { regen, pointer, NODE_TABS } = D._internals;
  const api = { render() {}, paint() {}, canvas: { width: 390, height: 352 } };
  regen(12);
  const target = D.state.pts[5];
  const q = () => ({ x: target.x, y: target.y, aspect: 1 });

  // from a page that says nothing about the node, jump to its parameters
  for (const from of ['MIX', 'LVL', 'FRZ', 'OUT']) {
    D.state.tab = from;
    D.state.sel = 0;
    pointer('down', q(), D.state, api);
    pointer('up', q(), D.state, api);
    assert.strictEqual(D.state.sel, 5, 'picking from ' + from + ' did not select the node');
    assert.strictEqual(D.state.tab, 'TAP', 'picking from ' + from + ' left the parameters hidden');
  }

  // already on a node-scoped page: change the selection, stay where you are
  for (const from of NODE_TABS) {
    D.state.tab = from;
    D.state.sel = 0;
    pointer('down', q(), D.state, api);
    pointer('up', q(), D.state, api);
    assert.strictEqual(D.state.sel, 5, from + ' did not re-select');
    assert.strictEqual(D.state.tab, from, from + ' was yanked away mid-edit');
  }

  // right-click / long-press reaches the editor too — the README's contract
  D.state.tab = 'MIX'; D.state.sel = 0;
  pointer('hold', q(), D.state, api);
  pointer('up', q(), D.state, api);
  assert.strictEqual(D.state.tab, 'TAP', 'hold did not reveal the node editor');
  assert.strictEqual(D.state.sel, 5, 'hold did not select the node');

  // empty space still drives the playhead and must not change page
  D.state.tab = 'MIX';
  pointer('down', { x: 0.995, y: 0.005, aspect: 1 }, D.state, api);
  pointer('up', { x: 0.995, y: 0.005, aspect: 1 }, D.state, api);
  assert.strictEqual(D.state.tab, 'MIX', 'dragging the playhead should not change page');
});

check('delaunay: hold-drag edits time vertically and feedback horizontally', () => {
  const { regen, pointer } = D._internals;
  const api = { render() {}, paint() {}, canvas: { width: 390, height: 352 } };
  regen(12);
  const t = D.state.pts[4];
  t.div = 5; t.fb = 40;
  const at = (dx, dy) => ({ x: t.x + dx, y: t.y + dy, aspect: 1, shift: false });

  pointer('down', at(0, 0), D.state, api);
  pointer('hold', at(0, 0), D.state, api);
  assert.strictEqual(D.state.editing, 4, 'hold did not mark the node as being edited');

  // drag UP => longer division; feedback untouched on a pure vertical drag
  pointer('holdmove', at(0, -0.10), D.state, api);
  assert.ok(t.div > 5, 'dragging up should lengthen the division, got ' + t.div);
  assert.strictEqual(t.fb, 40, 'a vertical drag must not move feedback');

  // drag DOWN past the start => shorter, and it clamps at the bottom
  pointer('holdmove', at(0, 0.9), D.state, api);
  assert.strictEqual(t.div, 0, 'division should clamp at the shortest, got ' + t.div);

  // drag RIGHT => more feedback; division holds because the drag is relative
  // to the grab point, not accumulated
  pointer('holdmove', at(0.20, 0), D.state, api);
  assert.ok(t.fb > 40, 'dragging right should raise feedback, got ' + t.fb);
  assert.strictEqual(t.div, 5, 'a horizontal drag must not move the division');

  // both axes clamp inside the ranges the TAP page declares
  pointer('holdmove', at(-0.9, 0.9), D.state, api);
  assert.strictEqual(t.fb, 0, 'feedback should clamp at 0, got ' + t.fb);
  pointer('holdmove', at(0.9, -0.9), D.state, api);
  assert.strictEqual(t.fb, 90, 'feedback should clamp at 90, got ' + t.fb);
  assert.strictEqual(t.div, 11, 'division should clamp at 11, got ' + t.div);

  pointer('up', at(0, 0), D.state, api);
  assert.strictEqual(D.state.editing, null, 'editing flag leaked past pointerup');
});

check('delaunay: shift-drag still repositions and re-triangulates', () => {
  const { regen, pointer } = D._internals;
  const api = { render() {}, paint() {}, canvas: { width: 390, height: 352 } };
  regen(10);
  const t = D.state.pts[2];
  const before = { x: t.x, y: t.y, div: t.div, fb: t.fb };
  pointer('down', { x: t.x, y: t.y, aspect: 1, shift: true }, D.state, api);
  pointer('move', { x: 0.71, y: 0.29, aspect: 1, shift: true }, D.state, api);
  pointer('up', { x: 0.71, y: 0.29, aspect: 1, shift: true }, D.state, api);
  assert.ok(Math.abs(t.x - 0.71) < 1e-9 && Math.abs(t.y - 0.29) < 1e-9, 'node did not move');
  assert.ok(t.x !== before.x || t.y !== before.y, 'position unchanged');
  assert.strictEqual(t.div, before.div, 'repositioning must not edit the division');
  assert.strictEqual(t.fb, before.fb, 'repositioning must not edit feedback');
  assert.ok(D.state.tris.length > 0, 'mesh was not rebuilt after the move');
});

check('delaunay: every tap carries a pitch the TAP page can reach', () => {
  D._internals.regen(14);
  D.state.pts.forEach((p, i) => {
    assert.strictEqual(typeof p.pitch, 'number', 'tap ' + i + ' has no pitch');
  });
  D.state.sel = 3;
  const labels = D.pages.TAP.controls(D.state).map(c => c.label);
  assert.deepStrictEqual(labels, ['Time', 'Pitch', 'Volume', 'Feedback'],
    'TAP should show time, pitch, volume and feedback; got ' + labels.join(', '));
  const ctx = D.pages.TAP.context(D.state);
  ['1/', 'vol'].forEach(frag => assert.ok(ctx.indexOf(frag) >= 0,
    'TAP header should state the locked time and volume; got "' + ctx + '"'));
});

/* ---------- wfc: the transpose is the whole portrait fix ---------- */
check('wfc: grid transposes in portrait and cells clear the touch minimum', () => {
  const { geom, cellAt } = W._internals;
  const phone = geom(390, 352), rack = geom(288, 156);
  assert.ok(!phone.p, 'a 390x352 canvas is landscape; portrait starts when H > W');
  const tall = geom(390, 500);
  assert.ok(tall.p, '390x500 should be portrait');
  assert.strictEqual(tall.across, W.state.lanes, 'portrait puts lanes across');
  assert.strictEqual(tall.down, W.state.cols, 'portrait puts steps down');
  assert.ok(tall.cw >= 44, 'portrait cells are ' + tall.cw.toFixed(1) + 'px; touch needs 44');
  assert.ok(!rack.p && rack.across === W.state.cols, 'rack stays landscape');
});
check('wfc: cellAt round-trips inside the grid and rejects outside', () => {
  const { cellAt, put, at } = W._internals;
  const hit = cellAt({ x: 0.5, y: 0.5, aspect: 288 / 156 }, 288, 156);
  assert.ok(hit && hit.col >= 0 && hit.lane >= 0, 'centre of the canvas is a cell');
  put(hit.col, hit.lane, 4);
  assert.strictEqual(at(hit.col, hit.lane), 4, 'put/at disagree');
  assert.strictEqual(cellAt({ x: 1.4, y: 0.5, aspect: 1 }, 288, 156), null, 'outside must be null');
});
check('wfc: lane levels are finite and muting zeroes them', () => {
  const { laneLevel, reseed } = W._internals;
  reseed();
  for (let l = 0; l < W.state.lanes; l++) {
    const v = laneLevel(l);
    assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, 'lane level out of range: ' + v);
  }
  W.state.lanesMeta[0].mute = true;
  assert.strictEqual(laneLevel(0), 0, 'a muted lane must read 0');
  W.state.lanesMeta[0].mute = false;
});

/* ---------- mount(): enough of a DOM to prove the assembly runs ----------
   Not a rendering test — just enough that a typo or an unbound variable in
   chassis.js fails here instead of on the first double-click. */
function fakeDom() {
  const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (t[k] = () => {})) });
  const mk = (tag) => {
    const el = {
      tagName: String(tag).toUpperCase(), className: '', children: [], attrs: {},
      style: { cssText: '', setProperty() {} }, isConnected: true,
      classList: { toggle() {}, add() {}, remove() {} },
      set textContent(v) { if (v === '') el.children.length = 0; el._text = v; },
      get textContent() { return el._text || ''; },
      set innerHTML(v) { el._html = v; }, get innerHTML() { return el._html || ''; },
      appendChild(c) { el.children.push(c); return c; },
      append(...cs) { cs.forEach(c => el.children.push(c)); },
      setAttribute(k, v) { el.attrs[k] = String(v); },
      getAttribute(k) { return el.attrs[k]; },
      addEventListener() {}, setPointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: el.width || 100, height: el.height || 100 }),
      getContext: () => ctx2d,
      querySelector: (sel) => descend(el).find(d => matches(d, sel)) || null,
      querySelectorAll: (sel) => descend(el).filter(d => matches(d, sel))
    };
    return el;
  };
  const descend = (el) => el.children.flatMap(c => [c, ...descend(c)]);
  const matches = (d, sel) => sel.split(/\s+/).every(part =>
    part.startsWith('.') ? (d.className || '').split(/\s+/).includes(part.slice(1)) : true);
  global.document = { createElement: mk };
  return mk;
}

check('mount(): both variants of both effects assemble without throwing', () => {
  const mk = fakeDom();
  for (const [label, spec] of [['delaunay', D], ['wfc', W], ['lsystem', L]]) {
    for (const variant of ['phone', 'rack']) {
      const host = mk('div');
      const api = global.Chassis.mount(host, spec, variant);
      assert.ok(api && api.render && api.paint, label + '/' + variant + ' returned no api');
      assert.ok(host.children.length > 0, label + '/' + variant + ' mounted nothing');
      assert.ok(/dlny/.test(host.className), label + '/' + variant + ' missing .dlny class');
      // every tab must build without throwing, on both bodies
      spec.tabs.forEach(t => { spec.state.tab = t; api.render(); });
      spec.state.tab = spec.tabs[0];
    }
  }
});

check('mount(): re-mounting the same host does not accumulate peers', () => {
  const mk = fakeDom();
  const host = mk('div');
  let painted = 0;
  const spec = {
    name: 'Probe', state: { tab: 'A', on: true }, tabs: ['A'],
    pages: { A: { controls: () => [] } },
    transport: () => [],
    draw: () => { painted++; },
    readout: () => ''
  };
  global.Chassis.mount(host, spec, 'phone');
  global.Chassis.mount(host, spec, 'phone');
  const api = global.Chassis.mount(host, spec, 'phone');
  painted = 0;                     // mount() paints once itself; count only paint()
  api.paint();
  assert.strictEqual(painted, 1, 'paint() hit ' + painted + ' mounts; stale peers were kept');
});

console.log('\n' + n + ' checks passed.');
