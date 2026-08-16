// dlny.map.js  —  DELAUNAY NAVIGABLE DELAY  ·  geometry brain + interactive map
// Runs inside a Max [jsui] object. Ported 1:1 from prototypes/delaunay_delay.html
// (circumcircle / Bowyer–Watson delaunay() / barycentric bary()).
//
//   outlet 0  ->  [poly~ dlny.voice 16]   voice control:  target / gain / time / cut / fb / pan
//   outlet 1  ->  editor UI               readout:        "sel  <i> <di> <cut> <pan%> <fb%>"
//
// Interaction:
//   drag on empty space ....... move the orange playhead (barycentric morph across 3 taps)
//   click a node .............. select it for the per-tap editor
//   shift-drag a node ......... reposition it (mesh re-triangulates live)

autowatch = 1;
inlets = 1;
outlets = 2;

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

// ---------------------------------------------------------------- config / state
// GEOMETRY IS STORED NORMALIZED: points + playhead live in [0,1] x [0,1] and are mapped
// to pixels only for drawing and mouse. So the map fills ANY jsui size with no rescaling,
// and never spills out of the viewport.
var W = 300, H = 140;                 // current pixel size (updated by onresize)
var PAD = 18;                         // px inset for the drawing area (room for node + label)
var RAIL = 34;                        // left MAP/MIX tab strip, drawn INSIDE this object
var MAXV = 16;                        // must equal the poly~ voice count
function areaW() { return Math.max(1, W - RAIL - 2 * PAD); }
function areaH() { return Math.max(1, H - 2 * PAD); }
function toX(nx) { return RAIL + PAD + nx * areaW(); }  // normalized -> pixel (offset past the rail)
function toY(ny) { return PAD + ny * areaH(); }
function fromX(px) { return (px - RAIL - PAD) / areaW(); }
function fromY(py) { return (py - PAD) / areaH(); }
function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

var BPM = 110;                        // one global clock
var glideMs = 80;                     // gain/crossfade time-constant
var globalFb = 0.30;                  // master feedback trim (0..0.95)
var delayMult = 1.0;                  // Time feel  ½ / 1 / 2
var widthAmt = 1.0;                   // pan spread

var points = [];                      // {x,y,tap,di,cut,pan,fb,pitch,hue}
var tris = [];                        // array of [pt,pt,pt]
var playhead = { x: 0.5, y: 0.55 };   // normalized
var activeTri = null, activeW = null;
var sel = -1;                         // selected tap (editor), -1 = none
var pendingCount = 6;

var dragMode = 0;                     // 0 none, 1 playhead, 2 move-node
var dragNode = -1;

var view = 0;                         // 0 = MAP, 1 = MIX (mixer). set by [live.tab] -> page()
var lastGain = [];                    // per-voice emitted gain, for the mixer level bars
var mixDragRow = -1;                  // row whose fader is being dragged in MIX view

// note divisions (ascending by length), value in quarter-note beats. T=triplet, .=dotted
var DIVS = [
  { label: "1/16",  beats: 0.25 }, { label: "1/8T", beats: 1/3 },  { label: "1/16.", beats: 0.375 },
  { label: "1/8",   beats: 0.5 },  { label: "1/4T", beats: 2/3 },  { label: "1/8.",  beats: 0.75 },
  { label: "1/4",   beats: 1 },    { label: "1/2T", beats: 4/3 },  { label: "1/4.",  beats: 1.5 },
  { label: "1/2",   beats: 2 },    { label: "1/2.", beats: 3 },    { label: "1/1",   beats: 4 }
];
function divMs(di) { return DIVS[di].beats * 60.0 / BPM * 1000.0 * delayMult; }

// ---------------------------------------------------------------- geometry (ported)
function circumcircle(a, b, c) {
  var ax = a.x, ay = a.y, bx = b.x, by = b.y, cx = c.x, cy = c.y;
  var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return null;
  var a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  var ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  var uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return { x: ux, y: uy, r2: (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy) };
}
function triHasEdge(t, a, b) { return t.indexOf(a) >= 0 && t.indexOf(b) >= 0; }

