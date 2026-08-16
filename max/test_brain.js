// Test harness for dlny.map.js — the Delaunay brain.
// Runs the JS under macOS JavaScriptCore (no Max needed) with Max globals stubbed,
// and asserts on geometry, weights, and the messages it emits to poly~.
//
//   run:  osascript -l JavaScript max/test_brain.js
//   (from the repo root, or any cwd — it resolves dlny.map.js next to itself via $PWD/max)
//
// What it can prove here: the geometry is a valid Delaunay triangulation
// (empty-circumcircle property), barycentric weights are a partition of unity,
// every emitted gain/param is finite and in range, the editor round-trips, and
// sweeping the playhead is click-free. What it CANNOT prove: that the DSP graph
// in the .maxpat actually makes sound — that needs Max/Live.

// ---------- Max global stubs + outlet capture ----------
var autowatch, inlets, outlets, CAP = [];
function outlet(idx) { var a = []; for (var i = 1; i < arguments.length; i++) a.push(arguments[i]); CAP.push({ o: idx, a: a }); }
function Task() { return { interval: 0, repeat: function () {}, cancel: function () {} }; }
var mgraphics = { init: function () {}, redraw: function () {}, relative_coords: 0, autofill: 0 };
["set_source_rgba", "rectangle", "fill", "stroke", "move_to", "line_to", "close_path",
 "set_line_width", "ellipse", "select_font_face", "set_font_size", "show_text"].forEach(function (m) { mgraphics[m] = function () {}; });

// deterministic PRNG so buildConstellation is reproducible
var _seed = 1; function srand(s) { _seed = s >>> 0; }
Math.random = function () { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };

var app = Application.currentApplication(); app.includeStandardAdditions = true;
srand(12345);
var _fm = $.NSFileManager.defaultManager, _cwd = _fm.currentDirectoryPath.js;
var _cands = [_cwd + "/max/dlny.map.js", _cwd + "/dlny.map.js"];   // repo root, or max/
var _src = null;
for (var _i = 0; _i < _cands.length; _i++) if (_fm.fileExistsAtPath(_cands[_i])) { _src = app.read(Path(_cands[_i])); break; }
if (_src === null) throw new Error("dlny.map.js not found (run from repo root or max/)");
eval(_src);   // direct eval at top level -> brain functions become available below

// ---------- assert ----------
var FAIL = [], PASS = 0;
function ok(c, msg) { if (c) PASS++; else FAIL.push(msg); }
function fin(x) { return typeof x === "number" && isFinite(x); }

// local circumcircle (independent of the module) for the empty-circle test
function circ(a, b, c) {
  var d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  var a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  var ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  var uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { x: ux, y: uy, r2: (a.x - ux) * (a.x - ux) + (a.y - uy) * (a.y - uy) };
}

// ================= 1) Delaunay validity (empty-circumcircle) =================
var viol = 0, sweeps = 0;
[3, 4, 5, 6, 8, 12, 16].forEach(function (N) {
  for (var s = 1; s <= 120; s++) {
    srand(s * 7 + N); buildConstellation(N); sweeps++;
    for (var k = 0; k < tris.length; k++) {
      var t = tris[k], cc = circ(t[0], t[1], t[2]); if (!cc) continue;
      ok(t[0].tap != null && t[1].tap != null && t[2].tap != null, "super-tri vertex leaked");
      for (var i = 0; i < points.length; i++) {
        var p = points[i]; if (p === t[0] || p === t[1] || p === t[2]) continue;
        var d2 = (p.x - cc.x) * (p.x - cc.x) + (p.y - cc.y) * (p.y - cc.y);
        if (d2 < cc.r2 - Math.max(1e-6, cc.r2 * 1e-9)) viol++;
      }
    }
  }
});
ok(viol === 0, "empty-circumcircle VIOLATED x" + viol + " (triangulation not Delaunay)");

