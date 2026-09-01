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
    /* decodeAudioData, promise form or not — Safari before 14.1 only has the
       callback signature, and returns undefined. */
    decode: function (ctx, ab) {
      return new Promise(function (res, rej) {
        var p = ctx.decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    }
  };
})();
