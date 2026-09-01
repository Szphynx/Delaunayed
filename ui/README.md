# `ui/` — the DLNY chassis

One control surface, two device bodies. Mobile portrait (**390 × 844**) and the Live
device strip (**632 × 168**) are transposes of each other, so both are driven by the
same page spec: a canvas that takes all the space it can get, a transport that never
moves, and a small control cluster that pages.

Open [`index.html`](index.html) — it mounts whichever effect you pick into both bodies
at 1:1. Run the self-check with `node ui/test_chassis.js`.

| File | What it is |
|---|---|
| `chassis.css` | All device chrome, both bodies. Scoped under `.dlny`, dark-only. |
| `chassis.js` | `Chassis.mount(host, spec, 'phone'\|'rack')` + the reusable page bodies. |
| `randomize.js` | `Randomize.mount()` — the dice button and its amount knob, plus the model behind them. The chassis mounts it into the transport itself; the four single-file prototypes inline a copy that rolls their `<input type=range>` sliders instead. Keep the copies in sync. |
| `rhodes.js` | `Rhodes.create(AC)` — a two-operator FM electric piano, so an effect can be played with notes instead of a sample. `node ui/test_rhodes.js`. |
| `audio-session.js` | `AudioSession.unlock()/.attach()/.decode()` — keeps WebAudio audible on iOS, and decodes AIFF/AIFC, which only Safari takes natively. Inlined verbatim in the four single-file prototypes; keep the copies in sync. |
| `effects/delaunay.js` | Engine A of `prototypes/delaunay_delay.html`, as a spec. |
| `effects/wfc.js` | `prototypes/wfc_multitap.html`, as a spec. Second consumer — keeps the chassis honest. |
| `effects/lsystem.js` | The L-system branching delay tree, as a spec. Five pages: TREE, TIME, KEY, WIND, OUT. |
| `lsystem.js` | `LSystem.grow(params, wind)` — the tree itself. Pure, no DOM, no audio. `node ui/test_lsystem.js`. |
| `index.html` | Host page and effect picker. Copy it to start a new device. |
| *(consumer)* | [`../prototypes/delaunay_chassis.html`](../prototypes/delaunay_chassis.html) — the same spec with a real WebAudio engine attached. |
| *(consumer)* | [`../prototypes/lsystem_chassis.html`](../prototypes/lsystem_chassis.html) — `lsystem` spec in both bodies, with one WebAudio voice per tree node attached. |
| *(consumer)* | [`../prototypes/wfc_chassis.html`](../prototypes/wfc_chassis.html) — `wfc` spec, phone body only, with a real WebAudio engine (grain capture + gated multitap) attached. |
| `test_chassis.js` | `node ui/test_chassis.js` — 29 checks, no framework. |
| `test_audio_session.js` | `node ui/test_audio_session.js` — 8 checks on the AIFF parser, no fixtures on disk. |
| `test_randomize.js` | `node ui/test_randomize.js` — 21 checks on the dice: the window, the step, the structural opt-out. |

Classic scripts, not ES modules: the prototypes open straight off disk by double-click
and `file://` blocks module imports. There is no build step and no dependency.

---

## Adding an effect

One file in `effects/`, registered on the global `DLNY`, then a `<script>` tag in
`index.html`. Nothing else.

```js
var DLNY = window.DLNY || (window.DLNY = {});

(function () {
  var F = Chassis.fmt;
  var S = { on: true, play: false, tab: 'MIX', wet: 60, fb: 30, rate: 4, depth: 50 };

  DLNY.kuramoto = {
    name: 'Kuramoto',
    meta: 'AUDIO FX · KUR-01',
    state: S,
    tabs: ['MIX', 'PHASE', 'OUT'],

    transport: function (s) {
      return [
        { label: '▶', accent: true, on: s.play, tap: function () { s.play = !s.play; } },
        { label: 'SYNC', on: s.sync, tap: function () { s.sync = !s.sync; } }
      ];
    },

    pages: {
      MIX: {
        context: function () { return 'Master bus'; },
        controls: function (s) {
          return [
            { label: 'Dry/Wet', obj: s, key: 'wet', min: 0, max: 100, fmt: F.pct },
            { label: 'Feedback', obj: s, key: 'fb', min: 0, max: 90, fmt: F.pct }
          ];
        }
      },
      PHASE: { /* … */ },
      OUT:   { /* … */ }
    },

    draw: function (ctx, W, H, s) { /* paint the oscillator ring */ },
    pointer: function (phase, q, s, api) { /* phase: down|hold|move|holdmove|up */ },
    readout: function (s) { return 'R <b>' + s.order.toFixed(2) + '</b>'; },
    tick: function (s, seconds) { /* return true if something changed */ }
  };
})();
```

### Rules the chassis assumes

- **Keep geometry normalized to [0,1].** This is the whole reason one constellation
  renders correctly in a 390 × 352 square *and* a 288 × 156 letterbox. A spec that
  stores pixel coordinates works in exactly one body.
- **At most four controls per page.** The rack lays them out 2 × 2 in 106 px. The
  self-check enforces this.