function delaunay(pts) {
  var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, i;
  for (i = 0; i < pts.length; i++) {
    var p = pts[i];
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  var dx = (maxX - minX) || 1, dy = (maxY - minY) || 1, dmax = Math.max(dx, dy);
  var mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  var s1 = { x: mx - 20 * dmax, y: my - dmax, sup: 1 },
      s2 = { x: mx,            y: my + 20 * dmax, sup: 1 },
      s3 = { x: mx + 20 * dmax, y: my - dmax, sup: 1 };
  var T = [[s1, s2, s3]], k;
  for (i = 0; i < pts.length; i++) {
    var pt = pts[i], bad = [];
    for (k = 0; k < T.length; k++) {
      var t = T[k], cc = circumcircle(t[0], t[1], t[2]);
      if (cc && ((pt.x - cc.x) * (pt.x - cc.x) + (pt.y - cc.y) * (pt.y - cc.y)) <= cc.r2) bad.push(t);
    }
    var edges = [];
    for (k = 0; k < bad.length; k++) {
      var tb = bad[k], es = [[tb[0], tb[1]], [tb[1], tb[2]], [tb[2], tb[0]]];
      for (var e = 0; e < 3; e++) {
        var ea = es[e][0], eb = es[e][1], shared = false;
        for (var m = 0; m < bad.length; m++) {
          if (bad[m] !== tb && triHasEdge(bad[m], ea, eb)) { shared = true; break; }
        }
        if (!shared) edges.push([ea, eb]);
      }
    }
    var keep = [];
    for (k = 0; k < T.length; k++) if (bad.indexOf(T[k]) < 0) keep.push(T[k]);
    T = keep;
    for (k = 0; k < edges.length; k++) T.push([edges[k][0], edges[k][1], pt]);
  }
  var out = [];
  for (k = 0; k < T.length; k++) {
    var tt = T[k];
    if (!tt[0].sup && !tt[1].sup && !tt[2].sup) out.push(tt);
  }
  return out;
}

function bary(p, a, b, c) {
  var v0x = b.x - a.x, v0y = b.y - a.y, v1x = c.x - a.x, v1y = c.y - a.y, v2x = p.x - a.x, v2y = p.y - a.y;
  var d00 = v0x * v0x + v0y * v0y, d01 = v0x * v1x + v0y * v1y, d11 = v1x * v1x + v1y * v1y;
  var d20 = v2x * v0x + v2y * v0y, d21 = v2x * v1x + v2y * v1y;
  var den = d00 * d11 - d01 * d01 || 1e-9;
  var v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
  return [1 - v - w, v, w];
}

// ---------------------------------------------------------------- constellation
function rnd(a, b) { return a + Math.random() * (b - a); }

function pickPos(existing, minD) {                   // normalized [0,1], inset from edges
  for (var a = 0; a < 40; a++) {
    var x = rnd(0.06, 0.94), y = rnd(0.10, 0.88), ok = true;
    for (var i = 0; i < existing.length; i++) {
      var q = existing[i], dx = q.x - x, dy = q.y - y;
      if (dx * dx + dy * dy < minD * minD) { ok = false; break; }
    }
    if (ok) return { x: x, y: y };
  }
  return { x: rnd(0.06, 0.94), y: rnd(0.10, 0.88) };
}

function buildConstellation(n) {
  points = [];
  var minD = Math.min(0.34, 0.72 / Math.sqrt(n));    // normalized spacing, scales with density
  for (var i = 0; i < n; i++) {
    var pos = pickPos(points, minD), hue = Math.round((i * 47) % 360);
    points.push({
      x: pos.x, y: pos.y, tap: i,
      di: Math.floor(rnd(0, 9)), cut: Math.round(rnd(500, 7500)),
      pan: rnd(-0.85, 0.85), fb: rnd(0.05, 0.55), pitch: 0, hue: hue,
      vol: 1, mute: false, solo: false            // mixer state
    });
  }
  tris = delaunay(points);
  if (tris.length) {
    var tc = tris[Math.floor(tris.length / 2)];
    playhead.x = (tc[0].x + tc[1].x + tc[2].x) / 3;
    playhead.y = (tc[0].y + tc[1].y + tc[2].y) / 3;
  } else { playhead.x = 0.5; playhead.y = 0.5; }
}

// ---------------------------------------------------------------- voice output
// per-voice final coefficients are computed HERE (JS is the "architecture"),
// the poly~ voice just renders them. poly~ voices are 1-indexed via "target".
function pushTime(i) { var p = points[i]; outlet(0, "target", i + 1); outlet(0, "time", Math.min(7900, divMs(p.di))); }
function pushCut(i)  { outlet(0, "target", i + 1); outlet(0, "cut", points[i].cut); }
function pushFb(i)   { var p = points[i]; outlet(0, "target", i + 1); outlet(0, "fb", Math.min(0.85, p.fb * globalFb * 1.6)); }
function pushPan(i)  { var p = points[i]; outlet(0, "target", i + 1); outlet(0, "pan", Math.max(-1, Math.min(1, p.pan * widthAmt))); }

function pushVoice(i) {
  outlet(0, "target", i + 1);
  if (i >= points.length) { outlet(0, "gain", 0., 5.); outlet(0, "fb", 0.); outlet(0, "time", 1.); return; }
  pushTime(i); pushCut(i); pushFb(i); pushPan(i);
}
function pushAll() { for (var i = 0; i < MAXV; i++) pushVoice(i); }
function repush(fn) { for (var i = 0; i < points.length; i++) fn(i); }

function updateWeights() {
  var found = null, wts = null, k;
  for (k = 0; k < tris.length; k++) {
    var t = tris[k], b = bary(playhead, t[0], t[1], t[2]);
    if (b[0] >= -0.001 && b[1] >= -0.001 && b[2] >= -0.001) { found = t; wts = b; break; }
  }
  activeTri = found; activeW = wts;
  var g = new Array(MAXV);
  for (k = 0; k < MAXV; k++) g[k] = 0;
  if (found) { for (k = 0; k < 3; k++) g[found[k].tap] = wts[k]; }
  else {                                             // outside hull -> nearest tap = 1
    var best = 0, bd = 1e18;
    for (k = 0; k < points.length; k++) {
      var dx = points[k].x - playhead.x, dy = points[k].y - playhead.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = k; }
    }
    if (points.length) g[best] = 1;
  }
  for (k = 0; k < MAXV; k++) {
    var w = g[k] < 0 ? 0 : (g[k] > 1 ? 1 : g[k]);    // barycentric edge-tolerance can nudge a hair <0/>1
    var gk = k < points.length ? w * effGain(k) : 0; // apply mixer vol / mute / solo
    lastGain[k] = gk;
    outlet(0, "target", k + 1); outlet(0, "gain", gk, glideMs);
  }
  if (view === 1) mgraphics.redraw();                // live level bars in the mixer
}

