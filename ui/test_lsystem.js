/* Self-check for ui/lsystem.js — node ui/test_lsystem.js
 * The tree either draws or it doesn't. What fails silently is the pitch: a
 * node landing off-key, or the wind sliding it off the scale. */
'use strict';
const assert = require('assert');
const L = require('./lsystem.js');

let n = 0;
const check = (name, fn) => { fn(); n++; process.stdout.write('  ok  ' + name + '\n'); };

check('every node lands on a degree of the key', () => {
  Object.keys(L.KEYS).forEach((key) => {
    const nodes = L.grow({ key: key, maxDepth: 5, angle: 34 });
    const degrees = L.KEYS[key];
    nodes.forEach((nd) => {
      assert.ok(degrees.indexOf(((nd.semi % 12) + 12) % 12) >= 0,
        key + ' node ' + nd.i + ' off key at ' + nd.semi);
    });
  });
});

check('delay times compound down a path, never repeat a parent', () => {
  const nodes = L.grow({ maxDepth: 4 });
  nodes.forEach((nd) => {
    if (nd.parent >= 0) assert.ok(nd.t > nodes[nd.parent].t, 'node ' + nd.i + ' does not follow its parent');
  });
});

check('gain only falls with depth', () => {
  const nodes = L.grow({ maxDepth: 4, decay: 0.8 });
  nodes.forEach((nd) => {
    if (nd.parent >= 0) assert.ok(nd.gain < nodes[nd.parent].gain);
  });
});

check('a root transposition moves the whole tree, and stays in key', () => {
  const a = L.grow({ key: 'hijaz', rootSemi: 0 });
  const b = L.grow({ key: 'hijaz', rootSemi: 3 });
  a.forEach((nd, i) => assert.strictEqual(b[i].semi - nd.semi, 3));
});

check('wind bends the tips more than the trunk', () => {
  const bent = L.grow({ maxDepth: 4, windAmount: 1 }, 1);
  const trunk = Math.abs(bent[0].bend);
  const tip = Math.abs(bent[bent.length - 1].bend);
  assert.ok(tip > trunk, 'tip ' + tip + ' should exceed trunk ' + trunk);
});

check('wind moves the tree, not just its pitch', () => {
  const still = L.grow({ maxDepth: 4, windAmount: 1 }, 0);
  const bent = L.grow({ maxDepth: 4, windAmount: 1 }, 1);
  assert.notStrictEqual(bent[bent.length - 1].x, still[still.length - 1].x);
  assert.ok(Math.abs(bent[bent.length - 1].t - still[still.length - 1].t) > 1e-6,
    'a bent branch should stretch its delay time');
});

check('wind never pushes a node off the key', () => {
  const degrees = L.KEYS.hirajoshi;
  const params = { key: 'hirajoshi', maxDepth: 4, windAmount: 1.5 };
  for (let t = 0; t < 40; t += 0.25) {
    L.grow(params, L.wind(t, { windRate: 0.4, gust: 0.6 })).forEach((nd) => {
      assert.ok(degrees.indexOf(((nd.semi % 12) + 12) % 12) >= 0, 'off key at t=' + t);
    });
  }
});

check('wind stays in range', () => {
  for (let t = 0; t < 60; t += 0.1) {
    const w = L.wind(t, { windRate: 0.2, gust: 0.7 });
    assert.ok(Math.abs(w) <= 1.7, 'wind out of range: ' + w);
  }
});

process.stdout.write(n + ' checks passed\n');
