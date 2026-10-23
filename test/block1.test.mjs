import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as asyncControl from '../src/engine/async-control.js';
const { abortable, delay, fetchRemote } = asyncControl;

test('cancel interrupts visual delay', async () => {
  const c = new AbortController(); const pending = delay(5000, c.signal); c.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
test('pre-aborted operations reject', async () => {
  const c = new AbortController(); c.abort();
  await assert.rejects(delay(1, c.signal), { name: 'AbortError' });
  await assert.rejects(abortable(Promise.reject(new Error('late')), c.signal), { name: 'AbortError' });
});
test('successful operations and ordinary errors are preserved', async () => {
  assert.equal(await abortable(Promise.resolve(3), new AbortController().signal), 3);
  await assert.rejects(abortable(Promise.reject(new Error('failure')), new AbortController().signal), /failure/);
});
async function mockFetch(mock, work) {
  const original = globalThis.fetch; globalThis.fetch = mock;
  try { await work(); } finally { globalThis.fetch = original; }
}
test('cancel aborts fetch', async () => {
  const c = new AbortController(); let signal;
  await mockFetch((_url, opts) => { signal = opts.signal; return new Promise(() => {}); }, async () => {
    const pending = fetchRemote({ endpoint: 'https://example.invalid', body: {}, timeoutMs: 10000, signal: c.signal });
    c.abort(); await assert.rejects(pending, { name: 'AbortError' }); assert.equal(signal.aborted, true);
  });
});
test('timeout aborts fetch', async () => {
  let signal;
  await mockFetch((_url, opts) => { signal = opts.signal; return new Promise(() => {}); }, async () => {
    await assert.rejects(fetchRemote({ endpoint: 'https://example.invalid', body: {}, timeoutMs: 10 }), { name: 'TimeoutError' });
    assert.equal(signal.aborted, true);
  });
});
test('timeout covers JSON body parsing', async () => {
  await mockFetch(async () => ({ ok: true, json: () => new Promise(() => {}) }), async () => {
    await assert.rejects(fetchRemote({ endpoint: 'https://example.invalid', body: {}, timeoutMs: 10 }), { name: 'TimeoutError' });
  });
});
test('successful fetch releases timer', async () => {
  let signal;
  await mockFetch(async (_url, opts) => { signal = opts.signal; return { ok: true, json: async () => ({ ok: true }) }; }, async () => {
    assert.deepEqual(await fetchRemote({ endpoint: 'https://example.invalid', body: {}, timeoutMs: 10 }), { ok: true });
    await delay(25); assert.equal(signal.aborted, false);
  });
});
function deferred() {
  let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function response(id) {
  return { provider: 'local', diagnostics: { warnings: [] }, result: { status: 'success',
    outfit: { top: { id }, bottom: { id: 'b' }, footwear: { id: 'f' } }, score: { overall: 70 }, editorial: '', transitionLayer: null } };
}
const html = await readFile(new URL('../index-preview.html', import.meta.url), 'utf8');
const cancelStart = html.indexOf('      const invalidateGeneration = () => {');
const cancelEnd = html.indexOf('      const resetInteractionState = () => {', cancelStart);
const generationStart = html.indexOf('      const generatePrescription = async (extraIntent = null) => {');
const generationEnd = html.indexOf('\n      //', generationStart);
assert.ok(cancelStart >= 0 && cancelEnd > cancelStart && generationEnd > generationStart);
const prefix = `
const generationRequestRef = { current: { id: 0, abortController: null, waitTimer: null } };
const state = { outfit: { top: { id: 'old' } }, count: 0, loading: 'idle', error: null };
const lang = 'es', wardrobe = [], history = [], eventContext = 'office';
const dualJourney = false, dualJourneyType = 'dinner', currentView = 'today', isAuthenticated = true;
const currentOutfit = state.outfit, weather = { tempC: 17 };
const useEffect = () => {};
const setGenerationState = v => { state.loading = v; };
const setGenerationError = v => { state.error = v; };
const setGenerationWarning = () => {}, setShowRetryHint = () => {}, setShowTweakDrawer = () => {};
const setCurrentOutfit = v => { state.outfit = v; };
const setGeneratedCount = fn => { state.count = fn(state.count); };
const resetInteractionState = () => {};
const mapEngineOutfitToUI = outfit => outfit;
`;
const build = new Function('window', prefix + html.slice(cancelStart, cancelEnd) + html.slice(generationStart, generationEnd) + '\nreturn { generatePrescription, cancelGeneration, state };');
function harness(generate, min = 0) {
  return build({ __ARACHNE_ENGINE_READY__: Promise.resolve(), __ARACHNE_ENGINE__: { generate }, __ARACHNE_ASYNC__: asyncControl, ARACHNE_MIN_VISUAL_MS: min });
}
test('cancel during actual UI visual delay preserves previous outfit and count', async () => {
  const h = harness(async () => response('new'), 100);
  const pending = h.generatePrescription(); await delay(5); h.cancelGeneration(); await pending;
  assert.equal(h.state.outfit.top.id, 'old'); assert.equal(h.state.count, 0); assert.equal(h.state.loading, 'idle');
});
test('old UI success cannot overwrite newer generation', async () => {
  const old = deferred(); let n = 0; const h = harness(() => ++n === 1 ? old.promise : Promise.resolve(response('latest')), 1);
  const first = h.generatePrescription(); await delay(1); h.cancelGeneration();
  await h.generatePrescription(); old.resolve(response('obsolete')); await first;
  assert.equal(h.state.outfit.top.id, 'latest'); assert.equal(h.state.count, 1); assert.equal(h.state.loading, 'success');
});
test('old UI failure cannot overwrite current success', async () => {
  const old = deferred(); let n = 0; const h = harness(() => ++n === 1 ? old.promise : Promise.resolve(response('latest')), 1);
  const first = h.generatePrescription(); await delay(1); await h.generatePrescription();
  old.reject(new Error('obsolete')); await first;
  assert.equal(h.state.error, null); assert.equal(h.state.count, 1); assert.equal(h.state.loading, 'success');
});
test('three context controls have disabled attribute', () => {
  assert.equal((html.match(/disabled=\{isGenerating\}\s+aria-disabled=\{isGenerating\}/g) || []).length, 3);
});
