/* Self-check for the dice.
 *
 *   node ui/test_randomize.js
 *
 * The knob promises something specific — "the dice may move any parameter by
 * up to N% of its own range" — and the failure mode is that it quietly
 * promises something else: values pinned at an end, a step ignored so a tap
 * index lands on 4.37, or repeated presses walking every patch to the middle.
 * None of that throws in the browser, so it's checked here. The DOM half
 * (knob drag, injected CSS) throws loudly on first open and isn't tested.
 */
'use strict';
const assert = require('assert');

const R = require('./randomize.js');
global.window = {};
global.Chassis = require('./chassis.js');
global.Randomize = R;                 // chassis looks it up lazily, as in a page
require('./effects/delaunay.js');
require('./effects/wfc.js');
const D = global.window.DLNY.delaunay;
const W = global.window.DLNY.wfc;

let n = 0;
const check = (name, fn) => { fn(); n++; process.stdout.write('  ok  ' + name + '\n'); };

// Deterministic stand-in for Math.random, so a rare draw can't make this file
// pass on Tuesdays.
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);

/* ---------- the window the knob describes ---------- */

check('amount 0 is a no-op window', () => {
  const w = R.window(40, 0, 100, 0);
  assert.deepStrictEqual(w, [40, 40]);
});

check('amount 100 reaches the whole range from anywhere in it', () => {
  [0, 1, 50, 99, 100].forEach(cur => {
    assert.deepStrictEqual(R.window(cur, 0, 100, 100), [0, 100], 'from ' + cur);
  });
});

check('window width is amount% of the span, wherever the value sits', () => {
  const span = 220 - 40;
  [40, 60, 130, 210, 220].forEach(cur => {
    const w = R.window(cur, 40, 220, 25);
    assert.ok(near(w[1] - w[0], span * 0.25, 1e-9),
      'width at ' + cur + ' was ' + (w[1] - w[0]));
  });
});

// The one that stops repeated presses from pulling every patch to the middle:
// a value at an end must keep its full width of travel, not half of it.
check('the window reflects off the ends instead of being clipped', () => {
  assert.deepStrictEqual(R.window(100, 0, 100, 40), [60, 100]);
  assert.deepStrictEqual(R.window(0, 0, 100, 40), [0, 40]);
  const mid = R.window(50, 0, 100, 40);
  assert.strictEqual(mid[1] - mid[0], R.window(100, 0, 100, 40)[1] - R.window(100, 0, 100, 40)[0]);
});

check('the window never leaves the range', () => {
  const rnd = seeded(7);
  for (let i = 0; i < 2000; i++) {
    const min = Math.round(rnd() * 200 - 100);
    const max = min + 1 + Math.round(rnd() * 500);
    const cur = min + rnd() * (max - min);
    const w = R.window(cur, min, max, rnd() * 100);
    assert.ok(w[0] >= min - 1e-9 && w[1] <= max + 1e-9 && w[1] >= w[0],
      [cur, min, max, w].join(' '));
  }
});

/* ---------- picking a value out of it ---------- */

check('pick stays in range and on the step over many draws', () => {
  const rnd = seeded(11);
  const c = { min: -12, max: 12 };
  for (let i = 0; i < 3000; i++) {
    const v = R.pick(Math.round(rnd() * 24 - 12), c, rnd() * 100, rnd);
    assert.ok(v >= -12 && v <= 12, 'out of range: ' + v);
    assert.strictEqual(v, Math.round(v), 'off the default step: ' + v);
  }
});

check('pick honours a fractional step without float dust', () => {
  const rnd = seeded(3);
  const c = { min: 0.05, max: 8, step: (8 - 0.05) / 100 };
  for (let i = 0; i < 500; i++) {
    const v = R.pick(4, c, 100, rnd);
    assert.ok(v >= 0.05 && v <= 8);
    assert.ok(String(v).length <= 10, 'float dust: ' + v);
  }
});

check('pick returns the value untouched when the range is degenerate', () => {
  assert.strictEqual(R.pick(5, { min: 3, max: 3 }, 100, seeded(1)), 5);
  assert.strictEqual(R.pick(5, { min: 10, max: 2 }, 100, seeded(1)), 5);
});

