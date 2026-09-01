/* node ui/test_audio_session.js — no framework, no fixtures on disk.
   Builds AIFF/AIFC files byte by byte and checks the parser reads them back.
   Only Safari decodes AIFF natively, so this is the code path that carries
   .aif/.aiff/.aifc on every other browser. */
'use strict';
var assert = require('assert');

/* audio-session.js wires a visibility listener at load, so stub the page first. */
global.document = { addEventListener: function () {},
                    createElement: function () { return { setAttribute: function () {},
                                                          addEventListener: function () {} }; } };
global.btoa = function (s) { return Buffer.from(s, 'binary').toString('base64'); };
var AudioSession = require('./audio-session.js');

/* ---------- a context stub: createBuffer is all the parser touches ---------- */
var ctx = { sampleRate: 44100, createBuffer: function (ch, len, rate) {
  var data = []; for (var i = 0; i < ch; i++) data.push(new Float32Array(len));
  return { numberOfChannels: ch, length: len, sampleRate: rate,
           getChannelData: function (i) { return data[i]; } };
} };

/* ---------- AIFF writers ---------- */
function ext80(rate) {                        // the 80-bit float the format stores its rate in
  var b = Buffer.alloc(10);
  var exp = Math.floor(Math.log2(rate)) + 1;
  var mant = Math.round(rate / Math.pow(2, exp - 1) * Math.pow(2, 63));
  b.writeUInt16BE(exp - 1 + 16383, 0);
  b.writeUInt32BE(Math.floor(mant / 0x100000000), 2);
  b.writeUInt32BE(mant >>> 0, 6);
  return b;
}
function chunk(id, body) {
  var head = Buffer.alloc(8); head.write(id, 0, 'binary'); head.writeUInt32BE(body.length, 4);
  return Buffer.concat(body.length & 1 ? [head, body, Buffer.alloc(1)] : [head, body]);
}
function aiff(ch, rate, bits, frames, data, comp) {
  var comm = Buffer.alloc(8);
  comm.writeUInt16BE(ch, 0); comm.writeUInt32BE(frames, 2); comm.writeUInt16BE(bits, 6);
  comm = Buffer.concat([comm, ext80(rate)]);
  var form = 'AIFF', pre = Buffer.alloc(0);
  if (comp) {
    comm = Buffer.concat([comm, Buffer.from(comp, 'binary'), Buffer.from([0, 0])]);
    form = 'AIFC';
    var fver = Buffer.alloc(4); fver.writeUInt32BE(0xa2805140, 0);
    pre = chunk('FVER', fver);
  }
  var body = Buffer.concat([Buffer.from(form, 'binary'), pre, chunk('COMM', comm),
                            chunk('SSND', Buffer.concat([Buffer.alloc(8), data]))]);
  var head = Buffer.alloc(8); head.write('FORM', 0, 'binary'); head.writeUInt32BE(body.length, 4);
  return Buffer.concat([head, body]);
}
function ab(buf) { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); }

/* ---------- the signal every variant encodes ---------- */
var N = 512, ref = [];
for (var i = 0; i < N; i++) ref.push(Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5);

function pcm(write, width) {
  var b = Buffer.alloc(N * width);
  for (var i = 0; i < N; i++) write(b, ref[i], i * width);
  return b;
}

var pass = 0;
function check(name, fn) {
  try { fn(); console.log('  ok  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
function close(got, want, tol, what) {
  assert.ok(Math.abs(got - want) <= tol, what + ': ' + got + ' vs ' + want + ' (tol ' + tol + ')');
}

console.log('AIFF parser');

check('16-bit stereo, big-endian, 44.1 kHz', function () {
  var d = Buffer.alloc(N * 4);
  for (var i = 0; i < N; i++) {
    d.writeInt16BE(Math.round(ref[i] * 32767), i * 4);
    d.writeInt16BE(Math.round(-ref[i] * 32767), i * 4 + 2);   // right channel inverted
  }
  var buf = AudioSession.decodeAiff(ctx, ab(aiff(2, 44100, 16, N, d)));
  assert.strictEqual(buf.numberOfChannels, 2);
  assert.strictEqual(buf.sampleRate, 44100);
  assert.strictEqual(buf.length, N);
  for (var j = 0; j < N; j++) {
    close(buf.getChannelData(0)[j], ref[j], 1e-4, 'L[' + j + ']');
    close(buf.getChannelData(1)[j], -ref[j], 1e-4, 'R[' + j + ']');   // channels stay separate
  }
});

check('24-bit mono keeps its own 48 kHz rate', function () {
  var d = pcm(function (b, v, o) {
    var n = Math.round(v * 8388607) & 0xffffff;
    b[o] = n >> 16 & 255; b[o + 1] = n >> 8 & 255; b[o + 2] = n & 255;
  }, 3);
  var buf = AudioSession.decodeAiff(ctx, ab(aiff(1, 48000, 24, N, d)));
  assert.strictEqual(buf.sampleRate, 48000);                 // 80-bit extended read correctly
  for (var j = 0; j < N; j++) close(buf.getChannelData(0)[j], ref[j], 1e-6, 's[' + j + ']');
});

check('8-bit mono is signed, unlike WAV', function () {
  var d = pcm(function (b, v, o) { b.writeInt8(Math.round(v * 127), o); }, 1);
  var buf = AudioSession.decodeAiff(ctx, ab(aiff(1, 22050, 8, N, d)));
  assert.strictEqual(buf.sampleRate, 22050);
  for (var j = 0; j < N; j++) close(buf.getChannelData(0)[j], ref[j], 1e-2, 's[' + j + ']');
});

check('AIFC fl32', function () {
  var d = pcm(function (b, v, o) { b.writeFloatBE(v, o); }, 4);
  var buf = AudioSession.decodeAiff(ctx, ab(aiff(1, 44100, 32, N, d, 'fl32')));
  for (var j = 0; j < N; j++) close(buf.getChannelData(0)[j], ref[j], 1e-7, 's[' + j + ']');
});

check('AIFC sowt is read little-endian', function () {
  var d = pcm(function (b, v, o) { b.writeInt16LE(Math.round(v * 32767), o); }, 2);
  var buf = AudioSession.decodeAiff(ctx, ab(aiff(1, 44100, 16, N, d, 'sowt')));
  for (var j = 0; j < N; j++) close(buf.getChannelData(0)[j], ref[j], 1e-4, 's[' + j + ']');
});

check('a compressed AIFC is refused, not mangled', function () {
  // null hands the file back to the browser's own decoder rather than guessing
  assert.strictEqual(AudioSession.decodeAiff(ctx, ab(aiff(1, 44100, 16, N, Buffer.alloc(256), 'ima4'))), null);
});

check('a truncated file yields the frames that are there', function () {
  var full = aiff(1, 44100, 16, N, pcm(function (b, v, o) { b.writeInt16BE(Math.round(v * 32767), o); }, 2));
  var buf = AudioSession.decodeAiff(ctx, ab(full.slice(0, full.length - 200)));
  assert.strictEqual(buf.length, N - 100);
  close(buf.getChannelData(0)[0], ref[0], 1e-4, 's[0]');
});

check('sniffing only claims real AIFF', function () {
  assert.ok(AudioSession.isAiff(ab(aiff(1, 44100, 16, N, Buffer.alloc(N * 2)))));
  assert.ok(!AudioSession.isAiff(ab(Buffer.from('RIFF\0\0\0\0WAVEfmt ', 'binary'))));
  assert.ok(!AudioSession.isAiff(ab(Buffer.from('no', 'binary'))));      // shorter than a header
});

console.log('\n' + pass + ' checks passed.');
