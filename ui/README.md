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
| `audio-session.js` | `AudioSession.unlock()/.attach()/.decode()` — keeps WebAudio audible on iOS. Inlined verbatim in the four single-file prototypes; keep the copies in sync. |
| `effects/delaunay.js` | Engine A of `prototypes/delaunay_delay.html`, as a spec. |
| `effects/wfc.js` | `prototypes/wfc_multitap.html`, as a spec. Second consumer — keeps the chassis honest. |
| `index.html` | Host page and effect picker. Copy it to start a new device. |
| *(consumer)* | [`../prototypes/delaunay_chassis.html`](../prototypes/delaunay_chassis.html) — the same spec with a real WebAudio engine attached. |
| `test_chassis.js` | `node ui/test_chassis.js` — 29 checks, no framework. |

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
