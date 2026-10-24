import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUsageSession, usageState, usageOutfitGarmentIds,
  confirmUsage, undoUsage, profileWearCount
} from '../src/engine/presentation.js';
import { createUsageLedger } from '../src/engine/usage.js';

const garment = (id, timesWorn = 0, state = 'available') => ({ id, category: 'top', state, timesWorn });
const outfit = (id, garments) => ({ id, garments });
const day = '2026-10-24';

test('createUsageSession preserves historical wear count', () => {
  const history = [{ wornDates: [day], legacyWearCount: 2 }];
  const ledger = createUsageSession(history);
  assert.equal(ledger.legacyCount, 3);
  assert.deepEqual(ledger.records, []);
});

test('empty selection is rejected without mutations', () => {
  const ledger = createUsageSession([]);
  const wardrobe = [garment('g1')];
  const result = confirmUsage(ledger, wardrobe, outfit('o1', [wardrobe[0]]), [], day);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty_selection');
  assert.equal(result.ledger.records.length, 0);
  assert.equal(result.wardrobe[0].timesWorn, 0);
});

test('partial confirmation records only selected garments', () => {
  const ledger = createUsageSession([]);
  const wardrobe = [garment('g1'), garment('g2')];
  const look = outfit('o1', wardrobe);
  const result = confirmUsage(ledger, wardrobe, look, ['g1'], day);
  assert.equal(result.ok, true);
  assert.deepEqual(result.entry.garmentIds, ['g1']);
  assert.equal(result.wardrobe[0].timesWorn, 1);
  assert.equal(result.wardrobe[1].timesWorn, 0);
});

test('identical repeat confirmation is a duplicate', () => {
  const ledger = createUsageSession([]);
  const wardrobe = [garment('g1')];
  const look = outfit('o1', wardrobe);
  const first = confirmUsage(ledger, wardrobe, look, ['g1'], day);
  const second = confirmUsage(first.ledger, first.wardrobe, look, ['g1'], day);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.wardrobe[0].timesWorn, 1);
});

test('different selection after a record is rejected', () => {
  const ledger = createUsageSession([]);
  const wardrobe = [garment('g1'), garment('g2')];
  const look = outfit('o1', wardrobe);
  const first = confirmUsage(ledger, wardrobe, look, ['g1'], day);
  const second = confirmUsage(first.ledger, first.wardrobe, look, ['g2'], day);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already_recorded');
});

test('revoke removes the exact daily record', () => {
  const ledger = createUsageSession([]);
  const wardrobe = [garment('g1')];
  const look = outfit('o1', wardrobe);
  const registered = confirmUsage(ledger, wardrobe, look, ['g1'], day);
  const revoked = undoUsage(registered.ledger, registered.wardrobe, look, day);
  assert.equal(revoked.ok, true);
  assert.equal(revoked.ledger.records.length, 0);
  assert.equal(revoked.wardrobe[0].timesWorn, 0);
});

test('shared garment is counted once per day', () => {
  const ledger = createUsageSession([]);
  const shared = garment('shared');
  const wardrobe = [shared, garment('other')];
  const first = outfit('o1', [shared]);
  const second = outfit('o2', [shared, wardrobe[1]]);
  const a = confirmUsage(ledger, wardrobe, first, ['shared'], day);
  const b = confirmUsage(a.ledger, a.wardrobe, second, ['shared', 'other'], day);
  assert.equal(b.wardrobe[0].timesWorn, 1);
  assert.equal(b.wardrobe[1].timesWorn, 1);
  const revokeFirst = undoUsage(b.ledger, b.wardrobe, first, day);
  assert.equal(revokeFirst.wardrobe[0].timesWorn, 1);
  const revokeSecond = undoUsage(revokeFirst.ledger, revokeFirst.wardrobe, second, day);
  assert.equal(revokeSecond.wardrobe[0].timesWorn, 0);
});

test('unselected unavailable garments do not block available selection', () => {
  const ledger = createUsageSession([]);
  const wardrobe = [garment('g1'), garment('g2', 0, 'unavailable')];
  const look = outfit('o1', wardrobe);
  const result = confirmUsage(ledger, wardrobe, look, ['g1'], day);
  assert.equal(result.ok, true);
  assert.equal(result.wardrobe[0].timesWorn, 1);
});

test('usage can be revoked after availability changes', () => {
  const ledger = createUsageSession([]);
  const wardrobe = [garment('g1')];
  const look = outfit('o1', wardrobe);
  const registered = confirmUsage(ledger, wardrobe, look, ['g1'], day);
  const changed = registered.wardrobe.map(item => ({ ...item, state: 'unavailable' }));
  const revoked = undoUsage(registered.ledger, changed, look, day);
  assert.equal(revoked.ok, true);
  assert.equal(revoked.wardrobe[0].timesWorn, 0);
});

test('usageState exposes recorded garment ids', () => {
  const ledger = createUsageSession([]);
  const wardrobe = [garment('g1'), garment('g2')];
  const look = outfit('o1', wardrobe);
  const registered = confirmUsage(ledger, wardrobe, look, ['g2'], day);
  const state = usageState(registered.ledger, look, day);
  assert.equal(state.recorded, true);
  assert.deepEqual(state.garmentIds, ['g2']);
  assert.deepEqual(usageOutfitGarmentIds(look), ['g1', 'g2']);
});

test('another day can add another use', () => {
  const ledger = createUsageSession([]);
  const wardrobe = [garment('g1')];
  const look = outfit('o1', wardrobe);
  const first = confirmUsage(ledger, wardrobe, look, ['g1'], '2026-10-24');
  const second = confirmUsage(first.ledger, first.wardrobe, look, ['g1'], '2026-10-25');
  assert.equal(second.wardrobe[0].timesWorn, 2);
});

test('profileWearCount prefers ledger and falls back to history', () => {
  const history = [{ wornDates: [day], legacyWearCount: 1 }];
  assert.equal(profileWearCount(null, history), 2);
  const ledger = createUsageLedger(2);
  const wardrobe = [garment('g1')];
  const registered = confirmUsage(ledger, wardrobe, outfit('o1', wardrobe), ['g1'], day);
  assert.equal(profileWearCount(registered.ledger, history), 3);
});