- **A control that changes the element count needs `commit: 'change'`.** Committing on
  every `input` event rebuilds the page under the slider you're holding. Also enforced.
- **`draw` gets a context that may already be alpha'd down** (device bypassed). Read
  `ctx.globalAlpha` before setting it if you nest transparency.

### Page bodies you don't have to write

- `Chassis.strips({items, level, selected, select, extras})` — a mixer page: fader, mute,
  solo and a live level bar per element. Add `levelAt(i, s)` to the page so the bars
  animate between rebuilds. `extras` adds thin sliders under each fader —
  `[{key, min, max, label}]`. Pan and tone live there rather than on a parameter page,
  the way a channel strip has them.
- `Chassis.rack(FXDEF, {owner, emptyText})` — an insert-FX page for the selected element.
  `FXDEF` maps a key to `[name, param label, min, max, default]`.
- Anything else: give the page a `render(host, state, api)` and build it yourself.

### Formatters

`Chassis.fmt` has `raw`, `pct`, `ms`, `db`, `hz` (1000 → `1.0k`), `pan` (0 → `C`,
−40 → `L40`), and `list(array)` for sliders that step through labels — note divisions,
tile names, scale degrees.

### A dropdown instead of a slider

Give a control `type: 'select'` and it renders as a native `<select>` instead of a
range — for a choice with no meaningful "between" (a preset, a named mode), where
stepping through with a slider makes you scrub past everything in between to reach
the one you want. `groups: [{label, options: [{value, label}]}]` renders one
`<optgroup>` per group (`effects/lsystem.js`'s Preset control uses this for Factory
Presets vs. User Presets); a flat `options: [{value, label}]` works when there's only
one group. It always commits on change — there's no drag to protect the way a range
control's `commit: 'change'` protects one — so `onInput` fires immediately. Still
excluded from the dice for free: `randomizable()`'s numeric-range check
(`+c.max > +c.min`) already skips it without a select-specific case, since a select
has no `min`/`max`.

---

## The dice

One button in the transport rolls **every** parameter of the mounted spec, and the
knob beside it is how far it may throw: the share of each control's own range the
roll may land in, centred on where that control is now. 15% nudges a patch you like;
100% replaces it; 0% is a no-op. The window is *reflected* off the ends of a range
rather than clipped, or a value already at its maximum could only ever be thrown
downwards and repeated presses would walk every patch to the middle. Each slider
draws the slice it can reach behind its own track (`--rlo`/`--rhi` in `chassis.css`),
so the knob answers "how random is 40%?" on the page itself.

A spec gets this for free — `Chassis.randomizable(spec)` walks *every* page's
`controls`, not just the tab that happens to be open. Two hooks cover what a control
list can't say:

```js
// Extra descriptors, same shape as a page's controls, for values no page binds.
// `controls` only ever binds the *selected* tap or lane, and strips/rack pages
// bind nothing — without this a roll would move one tap out of fourteen.
randomize: function (s) {
  return s.pts.map(function (p) { return { obj: p, key: 'div', min: 0, max: 11 }; });
},

// Whatever isn't a numeric range: a tile map, a constellation, a geometry.
// Return how many values you moved.
roll: function (s, amount, rand) { … }
```

**Structural controls are excluded**, and that is the rule worth remembering: anything
carrying `commit: 'change'` changes the element count, so rolling it regenerates the
very taps or lanes the same roll just set. `rnd: true` on a control opts one back in;
`rnd: false` opts any control out. A DOM slider does the same with `data-rnd="off"`.

Both bodies share one knob, because the amount lives on `spec.state.rnd` — same
reason `s.tab` does. `spec.state.rnd` is the source of truth and the knob is its
view, so a preset that carries an amount takes effect on the next render.

The cluster lives *outside* the part of the transport that `buildTransport()` empties.
A roll re-renders, and a knob you are dragging must not be rebuilt out from under
your thumb.

The four single-file prototypes inline a copy that rolls their `<input type=range>`
sliders directly — it sets each one and fires `input` + `change`, so whatever the page
already wired to those events does the work and nothing in the dice knows what a
slider means. That copy leaves the per-slider band out: those are the browser's native
sliders, and Chrome paints them over anything the element paints behind them. There the
knob's arc and readout are the range display. Everything else is byte-identical, the CSS
block included — keep it that way.

---

## Interaction contract

Because one spec serves touch and mouse, the chassis normalizes the gestures that
differ and hands the effect a single callback:

| Chassis phase | Touch | Desktop |
|---|---|---|
| `down` | tap | click |
| `hold` | 400 ms long-press | right-click |
| `move` / `holdmove` | drag | drag |
| `up` | lift | release |

`q` also carries `shift`, so desktop can keep a gesture there is no room for on
touch. In `effects/delaunay.js` that is repositioning a node, because the plain
drag was taken by the edit gesture below.

`hold` is the one that matters. In the prototypes the channel editor is reachable only
through `contextmenu`, and node dragging is gated behind `e.shiftKey` — neither exists
on touch, so on a phone those paths are dead. Writing them against `hold` covers both
inputs from one branch.

Coordinates arrive normalized, with `q.aspect` (`canvas.width / canvas.height`) so
distance tests stay round instead of stretching with the body.

