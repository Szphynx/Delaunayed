#!/usr/bin/env python3
# Generates the two Max patcher files for the Delaunay Navigable Delay port:
#   dlny.voice.maxpat  -  one poly~ delay voice  (delay + lowpass + feedback + pan + gain)
#   dlny.maxpat        -  the Max for Live device (jsui brain -> poly~ -> dry/wet -> plugout~)
# Building the JSON in code keeps every [id,inlet] / [id,outlet] index correct by construction.
import json

# ------------------------------------------------------------------ tiny patcher DSL
class Patch:
    def __init__(self):
        self.boxes = []
        self.lines = []
        self.n = 0
    def add(self, maxclass, text=None, rect=(0, 0, 70, 22), ins=1, outs=1, outs_t=None, pres=None, **extra):
        self.n += 1
        bid = "obj-%d" % self.n
        box = {"id": bid, "maxclass": maxclass,
               "numinlets": ins, "numoutlets": outs,
               "outlettype": outs_t if outs_t is not None else [""] * outs,
               "patching_rect": [float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3])]}
        if text is not None:
            box["text"] = text
        if pres is not None:                       # include this box in the Live (presentation) view
            box["presentation"] = 1
            box["presentation_rect"] = [float(pres[0]), float(pres[1]), float(pres[2]), float(pres[3])]
        box.update(extra)
        self.boxes.append({"box": box})
        return bid
    def link(self, s, so, d, di):
        self.lines.append({"patchline": {"source": [s, so], "destination": [d, di]}})
    def dump(self, path, present=False):
        patcher = {
            "fileversion": 1,
            "appversion": {"major": 8, "minor": 6, "revision": 0, "architecture": "x64", "modernui": 1},
            "classnamespace": "box",
            "rect": [60.0, 80.0, 1000.0, 680.0],
            "openinpresentation": 1 if present else 0,
            "default_fontsize": 11.0, "default_fontface": 0, "default_fontname": "Arial",
            "gridonopen": 1, "gridsize": [15.0, 15.0], "gridsnaponopen": 1,
            "objectsnaponopen": 1, "statusbarvisible": 2, "toolbarvisible": 1,
            "lefttoolbarpinned": 0, "toptoolbarpinned": 0, "righttoolbarpinned": 0, "bottomtoolbarpinned": 0,
            "toolbars_unpinned_last_save": 0, "tallnewobj": 0, "boxanimatetime": 200,
            "enablehscroll": 1, "enablevscroll": 1, "devicewidth": 650.0 if present else 0.0,
            "description": "", "digest": "", "tags": "", "style": "", "subpatcher_template": "",
            "assistshowspatchername": 0,
            "boxes": self.boxes, "lines": self.lines,
        }
        with open(path, "w") as f:
            f.write(json.dumps({"patcher": patcher}, indent=1))
        print("wrote", path, "(%d boxes, %d lines)" % (len(self.boxes), len(self.lines)))


# live.* parameter attribute helper (so ranges/names survive and the params are Live-automatable)
def param(longname, ptype, mmin, mmax, initial, enum=None):
    v = {"parameter_longname": longname, "parameter_shortname": longname[:15],
         "parameter_type": ptype, "parameter_mmin": mmin, "parameter_mmax": mmax,
         "parameter_initial_enable": 1, "parameter_initial": [initial]}
    if enum is not None:
        v["parameter_enum"] = enum
    return {"parameter_enable": 1, "saved_attribute_attributes": {"valueof": v}}