// ---------------------------------------------------------------- mixer state
function anySolo() { for (var i = 0; i < points.length; i++) if (points[i].solo) return true; return false; }
function effGain(i) {
  var p = points[i];
  if (!p || p.mute) return 0;
  if (anySolo() && !p.solo) return 0;
  return p.vol == null ? 1 : p.vol;
}

// ---------------------------------------------------------------- messages in
function init() {                                    // from [loadbang]
  if (!points.length) buildConstellation(pendingCount);
  tris = delaunay(points);
  pushAll(); updateWeights(); mgraphics.redraw();
}
function regen() {
  buildConstellation(pendingCount);
  sel = -1; outlet(1, "sel", -1, 6, 3000, 0, 30);
  pushAll(); updateWeights(); mgraphics.redraw();
}
function count(n)     { pendingCount = Math.max(3, Math.min(MAXV, Math.round(n))); }
function bpm(v)       { BPM = v; repush(pushTime); mgraphics.redraw(); }
function setfb(v)     { globalFb = Math.max(0, Math.min(0.95, v)); repush(pushFb); }
function setglide(v)  { glideMs = Math.max(0, v); }
function setwidth(v)  { widthAmt = Math.max(0, v); repush(pushPan); }
function settime(v)   { delayMult = v; repush(pushTime); }
function page(v)      { view = v ? 1 : 0; mgraphics.redraw(); }   // [live.tab] MAP/MIX

function edit(which, v) {                             // from the per-tap editor dials
  if (sel < 0 || sel >= points.length) return;
  var p = points[sel];
  if (which == "di")        { p.di = Math.max(0, Math.min(DIVS.length - 1, Math.round(v))); pushTime(sel); }
  else if (which == "cut")  { p.cut = v; pushCut(sel); }
  else if (which == "pan")  { p.pan = Math.max(-1, Math.min(1, v)); pushPan(sel); }
  else if (which == "fb")   { p.fb = Math.max(0, Math.min(0.9, v)); pushFb(sel); }
  mgraphics.redraw();
}