// ================= 2) barycentric partition of unity =================
srand(999); buildConstellation(10); var pu = 0;
for (var k = 0; k < tris.length; k++) {
  var t = tris[k], cx = (t[0].x + t[1].x + t[2].x) / 3, cy = (t[0].y + t[1].y + t[2].y) / 3;
  var b = bary({ x: cx, y: cy }, t[0], t[1], t[2]);
  if (!(fin(b[0]) && fin(b[1]) && fin(b[2])) || Math.abs(b[0] + b[1] + b[2] - 1) > 1e-9 || b[0] < -1e-9 || b[1] < -1e-9 || b[2] < -1e-9) pu++;
}
ok(pu === 0, "barycentric partition-of-unity failed x" + pu);

// ================= 3) updateWeights emits valid, normalized gains =================
// geometry is normalized [0,1], so sweep the playhead across the unit square
srand(4242); buildConstellation(9); var bg = 0, tb = 0, sb = 0, ns = 0;
for (var gx = 0.02; gx < 1; gx += 0.05) for (var gy = 0.02; gy < 1; gy += 0.05) {
  CAP = []; playhead.x = gx; playhead.y = gy; updateWeights();
  var sum = 0;
  for (var i = 0; i < CAP.length; i++) { var m = CAP[i];
    if (m.a[0] === "target") { if (!(m.a[1] >= 1 && m.a[1] <= MAXV)) tb++; }
    else if (m.a[0] === "gain") { var g = m.a[1]; if (!fin(g) || g < 0 || g > 1) bg++; sum += g; }
  }
  if (Math.abs(sum - 1) > 1e-3) sb++; ns++;
}
ok(bg === 0, "updateWeights emitted out-of-range/NaN gain x" + bg);
ok(tb === 0, "updateWeights emitted bad target id x" + tb);
ok(sb === 0, "updateWeights gain-sum != 1 x" + sb + "/" + ns);

// ================= 4) pushAll param ranges (stress: extreme globals) =================
srand(7); buildConstellation(12); bpm(200); setwidth(1.5); setfb(0.9); CAP = []; pushAll();
var pr = { time: 0, fb: 0, pan: 0, cut: 0 };
for (var i = 0; i < CAP.length; i++) { var m = CAP[i], v = m.a[1];
  if (m.a[0] === "time" && !(fin(v) && v > 0 && v <= 7900)) pr.time++;
  if (m.a[0] === "fb" && !(fin(v) && v >= 0 && v <= 0.85)) pr.fb++;
  if (m.a[0] === "pan" && !(fin(v) && v >= -1 && v <= 1)) pr.pan++;
  if (m.a[0] === "cut" && !(fin(v) && v > 0)) pr.cut++;
}
ok(pr.time === 0 && pr.fb === 0 && pr.pan === 0 && pr.cut === 0,
   "pushAll out of range: time" + pr.time + " fb" + pr.fb + " pan" + pr.pan + " cut" + pr.cut);

// ================= 5) degenerate inputs don't crash / NaN =================
try { // collinear
  points = []; for (var i = 0; i < 6; i++) points.push({ x: 60 + i * 80, y: 200, tap: i, di: 3, cut: 3000, pan: 0, fb: 0.3, pitch: 0, hue: 0 });
  tris = delaunay(points); CAP = []; playhead.x = 300; playhead.y = 200; updateWeights();
  var s = 0, bad = 0; for (var i = 0; i < CAP.length; i++) { var m = CAP[i]; if (m.a[0] === "gain") { if (!fin(m.a[1])) bad++; s += m.a[1]; } }
  ok(bad === 0 && Math.abs(s - 1) < 1e-3, "collinear fallback bad=" + bad + " sum=" + s.toFixed(4));
} catch (e) { ok(false, "collinear threw: " + e); }
try { // duplicate points + tiny N
  srand(3); buildConstellation(1); CAP = []; updateWeights();
  var s1 = 0; CAP.forEach(function (m) { if (m.a[0] === "gain") s1 += m.a[1]; });
  ok(Math.abs(s1 - 1) < 1e-3, "N=1 gain-sum=" + s1);
} catch (e) { ok(false, "tiny N threw: " + e); }

