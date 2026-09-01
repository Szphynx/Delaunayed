"""
L-system branching delay tree — numpy sketch (step 1 of the prototyping path).

Turtle interpretation of the L-system IS the delay graph:
  segment  -> a delay node (time, gain, pitch, pan, darkening)
  child    -> reads its PARENT's output, so delay times COMPOUND
  +/-      -> pitch ratio for that branch, optionally snapped to a scale
  depth    -> gain g^n and cumulative lowpass -> the tree prunes itself

Signal enters the root and flows down; every sub-branch is a scaled copy of
the whole tree, so the tail is self-similar rather than a flat tap list.

Renders one SVG diagram + a set of WAVs with ONE variable changed each,
so the knobs can be compared by ear against the dry source.
"""
import numpy as np
import wave, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.join(HERE, "..", "assets", "audio")
IMG = os.path.join(HERE, "..", "assets", "img")
SR = 44100

def read_wav(path):
    with wave.open(path) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(axis=1)
    return x.astype(np.float64) / 32768.0, sr

def write_wav(name, y):
    y = np.asarray(y, dtype=np.float64)          # (n,2)
    y = 0.9 * y / (np.max(np.abs(y)) + 1e-9)
    with wave.open(os.path.join(AUD, name), "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.int16(np.clip(y, -1, 1) * 32767).tobytes())
    print("wrote", name, f"{len(y)/SR:.1f}s")

# ---------------------------------------------------------------- scales
JUST = [1/1, 9/8, 6/5, 5/4, 4/3, 3/2, 5/3, 7/4]          # cents-free ratios
KEYS = {"minor_pentatonic": [0, 3, 5, 7, 10],            # semitone degrees
        "natural_minor":    [0, 2, 3, 5, 7, 8, 10],
        "dorian":           [0, 2, 3, 5, 7, 9, 10],
        "major":            [0, 2, 4, 5, 7, 9, 11],
        "phrygian":         [0, 1, 3, 5, 7, 8, 10],   # flat 2nd, Spanish darkness
        "hijaz":            [0, 1, 4, 5, 7, 8, 11],   # maqam Hijaz: the augmented 2nd
        "hirajoshi":        [0, 2, 3, 7, 8],          # Japanese koto pentatonic
        "fifths":           [0, 7],                   # stacked fifths only
        "octaves":          [0]}                      # pure octave ladder

def snap_key(cents, degrees, root_semi):
    """Absolute snap: nearest degree of a fixed key, any octave. Key is
    absolute, intervals are relative — so this quantizes the ACCUMULATED
    pitch, never a per-branch ratio."""
    rel = cents - root_semi * 100
    oct_, rem = divmod(rel, 1200.0)
    best = min(degrees, key=lambda d: min(abs(d * 100 - rem), abs(d * 100 + 1200 - rem)))
    if abs(best * 100 + 1200 - rem) < abs(best * 100 - rem):
        best, oct_ = best, oct_ + 1
    return root_semi * 100 + oct_ * 1200 + best * 100
def snap(cents, mode):
    if mode == "off":
        return 2 ** (cents / 1200.0)
    if mode == "12tet":
        return 2 ** (round(cents / 100.0) * 100 / 1200.0)
    if mode == "just":
        oct_, c = divmod(cents, 1200.0)
        r = 2 ** (c / 1200.0)
        return (2 ** oct_) * min(JUST, key=lambda j: abs(j - r))
    raise ValueError(mode)

# ------------------------------------------------------- grow the tree
def grow(branch=2, angle=25.0, ratio=0.62, decay=0.72, cents_per_deg=8.0,
         scale="12tet", base_len=0.26, max_depth=8, floor=1e-3,
         key="minor_pentatonic", root_semi=0):
    """Turtle walk -> node list. Each node compounds its parent's state."""
    nodes = []            # (time, gain, pitch, pan, depth, x, y, parent_x, parent_y)
    def walk(t, g, p, heading, depth, x, y, length):
        if depth > max_depth or g < floor:
            return
        t = t + base_len * (ratio ** depth)      # geometric, not linear
        g = g * decay
        if scale == "key":
            # heading is already cumulative, so it IS the accumulated pitch.
            # Snap it to the key, then bend the turtle back onto that pitch:
            # the tree can only grow along scale degrees.
            cents = snap_key(heading * cents_per_deg, KEYS[key], root_semi)
            heading = cents / cents_per_deg
            p = 2 ** (cents / 1200.0)
        else:
            p = p * snap(heading * cents_per_deg, scale)
        nx = x + length * math.sin(math.radians(heading))
        ny = y - length * math.cos(math.radians(heading))
        nodes.append((t, g, p, math.sin(math.radians(heading)), depth, nx, ny, x, y))
        spread = np.linspace(-1, 1, branch) if branch > 1 else [0.0]
        for s in spread:
            walk(t, g, p, heading + s * angle, depth + 1, nx, ny, length * ratio)
    walk(0.0, 1.0, 1.0, 0.0, 0, 0.0, 0.0, 150.0)
    return nodes

# --------------------------------------------------------------- render
def render(x, nodes, tail=3.0, grow_time=0.0, wet=0.9):
    n = len(x) + int(tail * SR)
    xp = np.concatenate([x, np.zeros(n - len(x))])
    t = np.arange(n) / SR
    # cumulative darkening per depth: one 3-tap blur per level, vectorised
    dark = {0: xp}
    for d in range(1, max(nd[4] for nd in nodes) + 2):
        s = dark[d - 1]
        dark[d] = 0.25 * np.roll(s, 1) + 0.5 * s + 0.25 * np.roll(s, -1)
    y = np.zeros((n, 2))
    for (dt, g, p, pan, depth, *_) in nodes:
        src = dark[depth]
        if p != 1.0:                              # varispeed pitch, tape style
            src = src[np.clip((np.arange(n) * p).astype(int), 0, n - 1)]
        d = int(dt * SR)
        if d >= n:
            continue
        tap = np.zeros(n); tap[d:] = src[:n - d]
        if grow_time > 0:                         # branch sprouts later
            tap *= (t > depth * grow_time)
        l = math.sqrt((1 - pan) / 2); r = math.sqrt((1 + pan) / 2)
        y[:, 0] += g * tap * l
        y[:, 1] += g * tap * r
    dry = np.stack([xp, xp], axis=1)
    return 0.6 * dry + wet * y / math.sqrt(len(nodes))

# ---------------------------------------------------- a tonal test source
def tonal_source(dur=8.0, root=110.0, seq=(0, 3, 7, 10, 12, 7, 3, 0)):
    """A minor: a held root drone under a slow pentatonic arpeggio. Long notes,
    so the tree's branches overlap and the harmony is actually audible —
    a marimba pluck decays before the deep branches ever arrive."""
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    # drone: root + fifth, gentle detune, slow swell
    for f, g in ((root, 0.5), (root * 1.5, 0.22), (root * 2, 0.16)):
        y += g * np.sin(2 * np.pi * f * t + 0.4 * np.sin(2 * np.pi * 0.13 * t))
    y *= np.clip(t / 1.2, 0, 1) * np.clip((dur - t) / 1.5, 0, 1)
    # arpeggio on top, each note ringing ~1.6 s
    step = dur / (len(seq) + 1)
    for k, semi in enumerate(seq):
        f = root * 4 * 2 ** (semi / 12)
        i = int((0.4 + k * step) * SR)
        m = int(1.6 * SR); m = min(m, n - i)
        if m <= 0: continue
        tt = np.arange(m) / SR
        v = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * 2 * f * tt)
             + 0.18 * np.sin(2 * np.pi * 3 * f * tt))
        v *= np.exp(-1.6 * tt) * np.clip(tt / 0.02, 0, 1)
        y[i:i + m] += 0.5 * v
    return y / (np.max(np.abs(y)) + 1e-9) * 0.85