# ================================================================== VOICE
def build_voice():
    p = Patch()
    sig    = p.add("newobj", "in~ 1",        (30, 40, 44, 22), 0, 1, ["signal"])
    ctl    = p.add("newobj", "in 1",         (150, 40, 34, 22), 0, 1, [""])
    rt     = p.add("newobj", "route gain time cut fb pan", (150, 78, 230, 22), 1, 6, [""] * 6)
    gline  = p.add("newobj", "line~",        (150, 120, 60, 22), 2, 2, ["signal", "bang"])
    summ   = p.add("newobj", "+~",           (30, 120, 44, 22), 2, 1, ["signal"])
    tapin  = p.add("newobj", "tapin~ 8000",  (30, 158, 92, 22), 1, 1, ["signal"])
    tapout = p.add("newobj", "tapout~ 250",  (30, 196, 92, 22), 2, 1, ["signal"])
    tpack  = p.add("newobj", "pack 0. 30.",  (230, 120, 84, 22), 2, 1, [""])
    tline  = p.add("newobj", "line~",        (230, 158, 60, 22), 2, 2, ["signal", "bang"])
    lp     = p.add("newobj", "onepole~ 3000", (30, 234, 108, 22), 2, 1, ["signal"])
    fbmul  = p.add("newobj", "*~ 0.3",       (180, 234, 52, 22), 2, 1, ["signal"])
    gmul   = p.add("newobj", "*~",           (30, 300, 44, 22), 2, 1, ["signal"])
    panl   = p.add("newobj", "expr sqrt(0.5*(1.-$f1))", (300, 234, 170, 22), 1, 1, ["float"])
    panr   = p.add("newobj", "expr sqrt(0.5*(1.+$f1))", (300, 272, 170, 22), 1, 1, ["float"])
    outl   = p.add("newobj", "*~",           (30, 340, 44, 22), 2, 1, ["signal"])
    outr   = p.add("newobj", "*~",           (90, 340, 44, 22), 2, 1, ["signal"])
    osigl  = p.add("newobj", "out~ 1",       (30, 380, 44, 22), 1, 0, [])
    osigr  = p.add("newobj", "out~ 2",       (90, 380, 44, 22), 1, 0, [])

    L = p.link
    L(sig, 0, summ, 0)          # dry input
    L(fbmul, 0, summ, 1)        # + feedback
    L(summ, 0, tapin, 0)
    L(tapin, 0, tapout, 0)      # tapin~ -> tapout~ special connection
    L(ctl, 0, rt, 0)
    L(rt, 0, gline, 0)          # "gain g ms" -> line~
    L(rt, 1, tpack, 0)          # "time ms"   -> pack -> line~ (30ms ramp, click-free)
    L(tpack, 0, tline, 0)
    L(tline, 0, tapout, 1)      # smoothed delay time -> tapout~ time inlet
    L(rt, 2, lp, 1)            # "cut hz"    -> onepole~ cutoff
    L(rt, 3, fbmul, 1)          # "fb coef"   -> feedback gain
    L(rt, 4, panl, 0)          # "pan -1..1" -> constant-power L/R
    L(rt, 4, panr, 0)
    L(tapout, 0, lp, 0)
    L(lp, 0, fbmul, 0)          # feedback = wet * fb
    L(lp, 0, gmul, 0)          # tap out  = wet * gain(weight)
    L(gline, 0, gmul, 1)
    L(gmul, 0, outl, 0)
    L(gmul, 0, outr, 0)
    L(panl, 0, outl, 1)
    L(panr, 0, outr, 1)
    L(outl, 0, osigl, 0)
    L(outr, 0, osigr, 0)
    p.dump("dlny.voice.maxpat")


