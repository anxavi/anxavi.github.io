import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutfitEngine } from '../src/engine/index.js';

const BASE_WARDROBE = [
  { id: 'top_1', category: 'top', state: 'available', formality: 6, thermalRange: { minTempC: 10, maxTempC: 25 }, timesWorn: 5, color: { family: 'blue' }, attributes: ['breathable'] },
  { id: 'top_2', category: 'top', state: 'available', formality: 8, thermalRange: { minTempC: 8, maxTempC: 22 }, timesWorn: 9, color: { family: 'white' } },
  { id: 'bot_1', category: 'bottom', state: 'available', formality: 7, thermalRange: { minTempC: 7, maxTempC: 24 }, timesWorn: 8, color: { family: 'grey' }, attributes: ['stretch'] },
  { id: 'shoe_1', category: 'footwear', state: 'available', formality: 5, thermalRange: { minTempC: 5, maxTempC: 28 }, timesWorn: 15, color: { family: 'white' }, attributes: ['sneakers'] },
  { id: 'shoe_2', category: 'footwear', state: 'available', formality: 8, thermalRange: { minTempC: 4, maxTempC: 24 }, timesWorn: 3, color: { family: 'brown' } },
  { id: 'outer_1', category: 'outerwear', state: 'available', formality: 7, thermalRange: { minTempC: 4, maxTempC: 19 }, timesWorn: 2, color: { family: 'grey' } }
];

const context = {
  occasion: 'office',
  tempC: 16,
  rainProb: 25,
  windKph: 18,
  lang: 'es',
  dualJourney: { enabled: false }
};

test('returns validation errors for empty wardrobe', async () => {
  const engine = createOutfitEngine();
  const response = await engine.generate({ wardrobe: [], context, intent: 'default', history: [] });
  assert.equal(response.result.status, 'error');
  assert.ok(response.diagnostics.errors.some((e) => e.code === 'MISSING_REQUIRED_CATEGORY'));
});

test('never selects unavailable garments', async () => {
  const engine = createOutfitEngine();
  const wardrobe = BASE_WARDROBE.map((item) => item.id === 'shoe_1' ? { ...item, state: 'unavailable' } : item);
  const response = await engine.generate({ wardrobe, context, intent: 'default', history: [] });
  assert.equal(response.result.status, 'success');
  assert.notEqual(response.result.outfit.footwear.id, 'shoe_1');
});

test('deterministic score for same input', async () => {
  const engine = createOutfitEngine();
  const first = await engine.generate({ wardrobe: BASE_WARDROBE, context, intent: 'default', history: [] });
  const second = await engine.generate({ wardrobe: BASE_WARDROBE, context, intent: 'default', history: [] });
  assert.equal(first.result.score.overall, second.result.score.overall);
  assert.deepEqual(first.result.outfit, second.result.outfit);
});

test('shoe tweak preserves other pieces and changes current footwear', async () => {
  const engine = createOutfitEngine();
  const base = await engine.generate({ wardrobe: BASE_WARDROBE, context, intent: 'default', history: [] });
  const tweaked = await engine.generate({
    wardrobe: BASE_WARDROBE,
    context,
    intent: 'shoes',
    currentOutfit: base.result.outfit,
    history: []
  });
  assert.equal(tweaked.result.status, 'success');
  assert.equal(tweaked.result.outfit.top.id, base.result.outfit.top.id);
  assert.equal(tweaked.result.outfit.bottom.id, base.result.outfit.bottom.id);
  assert.notEqual(tweaked.result.outfit.footwear.id, base.result.outfit.footwear.id);
});

test('dual journey evaluates transition and keeps hard constraints', async () => {
  const engine = createOutfitEngine();
  const response = await engine.generate({
    wardrobe: BASE_WARDROBE,
    context: { ...context, dualJourney: { enabled: true, type: 'dinner' } },
    intent: 'default',
    history: []
  });
  assert.equal(response.result.status, 'success');
  assert.ok(response.result.outfit.top && response.result.outfit.bottom && response.result.outfit.footwear);
  if (response.result.transitionLayer) {
    assert.ok(response.result.transitionLayer.item?.id);
  }
});

test('remote malformed response falls back to local explicitly', async () => {
  const engine = createOutfitEngine({ remoteEnabled: true, remoteEndpoint: 'https://localhost.invalid/nope' });
  const response = await engine.generate({ wardrobe: BASE_WARDROBE, context, intent: 'default', history: [] });
  assert.equal(response.provider, 'local');
  assert.equal(response.result.status, 'success');
  assert.ok(response.diagnostics.warnings.some((w) => w.code === 'REMOTE_FALLBACK_LOCAL'));
});

test('abort signal stops generation', async () => {
  const engine = createOutfitEngine({ remoteEnabled: true, remoteEndpoint: 'https://localhost.invalid/nope' });
  const controller = new AbortController();
  const pending = engine.generate({ wardrobe: BASE_WARDROBE, context, intent: 'default', history: [], signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /AbortError|Operation canceled/);
});
