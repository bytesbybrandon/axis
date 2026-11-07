import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { playTone, BELL, getTonePattern, TONE_PATTERNS } from '../src/audio.js';

describe('Terminal Audio Effects Suite (src/audio.js)', () => {
  it('exports valid tone timing patterns for all sound types', () => {
    assert.deepEqual(getTonePattern('move'), [0]);
    assert.deepEqual(getTonePattern('invalid'), [0, 90]);
    assert.deepEqual(getTonePattern('win'), [0, 120, 260]);
    assert.deepEqual(getTonePattern('draw'), [0, 200]);
    assert.deepEqual(getTonePattern('toggle'), [0]);
    assert.deepEqual(getTonePattern('unknown'), [0]);
  });

  it('does not write any bell characters when sound is disabled', () => {
    let written = '';
    const mockStream = {
      write: (data) => {
        written += data;
      }
    };

    const played = playTone('move', false, mockStream);
    assert.equal(played, false);
    assert.equal(written, '');
  });

  it('writes bell character when sound is enabled', () => {
    let written = '';
    const mockStream = {
      write: (data) => {
        written += data;
      }
    };

    const played = playTone('move', true, mockStream);
    assert.equal(played, true);
    assert.equal(written, BELL);
  });
});