# ================================================================== DEVICE
def build_device():
    p = Patch()

    # ---- audio i/o -------------------------------------------------
    pin     = p.add("newobj", "plugin~",  (40, 40, 60, 22), 0, 2, ["signal", "signal"])
    monosum = p.add("newobj", "+~",       (40, 80, 44, 22), 2, 1, ["signal"])
    monog   = p.add("newobj", "*~ 0.5",   (40, 112, 52, 22), 2, 1, ["signal"])
    poly    = p.add("newobj", "poly~ dlny.voice 16", (40, 150, 150, 22), 1, 2, ["signal", "signal"])
    wetL    = p.add("newobj", "*~",       (40, 300, 40, 22), 2, 1, ["signal"])
    wetR    = p.add("newobj", "*~",       (86, 300, 40, 22), 2, 1, ["signal"])
    dryL    = p.add("newobj", "*~",       (150, 300, 40, 22), 2, 1, ["signal"])
    dryR    = p.add("newobj", "*~",       (196, 300, 40, 22), 2, 1, ["signal"])
    outLsum = p.add("newobj", "+~",       (40, 340, 40, 22), 2, 1, ["signal"])
    outRsum = p.add("newobj", "+~",       (86, 340, 40, 22), 2, 1, ["signal"])
    pout    = p.add("newobj", "plugout~", (40, 380, 66, 22), 2, 0, [])

    # ---- dry/wet coefficient smoothing -----------------------------
    dw    = p.add("live.dial", None, (300, 40, 46, 48), 1, 1, ["float"], pres=(332, 24, 46, 48), varname="u_drywet",
                  **param("Dry/Wet", 0, 0.0, 100.0, 50.0))
    dwsc  = p.add("newobj", "/ 100.",  (360, 46, 54, 22), 2, 1, ["float"])
    wsig  = p.add("newobj", "sig~",    (360, 80, 44, 22), 1, 1, ["signal"])
    wramp = p.add("newobj", "rampsmooth~ 128 128", (360, 112, 140, 22), 3, 1, ["signal"])
    dinv  = p.add("newobj", "!- 1.",   (430, 80, 46, 22), 2, 1, ["float"])
    dsig  = p.add("newobj", "sig~",    (430, 112, 44, 22), 1, 1, ["signal"])
    dramp = p.add("newobj", "rampsmooth~ 128 128", (430, 150, 140, 22), 3, 1, ["signal"])
    lm_w  = p.add("newobj", "loadmess 0.5", (250, 112, 92, 22), 1, 1, [""])   # audible on load
    lm_d  = p.add("newobj", "loadmess 0.5", (250, 150, 92, 22), 1, 1, [""])   # regardless of dial

    # ---- performance macros (Live params) -> brain -----------------
    fb_d  = p.add("live.dial", None, (560, 40, 46, 48), 1, 1, ["float"], pres=(384, 24, 46, 48), varname="u_feedback",
                  **param("Feedback", 0, 0.0, 95.0, 30.0))
    fb_sc = p.add("newobj", "/ 100.",       (560, 92, 54, 22), 2, 1, ["float"])
    m_fb  = p.add("message", "setfb $1",    (560, 124, 80, 22), 2, 1, [""])

    gl_d  = p.add("live.dial", None, (630, 40, 46, 48), 1, 1, ["float"], pres=(436, 24, 46, 48), varname="u_glide",
                  **param("Glide", 0, 0.0, 800.0, 80.0))
    m_gl  = p.add("message", "setglide $1", (630, 92, 92, 22), 2, 1, [""])

    wd_d  = p.add("live.dial", None, (700, 40, 46, 48), 1, 1, ["float"], pres=(488, 24, 46, 48), varname="u_width",
                  **param("Width", 0, 0.0, 150.0, 100.0))
    wd_sc = p.add("newobj", "/ 100.",       (700, 92, 54, 22), 2, 1, ["float"])
    m_wd  = p.add("message", "setwidth $1", (700, 124, 92, 22), 2, 1, [""])

    bpm_n = p.add("live.numbox", None, (770, 40, 60, 22), 1, 1, [""], pres=(546, 26, 56, 18), varname="u_tempo",
                  **param("Tempo", 1, 40.0, 220.0, 110.0))
    m_bpm = p.add("message", "bpm $1",      (770, 72, 70, 22), 2, 1, [""])

    ct_n  = p.add("live.numbox", None, (770, 108, 60, 22), 1, 1, [""], pres=(546, 62, 44, 18), varname="u_taps",
                  **param("Taps", 1, 3.0, 16.0, 6.0))
    m_ct  = p.add("message", "count $1",    (770, 140, 74, 22), 2, 1, [""])

    tm_t  = p.add("live.tab", None, (850, 40, 120, 22), 1, 1, [""], pres=(332, 92, 128, 18), varname="u_time",
                  **param("Time", 2, 0.0, 2.0, 1.0, enum=["1/2x", "1x", "2x"]))
    tm_e  = p.add("newobj", "expr pow(2.,$i1-1.)", (850, 72, 130, 22), 1, 1, ["float"])
    m_tm  = p.add("message", "settime $1",  (850, 104, 90, 22), 2, 1, [""])

    m_reg = p.add("message", "regen",       (850, 150, 60, 22), 2, 1, [""], pres=(470, 92, 58, 18))
    dr_tg = p.add("toggle",  None,          (930, 150, 24, 24), 1, 1, ["int"], pres=(546, 91, 20, 20))
    m_drf = p.add("message", "drift $1",    (958, 150, 74, 22), 2, 1, [""])

    lb    = p.add("newobj", "loadbang",     (40, 460, 66, 22), 1, 1, ["bang"])
    m_ini = p.add("message", "init",        (40, 492, 50, 22), 2, 1, [""])

    # ---- the brain: MAP view + MIX view + left MAP/MIX rail, all in one jsui ----
    # patching size == presentation size, so the map lays out for exactly what Live shows
    brain = p.add("jsui", None, (300, 200, 300, 140), 1, 2, ["", ""], pres=(12, 22, 300, 140),
                  filename="dlny.map.js", parameter_enable=0)

    # ---- per-tap editor (classic UI = reliable set-without-output) --
    rsel  = p.add("newobj", "route sel",        (700, 470, 70, 22), 1, 2, ["", ""])
    usel  = p.add("newobj", "unpack 0 0 0 0 0", (700, 502, 140, 22), 1, 5, ["", "", "", "", ""])
    edsel = p.add("number",  None,              (700, 540, 50, 22), 1, 2, ["", "bang"], pres=(332, 132, 44, 18))
    edi   = p.add("number",  None,              (760, 540, 50, 22), 1, 2, ["", "bang"], pres=(392, 132, 44, 18))
    ecut  = p.add("flonum",  None,              (820, 540, 60, 22), 1, 2, ["", "bang"], pres=(452, 132, 56, 18))
    epan  = p.add("flonum",  None,              (890, 540, 60, 22), 1, 2, ["", "bang"], pres=(516, 132, 56, 18))
    efb   = p.add("flonum",  None,              (960, 540, 60, 22), 1, 2, ["", "bang"], pres=(582, 132, 44, 18))
    s_i   = p.add("message", "set $1",          (700, 572, 54, 22), 2, 1, [""])
    s_di  = p.add("message", "set $1",          (760, 572, 54, 22), 2, 1, [""])
    s_cut = p.add("message", "set $1",          (820, 572, 54, 22), 2, 1, [""])
    s_pan = p.add("message", "set $1",          (890, 572, 54, 22), 2, 1, [""])
    s_fb  = p.add("message", "set $1",          (960, 572, 54, 22), 2, 1, [""])
    c_di  = p.add("newobj", "clip 0 11",        (760, 604, 70, 22), 3, 1, ["float"])
    c_cut = p.add("newobj", "clip 200 12000",   (820, 604, 100, 22), 3, 1, ["float"])
    p_pan = p.add("newobj", "/ 100.",           (890, 604, 54, 22), 2, 1, ["float"])
    p_fb  = p.add("newobj", "/ 100.",           (960, 604, 54, 22), 2, 1, ["float"])
    e_di  = p.add("message", "edit di $1",      (760, 636, 84, 22), 2, 1, [""])
    e_cut = p.add("message", "edit cut $1",     (820, 636, 90, 22), 2, 1, [""])
    e_pan = p.add("message", "edit pan $1",     (890, 636, 90, 22), 2, 1, [""])
    e_fb  = p.add("message", "edit fb $1",      (960, 636, 84, 22), 2, 1, [""])

    # labels (presentation view). live.dials self-label; classic UI needs comments.
    py = 690
    def label(text, pres_rect, fontsize=None):        # comment in a free patching spot + presentation
        nonlocal py
        extra = {"fontsize": float(fontsize)} if fontsize else {}
        b = p.add("comment", text, (560, py, max(40, pres_rect[2] + 20), 18), 1, 0, pres=pres_rect, **extra)
        py += 22
        return b
    label("DELAUNAY  ·  drag the map, click a node to edit", (12, 6, 300, 13), 9)
    label("TEMPO", (546, 14, 56, 11), 8)
    label("TAPS",  (546, 50, 44, 11), 8)
    label("TIME",  (332, 80, 40, 11), 8)
    label("REGEN", (470, 80, 58, 11), 8)
    label("DRIFT", (570, 93, 40, 11), 8)
    label("sel", (332, 120, 44, 11), 8)     # editor labels sit 14px above their boxes (y442)
    label("div", (392, 120, 44, 11), 8)
    label("cut", (452, 120, 56, 11), 8)
    label("pan", (516, 120, 56, 11), 8)
    label("fb",  (582, 120, 44, 11), 8)

    L = p.link
    # audio
    L(pin, 0, monosum, 0); L(pin, 1, monosum, 1)
    L(monosum, 0, monog, 0)
    L(monog, 0, poly, 0)            # mono wet feed -> poly~ inlet 0
    L(brain, 0, poly, 0)           # voice control (target/gain/...) -> poly~ inlet 0
    L(poly, 0, wetL, 0); L(poly, 1, wetR, 0)
    L(pin, 0, dryL, 0);  L(pin, 1, dryR, 0)
    L(wramp, 0, wetL, 1); L(wramp, 0, wetR, 1)
    L(dramp, 0, dryL, 1); L(dramp, 0, dryR, 1)
    L(wetL, 0, outLsum, 0); L(dryL, 0, outLsum, 1)
    L(wetR, 0, outRsum, 0); L(dryR, 0, outRsum, 1)
    L(outLsum, 0, pout, 0); L(outRsum, 0, pout, 1)
    # dry/wet coeffs
    L(dw, 0, dwsc, 0)
    L(dwsc, 0, wsig, 0); L(wsig, 0, wramp, 0)
    L(dwsc, 0, dinv, 0); L(dinv, 0, dsig, 0); L(dsig, 0, dramp, 0)
    L(lm_w, 0, wsig, 0); L(lm_d, 0, dsig, 0)
    # macros
    L(fb_d, 0, fb_sc, 0); L(fb_sc, 0, m_fb, 0); L(m_fb, 0, brain, 0)
    L(gl_d, 0, m_gl, 0);  L(m_gl, 0, brain, 0)
    L(wd_d, 0, wd_sc, 0); L(wd_sc, 0, m_wd, 0); L(m_wd, 0, brain, 0)
    L(bpm_n, 0, m_bpm, 0); L(m_bpm, 0, brain, 0)
    L(ct_n, 0, m_ct, 0);  L(m_ct, 0, brain, 0)
    L(tm_t, 0, tm_e, 0);  L(tm_e, 0, m_tm, 0); L(m_tm, 0, brain, 0)
    L(m_reg, 0, brain, 0)
    L(dr_tg, 0, m_drf, 0); L(m_drf, 0, brain, 0)
    L(lb, 0, m_ini, 0);   L(m_ini, 0, brain, 0)
    # editor: brain outlet 1 -> displays
    L(brain, 1, rsel, 0); L(rsel, 0, usel, 0)
    L(usel, 0, s_i, 0);   L(s_i, 0, edsel, 0)
    L(usel, 1, s_di, 0);  L(s_di, 0, edi, 0)
    L(usel, 2, s_cut, 0); L(s_cut, 0, ecut, 0)
    L(usel, 3, s_pan, 0); L(s_pan, 0, epan, 0)
    L(usel, 4, s_fb, 0);  L(s_fb, 0, efb, 0)
    # editor: user edits -> brain
    L(edi, 0, c_di, 0);   L(c_di, 0, e_di, 0);  L(e_di, 0, brain, 0)
    L(ecut, 0, c_cut, 0); L(c_cut, 0, e_cut, 0); L(e_cut, 0, brain, 0)
    L(epan, 0, p_pan, 0); L(p_pan, 0, e_pan, 0); L(e_pan, 0, brain, 0)
    L(efb, 0, p_fb, 0);   L(p_fb, 0, e_fb, 0);  L(e_fb, 0, brain, 0)
    p.dump("dlny.maxpat", present=True)


if __name__ == "__main__":
    build_voice()
    build_device()
