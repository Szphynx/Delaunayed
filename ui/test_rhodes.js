/* Self-check for ui/rhodes.js — node ui/test_rhodes.js
 * Oscillators either sound or they don't. What fails silently is the mapping:
 * a velocity curve that never gets brighter, or a tine that outlasts the note. */
'use strict';
const assert = require('assert');
const R = require('./rhodes.js');

let n = 0;
const check = (name, fn) => { fn(); n++; process.stdout.write('  ok  ' + name + '\n'); };

check('A4 is 440 and octaves double', () => {
  assert.ok(Math.abs(R.freq(69) - 440) < 1e-9);
  assert.ok(Math.abs(R.freq(81) - 880) < 1e-9);
});

check('digging in gets brighter, not just louder', () => {
  const soft = R.voiceParams(60, 0.2), hard = R.voiceParams(60, 1);
  assert.ok(hard.index > soft.index * 2, 'modulation index should climb with velocity');
  assert.ok(hard.cutoff > soft.cutoff);
  assert.ok(hard.level > soft.level);
});

check('the tine always dies before the body', () => {
  for (let m = 24; m <= 96; m++) {
    for (const v of [0.05, 0.5, 1]) {
      const p = R.voiceParams(m, v);
      assert.ok(p.tine < p.body, 'note ' + m + ' vel ' + v + ': tine outlasts body');
    }
  }
});

check('high notes ring shorter and duller than low ones', () => {
  const low = R.voiceParams(48, 0.8), high = R.voiceParams(84, 0.8);
  assert.ok(high.body < low.body);
  assert.ok(high.index < low.index);
});

check('velocity is clamped, so a stray 0 or 5 cannot kill the envelope', () => {
  const zero = R.voiceParams(60, 0), over = R.voiceParams(60, 5);
  assert.ok(zero.level > 0 && zero.index > 0);
  assert.ok(over.level <= 0.5 + 1e-9);
});

process.stdout.write(n + ' checks passed\n');