# --------------------------------------------------- is the tail in key?
def in_key_share(y, degrees, root_hz=110.0):
    """Share of tail energy sitting on pitch classes of the key. Chroma of the
    part after the source has stopped: honest check on 'sounds harmonious'."""
    x = y.mean(axis=1) if y.ndim > 1 else y
    seg = x[int(6.0 * SR):]
    if len(seg) < 4096:
        return float("nan")
    mag = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    freq = np.fft.rfftfreq(len(seg), 1 / SR)
    band = (freq > 60) & (freq < 5000)
    mag, freq = mag[band], freq[band]
    cents = 1200 * np.log2(freq / root_hz)
    pc = np.round(cents / 100).astype(int) % 12
    off = np.abs(cents / 100 - np.round(cents / 100))     # how close to a semitone
    weight = mag ** 2 * (off < 0.25)                      # ignore energy between semitones
    total = weight.sum() + 1e-12
    return float(sum(weight[pc == d].sum() for d in degrees) / total)

# ------------------------------------------------------------ the diagram
def svg(nodes, path, caption=""):
    """Draw the exact tree the audio used. Position = turtle, width = gain,
    hue = pitch ratio in cents, so two trees with identical skeletons but
    different scale snapping look different."""
    W, H, PAD = 900, 560, 40
    xs = [n[5] for n in nodes] + [0.0]; ys = [n[6] for n in nodes] + [0.0]
    sx = (W - 2*PAD) / max(1e-6, max(xs) - min(xs))
    sy = (H - 2*PAD) / max(1e-6, max(ys) - min(ys))
    k = min(sx, sy)
    ox = W/2 - k * (min(xs) + max(xs)) / 2
    oy = H - PAD + k * max(ys)
    T = lambda x, y: (ox + k*x, oy - (-k*y))   # y already grows upward as negative
    segs, dots = [], []
    for (t, g, p, pan, depth, x, y, px, py) in nodes:
        cents = 1200 * math.log2(p)
        hue = (200 + cents * 0.22) % 360        # pitch -> hue
        x1, y1 = ox + k*px, oy + k*py
        x2, y2 = ox + k*x,  oy + k*y
        segs.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                    f'stroke="hsl({hue:.0f} 72% {min(78, 44 + 40*g):.0f}%)" '
                    f'stroke-width="{max(0.6, 5*g):.1f}" stroke-linecap="round"/>')
        dots.append(f'<circle cx="{x2:.1f}" cy="{y2:.1f}" r="{max(1.0, 5.5*g):.1f}" '
                    f'fill="hsl({hue:.0f} 82% 62%)" fill-opacity="0.9"/>')
    cap = (f'<text x="24" y="{H-18}" fill="#6f8fa0" font-family="monospace" font-size="12">{caption}</text>'
           if caption else "")
    open(path, "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#0b1014"/>'
        + "".join(segs) + "".join(dots) + cap + "</svg>")
    print("wrote", os.path.basename(path))

