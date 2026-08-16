"""
Generate a dry source + 5 processed WAV demos that APPROXIMATE the audio
character of each proposed Max for Live effect. These are numpy sketches,
not the real algorithms — they exist to convey the sonic direction.
"""
import numpy as np
import wave, os

SR = 44100
OUT = "/Users/enron/Documents/vibesurf/delaunayed/assets/audio"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def write_wav(name, x, sr=SR):
    x = np.asarray(x, dtype=np.float64)
    # normalize with a little headroom
    peak = np.max(np.abs(x)) + 1e-9
    x = 0.9 * x / peak
    xi = np.int16(np.clip(x, -1, 1) * 32767)
    path = os.path.join(OUT, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(xi.tobytes())
    print("wrote", path, f"{len(x)/sr:.1f}s")

def adsr(n, a=0.005, d=0.08, s=0.0, r=0.05):
    a_n=int(a*SR); d_n=int(d*SR); r_n=int(r*SR)
    env=np.zeros(n)
    a_n=min(a_n,n);
    env[:a_n]=np.linspace(0,1,a_n)
    d_end=min(a_n+d_n,n)
    env[a_n:d_end]=np.linspace(1,s,d_end-a_n)
    env[d_end:]=s
    # release tail
    if r_n>0 and n>r_n:
        env[-r_n:]*=np.linspace(1,0,r_n)
    return env

def pluck(freq, dur, kind="marimba"):
    n=int(dur*SR)
    t=np.arange(n)/SR
    if kind=="marimba":
        # fundamental + inharmonic partial, fast decay
        y = np.sin(2*np.pi*freq*t)*np.exp(-6*t)
        y+= 0.5*np.sin(2*np.pi*freq*3.9*t)*np.exp(-14*t)
        y+= 0.25*np.sin(2*np.pi*freq*2*t)*np.exp(-9*t)
    else:
        y = np.sin(2*np.pi*freq*t)*np.exp(-5*t)
    y*=adsr(n, a=0.002, d=dur*0.5, s=0.0, r=0.03)
    return y

def note(freq, at, dur, buf, gain=1.0, kind="marimba"):
    y=pluck(freq,dur,kind)*gain
    i=int(at*SR)
    end=min(i+len(y),len(buf))
    buf[i:end]+=y[:end-i]

# ---- DRY SOURCE: a short pentatonic marimba phrase ----
DUR=6.0
N=int(DUR*SR)
dry=np.zeros(N)
# A minor pentatonic-ish: A2 C E A C E ...
scale={"A2":110.0,"C3":130.81,"E3":164.81,"A3":220.0,"C4":261.63,"E4":329.63,"G3":196.0}
seq=[("A2",0.0),("E3",0.35),("A3",0.7),("C4",1.05),("E4",1.4),
     ("C4",1.75),("A3",2.1),("G3",2.6),("E3",3.1),("A2",3.6)]
for nm,at in seq:
    note(scale[nm],at,1.2,dry,gain=0.9)
dry*=0.8
write_wav("00_dry_source.wav", dry)

# ================================================================
# 1. DELAUNAY NAVIGABLE DELAY
# Multitap delay where tap gains/pans/times MORPH continuously as a
# "playhead" glides through a point cloud (barycentric interpolation
# approximated by smooth LFO-driven tap weights).
# ================================================================
def delaunay_delay(x):
    n=len(x)
    y=np.zeros(n)
    t=np.arange(n)/SR
    # tap base times (s) and pitch ratios (via simple resample-ish detune sim)
    taps=[0.12,0.23,0.37,0.55,0.66,0.81]
    # each tap weight is a slow LFO with its own rate/phase -> playhead drift
    for k,dt in enumerate(taps):
        d=int(dt*SR)
        w=0.5+0.5*np.sin(2*np.pi*(0.13+0.05*k)*t + k*1.1)
        w=w**2  # sharpen -> feels like crossing triangle edges
        # slow pan-ish tremolo baked into weight
        tap=np.zeros(n)
        if d<n:
            tap[d:]=x[:n-d]
        y+=w*tap*(0.7-0.06*k)
    # light feedback smear
    fb=np.zeros(n); g=0.35; dd=int(0.37*SR)
    for i in range(dd,n):
        fb[i]=x[i]+g*fb[i-dd]
    y=0.7*y+0.5*fb*0.3
    return 0.6*x+y
write_wav("01_delaunay_navigable_delay.wav", delaunay_delay(dry))

# ================================================================
# 2. WFC MULTITAP  — a "solved" coherent rhythmic tap pattern.
# Approximate: generate a constraint-consistent 16-step tap grid
# (no two silences adjacent to a junction, accents spaced) and render
# it as a rhythmic multitap with pitched taps.
# ================================================================
def wfc_multitap(x):
    n=len(x); y=np.zeros(n)
    step=0.14  # ~seconds per grid step
    states=[]
    prev="sustain"
    rules={"rise":["sustain","accent"],"sustain":["sustain","fall","accent"],
           "fall":["silent","sustain"],"accent":["fall","sustain"],
           "silent":["rise","sustain"]}
    for i in range(24):
        choices=rules[prev]
        prev=choices[rng.integers(len(choices))]
        states.append(prev)
    gainmap={"rise":0.6,"sustain":0.5,"fall":0.4,"accent":0.95,"silent":0.0}
    pitchmap={"rise":1.5,"sustain":1.0,"fall":0.75,"accent":2.0,"silent":1.0}
    for i,s in enumerate(states):
        at=i*step
        d=int(at*SR)
        if d>=n or gainmap[s]==0: continue
        # crude pitch shift via time-scaled copy of a slice
        ratio=pitchmap[s]
        src=x.copy()
        if ratio!=1.0:
            idx=np.clip((np.arange(n)*ratio).astype(int),0,n-1)
            src=x[idx]
        tap=np.zeros(n)
        tap[d:]=src[:n-d]
        y+=gainmap[s]*tap*0.5
    return 0.7*x+0.8*y
write_wav("02_wfc_multitap.wav", wfc_multitap(dry))

# ================================================================
# 3. REACTION-DIFFUSION SPECTRAL PROCESSOR
# STFT magnitude, then blur/diffuse across freq & time with nonlinear
# feedback (Turing-ish smear/bloom). Phase kept from a smeared version
# to add the "frozen growing" quality.
# ================================================================
def rd_spectral(x):
    n=len(x)
    win=2048; hop=512
    w=np.hanning(win)
    pad=win
    xp=np.concatenate([np.zeros(pad),x,np.zeros(win)])
    frames=range(0,len(xp)-win,hop)
    specs=[]
    for f in frames:
        seg=xp[f:f+win]*w
        specs.append(np.fft.rfft(seg))
    S=np.array(specs)  # [t, freq]
    mag=np.abs(S); ph=np.angle(S)
    # reaction-diffusion-ish: diffuse magnitude across freq (blur) and
    # across time (feedback), with a nonlinear reaction term.
    M=mag.copy()
    for it in range(6):
        # freq diffusion
        Mf=0.25*np.roll(M,1,axis=1)+0.5*M+0.25*np.roll(M,-1,axis=1)
        # time diffusion (causal feedback smear)
        Mt=Mf.copy()
        for t in range(1,Mt.shape[0]):
            Mt[t]=0.6*Mf[t]+0.4*Mt[t-1]
        # reaction: emphasize where energy already concentrates (Turing)
        react=Mt*(1.0+0.15*(Mt/(Mt.mean()+1e-6)-1.0))
        M=0.5*M+0.5*react
    # resynth: smeared magnitude, phase advanced smoothly
    ph2=np.cumsum(np.diff(ph,axis=0,prepend=ph[:1]),axis=0)
    S2=M*np.exp(1j*ph2)
    out=np.zeros(len(xp))
    norm=np.zeros(len(xp))
    for k,f in enumerate(frames):
        seg=np.fft.irfft(S2[k])
        out[f:f+win]+=seg*w
        norm[f:f+win]+=w**2
    out=out[pad:pad+n]/(norm[pad:pad+n]+1e-6)
    return 0.4*x+0.9*out
write_wav("03_reaction_diffusion_spectral.wav", rd_spectral(dry))

# ================================================================
# 4. KURAMOTO COUPLED-OSCILLATOR DELAY
# A bank of tap-amplitude LFOs whose phases are coupled -> they drift,
# then spontaneously synchronize into an emergent pulse.
# ================================================================
def kuramoto_delay(x):
    n=len(x); y=np.zeros(n); t=np.arange(n)/SR
    K=8  # oscillators/taps
    base=rng.uniform(0.8,1.6,K)          # natural freqs (Hz)
    phase=rng.uniform(0,2*np.pi,K)
    coupling=np.linspace(0.0,6.0,n)      # ramp coupling up over time -> sync
    dt=1.0/SR
    ph_track=np.zeros((n,K))
    for i in range(n):
        meanfield=np.mean(np.exp(1j*phase))
        r=np.abs(meanfield); psi=np.angle(meanfield)
        phase=phase+2*np.pi*base*dt+coupling[i]*r*np.sin(psi-phase)*dt
        ph_track[i]=phase
    taps=[0.11,0.19,0.27,0.33,0.41,0.5,0.61,0.72]
    for k in range(K):
        d=int(taps[k]*SR)
        w=0.5+0.5*np.sin(ph_track[:,k])
        tap=np.zeros(n)
        if d<n: tap[d:]=x[:n-d]
        y+=w*tap*0.35
    return 0.6*x+0.9*y
write_wav("04_kuramoto_delay.wav", kuramoto_delay(dry))

# ================================================================
# 5. PHYSARUM / FDN  — feedback delay network reverb whose "topology"
# is fixed here but dense & diffuse (approximating the self-organized net).
# ================================================================
def fdn_reverb(x):
    n=len(x)
    delays=[int(d*SR) for d in [0.0297,0.0371,0.0411,0.0437,0.005,0.017,0.023,0.029]]
    M=len(delays)
    # Hadamard-ish orthogonal feedback matrix
    H=np.array([[1,1,1,1,1,1,1,1],
                [1,-1,1,-1,1,-1,1,-1],
                [1,1,-1,-1,1,1,-1,-1],
                [1,-1,-1,1,1,-1,-1,1],
                [1,1,1,1,-1,-1,-1,-1],
                [1,-1,1,-1,-1,1,-1,1],
                [1,1,-1,-1,-1,-1,1,1],
                [1,-1,-1,1,-1,1,1,-1]],dtype=float)/np.sqrt(8)
    bufs=[np.zeros(d+1) for d in delays]
    idx=[0]*M
    g=0.86
    y=np.zeros(n)
    for i in range(n):
        outs=np.array([bufs[m][idx[m]] for m in range(M)])
        y[i]=np.sum(outs)*0.35
        fed=H@outs*g
        for m in range(M):
            bufs[m][idx[m]]=x[i]+fed[m]
            idx[m]=(idx[m]+1)%len(bufs[m])
    return 0.6*x+0.7*y
write_wav("05_physarum_fdn.wav", fdn_reverb(dry))

print("ALL DONE")
