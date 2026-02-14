import test from 'node:test';
import assert from 'node:assert/strict';

import { selectAddendaTabs, inferModeFromUserText } from '../../src/ollama/orchestrator/addendaPolicy';

test('inferModeFromUserText detects explain', () => {
  assert.equal(inferModeFromUserText('What does Natural Bonus do?'), 'explain');
});

test('selectAddendaTabs loads active tab help for explain question', () => {
  const tabs = selectAddendaTabs({ activeTab: 'SKILLS', mode: 'explain' }, 'What does Bonus mean?');
  assert.deepEqual(tabs, ['SKILLS']);
});

test('selectAddendaTabs does not load help for general chat', () => {
  const tabs = selectAddendaTabs({ activeTab: 'SKILLS' }, 'Hi there');
  assert.deepEqual(tabs, []);
});

test('selectAddendaTabs loads help when editing in complex tab', () => {
  const tabs = selectAddendaTabs({ activeTab: 'ABILITIES', mode: 'edit' }, 'Set Outcome to success');
  assert.deepEqual(tabs, ['ABILITIES']);
});