// ---------------------------------------------------------------- interaction
// mouse coords are pixels; convert to normalized, hit-test nodes in pixel space.
function siteAt(px, py, r) {
  var best = -1, bd = r * r;
  for (var i = 0; i < points.length; i++) {
    var dx = toX(points[i].x) - px, dy = toY(points[i].y) - py, d = dx * dx + dy * dy;
    if (d <= bd) { bd = d; best = i; }
  }
  return best;
}
function selectTap(i) {
  sel = i; var p = points[i];
  outlet(1, "sel", i, p.di, p.cut, Math.round(p.pan * 100), Math.round(p.fb * 100));
  mgraphics.redraw();
}

function onclick(x, y, but, cmd, shift, caps, option, ctrl) {
  if (x < RAIL) { view = (y < H / 2) ? 0 : 1; mgraphics.redraw(); return; }  // left MAP/MIX rail
  if (view === 1) { mixClick(x, y); return; }          // MIX view
  var hit = siteAt(x, y, 15);
  if (hit >= 0) {
    selectTap(hit);
    if (shift) { dragMode = 2; dragNode = hit; }      // shift-drag = reposition node
    else       { dragMode = 0; }
  } else {                                             // empty space = move playhead
    dragMode = 1;
    playhead.x = clamp01(fromX(x)); playhead.y = clamp01(fromY(y)); updateWeights();
  }
  mgraphics.redraw();
}
function ondrag(x, y, but, cmd, shift, caps, option, ctrl) {
  if (view === 1) { mixDrag(x, but); return; }         // MIX view
  if (dragMode == 2 && dragNode >= 0) {
    points[dragNode].x = clamp01(fromX(x)); points[dragNode].y = clamp01(fromY(y));
    tris = delaunay(points); updateWeights();
  } else if (dragMode == 1) {
    playhead.x = clamp01(fromX(x)); playhead.y = clamp01(fromY(y)); updateWeights();
  }
  if (but === 0) { dragMode = 0; dragNode = -1; }       // mouse released
  mgraphics.redraw();
}

// ---------------------------------------------------------------- mixer (MIX view)
// One row per tap: [hue] # [M][S] [====fader with live level====] div
function mixLayout() {
  var TOPY = 8, N = points.length;
  var rh = N ? (H - TOPY - 6) / N : 20;   // always shrink to fit N rows (cap tall for few taps)
  rh = rh > 40 ? 40 : rh;
  return { topy: TOPY, rh: rh, n: N };
}
function mixGeom(rh) {
  var bs = Math.min(rh - 6, 15); if (bs < 8) bs = 8;
  var mx = RAIL + 26, sx = mx + bs + 4, fx0 = sx + bs + 8, fx1 = W - 36;
  return { bs: bs, mx: mx, sx: sx, fx0: fx0, fx1: fx1 };
}
function mixRowAt(py) {
  var L = mixLayout(); if (py < L.topy) return -1;
  var i = Math.floor((py - L.topy) / L.rh);
  return (i >= 0 && i < L.n) ? i : -1;
}
function mixClick(x, y) {
  var i = mixRowAt(y); if (i < 0) return;
  selectTap(i);
  var L = mixLayout(), cy = L.topy + i * L.rh + L.rh / 2, G = mixGeom(L.rh);
  if (x >= G.mx && x <= G.mx + G.bs && Math.abs(y - cy) <= G.bs / 2 + 2) { points[i].mute = !points[i].mute; updateWeights(); }
  else if (x >= G.sx && x <= G.sx + G.bs && Math.abs(y - cy) <= G.bs / 2 + 2) { points[i].solo = !points[i].solo; updateWeights(); }
  else if (x >= G.fx0 && x <= G.fx1) { mixDragRow = i; points[i].vol = clamp01((x - G.fx0) / (G.fx1 - G.fx0)); updateWeights(); }
  mgraphics.redraw();
}
function mixDrag(x, but) {
  if (mixDragRow >= 0) {
    var G = mixGeom(mixLayout().rh);
    points[mixDragRow].vol = clamp01((x - G.fx0) / (G.fx1 - G.fx0)); updateWeights();
  }
  if (but === 0) mixDragRow = -1;
  mgraphics.redraw();
}

// ---------------------------------------------------------------- auto-drift (Lissajous)
var driftTask = null, driftPhase = 0;
function drift(on) {
  if (on) {
    if (!driftTask) { driftTask = new Task(driftTick, this); driftTask.interval = 33; }
    driftTask.repeat();
  } else if (driftTask) { driftTask.cancel(); }
}
function driftTick() {
  driftPhase += 0.02;
  playhead.x = 0.5 + 0.42 * Math.sin(driftPhase);            // Lissajous in normalized space
  playhead.y = 0.5 + 0.40 * Math.sin(driftPhase * 1.37 + 0.6);
  updateWeights(); mgraphics.redraw();
}