// An end value must not be a trap. From the maximum, at a mid amount, a run of
// rolls has to come back with something well below it.
check('a value parked at an end still moves', () => {
  const rnd = seeded(23);
  let below = 0;
  for (let i = 0; i < 200; i++) if (R.pick(100, { min: 0, max: 100 }, 50, rnd) < 90) below++;
  assert.ok(below > 100, 'only ' + below + '/200 rolls left the top of the range');
});

/* ---------- descriptor form ---------- */

check('apply writes through to the bound object and counts what moved', () => {
  const s = { wet: 50, fb: 20, name: 'x' };
  const moved = R.apply([
    { obj: s, key: 'wet', min: 0, max: 100 },
    { obj: s, key: 'fb', min: 0, max: 90 },
    { obj: s, key: 'nope', min: 0, max: 9 },     // not a key on s
    { key: 'wet', min: 0, max: 100 }             // no obj
  ], 100, seeded(5));
  assert.ok(moved >= 1 && moved <= 2);
  assert.ok(s.wet >= 0 && s.wet <= 100 && s.fb >= 0 && s.fb <= 90);
  assert.strictEqual(s.name, 'x');
});

check('apply at amount 0 changes nothing', () => {
  const s = { wet: 50, fb: 20 };
  const moved = R.apply([{ obj: s, key: 'wet', min: 0, max: 100 },
                         { obj: s, key: 'fb', min: 0, max: 90 }], 0, seeded(5));
  assert.strictEqual(moved, 0);
  assert.deepStrictEqual(s, { wet: 50, fb: 20 });
});

/* ---------- what the chassis hands it ---------- */

check('randomizable() collects every page, not just the visible one', () => {
  const keys = global.Chassis.randomizable(D)
    .filter(c => c.obj === D.state).map(c => c.key);
  ['wet', 'fb', 'glide', 'width', 'flen', 'ffb', 'out', 'tone', 'bpm'].forEach(k => {
    assert.ok(keys.indexOf(k) >= 0, 'missing ' + k + ' — it is on a tab that was not open');
  });
});

check('randomizable() leaves structural controls alone', () => {
  // ntaps regenerates the constellation and cols/lanes reseed the grid: rolling
  // them would discard the same roll's work.
  const d = global.Chassis.randomizable(D).filter(c => c.obj === D.state).map(c => c.key);
  assert.ok(d.indexOf('ntaps') < 0, 'ntaps is structural and must not be rolled');
  const w = global.Chassis.randomizable(W).filter(c => c.obj === W.state).map(c => c.key);
  assert.ok(w.indexOf('cols') < 0 && w.indexOf('lanes') < 0, 'grid size must not be rolled');
  assert.ok(w.indexOf('stepdiv') >= 0 && w.indexOf('bpm') >= 0, 'the rest of GRID should roll');
});

check('randomizable() reaches every tap and lane, not only the selected one', () => {
  const list = global.Chassis.randomizable(D);
  D.state.pts.forEach((p, i) => {
    assert.ok(list.some(c => c.obj === p && c.key === 'div'), 'tap ' + i + ' unreachable');
  });
  const wl = global.Chassis.randomizable(W);
  W.state.lanesMeta.forEach((m, i) => {
    assert.ok(wl.some(c => c.obj === m && c.key === 'vol'), 'lane ' + i + ' unreachable');
  });
});

check('randomizable() never lists the same value twice', () => {
  [['delaunay', D], ['wfc', W]].forEach(([label, spec]) => {
    const seen = new Set();
    global.Chassis.randomizable(spec).forEach(c => {
      const id = spec.state.pts ? spec.state.pts.indexOf(c.obj) : 0;
      const k = (c.obj === spec.state ? 'S' : 'o' + id) + '.' + c.key;
      assert.ok(!seen.has(k) || c.obj !== spec.state, label + ' lists ' + k + ' twice');
      seen.add(k);
    });
    // the strict version: object identity, not labels
    const pairs = global.Chassis.randomizable(spec).map(c => [c.obj, c.key]);
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        assert.ok(!(pairs[i][0] === pairs[j][0] && pairs[i][1] === pairs[j][1]),
          label + ' lists ' + pairs[i][1] + ' twice on the same object');
      }
    }
  });
});

