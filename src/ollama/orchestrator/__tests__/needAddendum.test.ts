import test from 'node:test';
import assert from 'node:assert/strict';

import { parseNeedAddendum } from '../needAddendum';

test('parseNeedAddendum accepts exact one-line format', () => {
  const got = parseNeedAddendum('NEED_ADDENDUM @@TAB_HELP:ABILITIES');
  assert.deepEqual(got, { tab: 'ABILITIES' });
});

test('parseNeedAddendum rejects extra text', () => {
  const got = parseNeedAddendum('NEED_ADDENDUM @@TAB_HELP:ABILITIES\nextra');
  assert.equal(got, null);
});

test('parseNeedAddendum rejects unknown tab', () => {
  const got = parseNeedAddendum('NEED_ADDENDUM @@TAB_HELP:BOGUS');
  assert.equal(got, null);
});