// ---------------------------------------------------------------- drawing
function hsl(h, s, l) {                                 // h,s,l in 0..1 -> [r,g,b] 0..1
  function hue2(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  if (s === 0) return [l, l, l];
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [hue2(p, q, h + 1/3), hue2(p, q, h), hue2(p, q, h - 1/3)];
}

function edge(mg, a, b) { mg.move_to(toX(a.x), toY(a.y)); mg.line_to(toX(b.x), toY(b.y)); }

function paint() {
  var mg = mgraphics, i, k;
  // background + faint inner frame
  mg.set_source_rgba(0.043, 0.055, 0.078, 1); mg.rectangle(0, 0, W, H); mg.fill();
  mg.set_source_rgba(1, 1, 1, 0.05); mg.set_line_width(1);
  mg.rectangle(0.5, 0.5, W - 1, H - 1); mg.stroke();

  if (view === 1) { paintMixer(mg); return; }

  // mesh
  mg.set_line_width(1); mg.set_source_rgba(0.40, 0.47, 0.62, 0.30);
  for (k = 0; k < tris.length; k++) {
    var t = tris[k];
    edge(mg, t[0], t[1]); edge(mg, t[1], t[2]); edge(mg, t[2], t[0]);
  }
  mg.stroke();

  // active triangle: soft fill + warm edge
  if (activeTri) {
    var t0 = activeTri[0], t1 = activeTri[1], t2 = activeTri[2];
    mg.move_to(toX(t0.x), toY(t0.y)); mg.line_to(toX(t1.x), toY(t1.y)); mg.line_to(toX(t2.x), toY(t2.y)); mg.close_path();
    mg.set_source_rgba(1, 0.45, 0.14, 0.10); mg.fill();
    mg.move_to(toX(t0.x), toY(t0.y)); mg.line_to(toX(t1.x), toY(t1.y)); mg.line_to(toX(t2.x), toY(t2.y)); mg.close_path();
    mg.set_source_rgba(1, 0.52, 0.20, 0.45); mg.set_line_width(1.5); mg.stroke();
  }

  // nodes
  mg.select_font_face("Arial"); mg.set_font_size(10);
  for (i = 0; i < points.length; i++) {
    var p = points[i], X = toX(p.x), Y = toY(p.y), c = hsl(p.hue / 360, 0.62, 0.62);
    mg.set_source_rgba(c[0], c[1], c[2], 0.16); mg.ellipse(X - 13, Y - 13, 26, 26); mg.fill();  // glow
    mg.set_source_rgba(c[0], c[1], c[2], 1);    mg.ellipse(X - 6.5, Y - 6.5, 13, 13); mg.fill(); // body
    mg.set_source_rgba(1, 1, 1, 0.28);          mg.ellipse(X - 3.5, Y - 4.5, 4, 4); mg.fill();    // spec
    if (i === sel) { mg.set_source_rgba(1, 0.20, 0.20, 1); mg.set_line_width(2); mg.ellipse(X - 11, Y - 11, 22, 22); mg.stroke(); }
    // label centered below, with a shadow so it reads over the mesh
    var lbl = DIVS[p.di].label, tw = mg.text_measure(lbl), lx = X - tw[0] / 2, ly = Y + 20;
    mg.set_source_rgba(0, 0, 0, 0.55); mg.move_to(lx + 0.7, ly + 0.7); mg.show_text(lbl);
    mg.set_source_rgba(0.87, 0.91, 0.97, 0.95); mg.move_to(lx, ly); mg.show_text(lbl);
  }

  // playhead: soft halo, ring, core
  var PX = toX(playhead.x), PY = toY(playhead.y);
  mg.set_source_rgba(1, 0.55, 0.15, 0.16); mg.ellipse(PX - 15, PY - 15, 30, 30); mg.fill();
  mg.set_source_rgba(1, 0.55, 0.15, 0.55); mg.set_line_width(1); mg.ellipse(PX - 10, PY - 10, 20, 20); mg.stroke();
  mg.set_source_rgba(1, 0.62, 0.22, 1);    mg.ellipse(PX - 5, PY - 5, 10, 10); mg.fill();

  drawRail(mg);
}

// ---------------------------------------------------------------- MIX view drawing
function paintMixer(mg) {
  var L = mixLayout(), G = mixGeom(L.rh), i;
  mg.select_font_face("Arial");
  var solo = anySolo();
  for (i = 0; i < L.n; i++) {
    var p = points[i], y0 = L.topy + i * L.rh, cy = y0 + L.rh / 2, c = hsl(p.hue / 360, 0.62, 0.62);
    var dimmed = p.mute || (solo && !p.solo);
    if (i === sel) { mg.set_source_rgba(1, 1, 1, 0.05); mg.rectangle(RAIL + 2, y0, W - RAIL - 4, L.rh); mg.fill(); }

    // hue dot + index
    mg.set_source_rgba(c[0], c[1], c[2], dimmed ? 0.28 : 1); mg.ellipse(RAIL + 8 - 4, cy - 4, 8, 8); mg.fill();
    mg.set_font_size(9); mg.set_source_rgba(0.6, 0.66, 0.75, 0.9);
    mg.move_to(RAIL + 15, cy + 3); mg.show_text("" + (i + 1));

    // M / S buttons
    drawBtn(mg, G.mx, cy - G.bs / 2, G.bs, "M", p.mute, [0.85, 0.25, 0.25]);
    drawBtn(mg, G.sx, cy - G.bs / 2, G.bs, "S", p.solo, [0.90, 0.72, 0.20]);

    // fader track
    var fw = G.fx1 - G.fx0, fy = cy - 3;
    mg.set_source_rgba(1, 1, 1, 0.10); mg.rectangle(G.fx0, fy, fw, 6); mg.fill();
    // live level (barycentric weight * mix), colored
    var lg = lastGain[i] || 0;
    if (lg > 0.001) { mg.set_source_rgba(c[0], c[1], c[2], 0.85); mg.rectangle(G.fx0, fy, fw * lg, 6); mg.fill(); }
    // volume handle
    var hx = G.fx0 + fw * (p.vol == null ? 1 : p.vol);
    mg.set_source_rgba(0.92, 0.94, 0.98, dimmed ? 0.4 : 0.95); mg.rectangle(hx - 2, cy - G.bs / 2 + 1, 4, G.bs - 2); mg.fill();

    // division label at right
    mg.set_font_size(9); mg.set_source_rgba(0.78, 0.83, 0.9, dimmed ? 0.4 : 0.9);
    var lbl = DIVS[p.di].label, tw = mg.text_measure(lbl);
    mg.move_to(W - 6 - tw[0], cy + 3); mg.show_text(lbl);
  }
  drawRail(mg);
}
// left MAP / MIX rail (drawn in both views, on top)
function drawRail(mg) {
  var half = H / 2;
  drawTab(mg, 0, 0, RAIL, half, "MAP", view === 0);
  drawTab(mg, 0, half, RAIL, H - half, "MIX", view === 1);
}
function drawTab(mg, x, y, w, h, label, active) {
  if (active) mg.set_source_rgba(1, 0.55, 0.15, 1); else mg.set_source_rgba(0.15, 0.17, 0.20, 1);
  mg.rectangle(x, y, w, h); mg.fill();
  mg.set_source_rgba(0, 0, 0, 0.45); mg.set_line_width(1); mg.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); mg.stroke();
  mg.set_font_size(11);
  mg.set_source_rgba(active ? 0.1 : 0.72, active ? 0.1 : 0.76, active ? 0.1 : 0.82, 1);
  var tw = mg.text_measure(label);
  mg.move_to(x + w / 2 - tw[0] / 2, y + h / 2 + 4); mg.show_text(label);
}
function drawBtn(mg, x, y, s, label, on, col) {
  if (on) { mg.set_source_rgba(col[0], col[1], col[2], 1); mg.rectangle(x, y, s, s); mg.fill(); }
  else { mg.set_source_rgba(1, 1, 1, 0.10); mg.rectangle(x, y, s, s); mg.fill(); }
  mg.set_source_rgba(on ? 0.1 : 0.7, on ? 0.1 : 0.7, on ? 0.1 : 0.75, 1);
  mg.set_font_size(8);
  var tw = mg.text_measure(label);
  mg.move_to(x + s / 2 - tw[0] / 2, y + s / 2 + 3); mg.show_text(label);
}

function onresize(w, h) {
  // Geometry is normalized, so nothing to rescale — just note the new pixel size
  // and repaint. The map fills whatever size Live (or the patcher) gives the jsui.
  W = w; H = h; mgraphics.redraw();
}

// build something to look at immediately (DSP is pushed on loadbang -> init)
buildConstellation(pendingCount);
