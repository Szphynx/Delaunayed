# Delaunay Navigable Delay — Max for Live port

The Max port of engine **A** from [`../prototypes/delaunay_delay.html`](../prototypes/delaunay_delay.html):
a *navigable* multitap delay. Scatter N taps as points in a plane, Delaunay-triangulate them,
and drag a playhead — the three vertices of the triangle you're inside crossfade by
**barycentric weight** (always summing to 1), so you glide continuously across a constellation
of delay behaviors.

This is the architecture the main README prescribes: **geometry in JS → barycentric weights →
`poly~` of delay voices**. The weird math builds the *architecture*; `poly~` renders it.

## Files

| File | What it is |
|---|---|
| `dlny.maxpat` | The device: `jsui` brain → `poly~` voice bank → dry/wet → `plugout~`, plus all controls. |
| `dlny.voice.maxpat` | One `poly~` voice: feedback delay (`tapin~`/`tapout~`) → lowpass → gain(weight) → pan. |
| `dlny.map.js` | The brain (runs in `jsui`): Bowyer–Watson `delaunay()` + `bary()`, the draggable map, and all per-voice coefficient math. Ported 1:1 from the HTML. |
| `build_patches.py` | Regenerates the two `.maxpat` files. Edit patch structure here, not the JSON by hand. |

## Quick start

1. Put all four files in one folder (they are — keep them together; `poly~` and `jsui` load the
   siblings by name).
2. Open **`dlny.maxpat`** in Max 8+. It opens in **Presentation view** — a compact **vertical
   device panel** (≈360 px wide): controls up top, the constellation map, the per-tap editor row at
   the bottom. Drag on the map — the orange playhead moves and the taps crossfade. Click a node to
   load it into the editor. *(Patching view, ⌘E, has the full signal graph.)* The map's geometry is
   stored in **normalized [0,1] coordinates**, so it fills whatever size the `jsui` is given (Live
   panel, patcher, or a manual resize) with no clipping — nodes never land off-panel.
3. To make it a **Max for Live device**: in Ableton Live, drop a **Max Audio Effect** on a track,
   click **Edit** to open the Max editor, then **File ▸ Open** `dlny.maxpat` and copy its contents
   in — or simply **File ▸ Save As… → `Delaunay.amxd`** from Max once it's open as a device.
   The `plugin~` / `plugout~` objects only pass audio inside Live.

> **Auditioning in plain Max (no Live):** temporarily swap `plugin~` → `ezadc~` and
> `plugout~` → `ezdac~`, or drive `poly~` from any signal source into its left inlet.

> **If the map is blank:** select the `jsui` object, open its inspector, and set **Javascript File**
> to `dlny.map.js` (the `filename` attribute). Some Max versions want it set there rather than saved
> in the patch.

## Views — MAP / MIX tab

A vertical **`MAP` / `MIX`** tab on the left of the map switches what the map object shows (it's a
second view drawn by the same `jsui` — no extra files):

- **MAP** — the constellation (below).
- **MIX** — one row per tap: a **live level bar** (its current barycentric weight × mix), **M**ute /
  **S**olo buttons, a **volume** fader, and its note division. Mute/Solo/volume work by the brain
  scaling that tap's gain, so they take effect immediately while playing. Click a row to also load
  that tap into the editor. *(Per-tap insert FX — phaser / ring-mod / grain — are the next step;
  they need DSP added to each `poly~` voice.)*

## Map interaction (MAP view)

| Gesture | Result |
|---|---|
| **Drag** empty space | Move the playhead → barycentric morph across the 3 nearest taps |
| **Click** a node | Select it → its params load into the editor row |
| **Shift-drag** a node | Reposition it → the mesh re-triangulates live |

## Controls (top row = Live parameters)

- **Dry/Wet**, **Feedback** (master feedback trim), **Glide** (crossfade time-constant for every
  gain move), **Width** (pan spread), **Tempo** (one BPM clock), **Taps** (count for the next
  Regenerate), **Time** (½× · 1× · 2× feel), **Regen** (new constellation), **Drift** (hands-free
  Lissajous sweep of the playhead).
- **Editor row** (per selected tap): **div** (note division 0–11), **cutoff** (Hz), **pan** (−100…100),
  **fb** (0–90 %). Editing pushes straight to that voice.

Delay time per tap = `division_beats × 60/BPM × Time`, matching the prototype's 12-entry division
table (`1/16 … 1/1`, incl. triplet `T` and dotted `.`).

## How the prototype maps onto Max