check('randomizable() descriptors are all bound and in range', () => {
  [['delaunay', D], ['wfc', W]].forEach(([label, spec]) => {
    global.Chassis.randomizable(spec).forEach(c => {
      assert.ok(c.key in c.obj, label + '/' + c.key + ' is not bound');
      assert.ok(+c.max > +c.min, label + '/' + c.key + ' has an empty range');
      const v = c.obj[c.key];
      assert.ok(v >= c.min && v <= c.max,
        label + '/' + c.key + ' starts at ' + v + ', outside ' + c.min + '..' + c.max);
    });
  });
});

/* ---------- the spec's own turn ---------- */

check('Chassis.roll moves values and keeps the whole state legal', () => {
  const rnd = seeded(41);
  const before = D.state.pts.map(p => ({ x: p.x, y: p.y }));
  const moved = global.Chassis.roll(D, 60, rnd);
  assert.ok(moved > 0, 'a 60% roll moved nothing');
  D.state.pts.forEach((p, i) => {
    assert.ok(p.x >= 0.03 && p.x <= 0.97 && p.y >= 0.03 && p.y <= 0.97,
      'tap ' + i + ' left the plane');
    assert.ok(p.div === Math.round(p.div) && p.div >= 0, 'tap ' + i + ' has a fractional division');
  });
  assert.ok(D.state.pts.some((p, i) => p.x !== before[i].x), 'the constellation did not move');
  assert.ok(D.state.tris.length > 0, 'retriangulation left no triangles');
});

check('Chassis.roll leaves the element count alone', () => {
  const taps = D.state.pts.length, cells = W.state.cells.length;
  global.Chassis.roll(D, 100, seeded(9));
  global.Chassis.roll(W, 100, seeded(9));
  assert.strictEqual(D.state.pts.length, taps, 'a roll changed the tap count');
  assert.strictEqual(D.state.ntaps, taps, 'ntaps drifted away from the tap count');
  assert.strictEqual(W.state.cells.length, cells, 'a roll resized the grid');
  assert.strictEqual(W.state.cells.length, W.state.cols * W.state.lanes, 'grid no longer square');
});

check('the wfc roll re-throws about `amount` percent of the tile map', () => {
  const rnd = seeded(77);
  const n = W.state.cells.length;
  const share = amount => {
    const before = W.state.cells.slice();
    W.roll(W.state, amount, rnd);
    return W.state.cells.filter((c, i) => c !== before[i]).length / n;
  };
  assert.strictEqual(share(0), 0, 'amount 0 touched the grid');
  // Each re-thrown cell can land on the tile it already had, so the share that
  // visibly differs sits under the amount — but it has to track it.
  const low = share(20), high = share(90);
  assert.ok(low < 0.25, 'a 20% roll changed ' + (low * 100).toFixed(0) + '% of cells');
  assert.ok(high > 0.5, 'a 90% roll changed only ' + (high * 100).toFixed(0) + '% of cells');
  assert.ok(high > low);
  W.state.cells.forEach((c, i) => {
    assert.ok(c === Math.round(c) && c >= 0 && c < 6, 'cell ' + i + ' is not a tile index: ' + c);
  });
});

/* ---------- the band the sliders draw ---------- */

check('band() writes the window as track percentages, and nothing at 0', () => {
  const styles = {};
  const fake = { type: 'range', min: '0', max: '100', value: '50',
                 disabled: false, getAttribute: () => null,
                 style: { setProperty: (k, v) => { styles[k] = v; } } };
  R.band(fake, 40);
  assert.strictEqual(styles['--rlo'], '30.00%');
  assert.strictEqual(styles['--rhi'], '70.00%');
  R.band(fake, 0);
  assert.strictEqual(styles['--rlo'], '0%');
  assert.strictEqual(styles['--rhi'], '0%');
});

check('band() draws nothing on a slider the dice will not touch', () => {
  const styles = {};
  const off = { type: 'range', min: '0', max: '100', value: '50', disabled: false,
                getAttribute: k => (k === 'data-rnd' ? 'off' : null),
                style: { setProperty: (k, v) => { styles[k] = v; } } };
  R.band(off, 80);
  assert.strictEqual(styles['--rlo'], '0%', 'an opted-out slider promised a range');
});

process.stdout.write('\n' + n + ' checks passed.\n');
