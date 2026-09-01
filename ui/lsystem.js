/* ============================================================================
   LSystem — grows the delay tree, and bends it in the wind.

   Classic script like the rest of ui/ (file:// safe):

     <script src="ui/lsystem.js"></script>
     var nodes = LSystem.grow({ branch:2, angle:34, ratio:0.88, decay:0.82,
                                baseLen:0.45, maxDepth:4, key:'minor_pentatonic' });
     var bent = LSystem.grow(params, LSystem.wind(t, params));

   Everything here is pure. No audio, no DOM — the prototype builds a WebAudio
   voice per node, and the visualiser draws the same array.

   The "formula" is these numbers: branch children per node, angle between them,
   ratio shortening each generation, decay per generation, and the key table.
   A grammar string buys nothing until the tree needs asymmetric rules.
   ========================================================================= */
(function (root) {
  'use strict';

  var KEYS = {
    minor_pentatonic: [0, 3, 5, 7, 10],
    natural_minor:    [0, 2, 3, 5, 7, 8, 10],
    dorian:           [0, 2, 3, 5, 7, 9, 10],
    major:            [0, 2, 4, 5, 7, 9, 11],
    phrygian:         [0, 1, 3, 5, 7, 8, 10],
    hijaz:            [0, 1, 4, 5, 7, 8, 11],
    hirajoshi:        [0, 2, 3, 7, 8],
    fifths:           [0, 7],
    octaves:          [0],
    chromatic:        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };
  var NAMES = ['A', 'A♯', 'B', 'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯'];

  function noteName(semi) {
    var s = Math.round(semi);
    return NAMES[((s % 12) + 12) % 12] + (3 + Math.floor((s + 9) / 12));
  }

  /* Absolute snap: nearest degree of a fixed key, any octave. A key is
     absolute and an interval is relative, so this quantises the ACCUMULATED
     pitch — snapping per-branch ratios drifts off the scale within a few
     generations. */
  function snapKey(semi, degrees, rootSemi) {
    // `semi` is an interval above the root, so the grid never moves with the
    // root — transposing the key transposes the whole tree by exactly that.
    var oct = Math.floor(semi / 12), rem = semi - oct * 12;
    var best = degrees[0], bestD = Infinity;
    degrees.concat([12]).forEach(function (d) {
      var dd = Math.abs(d - rem);
      if (dd < bestD) { bestD = dd; best = d; }
    });
    if (best === 12) { best = degrees[0]; oct += 1; }
    return (rootSemi || 0) + oct * 12 + best;
  }

  function defaults(p) {
    p = p || {};
    return {
      branch: p.branch == null ? 2 : p.branch,
      angle: p.angle == null ? 34 : p.angle,
      ratio: p.ratio == null ? 0.88 : p.ratio,
      decay: p.decay == null ? 0.82 : p.decay,
      baseLen: p.baseLen == null ? 0.45 : p.baseLen,
      centsPerDeg: p.centsPerDeg == null ? 8 : p.centsPerDeg,
      key: p.key || 'minor_pentatonic',
      rootSemi: p.rootSemi || 0,
      maxDepth: p.maxDepth == null ? 4 : p.maxDepth,
      floor: p.floor == null ? 1e-3 : p.floor,
      windAmount: p.windAmount == null ? 0 : p.windAmount,
      windRate: p.windRate == null ? 0.12 : p.windRate,
      gust: p.gust == null ? 0.5 : p.gust
    };
  }

  /* ---- grow --------------------------------------------------------------
     Delay times COMPOUND: a child reads its parent's output, so its time is
     the parent's plus its own segment. That is what makes the tail
     self-similar instead of a flat tap list.

     `w` is the wind field's value right now (see wind() below). It bends each
     heading before anything is derived from it, so one call gives the bent
     geometry, the bent pitches and the stretched delay times together — the
     drawing and the audio can never disagree about where the tree is. */
  function grow(params, w) {
    var p = defaults(params), degrees = KEYS[p.key] || KEYS.minor_pentatonic;
    var nodes = [];
    w = w || 0;
    function walk(parent, t, g, heading, depth, x, y, len) {
      if (depth > p.maxDepth || g < p.floor) return;
      // wind bends the tips more than the trunk, and a child inherits its
      // parent's bend, so a gust swings whole branches rather than twitching
      // single nodes
      var flex = Math.pow((depth + 1) / (p.maxDepth + 1), 1.3);
      var bend = w * p.windAmount * flex * p.angle;
      heading += bend;
      // a bent branch is a stretched one, and its delay time goes with it —
      // that drag is the chirp you hear while the wind moves
      t += p.baseLen * Math.pow(p.ratio, depth) * (1 + 0.02 * bend / Math.max(1, p.angle));
      g *= p.decay;
      var nx = x + len * Math.sin(heading * Math.PI / 180);
      var ny = y - len * Math.cos(heading * Math.PI / 180);
      var semi = snapKey(heading * p.centsPerDeg / 100, degrees, p.rootSemi);
      var i = nodes.length;
      nodes.push({ i: i, parent: parent, t: +t.toFixed(5), gain: g, bend: +bend.toFixed(2),
                   db: +(20 * Math.log10(Math.max(g, 1e-6))).toFixed(1),
                   semi: semi, note: noteName(semi), heading: heading, depth: depth,
                   pan: +Math.sin(heading * Math.PI / 180).toFixed(3),
                   x: +nx.toFixed(2), y: +ny.toFixed(2), px: +x.toFixed(2), py: +y.toFixed(2) });
      for (var k = 0; k < p.branch; k++) {
        var spread = p.branch === 1 ? 0 : (2 * k / (p.branch - 1) - 1);
        walk(i, t, g, heading + spread * p.angle, depth + 1, nx, ny, len * p.ratio);
      }
    }
    walk(-1, 0, 1, 0, 0, 0, 0, 150);
    return nodes;
  }

  /* ---- wind --------------------------------------------------------------
     Two slow sines plus a gust that swells and fades: a pulsing field, not an
     LFO. Returns roughly -1..1. */
  function wind(t, params) {
    var p = defaults(params);
    var base = 0.6 * Math.sin(2 * Math.PI * p.windRate * t)
             + 0.4 * Math.sin(2 * Math.PI * p.windRate * 1.618 * t + 1.1);
    var g = Math.pow(Math.max(0, Math.sin(2 * Math.PI * p.windRate * 0.37 * t)), 3);
    return base * (1 - p.gust) + g * p.gust * 1.6 * Math.sign(base || 1);
  }

  var LSystem = { KEYS: KEYS, grow: grow, wind: wind,
                  snapKey: snapKey, noteName: noteName, defaults: defaults };
  if (typeof module === 'object' && module.exports) module.exports = LSystem;
  root.LSystem = LSystem;
})(typeof window === 'undefined' ? global : window);