# ------------------------------------------------------------------ main
if __name__ == "__main__":
    dry, sr = read_wav(os.path.join(AUD, "00_dry_source.wav"))
    assert sr == SR, sr

    base = dict(branch=2, angle=25.0, ratio=0.62, decay=0.72, scale="12tet",
                base_len=0.34)
    KEYBASE = dict(root_semi=0, angle=34.0, ratio=0.8, base_len=0.4, decay=0.78)
    variants = [
        ("06_lsystem_a_baseline.wav",      dict()),
        ("06_lsystem_b_scale_off.wav",     dict(scale="off", angle=41.0)),
        ("06_lsystem_c_just.wav",          dict(scale="just")),
        ("06_lsystem_d_ratio_high.wav",    dict(ratio=0.93)),
        ("06_lsystem_e_branch3.wav",       dict(branch=3, decay=0.62, max_depth=5)),
        ("06_lsystem_f_long_decay.wav",    dict(decay=0.85, base_len=0.4)),
        ("06_lsystem_g_growth.wav",        dict()),
        ("06_lsystem_h_key_locked.wav",    dict(scale="key", key="minor_pentatonic",
                                               root_semi=0, angle=34.0, ratio=0.8,
                                               base_len=0.4, decay=0.78)),
        ("06_lsystem_i_phrygian.wav",      dict(scale="key", key="phrygian", **KEYBASE)),
        ("06_lsystem_j_hijaz.wav",         dict(scale="key", key="hijaz", **KEYBASE)),
        ("06_lsystem_k_hirajoshi.wav",     dict(scale="key", key="hirajoshi", **KEYBASE)),
    ]
    for name, over in variants:
        p = dict(base); p.update(over)
        nodes = grow(**p)
        gt = 0.6 if "growth" in name else 0.0
        write_wav(name, render(dry, nodes, grow_time=gt))
        svg(nodes, os.path.join(IMG, name.replace(".wav", ".svg")),
            f"{len(nodes)} nodes | width = gain | hue = pitch ratio")
        print(f"   {name}: {len(nodes)} nodes, tail {max(n[0] for n in nodes):.2f}s, {p}")

    # proof: every key-locked render must use ONLY degrees of its key
    for kname in ("minor_pentatonic", "phrygian", "hijaz", "hirajoshi"):
        nn = grow(**dict(base, scale="key", key=kname, **KEYBASE))
        got = sorted({round(1200 * math.log2(n[2])) % 1200 for n in nn})
        want = sorted(d * 100 for d in KEYS[kname])
        unused = [d for d in want if d not in got]
        ok = "OK" if set(got) <= set(want) else "VIOLATION"
        print(f"   proof {kname:17s} used {got} | in-key {ok} | unreached {unused}")
        assert set(got) <= set(want), kname   # nothing off-key, ever

    # control: same tap count, LINEAR times, no inheritance -> proves the tree matters
    nodes = grow(**base)
    flat = [(0.05 + 0.02 * i, n[1], 1.0, n[3], 0, i * 1.6 - 400, -8.0, i * 1.6 - 400, 0.0)
            for i, n in enumerate(sorted(nodes, key=lambda k: k[0]))]
    write_wav("06_lsystem_z_flat_control.wav", render(dry, flat))
    svg(flat, os.path.join(IMG, "06_lsystem_z_flat_control.svg"),
        "same node budget, laid out linearly | no inheritance, no pitch")

    # ---------------- presets on a sustained tonal source (A minor) --------
    tonal = tonal_source()
    write_wav("07_tonal_dry_Am.wav", np.stack([tonal, tonal], axis=1))

    PRESETS = {
        "cathedral":  dict(key="minor_pentatonic", angle=34, ratio=0.88, base_len=0.45,
                           decay=0.82, branch=2),
        "hijaz_veil": dict(key="hijaz", angle=40, ratio=0.90, base_len=0.30,
                           decay=0.80, branch=2),
        "koto_rain":  dict(key="hirajoshi", angle=26, ratio=0.70, base_len=0.22,
                           decay=0.74, branch=3, max_depth=5),
        "fifths":     dict(key="fifths", angle=44, ratio=0.92, base_len=0.38,
                           decay=0.84, branch=2),
        "drone_web":  dict(key="natural_minor", angle=20, ratio=0.95, base_len=0.50,
                           decay=0.88, branch=2),
    }
    print("   preset               nodes  span   in-key share of tail")
    for pname, pp in PRESETS.items():
        nn = grow(scale="key", root_semi=0, cents_per_deg=8.0, **pp)
        out = render(tonal, nn, tail=4.0)
        write_wav(f"07_preset_{pname}.wav", out)
        svg(nn, os.path.join(IMG, f"07_preset_{pname}.svg"),
            f"{pname} | {pp['key']} | {len(nn)} nodes")
        share = in_key_share(out, KEYS[pp["key"]])
        print(f"   {pname:20s} {len(nn):5d}  {max(n[0] for n in nn):.2f}s  {share*100:5.1f}%")
    # controls on the same source: free ratios, no key lock
    for cname, cover in (("free_12tet", dict(scale="12tet")),
                         ("free_nosnap", dict(scale="off", angle=41.0))):
        nn = grow(**dict(base, ratio=0.88, base_len=0.45, decay=0.82, **cover))
        out = render(tonal, nn, tail=4.0)
        write_wav(f"07_control_{cname}.wav", out)
        print(f"   {cname:20s} {len(nn):5d}  {max(n[0] for n in nn):.2f}s  "
              f"{in_key_share(out, KEYS['minor_pentatonic'])*100:5.1f}%  (no key lock)")
    print(f"   {'dry source':20s} {'':5s}  {'':5s}  "
          f"{in_key_share(np.stack([tonal, tonal], 1), KEYS['minor_pentatonic'])*100:5.1f}%  (reference)")

    # depth-4 versions of every variant, exported for ui/tree-travel.js
    import json
    NAMES = ["A", "A\u266f", "B", "C", "C\u266f", "D", "D\u266f", "E", "F", "F\u266f", "G", "G\u266f"]
    def note_name(pitch):
        semis = round(12 * math.log2(pitch))
        return NAMES[semis % 12] + str(3 + (semis + 9) // 12)

    def travel(nodes):
        index = {(round(n[5], 4), round(n[6], 4)): i for i, n in enumerate(nodes)}
        out = []
        for i, n in enumerate(nodes):
            t, g, pit, pan, depth, x, y, px, py = n
            out.append(dict(i=i, parent=index.get((round(px, 4), round(py, 4)), -1),
                            t=round(t, 4), db=round(20 * math.log10(max(g, 1e-6)), 1),
                            note=note_name(pit), x=round(x, 2), y=round(y, 2),
                            px=round(px, 2), py=round(py, 2), depth=depth, pan=round(pan, 3)))
        return out

    trav = {}
    for name, over in variants:
        pp = dict(base); pp.update(over); pp["max_depth"] = 4
        trav[name.replace("06_lsystem_", "").replace(".wav", "")] = travel(grow(**pp))
    json.dump(trav, open(os.path.join(HERE, "..", "assets", "lsystem_travel.json"), "w"))
    print(f"wrote lsystem_travel.json ({len(trav)} variants, "
          f"{sum(len(v) for v in trav.values())} nodes)")

    # the README hero stays the baseline tree
    svg(grow(**base), os.path.join(IMG, "06_lsystem.svg"),
        "baseline | width = gain | hue = pitch ratio")
