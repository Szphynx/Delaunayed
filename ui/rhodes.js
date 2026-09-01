/* ============================================================================
   Rhodes — a two-operator FM electric piano, for playing an effect with notes
   instead of a sample.

     <script src="ui/rhodes.js"></script>
     var rh = Rhodes.create(AC);      // rh.out is the audio node to connect
     rh.noteOn(60, 0.8); rh.noteOff(60); rh.panic();

   A Rhodes is a tine struck by a hammer: a bright inharmonic ping that dies
   almost at once, over a soft sine body that rings on. Two oscillators do
   that — a carrier at the note, a modulator ~14x above it whose depth decays
   in about 120 ms. Harder keystrokes push the modulator harder, which is the
   whole reason the instrument gets brighter when you dig in, so velocity maps
   to index rather than only to level.

   ponytail: no sample, no wavetable, no library. Two oscillators, two gains
   and a lowpass per note. It is not a Suitcase — no pickup asymmetry, no
   tremolo, no key-off thunk — but it plays in tune and it sounds like the
   right instrument through a delay, which is what it is here for.
   ========================================================================= */
(function (root) {
  'use strict';

  function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /* Pure: everything one keystroke needs, derived from note and velocity.
     Higher notes ring shorter and duller, the way a real tine bar does. */
  function voiceParams(midi, vel) {
    vel = Math.max(0.05, Math.min(1, vel == null ? 0.8 : vel));
    var f = freq(midi);
    var oct = (midi - 60) / 12;
    return {
      freq: f,
      ratio: 14,                                  // the tine
      index: 3.2 * Math.pow(vel, 1.6) * Math.pow(0.86, oct),
      tine: 0.11 + 0.03 * (1 - vel),              // tine decay, seconds
      body: Math.max(0.9, 3.4 * Math.pow(0.72, oct)),   // body decay, seconds
      cutoff: Math.min(12000, (1400 + 5200 * vel) * Math.pow(1.35, oct)),
      level: 0.16 + 0.34 * vel
    };
  }

  function create(AC, opts) {
    opts = opts || {};
    var out = AC.createGain();
    out.gain.value = opts.level == null ? 0.9 : opts.level;
    var held = {};

    function noteOn(midi, vel) {
      noteOff(midi, true);
      var p = voiceParams(midi, vel), t = AC.currentTime;

      var car = AC.createOscillator(); car.frequency.value = p.freq;
      var mod = AC.createOscillator(); mod.frequency.value = p.freq * p.ratio;
      var modGain = AC.createGain();
      modGain.gain.setValueAtTime(p.freq * p.index, t);
      modGain.gain.exponentialRampToValueAtTime(p.freq * 0.01, t + p.tine);
      mod.connect(modGain); modGain.connect(car.frequency);

      var lp = AC.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = p.cutoff; lp.Q.value = 0.6;
      var amp = AC.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(p.level, t + 0.004);   // hammer
      amp.gain.exponentialRampToValueAtTime(p.level * 0.28, t + 0.22);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + p.body);

      car.connect(lp); lp.connect(amp); amp.connect(out);
      car.start(t); mod.start(t);
      car.stop(t + p.body + 0.1); mod.stop(t + p.body + 0.1);

      held[midi] = { car: car, mod: mod, amp: amp, until: t + p.body };
    }

    // Release is a fast fade, not a cut: a damper landing on a ringing tine.
    function noteOff(midi, now) {
      var v = held[midi];
      if (!v) return;
      delete held[midi];
      var t = AC.currentTime, r = now ? 0.01 : 0.18;
      try {
        v.amp.gain.cancelScheduledValues(t);
        v.amp.gain.setValueAtTime(Math.max(0.0001, v.amp.gain.value), t);
        v.amp.gain.exponentialRampToValueAtTime(0.0001, t + r);
        v.car.stop(t + r + 0.02); v.mod.stop(t + r + 0.02);
      } catch (e) {}
    }

    function panic() { Object.keys(held).forEach(function (m) { noteOff(+m, true); }); }

    return { out: out, noteOn: noteOn, noteOff: noteOff, panic: panic,
             held: function () { return Object.keys(held).map(Number); } };
  }

  var Rhodes = { create: create, freq: freq, voiceParams: voiceParams };
  if (typeof module === 'object' && module.exports) module.exports = Rhodes;
  root.Rhodes = Rhodes;
})(typeof window === 'undefined' ? global : window);
