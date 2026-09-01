/* ============================================================================
   DLNY randomize — one dice for the whole patch, and a knob for how far it
   is allowed to throw.

   The knob is an *amount*, not a seed. It sets how much of each parameter's
   own travel the dice may use: at 0% the dice is a no-op, at 100% anything can
   land anywhere it may legally sit, and in between each parameter gets a
   window of that width centred on where it is now. So one button means "vary
   this a little" or "give me something else entirely" depending only on where
   the knob is, and a patch you already like drifts instead of being replaced.

   The window is *reflected* off the ends of the range, not clipped. A
   parameter already at its maximum would otherwise only ever be thrown
   downwards; over repeated presses the extremes would act as one-way valves
   and quietly pull every patch toward the middle.

   Two ways in, because the surfaces are built two different ways:

     Randomize.apply(list, amount)   — control descriptors {obj,key,min,max},
                                       which is what a chassis spec declares.
     Randomize.sliders(root, amount) — every <input type=range> under `root`,
                                       which is what the single-file prototypes
                                       have. Skips [data-rnd="off"].

   Randomize.mount(host, {roll}) builds the dice + knob cluster and calls
   `roll(amount)` on each press — the caller picks which of the two it wants.

   Classic script, ES5, no build step: same reasons as ui/chassis.js. The CSS
   is injected from here rather than added to ui/chassis.css because the four
   single-file prototypes have no shared stylesheet to put it in and have to
   keep working opened straight off disk. It reads --acc/--ink/--panel/--line
   from whatever page it lands in, with the chassis values as fallbacks, so one
   cluster looks native in both.
   ========================================================================= */
