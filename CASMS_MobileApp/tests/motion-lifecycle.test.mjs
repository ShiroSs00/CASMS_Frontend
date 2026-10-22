import assert from 'node:assert/strict';
import test from 'node:test';
import { startSheetTransition } from '../src/components/passenger/sheet-presence.ts';

test('sheet stays mounted until its exit actually completes', () => {
  let complete; let hidden = 0;
  const dispose = startSheetTransition(false, callback => { complete = callback; return () => {}; }, () => hidden++);
  assert.equal(hidden, 0);
  complete(false); assert.equal(hidden, 0);
  complete(true); assert.equal(hidden, 1);
  dispose();
});

test('late native exit callbacks cannot hide a reopened sheet', () => {
  let oldComplete; let nextComplete; let hidden = 0; let stopped = 0;
  const dispose = startSheetTransition(false, callback => { oldComplete = callback; return () => stopped++; }, () => hidden++);
  dispose();
  const disposeNext = startSheetTransition(true, callback => { nextComplete = callback; return () => stopped++; }, () => hidden++);
  oldComplete(true); nextComplete(true);
  assert.equal(hidden, 0); assert.equal(stopped, 1);
  disposeNext(); assert.equal(stopped, 2);
});

test('repeated open/close interruptions leave only the latest exit able to finish', () => {
  const pending = []; let hidden = 0; let dispose = () => {};
  for (const visible of [true, false, true, false, true, false]) {
    dispose();
    dispose = startSheetTransition(visible, callback => { pending.push(callback); return () => callback(false); }, () => hidden++);
  }
  pending.slice(0, -1).forEach(callback => callback(true));
  assert.equal(hidden, 0);
  pending.at(-1)(true); assert.equal(hidden, 1);
  dispose();
});

test('instant reduced-motion completion and unmount cancellation both work', () => {
  let hidden = 0;
  startSheetTransition(false, callback => { callback(true); return () => {}; }, () => hidden++);
  assert.equal(hidden, 1);
  let callback;
  const dispose = startSheetTransition(false, complete => { callback = complete; return () => callback(true); }, () => hidden++);
  dispose(); callback(true); assert.equal(hidden, 1);
});
