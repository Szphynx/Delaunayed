/* ============================================================================
   ring-capture-worklet.js — a rolling capture buffer that runs on the audio
   thread, so a freeze/grain engine can grab "the last N ms of whatever is
   actually flowing through this point in the graph" regardless of what feeds
   it (a looped sample, a live mic, anything). Tap it onto the point you want
   to be able to freeze — the wet/processed bus, not the dry source — and it
   works the same for a file and for live input, which a static AudioBuffer
   loop never can.

   Usage from the main thread:
     await AC.audioWorklet.addModule('ring-capture-worklet.js');
     var node = new AudioWorkletNode(AC, 'ring-capture');
     someProcessedBus.connect(node);
     node.connect(silentSinkThatReachesDestination);   // keeps it pulled
     node.port.postMessage({ type: 'capture', ms: 180, id: 1 });
     node.port.onmessage = (e) => { // e.data === { type:'captured', id:1, samples: Float32Array } };
   ========================================================================= */
class RingCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capSec = 4;
    this.buf = new Float32Array(Math.ceil(sampleRate * this.capSec));
    this.w = 0;
    this.port.onmessage = (e) => {
      if (e.data.type !== 'capture') return;
      var ms = e.data.ms, n = Math.max(256, Math.min(this.buf.length, Math.floor(ms / 1000 * sampleRate)));
      var start = (this.w - n + this.buf.length) % this.buf.length;
      var out = new Float32Array(n);
      // short fade at both ends so the loop point doesn't click on its own
      var fade = Math.min(Math.floor(n * 0.12), Math.floor(0.006 * sampleRate));
      for (var i = 0; i < n; i++) {
        var s = this.buf[(start + i) % this.buf.length];
        if (i < fade) s *= i / fade; else if (i > n - fade) s *= (n - i) / fade;
        out[i] = s;
      }
      this.port.postMessage({ type: 'captured', id: e.data.id, samples: out }, [out.buffer]);
    };
  }
  process(inputs) {
    var ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (var i = 0; i < ch.length; i++) { this.buf[this.w] = ch[i]; this.w = (this.w + 1) % this.buf.length; }
    }
    return true;
  }
}
registerProcessor('ring-capture', RingCapture);