| HTML prototype | Max port |
|---|---|
| `delaunay()`, `bary()`, `circumcircle()` (plain JS) | **same code**, verbatim, in `dlny.map.js` |
| canvas + pointer drag | `jsui` `paint()` + `onclick`/`ondrag` |
| WebAudio `DelayNode` + `BiquadFilter` + feedback `Gain` | `tapin~`/`tapout~` + `onepole~` + `*~` feedback |
| barycentric weight → tap `gain` (glide via `setTargetAtTime`) | brain sends `gain <w> <glide>` → `line~` |
| `StereoPanner` | constant-power `*~` pair driven by `expr` |
| master limiter bus | Live's own gain staging (add a `limi~` if you stack heavy feedback) |

## In this v1 (Delay engine) — and what's deferred

**In:** the full Delay · Delaunay engine — barycentric multitap morph, per-tap division / cutoff /
pan / feedback, tempo + divisions, dry/wet, master feedback, glide, width, time-feel, auto-drift,
live node repositioning.

**Deferred to the full device** (all implemented in the HTML as *inserted* nodes, so they belong in
a later pass): the **Freeze · Voronoi** engine, the per-channel **FX rack** (phaser/ringmod/grain),
the **mixer** strip (mute/solo/meters), **per-tap pitch** (a granular insert), **preset** save/load,
and the output **Tone** stage. The voice patch is deliberately a clean single insert-point
(`onepole~ → *~gain`) so those sub-patchers drop in next.

## Exporting the `.amxd`

`dlny.amxd` is a real Max for Live audio-effect device, built directly from `dlny.maxpat`:

```bash
python3 build_patches.py   # writes dlny.maxpat + dlny.voice.maxpat
python3 build_amxd.py      # wraps dlny.maxpat -> dlny.amxd
```

`build_amxd.py` uses the `.amxd` container format reverse-engineered byte-for-byte by
[py2max](https://github.com/shakfu/py2max) (`ampf` header + NUL-terminated patcher JSON + IFF
dependency trailer) and injects the `project` block Max requires. It self-checks by unpacking the
JSON back out of the container and comparing to the source.

**Important — the device is NOT frozen.** The `.amxd` embeds the patcher, but the patcher still
*references* two sibling files: **`dlny.map.js`** (the `jsui` map) and **`dlny.voice.maxpat`** (the
`poly~` voice). Freezing (which bundles dependencies into a single portable file) needs Max, which
wasn't available when this was built. So:

- **Keep `dlny.amxd`, `dlny.map.js`, and `dlny.voice.maxpat` in the same folder.**
- If the map is blank or Live reports `dlny.voice` / `dlny.map.js` missing, add that folder to
  Max's search path (in Max: **Options ▸ File Preferences ▸ +**), **or**
- Open `dlny.amxd` in Max and **File ▸ Freeze Device** — that bundles the `.js` and voice patch
  inside, giving you one self-contained file you can drop anywhere.

Drag `dlny.amxd` onto an audio track in Live (or double-click it in the browser). It loads as a
**MAX AUDIO FX** device showing the vertical panel.

## Regenerating the patches

```bash
python3 build_patches.py   # rewrites dlny.maxpat and dlny.voice.maxpat
```

The generator builds the patcher JSON in code so every `[id, inlet]` / `[id, outlet]` connection
index is correct by construction. It has no dependencies (stdlib only).

## Debugging & tests

The brain (`dlny.map.js`) is plain JS, so it can be tested without Max. `test_brain.js` loads it
under macOS's built-in JavaScriptCore (Max globals stubbed, `outlet()` captured) and asserts on
what it computes and emits:

```bash
osascript -l JavaScript max/test_brain.js
```

Coverage (~7k assertions over 840 random constellations): **Delaunay validity** (the defining
empty-circumcircle property — 0 violations), **barycentric partition-of-unity**, every emitted
`gain`/`time`/`cut`/`fb`/`pan` **finite and in range**, gains **sum to 1**, **editor round-trip**,
**click-free** edge crossings (bounded per-step gain jump), degenerate inputs (collinear / N=1),
and auto-drift bounds. This proves the *geometry and control* are correct; it does **not** prove the
`.maxpat` DSP makes sound — that still needs Max/Live.

The two `.maxpat` files are separately lint-checked: every patchline is verified to land on a real
inlet/outlet index (see the validator in the build history), and the voice's signal graph is
confirmed fully connected.

### Known, benign edge case

With **exactly 3 taps** that happen to fall **near-collinear** (~1.7 % of `Taps=3` regenerates; it
does **not** occur at 4+ taps), the triangulation is empty and the playhead falls back to the
nearest single tap instead of a 3-way morph — sound continues cleanly (verified: gains still sum to
1, no NaN), there's just no triangle to interpolate. This matches the HTML prototype exactly (same
`delaunay()` code). Hit Regenerate, or use ≥4 taps. Not worth special-casing — collinear points have
no meaningful triangle to morph through anyway.

One fix was applied during testing: emitted voice gains are clamped to `[0,1]` (barycentric
edge-tolerance could otherwise nudge a weight to ≈ −7e-5). Pure hygiene, no audible change.
