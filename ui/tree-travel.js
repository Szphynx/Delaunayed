/* ============================================================================
   TreeTravel — draws an L-system delay tree and animates one impulse
   travelling down its branches.

   Classic script like the rest of ui/, so a prototype opened off disk works:

     <script src="ui/tree-travel.js"></script>
     <script>
       var t = TreeTravel.mount(document.getElementById('svg'), nodes,
                                { speed: 0.3, labels: true, loop: true });
       t.play(); t.pause(); t.seek(0.75);
     </script>

   `nodes` is the control-rate output of the tree grower — the same array the
   DSP voice bank reads, one entry per delay node:

     { i, parent, t, db, note, x, y, px, py, depth, pan }

   i        index, parent  index of the node it reads from (-1 = root)
   t        arrival time in seconds, accumulated down the path
   db       node gain in dB, note  pitch ratio as a note name
   x,y      turtle position, px,py  parent's position (drawing only)
   pan      -1..1

   TreeTravel.frame(nodes, t) is pure and has no DOM in it: it answers "what is
   in flight, and what has just fired, at time t". The animation uses it to
   draw; the engine can use the same call to know which voices are sounding.
   ========================================================================= */
(function (root) {
  'use strict';

  /* ---- pure core -------------------------------------------------------- */
  function frame(nodes, t) {
    return nodes.map(function (n, i) {
      var start = n.parent < 0 ? 0 : nodes[n.parent].t;
      var span = Math.max(1e-4, n.t - start);
      var u = (t - start) / span;
      var flying = u >= 0 && u <= 1;
      return {
        i: i,
        u: u,
        flying: flying,
        x: flying ? n.px + (n.x - n.px) * u : n.x,
        y: flying ? n.py + (n.y - n.py) * u : n.y,
        fired: t >= n.t,
        since: t - n.t,
        label: '#' + n.i + '  ' + n.note + '  ' + n.db + ' dB'
      };
    });
  }

  function span(nodes) {
    return nodes.reduce(function (m, n) { return Math.max(m, n.t); }, 0);
  }

  /* ---- drawing ---------------------------------------------------------- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function mount(svg, nodes, opts) {
    opts = opts || {};
    var speed = opts.speed || 0.3, labels = opts.labels !== false,
        loop = opts.loop !== false, hold = opts.hold == null ? 1.6 : opts.hold,
        pad = opts.pad || 46;
    var box = (svg.getAttribute('viewBox') || '0 0 900 460').split(/\s+/).map(Number);
    var W = box[2], H = box[3];
    var xs = nodes.map(function (n) { return n.x; }).concat([0]);
    var ys = nodes.map(function (n) { return n.y; }).concat([0]);
    var k = Math.min((W - 2 * pad) / (Math.max.apply(null, xs) - Math.min.apply(null, xs) || 1),
                     (H - 2 * pad) / (Math.max.apply(null, ys) - Math.min.apply(null, ys) || 1));
    var ox = W / 2 - k * (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, oy = H - pad;
    var TX = function (x) { return ox + k * x; }, TY = function (y) { return oy + k * y; };
    var hue = function (n) { return 200 + n.depth * 14; };

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    nodes.forEach(function (n) {
      svg.appendChild(el('line', { 'class': 'tt-edge', x1: TX(n.px), y1: TY(n.py),
                                   x2: TX(n.x), y2: TY(n.y) }));
    });
    nodes.forEach(function (n) {
      svg.appendChild(el('circle', { 'class': 'tt-node', cx: TX(n.x), cy: TY(n.y), r: 2 }));
    });

    var lit = nodes.map(function (n) {
      var c = el('circle', { cx: TX(n.x), cy: TY(n.y), r: 5, opacity: 0,
                             fill: 'hsl(' + hue(n) + ' 90% 66%)' });
      svg.appendChild(c); return c;
    });
    var dots = nodes.map(function (n) {
      var g = el('g', { opacity: 0 });
      g.appendChild(el('circle', { r: 4.6, fill: 'hsl(' + hue(n) + ' 85% 62%)' }));
      if (labels) {
        var left = n.x < n.px;
        var lab = el('text', { 'class': 'tt-label', x: left ? -9 : 9, y: 3.5,
                               'text-anchor': left ? 'end' : 'start' });
        g.appendChild(lab);
        g._lab = lab;
      }
      svg.appendChild(g); return g;
    });

    var END = span(nodes) + 0.9;
    function draw(t) {
      frame(nodes, t).forEach(function (f, i) {
        if (f.flying) {
          dots[i].setAttribute('transform',
            'translate(' + TX(f.x).toFixed(1) + ',' + TY(f.y).toFixed(1) + ')');
          dots[i].setAttribute('opacity', 0.35 + 0.65 * Math.min(1, f.u * 3));
          if (dots[i]._lab) {
            dots[i]._lab.textContent = f.label;
            dots[i]._lab.setAttribute('opacity', f.u > 0.2 && f.u < 0.88 ? 1 : 0);
          }
        } else dots[i].setAttribute('opacity', 0);
        lit[i].setAttribute('opacity', f.fired ? Math.max(0.28, 1 - f.since * 1.1) : 0);
        lit[i].setAttribute('r', f.fired && f.since < 0.35 ? 5 + 9 * f.since : 5);
      });
      if (opts.onTick) opts.onTick(t);
    }

    var raf = null, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var t = (ts - t0) / 1000 * speed;
      draw(Math.min(t, END));
      if (t < END + hold) raf = requestAnimationFrame(step);
      else if (loop) { t0 = null; raf = requestAnimationFrame(step); }
      else raf = null;
    }
    var api = {
      play: function () { if (raf) cancelAnimationFrame(raf); t0 = null; raf = requestAnimationFrame(step); },
      pause: function () { if (raf) cancelAnimationFrame(raf); raf = null; },
      seek: function (t) { api.pause(); draw(t); },
      end: END,
      nodes: nodes
    };
    return api;
  }

  var TreeTravel = { frame: frame, span: span, mount: mount };
  if (typeof module === 'object' && module.exports) module.exports = TreeTravel;
  root.TreeTravel = TreeTravel;
})(typeof window === 'undefined' ? global : window);