// ================= 6) editor round-trip =================
srand(55); buildConstellation(7); CAP = []; selectTap(3);
ok(CAP.some(function (m) { return m.o === 1 && m.a[0] === "sel" && m.a[1] === 3; }), "selectTap emits sel for node 3");
CAP = []; edit("di", 9); edit("cut", 800); edit("pan", -0.5); edit("fb", 0.7);
ok(points[3].di === 9 && points[3].cut === 800 && Math.abs(points[3].pan + 0.5) < 1e-9 && Math.abs(points[3].fb - 0.7) < 1e-9, "edit() mutates selected point");
ok(CAP.filter(function (m) { return m.a[0] === "target" && m.a[1] === 4; }).length >= 4, "edit() re-pushes to voice 4");
sel = -1; CAP = []; edit("cut", 1234); ok(CAP.length === 0, "edit() with no selection is a no-op");

// ================= 7) edge-crossing is click-free =================
srand(88); buildConstellation(8);
var se = null;
for (var i = 0; i < tris.length && !se; i++) for (var j = i + 1; j < tris.length && !se; j++) {
  var sh = tris[i].filter(function (v) { return tris[j].indexOf(v) >= 0; }); if (sh.length === 2) se = [tris[i], tris[j]];
}
if (se) {
  // shared-edge midpoint + the two triangle centroids; walk a short segment that
  // straddles the edge near its midpoint (stays inside A then B) with fine steps.
  var shv = se[0].filter(function (v) { return se[1].indexOf(v) >= 0; });
  var mid = { x: (shv[0].x + shv[1].x) / 2, y: (shv[0].y + shv[1].y) / 2 };
  var cA = { x: (se[0][0].x + se[0][1].x + se[0][2].x) / 3, y: (se[0][0].y + se[0][1].y + se[0][2].y) / 3 };
  var cB = { x: (se[1][0].x + se[1][1].x + se[1][2].x) / 3, y: (se[1][0].y + se[1][1].y + se[1][2].y) / 3 };
  var pA = { x: (mid.x + cA.x) / 2, y: (mid.y + cA.y) / 2 };   // inside A, near the edge
  var pB = { x: (mid.x + cB.x) / 2, y: (mid.y + cB.y) / 2 };   // inside B, near the edge
  var prev = null, maxJump = 0, N = 240;
  for (var s = 0; s <= N; s++) {
    var t = s / N; CAP = []; playhead.x = pA.x + (pB.x - pA.x) * t; playhead.y = pA.y + (pB.y - pA.y) * t; updateWeights();
    var g = new Array(MAXV); for (var v = 0; v < MAXV; v++) g[v] = 0; var cur = -1;
    for (var i = 0; i < CAP.length; i++) { var m = CAP[i]; if (m.a[0] === "target") cur = m.a[1] - 1; else if (m.a[0] === "gain") g[cur] = m.a[1]; }
    if (prev) { var l1 = 0; for (var v = 0; v < MAXV; v++) l1 += Math.abs(g[v] - prev[v]); if (l1 > maxJump) maxJump = l1; }
    prev = g;
  }
  ok(maxJump < 0.05, "edge-crossing max per-step gain jump=" + maxJump.toFixed(4) + " (want <0.05, fine-sampled)");
} else ok(false, "no shared edge found for continuity test");

// ================= 8) auto-drift stays in bounds =================
srand(11); buildConstellation(6); var db = 0;
for (var s = 0; s < 200; s++) { CAP = []; driftTick();
  if (!(fin(playhead.x) && fin(playhead.y) && playhead.x >= 0 && playhead.x <= W && playhead.y >= 0 && playhead.y <= H)) db++;
  for (var i = 0; i < CAP.length; i++) { var m = CAP[i]; if (m.a[0] === "gain" && !fin(m.a[1])) db++; }
}
ok(db === 0, "auto-drift out-of-bounds/NaN x" + db);

// ---------- report ----------
var out = "dlny.map.js — " + PASS + " passed, " + FAIL.length + " failed  (delaunay sweeps=" + sweeps + ", empty-circumcircle violations=" + viol + ")\n";
out += FAIL.length ? ("FAILURES:\n  " + FAIL.join("\n  ")) : "ALL GREEN";
out;
