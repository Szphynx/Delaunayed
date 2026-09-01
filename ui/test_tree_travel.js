/* Self-check for the pure core of ui/tree-travel.js — node ui/test_tree_travel.js
 * The drawing throws loudly in a browser; what fails silently is the timing. */
'use strict';
const assert = require('assert');
const TT = require('./tree-travel.js');

// root fires at 0.4s; child reads the root and fires 0.2s later
const nodes = [
  { i: 0, parent: -1, t: 0.4, db: -2.2, note: 'A3', x: 0, y: -150, px: 0, py: 0, depth: 0, pan: 0 },
  { i: 1, parent: 0, t: 0.6, db: -5.0, note: 'C4', x: 60, y: -200, px: 0, py: -150, depth: 1, pan: 0.5 }
];
let n = 0;
const check = (name, fn) => { fn(); n++; process.stdout.write('  ok  ' + name + '\n'); };

check('child does not move before its parent has fired', () => {
  const f = TT.frame(nodes, 0.3)[1];
  assert.strictEqual(f.flying, false);
  assert.strictEqual(f.fired, false);
});

check('halfway down an edge is halfway in space', () => {
  const f = TT.frame(nodes, 0.5)[1];      // 0.1s into a 0.2s edge
  assert.ok(Math.abs(f.u - 0.5) < 1e-9);
  assert.strictEqual(f.x, 30);
  assert.strictEqual(f.y, -175);
});

check('a node stays fired after its arrival time', () => {
  const f = TT.frame(nodes, 5)[0];
  assert.strictEqual(f.fired, true);
  assert.strictEqual(f.flying, false);
  assert.strictEqual(f.x, 0);             // parked at the node, not off the edge
});

check('label carries index, note and level', () => {
  assert.strictEqual(TT.frame(nodes, 0.5)[1].label, '#1  C4  -5 dB');
});

check('span is the deepest arrival', () => {
  assert.strictEqual(TT.span(nodes), 0.6);
});

process.stdout.write(n + ' checks passed\n');
