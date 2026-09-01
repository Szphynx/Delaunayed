/* ============================================================================
   audio-session.js — keeping WebAudio audible on mobile

   iOS parks WebAudio on the *ringer* channel: the silent switch mutes it, the
   volume keys don't reach it, and on a lot of devices it simply produces
   nothing. The session only moves to the playback channel while an
   HTMLMediaElement is genuinely playing, and it falls straight back when that
   element stops — so the usual "play a one-sample blip to unlock" trick buys
   nothing, because the blip is over before the switch takes effect.
   getUserMedia flips the same switch (it forces play-and-record), which is why
   granting the microphone was the only way to hear these prototypes.

   So the rules this module enforces:
     - keep a *silent looping* element playing for as long as the page wants
       audio, not a one-shot blip;
     - the element has to be silent by content, because iOS ignores .volume on
       media elements — an unlocker built from the demo sample plays out loud
       and can't be stopped afterwards;
     - create and resume the AudioContext inside the gesture that asked for
       sound, before any await, never at page load.

   Usage:
     AudioSession.unlock();            // synchronously, first line of a gesture
     AudioSession.attach(ctx);         // right after the context is constructed
     AudioSession.decode(ctx, arrayBuffer).then(...)

   The four single-file prototypes carry an inlined copy of the same logic —
   they are meant to work when saved on their own, so they can't load this.
   Keep the two in sync.
   ========================================================================= */
