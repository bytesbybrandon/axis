import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseKey } from '../src/input.js';

describe('Terminal Input Parser (src/input.js)', () => {
  it('parses arrow navigation keys', () => {
    assert.deepEqual(parseKey('\u001b[A'), { name: 'up', type: 'move' });
    assert.deepEqual(parseKey('\u001b[B'), { name: 'down', type: 'move' });
    assert.deepEqual(parseKey('\u001b[C'), { name: 'right', type: 'move' });
    assert.deepEqual(parseKey('\u001b[D'), { name: 'left', type: 'move' });
  });

  it('parses vim navigation keys', () => {
    assert.deepEqual(parseKey('k'), { name: 'up', type: 'move' });
    assert.deepEqual(parseKey('j'), { name: 'down', type: 'move' });
    assert.deepEqual(parseKey('h'), { name: 'left', type: 'move' });
    assert.deepEqual(parseKey('l'), { name: 'right', type: 'move' });
  });

  it('parses WASD navigation keys', () => {
    assert.deepEqual(parseKey('w'), { name: 'up', type: 'move' });
    assert.deepEqual(parseKey('s'), { name: 'down', type: 'move' });
    assert.deepEqual(parseKey('a'), { name: 'left', type: 'move' });
    assert.deepEqual(parseKey('d'), { name: 'right', type: 'move' });
  });

  it('parses direct numeric cell picks (1-9)', () => {
    assert.deepEqual(parseKey('1'), { name: 'cell', index: 0, type: 'jump' });
    assert.deepEqual(parseKey('5'), { name: 'cell', index: 4, type: 'jump' });
    assert.deepEqual(parseKey('9'), { name: 'cell', index: 8, type: 'jump' });
  });

  it('parses select and command hotkeys', () => {
    assert.deepEqual(parseKey(' '), { name: 'select', type: 'action' });
    assert.deepEqual(parseKey('\r'), { name: 'select', type: 'action' });
    assert.deepEqual(parseKey('\n'), { name: 'select', type: 'action' });
    assert.deepEqual(parseKey('r'), { name: 'restart', type: 'command' });
    assert.deepEqual(parseKey('m'), { name: 'mode', type: 'command' });
    assert.deepEqual(parseKey('t'), { name: 'difficulty', type: 'command' });
    assert.deepEqual(parseKey('\t'), { name: 'difficulty', type: 'command' });
    assert.deepEqual(parseKey('v'), { name: 'sound', type: 'command' });
    assert.deepEqual(parseKey('b'), { name: 'sound', type: 'command' });
  });

  it('parses exit keys', () => {
    assert.deepEqual(parseKey('q'), { name: 'exit', type: 'system' });
    assert.deepEqual(parseKey('Q'), { name: 'exit', type: 'system' });
    assert.deepEqual(parseKey('\u0003'), { name: 'exit', type: 'system' });
  });
});
