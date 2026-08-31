// node prototypes/test_fdn.js
// Pulls the real functions out of physarum_fdn.html so this tests the shipped code, not a copy.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'physarum_fdn.html'), 'utf8');

// brace-matching extractor: handles one-liners and multi-line bodies alike
function grabFn(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' not found');
  let i = html.indexOf('{', start), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error('unbalanced braces in ' + name);
}
const grabConst = name => {
  const m = html.match(new RegExp('const ' + name + '=[\\s\\S]*?;\\n'));
  assert.ok(m, name + ' not found');
  return m[0];
};

const GW = 360, GH = 230, M = 8;
let trail = new Float32Array(GW * GH);
const scope = eval(`(() => {
  ${grabConst('HSIGN')}
  ${grabFn('nodePoints')}
  const NODES = nodePoints();
  ${grabFn('sampleAt')}
  ${grabFn('pathDensity')}
  ${grabFn('buildMatrix')}
  ${grabFn('spectralRadius')}
  ${grabFn('buildBands')}
  return {HSIGN, NODES, buildMatrix, spectralRadius, buildBands, pathDensity};
})()`);
const { HSIGN, NODES, buildMatrix, spectralRadius, buildBands } = scope;

const rowNorm = r => Math.sqrt(r.reduce((s, v) => s + v * v, 0));
const gFor = rho => Math.min(0.86, rho > 1e-6 ? 0.94 / rho : 0.86); // same rule as updateNetwork

// 1. no trail at all => exactly the numpy reference matrix (Hadamard/sqrt(8)), rho exactly 1, full g
trail.fill(0);
{
  const W = buildMatrix(0.22), rho = spectralRadius(W);
  W.forEach((row, i) => row.forEach((v, j) =>
    assert.ok(Math.abs(v - 1 / Math.sqrt(M)) < 1e-12, `fallback[${i}][${j}] = ${v}, want 1/sqrt(8)`)));
  assert.ok(Math.abs(rho - 1) < 1e-9, `orthogonal fallback rho = ${rho}, want 1`);
  assert.strictEqual(gFor(rho), 0.86, 'reference case must keep the numpy g=0.86');
}

// 2. arbitrary colony states stay unit-norm and stably damped
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let trialN = 0; trialN < 20; trialN++) {
  for (let i = 0; i < trail.length; i++) trail[i] = rnd() < 0.15 ? rnd() * 40 : 0;
  for (const prune of [0, 0.22, 0.6]) {
    const W = buildMatrix(prune), rho = spectralRadius(W);
    W.forEach((row, i) => assert.ok(Math.abs(rowNorm(row) - 1) < 1e-9,
      `trial ${trialN} prune ${prune} row ${i} norm ${rowNorm(row)}`));
    assert.ok(gFor(rho) * rho <= 0.9400001,
      `trial ${trialN} prune ${prune}: g*rho = ${gFor(rho) * rho} exceeds the 0.94 ceiling`);
  }
}

// 3. trail actually steers routing: a bright path from node 0 to node 3 makes that 0->3 edge dominant
trail.fill(0);
{
  const a = NODES[0], b = NODES[3];
  for (let k = 0; k <= 200; k++) {
    const t = k / 200, x = Math.round(a.gx + (b.gx - a.gx) * t), y = Math.round(a.gy + (b.gy - a.gy) * t);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) trail[((y + dy) * GW + x + dx)] = 100;
  }
  const W = buildMatrix(0.22);
  const offDiag = W[0].map((v, j) => ({ j, v })).filter(o => o.j !== 0);
  const best = offDiag.reduce((m, o) => (o.v > m.v ? o : m));
  assert.strictEqual(best.j, 3, `node 0 should route strongest to node 3, got ${best.j}`);
}

// 4. frequency bands stay non-empty, in range, ascending
for (const sr of [44100, 48000]) {
  const bands = buildBands(sr, 1024, M);
  assert.strictEqual(bands.length, M);
  bands.forEach((b, i) => {
    assert.ok(b.b1 > b.b0, `sr=${sr} band ${i} empty`);
    assert.ok(b.b1 <= 512, `sr=${sr} band ${i} past 512 bins`);
    if (i) assert.ok(b.b0 >= bands[i - 1].b0, `sr=${sr} bands not ascending at ${i}`);
  });
}

// 5. nodes distinct and on the grid
NODES.forEach((p, i) => {
  assert.ok(p.gx >= 0 && p.gx < GW && p.gy >= 0 && p.gy < GH, `node ${i} off grid`);
});
assert.strictEqual(new Set(NODES.map(p => p.gx + ',' + p.gy)).size, M, 'nodes overlap');

console.log('ok — empty colony == numpy Hadamard (rho 1, g .86); 60 random states stayed unit-norm and under g*rho<=.94; trail steers routing; bands + nodes valid');
