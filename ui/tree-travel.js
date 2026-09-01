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
    var edges = nodes.map(function (n) {
      var e = el('line', { 'class': 'tt-edge', x1: TX(n.px), y1: TY(n.py),
                           x2: TX(n.x), y2: TY(n.y) });
      svg.appendChild(e); return e;
    });
    var pts = nodes.map(function (n) {
      var c = el('circle', { 'class': 'tt-node', cx: TX(n.x), cy: TY(n.y), r: 2 });
      svg.appendChild(c); return c;
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
    /* Same tree, moved: a wind field re-grows it every control tick, so only
       the coordinates change. Rebuilding the DOM 20 times a second to say that
       would be silly. */
    function update(next) {
      nodes = next;
      nodes.forEach(function (n, i) {
        edges[i].setAttribute('x1', TX(n.px)); edges[i].setAttribute('y1', TY(n.py));
        edges[i].setAttribute('x2', TX(n.x));  edges[i].setAttribute('y2', TY(n.y));
        pts[i].setAttribute('cx', TX(n.x));    pts[i].setAttribute('cy', TY(n.y));
        lit[i].setAttribute('cx', TX(n.x));    lit[i].setAttribute('cy', TY(n.y));
      });
    }

    var api = {
      update: update,
      play: function () { if (raf) cancelAnimationFrame(raf); t0 = null; raf = requestAnimationFrame(step); },
      pause: function () { if (raf) cancelAnimationFrame(raf); raf = null; },
      seek: function (t) { api.pause(); draw(t); },
      end: END,
      nodes: nodes
    };
    return api;
  }

  /* ---- canvas painter ----------------------------------------------------
     The chassis draws to a canvas at two very different sizes, so this fits
     the tree to whatever box it is given. Same encoding as the SVG mount:
     stroke width is node gain, hue is pitch, a dot is the signal in flight. */
  function paint(ctx, W, H, nodes, t, opts) {
    opts = opts || {};
    var pad = opts.pad == null ? 12 : opts.pad;
    var xs = nodes.map(function (n) { return n.x; }).concat([0]);
    var ys = nodes.map(function (n) { return n.y; }).concat([0]);
    var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs);
    var miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
    var k = Math.min((W - 2 * pad) / ((maxx - minx) || 1), (H - 2 * pad) / ((maxy - miny) || 1));
    var ox = W / 2 - k * (minx + maxx) / 2, oy = H - pad + k * maxy;
    var TX = function (x) { return ox + k * x; }, TY = function (y) { return oy + k * y; };
    // Blue through teal only: pitch reads as a shift within one family rather
    // than a rainbow, which is what keeps a swaying tree legible.
    var hue = function (n) {
      var v = n.semi == null ? n.depth * 2 : n.semi;
      return 158 + Math.max(0, Math.min(60, v * 2.4 + 30));
    };

    // The chassis hands over a canvas it does not clear — each spec paints its
    // own ground, so a moving tree would otherwise smear across every frame.
    ctx.fillStyle = opts.bg || '#08192a';
    ctx.fillRect(0, 0, W, H);

    var f = frame(nodes, t);
    nodes.forEach(function (n) {
      ctx.strokeStyle = 'hsl(' + hue(n) + ' 62% ' + Math.min(70, 34 + 40 * n.gain) + '%)';
      ctx.lineWidth = Math.max(0.6, 4 * n.gain);
      ctx.beginPath();
      ctx.moveTo(TX(n.px), TY(n.py));
      ctx.lineTo(TX(n.x), TY(n.y));
      ctx.stroke();
    });
    nodes.forEach(function (n, i) {
      if (!f[i].fired) return;
      ctx.fillStyle = 'hsl(' + hue(n) + ' 85% 64%)';
      ctx.globalAlpha = Math.max(0.25, 1 - f[i].since * 1.1);
      ctx.beginPath();
      ctx.arc(TX(n.x), TY(n.y), Math.max(1.4, 3.2 * n.gain + (f[i].since < 0.3 ? 6 * f[i].since : 0)), 0, 6.284);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // A whole generation is in flight at once, so labelling every dot buries
    // the tree. Three at a time is enough to read what a dot carries.
    var labelled = 0, LABEL_MAX = opts.labelMax || 3;
    f.forEach(function (d, i) {
      if (!d.flying) return;
      ctx.fillStyle = 'hsl(' + hue(nodes[i]) + ' 90% 70%)';
      ctx.beginPath(); ctx.arc(TX(d.x), TY(d.y), 3, 0, 6.284); ctx.fill();
      if (opts.labels && labelled < LABEL_MAX && d.u > 0.2 && d.u < 0.88) {
        labelled++;
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(159,199,218,.9)';
        ctx.textAlign = nodes[i].x < nodes[i].px ? 'right' : 'left';
        ctx.fillText(d.label, TX(d.x) + (nodes[i].x < nodes[i].px ? -7 : 7), TY(d.y) + 3);
      }
    });
  }

  var TreeTravel = { frame: frame, span: span, mount: mount, paint: paint };
  if (typeof module === 'object' && module.exports) module.exports = TreeTravel;
  root.TreeTravel = TreeTravel;
})(typeof window === 'undefined' ? global : window);