**Picking an element should reveal its page.** A selection that only shows as a ring on
the canvas is a dead end — the parameters stay hidden behind whatever tab you happened
to be on. `effects/delaunay.js` jumps to `TAP` on pick, *unless* the current page is
already about the selected node (`TAP` or `FX`), so changing which tap you're editing
doesn't yank you off the insert rack. Enforced by the self-check.

**Two parameters under one thumb.** Holding a node and dragging edits it on the
canvas: vertical is delay time, horizontal is feedback, both relative to the values
the tap had when grabbed so it never snaps on first touch. A badge on the canvas
shows both live, because the page below is under your thumb while you drag. The
axis scalings (`DRAG_DIV`, `DRAG_FB`) are named constants — tune those before
touching `PICK_R2`.

`effects/wfc.js` deliberately does **not** do this: its canvas is a paint surface, so
`down` lays down tiles and jumping pages on every stroke would be unusable. Lanes are
selected from the `LVL` strips instead. Reveal-on-pick suits canvases whose marks are
*objects*, not canvases you draw on.

---

## Known ceilings

- **`ponytail:`** Bowyer–Watson exists three times — here, in
  `prototypes/delaunay_delay.html`, and in `max/dlny.map.js`. The Max copy is the source
  of truth (it has the 7k-assertion suite); `jsui` can't load from `ui/`, so a shared
  module would only ever merge two of the three. Fold the two web copies together if
  they drift.
- **`ponytail:`** The published chassis study is a frozen snapshot with its CSS and JS
  inlined, so it can drift from these files. Re-inline it if the two ever disagree
  enough to matter; a five-line concatenation step is cheaper than a build system.
- Dark-only. A Live device has no light mode, so there is no theme layer to maintain.
- The effect specs carry no audio. They are the control surface; DSP stays in the
  prototypes and in `max/`. `prototypes/delaunay_chassis.html` shows the pattern: the
  audio layer **observes** state each frame and writes only what changed, so nothing is
  wired between the two and the spec still mounts standalone in `index.html`.
- **`ponytail:`** Per-tap pitch is a two-line delay shifter with a fixed 90 ms window,
  phase-aligned only at start, so large shifts warble. Good to about a fifth either way.
  Making it clean is an AudioWorklet, not a tuning change.
- **`ponytail:`** That prototype's freeze loops a slice of the *source*, not the processed
  output — a few lines instead of a capture graph, and it sounds right for a buffer. It
  does nothing for live mic input; ring-buffer it through an AudioWorklet if that matters.

## `tree-travel.js` — the L-system delay tree, drawn and animated

`TreeTravel.mount(svgEl, nodes, opts)` draws a delay tree and animates one impulse
travelling down it: a dot per branch in flight, labelled with node index, arrival level
in dB and the note its pitch ratio lands on. `opts` takes `speed`, `labels`, `loop`,
`hold`, `pad`, `onTick`; the returned handle has `play`, `pause`, `seek(t)` and `end`.

`nodes` is the grower's control-rate output, not a drawing format — the same array a
`poly~` voice bank would read:

    { i, parent, t, db, note, x, y, px, py, depth, pan }

`prototypes/lsystem_tree_delay.py` writes `assets/lsystem_travel.json` in exactly this
shape, one entry per variant. `x, y, px, py` are the only drawing-only fields; strip
them and the rest is the patch.

- **`ponytail:`** `TreeTravel.frame(nodes, t)` is pure and DOM-free — it answers "what is
  in flight and what has just fired at time t". The animation draws from it, and the
  engine can call the same function to know which voices are sounding. That's why the
  timing lives there and not in the render loop. `node ui/test_tree_travel.js` covers it.
- **`ponytail:`** User presets save to `localStorage` under `dlny.lsystem.userPresets` —
  no accounts, no server, no export/import. They live in this browser only, and a
  private window or cleared site data loses them. Naming is a bare `window.prompt`,
  and there's no delete; both are one line each to add if a real preset library ever
  needs them.
- **`ponytail:`** `rhodes.js` is two oscillators, two gains and a lowpass per note — a carrier
  at the note and a modulator 14× above it whose depth dies in ~120 ms, which is the tine.
  Velocity drives the modulation index, not just level, so digging in gets *brighter*. No
  samples, no wavetable, no library. It is not a Suitcase (no pickup asymmetry, no tremolo,
  no key-off thunk) but it plays in tune and sounds like the right instrument through a delay,
  which is all it is for.
- **`ponytail:`** The chassis hands `draw` a canvas it does not clear, so `TreeTravel.paint`
  paints its own ground. Without that a swaying tree smears across every frame — a spec
  that draws a still picture never notices.
- **`ponytail:`** Preset and scale values are abbreviated to six characters in
  `effects/lsystem.js` because the rack lays four controls into 106 px. The full name is
  the page's context line, which has the room.
- **`ponytail:`** Trees are exported at depth 4 (~31 nodes) for the page. The audio runs
  511. Animating the full tree is legible only as a cloud, so the shallow copy is the
  visualisation and the deep one is the sound; regenerate both from the same `grow()` call
  if the params change.