var AudioSession = (function () {
  'use strict';
  var el = null, ctxs = [];

  // 8-bit mono 8 kHz, every sample at the zero level (128). Half a second is
  // plenty to loop on, and building it here beats another kilobyte of base64.
  function silentWav(sec) {
    var n = Math.round(8000 * sec), b = new Uint8Array(44 + n), d = new DataView(b.buffer);
    function tag(o, s) { for (var i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); }
    tag(0, 'RIFF'); d.setUint32(4, 36 + n, true); tag(8, 'WAVEfmt ');
    d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
    d.setUint32(24, 8000, true); d.setUint32(28, 8000, true);
    d.setUint16(32, 1, true); d.setUint16(34, 8, true);
    tag(36, 'data'); d.setUint32(40, n, true); b.fill(128, 44);
    var str = ''; for (var i = 0; i < b.length; i++) str += String.fromCharCode(b[i]);
    return 'data:audio/wav;base64,' + btoa(str);
  }

  /* AIFF/AIFC. Safari is the only browser that decodes these natively, and a
     Mac session hands them over constantly, so unpack the uncompressed forms
     here rather than tell someone their file is broken. A compressed AIFC
     still goes to the browser, which may or may not take it. */
  function fcc(dv, o) {
    return String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  }
  function isAiff(ab) {
    if (ab.byteLength < 12) return false;
    var dv = new DataView(ab);
    return fcc(dv, 0) === 'FORM' && (fcc(dv, 8) === 'AIFF' || fcc(dv, 8) === 'AIFC');
  }
  // The sample rate is stored as an 80-bit IEEE 754 float, which no DataView reads.
  function extended(dv, o) {
    var e = dv.getUint16(o), hi = dv.getUint32(o + 2), lo = dv.getUint32(o + 6), exp = e & 0x7fff;
    if (!exp && !hi && !lo) return 0;
    return ((e & 0x8000) ? -1 : 1) * (hi * Math.pow(2, exp - 16414) + lo * Math.pow(2, exp - 16446));
  }
  // Returns an AudioBuffer, or null for a form we don't unpack.
  function decodeAiff(ctx, ab) {
    var dv = new DataView(ab), p = 12, comm = null, ssnd = -1;
    while (p + 8 <= ab.byteLength) {
      var id = fcc(dv, p), size = dv.getUint32(p + 4), body = p + 8;
      if (id === 'COMM') comm = {
        ch: dv.getUint16(body), frames: dv.getUint32(body + 2), bits: dv.getUint16(body + 6),
        rate: extended(dv, body + 8), comp: size >= 22 ? fcc(dv, body + 18) : 'NONE'
      };
      else if (id === 'SSND') ssnd = body;
      p = body + size + (size & 1);          // chunks are word-aligned
    }
    if (!comm || ssnd < 0 || !comm.ch || !comm.frames) return null;
    var le = comm.comp === 'sowt',
        f32 = comm.comp === 'fl32' || comm.comp === 'FL32',
        f64 = comm.comp === 'fl64' || comm.comp === 'FL64';
    if (!(comm.comp === 'NONE' || comm.comp === 'twos' || le || f32 || f64)) return null;
    var w = f32 ? 4 : f64 ? 8 : comm.bits >> 3;
    if (!(w === 1 || w === 2 || w === 3 || w === 4 || (f64 && w === 8))) return null;
    var start = ssnd + 8 + dv.getUint32(ssnd);            // SSND carries its own data offset
    var room = Math.floor((ab.byteLength - start) / (comm.ch * w));
    var frames = Math.min(comm.frames, room);             // a truncated file still yields what is there
    if (frames < 1) return null;
    var out;
    try { out = ctx.createBuffer(comm.ch, frames, comm.rate); }
    catch (e) { out = ctx.createBuffer(comm.ch, frames, ctx.sampleRate); }
    for (var c = 0; c < comm.ch; c++) {
      var d = out.getChannelData(c);
      for (var i = 0; i < frames; i++) {
        var o = start + (i * comm.ch + c) * w;
        if (f32) d[i] = dv.getFloat32(o, le);
        else if (f64) d[i] = dv.getFloat64(o, le);
        else if (w === 1) d[i] = dv.getInt8(o) / 128;     // 8-bit AIFF is signed, unlike WAV
        else if (w === 2) d[i] = dv.getInt16(o, le) / 32768;
        else if (w === 3) {
          var b0 = dv.getUint8(o), b1 = dv.getUint8(o + 1), b2 = dv.getUint8(o + 2);
          var n = le ? (b2 << 16 | b1 << 8 | b0) : (b0 << 16 | b1 << 8 | b2);
          if (n & 0x800000) n -= 0x1000000;
          d[i] = n / 8388608;
        }
        else d[i] = dv.getInt32(o, le) / 2147483648;
      }
    }
    return out;
  }

  function keep() {
    if (el && el.paused) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
  }
  function resume() {
    ctxs.forEach(function (c) {
      if (c.state !== 'running') { var p = c.resume(); if (p && p.catch) p.catch(function () {}); }
    });
  }
  // A call, a lock screen or a tab switch suspends both the element and the
  // context; coming back to the page is the moment to put them back.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && el) { keep(); resume(); }
  });

  return {
    /* Call synchronously from inside a user gesture, before any await —
       an awaited call has already lost the activation it needed. */
    unlock: function () {
      if (!el) {
        el = document.createElement('audio');   // deliberately not in the DOM
        el.src = silentWav(0.5);
        el.loop = true;
        el.setAttribute('playsinline', '');
        el.addEventListener('pause', keep);     // iOS pauses it after an interruption
      }
      keep(); resume();
    },
    /* Register a context so unlock() and the visibility handler can resume it. */
    attach: function (ac) {
      if (ctxs.indexOf(ac) < 0) ctxs.push(ac);
      resume();
      return ac;
    },
    /* AIFF first — no browser but Safari takes it, so we unpack it ourselves.
       Then decodeAudioData, promise form or not: Safari before 14.1 only has
       the callback signature, and returns undefined. */
    /* Exposed so ui/test_audio_session.js can check the parser directly. */
    isAiff: isAiff,
    decodeAiff: decodeAiff,
    decode: function (ctx, ab) {
      if (isAiff(ab)) {
        try { var b = decodeAiff(ctx, ab); if (b) return Promise.resolve(b); } catch (e) {}
      }
      return new Promise(function (res, rej) {
        var p = ctx.decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    }
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = AudioSession;
