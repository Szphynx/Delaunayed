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
         scale="12tet", base_len=0.26, max_depth=8, floor=1e-3):
    """Turtle walk -> node list. Each node compounds its parent's state."""
    nodes = []                                   # (time, gain, pitch, pan, depth)
    def walk(t, g, p, heading, depth):
        if depth > max_depth or g < floor:
            return
        t = t + base_len * (ratio ** depth)      # geometric, not linear
        g = g * decay
        p = p * snap(heading * cents_per_deg, scale)
        nodes.append((t, g, p, math.sin(math.radians(heading)), depth))
        spread = np.linspace(-1, 1, branch) if branch > 1 else [0.0]
        for s in spread:
            walk(t, g, p, heading + s * angle, depth + 1)
    walk(0.0, 1.0, 1.0, 0.0, 0)
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
    for (dt, g, p, pan, depth) in nodes:
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

# ------------------------------------------------------------ the diagram
def svg(nodes_params, path):
    """Draw the turtle tree the audio actually used; colour = depth, dot = gain."""
    W, H = 900, 560
    segs, dots = [], []
    def walk(x, y, g, heading, depth, length):
        if depth > 7 or g < 1e-3:
            return
        nx = x + length * math.sin(math.radians(heading))
        ny = y - length * math.cos(math.radians(heading))
        hue = 190 + depth * 18
        segs.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{nx:.1f}" y2="{ny:.1f}" '
                    f'stroke="hsl({hue} 70% {70 - depth*5}%)" stroke-width="{max(0.7, 5*g):.1f}"/>')
        dots.append(f'<circle cx="{nx:.1f}" cy="{ny:.1f}" r="{max(1.2, 6*g):.1f}" '
                    f'fill="hsl({hue} 80% 60%)" fill-opacity="0.9"/>')
        for s in np.linspace(-1, 1, nodes_params["branch"]):
            walk(nx, ny, g * nodes_params["decay"], heading + s * nodes_params["angle"],
                 depth + 1, length * nodes_params["ratio"])
    walk(W / 2, H - 40, 1.0, 0.0, 0, 150)
    txt = ('<text x="24" y="34" fill="#9fe8ff" font-family="monospace" font-size="17">'
           'L-system branching delay tree</text>'
           '<text x="24" y="56" fill="#6f8fa0" font-family="monospace" font-size="12">'
           'segment = delay node &#183; child reads parent output, so times compound &#183; '
           'turn angle = pitch ratio &#183; depth = gain and darkening</text>')
    open(path, "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#0b1014"/>'
        + txt + "".join(segs) + "".join(dots) + "</svg>")
    print("wrote", path)

# ------------------------------------------------------------------ main
if __name__ == "__main__":
    dry, sr = read_wav(os.path.join(AUD, "00_dry_source.wav"))
    assert sr == SR, sr

    base = dict(branch=2, angle=25.0, ratio=0.62, decay=0.72, scale="12tet",
                base_len=0.34)
    variants = [
        ("06_lsystem_a_baseline.wav",      dict()),
        ("06_lsystem_b_scale_off.wav",     dict(scale="off", angle=41.0)),
        ("06_lsystem_c_just.wav",          dict(scale="just")),
        ("06_lsystem_d_ratio_high.wav",    dict(ratio=0.93)),
        ("06_lsystem_e_branch3.wav",       dict(branch=3, decay=0.62, max_depth=5)),
        ("06_lsystem_f_long_decay.wav",    dict(decay=0.85, base_len=0.4)),
        ("06_lsystem_g_growth.wav",        dict()),
    ]
    for name, over in variants:
        p = dict(base); p.update(over)
        nodes = grow(**p)
        gt = 0.6 if "growth" in name else 0.0
        write_wav(name, render(dry, nodes, grow_time=gt))
        print(f"   {name}: {len(nodes)} nodes, tail {max(n[0] for n in nodes):.2f}s, {p}")

    # control: same tap count, LINEAR times, no inheritance -> proves the tree matters
    nodes = grow(**base)
    flat = [(0.05 + 0.02 * i, g, 1.0, pan, 0)
            for i, (t, g, p, pan, d) in enumerate(sorted(nodes, key=lambda k: k[0]))]
    write_wav("06_lsystem_z_flat_control.wav", render(dry, flat))

    svg(dict(branch=2, angle=25.0, ratio=0.62, decay=0.72),
        os.path.join(IMG, "06_lsystem.svg"))