var Randomize = (function () {
  'use strict';

  var DEFAULT_AMOUNT = 35;

  /* The die face is drawn, not typed. U+2680..2685 have no coverage on a bare
     Linux font set and fall back to tofu, and the emoji die is colour-locked.
     Pips inherit currentColor, so the button's hover and press states carry. */
  var PIPS = [[7, 7], [17, 7], [7, 12], [12, 12], [17, 12], [7, 17], [17, 17]];
  var FACES = [[3], [0, 6], [0, 3, 6], [0, 1, 5, 6], [0, 1, 3, 5, 6], [0, 1, 2, 4, 5, 6]];
  var SVG = 'http://www.w3.org/2000/svg';

  function die(n) {
    var svg = document.createElementNS(SVG, 'svg'), box = document.createElementNS(SVG, 'rect');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    box.setAttribute('x', 2.5); box.setAttribute('y', 2.5);
    box.setAttribute('width', 19); box.setAttribute('height', 19); box.setAttribute('rx', 3);
    box.setAttribute('fill', 'none'); box.setAttribute('stroke', 'currentColor');
    box.setAttribute('stroke-width', 1.7);
    svg.appendChild(box);
    FACES[n].forEach(function (i) {
      var c = document.createElementNS(SVG, 'circle');
      c.setAttribute('cx', PIPS[i][0]); c.setAttribute('cy', PIPS[i][1]);
      c.setAttribute('r', 1.9); c.setAttribute('fill', 'currentColor');
      svg.appendChild(c);
    });
    return svg;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- the model ----------
     Everything the dice does is this one function and the window it draws. */

  // The slice of [min,max] the dice may land in, given where the value is now.
  // Returns [lo,hi]; width is amount% of the full span, reflected at the ends.
  function window_(cur, min, max, amount) {
    var span = max - min;
    var w = span * clamp(amount, 0, 100) / 100;
    var lo = clamp(cur, min, max) - w / 2, hi = lo + w;
    if (lo < min) { hi = Math.min(max, hi + (min - lo)); lo = min; }
    if (hi > max) { lo = Math.max(min, lo - (hi - max)); hi = max; }
    return [lo, hi];
  }

  // A range input with no step attribute steps by 1, and every chassis control
  // is bound to an integer state key — so 1 is the default here too, not 0.
  function stepOf(c) {
    var s = +c.step;
    return (isFinite(s) && s > 0) ? s : 1;
  }

  function pick(cur, c, amount, rand) {
    var min = +c.min, max = +c.max;
    if (!(max > min)) return cur;
    cur = clamp(+cur, min, max);
    var w = window_(cur, min, max, amount);
    if (!(w[1] > w[0])) return cur;
    var step = stepOf(c);
    var v = min + Math.round((w[0] + (rand || Math.random)() * (w[1] - w[0]) - min) / step) * step;
    v = clamp(v, min, max);
    // A fractional step (the insert-FX sliders use span/100) otherwise lands on
    // 0.30000000000000004 and shows up in a readout.
    return step < 1 ? +v.toFixed(6) : v;
  }

  /* ---------- descriptor form (chassis specs) ---------- */

  // Writes obj[key] in place. Returns how many values actually moved.
  function apply(list, amount, rand) {
    var moved = 0;
    (list || []).forEach(function (c) {
      if (!c || !c.obj || !(c.key in c.obj)) return;
      var was = c.obj[c.key], now = pick(was, c, amount, rand);
      if (now !== was) { c.obj[c.key] = now; moved++; }
    });
    return moved;
  }

  /* ---------- DOM form (the single-file prototypes) ---------- */

  function eligible(r) {
    return r.type === 'range' && !r.disabled && r.getAttribute('data-rnd') !== 'off' &&
           +r.max > +r.min;
  }

  function inputs(root) {
    var all = (root || document).querySelectorAll('input[type=range]'), out = [], i;
    for (i = 0; i < all.length; i++) if (eligible(all[i])) out.push(all[i]);
    return out;
  }

  // Sets each slider and fires input + change, so whatever the page already
  // wired to those events does the work — nothing here knows what a slider means.
  function sliders(root, amount, rand) {
    var list = inputs(root), moved = 0;
    list.forEach(function (r) {
      var was = r.value;
      var v = pick(+r.value, { min: r.min, max: r.max, step: r.step }, amount, rand);
      r.value = v;
      if (r.value === was) return;
      moved++;
      r.dispatchEvent(new Event('input', { bubbles: true }));
      r.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return moved;
  }

  /* ---------- showing the range on the sliders themselves ----------
     --rlo/--rhi are the window as track percentages. A surface that paints
     them (ui/chassis.css does) shows every slider's reach while you turn the
     knob, which is the whole point of the knob being a range and not a seed. */
  function band(r, amount) {
    var min = +r.min, max = +r.max, lo = '0%', hi = '0%';
    if (eligible(r) && amount > 0) {
      var w = window_(+r.value, min, max, amount), span = max - min;
      lo = ((w[0] - min) / span * 100).toFixed(2) + '%';
      hi = ((w[1] - min) / span * 100).toFixed(2) + '%';
    }
    r.style.setProperty('--rlo', lo);
    r.style.setProperty('--rhi', hi);
  }

  function bands(root, amount) {
    var all = (root || document).querySelectorAll('input[type=range]'), i;
    for (i = 0; i < all.length; i++) band(all[i], amount);
  }

  /* ---------- the cluster ---------- */

  var CSS =
    '.rnd{display:flex;align-items:center;gap:6px;flex:0 0 auto}' +
    '.rnd-lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;' +
      'color:var(--mut,#6d6d6d);white-space:nowrap}' +
    '.rnd-dice{width:var(--rs,30px);height:var(--rs,30px);flex:0 0 auto;padding:0;margin:0;' +
      'display:flex;align-items:center;justify-content:center;border-radius:0;' +
      'background:transparent;border:1px solid var(--line2,#444);color:var(--mut,#6d6d6d);' +
      'line-height:1;cursor:pointer;transition:.12s}' +
    '.rnd-dice svg{width:calc(var(--rs,30px)*.62);height:calc(var(--rs,30px)*.62);display:block}' +
    '.rnd-dice:hover{color:var(--ink,#eaeaea);border-color:#555}' +
    '.rnd-dice.roll{background:var(--acc,#ff2a2a);border-color:var(--acc,#ff2a2a);color:#000}' +
    /* 270deg of arc starting at 7:30, so the gap sits at the bottom where a
       hardware knob's gap is. --k is the amount as 0..1. */
    '.rnd-knob{--k:0;position:relative;width:var(--rs,30px);height:var(--rs,30px);' +
      'flex:0 0 auto;border-radius:50%;cursor:ns-resize;touch-action:none;' +
      'display:flex;align-items:center;justify-content:center;-webkit-user-select:none;' +
      'user-select:none;background:conic-gradient(from 225deg,' +
      'var(--acc,#ff2a2a) 0 calc(var(--k)*270deg),' +
      'var(--line2,#444) calc(var(--k)*270deg) 270deg,transparent 270deg)}' +
    '.rnd-knob::before{content:"";position:absolute;inset:3px;border-radius:50%;' +
      'background:var(--panel,#101010);border:1px solid var(--line,#252525)}' +
    '.rnd-knob:focus-visible{outline:2px solid var(--c1,#5ad1c8);outline-offset:2px}' +
    '.rnd-num{position:relative;pointer-events:none;font-size:9px;font-weight:700;' +
      'color:var(--ink,#eaeaea);font-variant-numeric:tabular-nums;letter-spacing:-.03em}' +
    '@media (prefers-reduced-motion:reduce){.rnd-dice{transition:none}}';

  function css() {
    if (typeof document === 'undefined' || document.getElementById('rnd-css')) return;
    var s = document.createElement('style');
    s.id = 'rnd-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // host: where the cluster goes. o.roll(amount) does the actual work.
  // o.amount initial value, o.size px (the number hides under 26), o.label text,
  // o.onAmount(amount) fires as the knob turns — repaint your bands there.
  // Returns { el, amount(), set(v) } — set() is for keeping a second mount of
  // the same state in sync and does not call back.
  function mount(host, o) {
    css();
    o = o || {};
    var size = o.size || 30;
    var amount = clamp(o.amount == null ? DEFAULT_AMOUNT : +o.amount, 0, 100);

    var wrap = document.createElement('div');
    wrap.className = 'rnd';
    wrap.style.setProperty('--rs', size + 'px');

    if (o.label) {
      var lbl = document.createElement('span');
      lbl.className = 'rnd-lbl';
      lbl.textContent = o.label;
      wrap.appendChild(lbl);
    }

    var dice = document.createElement('button');
    dice.type = 'button';
    dice.className = 'rnd-dice';
    dice.appendChild(die(4));
    dice.setAttribute('aria-label', 'Randomise every parameter');
    var knob = document.createElement('div');
    knob.className = 'rnd-knob';
    knob.tabIndex = 0;
    knob.setAttribute('role', 'slider');
    knob.setAttribute('aria-label', 'Randomise amount');
    knob.setAttribute('aria-valuemin', '0');
    knob.setAttribute('aria-valuemax', '100');
    var num = null;
    if (size >= 26) {
      num = document.createElement('b');
      num.className = 'rnd-num';
      knob.appendChild(num);
    }
    wrap.append(dice, knob);
    if (host) host.appendChild(wrap);

    function show() {
      knob.style.setProperty('--k', (amount / 100).toFixed(4));
      knob.setAttribute('aria-valuenow', amount);
      knob.setAttribute('aria-valuetext', '±' + Math.round(amount / 2) + '% of each range');
      knob.title = 'Randomise amount — ' + amount + '%' +
                   (amount === 0 ? ' (dice does nothing)' : '');
      if (num) num.textContent = amount;
      dice.title = amount === 0 ? 'Randomise — turn the knob up first'
                                : 'Randomise every parameter by up to ' + amount + '%';
    }
    function set(v, quiet) {
      v = clamp(Math.round(v), 0, 100);
      if (v === amount) { show(); return; }
      amount = v;
      show();
      if (!quiet && o.onAmount) o.onAmount(amount);
    }

    dice.onclick = function () {
      // A different face every press, so a roll that moves nothing visible
      // (knob at 0, or a page whose sliders are all elsewhere) still reads as
      // "that registered" rather than "that button is broken".
      dice.textContent = '';
      dice.appendChild(die(Math.floor(Math.random() * FACES.length)));
      dice.classList.add('roll');
      setTimeout(function () { dice.classList.remove('roll'); }, 140);
      if (o.roll) o.roll(amount);
    };

    /* Vertical drag: 140px of travel covers the full range, which is about a
       thumb's reach on the phone body and a comfortable mouse throw. */
    var dragFrom = 0, dragAt = 0;
    knob.addEventListener('pointerdown', function (e) {
      knob.setPointerCapture(e.pointerId);
      dragFrom = amount; dragAt = e.clientY;
      e.preventDefault();
    });
    knob.addEventListener('pointermove', function (e) {
      if (!knob.hasPointerCapture || !knob.hasPointerCapture(e.pointerId)) return;
      set(dragFrom + (dragAt - e.clientY) / 140 * 100);
    });
    knob.addEventListener('wheel', function (e) {
      e.preventDefault();
      set(amount + (e.deltaY < 0 ? 2 : -2));
    }, { passive: false });
    knob.addEventListener('keydown', function (e) {
      var k = e.key, d = 0;
      if (k === 'ArrowUp' || k === 'ArrowRight') d = 1;
      else if (k === 'ArrowDown' || k === 'ArrowLeft') d = -1;
      else if (k === 'PageUp') d = 10;
      else if (k === 'PageDown') d = -10;
      else if (k === 'Home') { e.preventDefault(); set(0); return; }
      else if (k === 'End') { e.preventDefault(); set(100); return; }
      else return;
      e.preventDefault();
      set(amount + d);
    });

    show();
    return { el: wrap, amount: function () { return amount; },
             set: function (v) { set(v, true); } };
  }

  return { window: window_, pick: pick, apply: apply, sliders: sliders,
           inputs: inputs, band: band, bands: bands, mount: mount, die: die,
           DEFAULT_AMOUNT: DEFAULT_AMOUNT };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Randomize;
