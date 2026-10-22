import { createOutfitEngine, INTENTS } from './index.js';
import { scoreOutfit } from './scoring.js';

const runtime = {
  timeoutMs: Number(globalThis.ARACHNE_TIMEOUT_MS || 8000),
  minVisualMs: Math.min(2500, Number(globalThis.ARACHNE_MIN_VISUAL_MS || 1200))
};

const engine = createOutfitEngine({
  remoteEnabled: Boolean(globalThis.ARACHNE_REMOTE_ENDPOINT),
  remoteEndpoint: globalThis.ARACHNE_REMOTE_ENDPOINT || '',
  runtime
});

globalThis.__ARACHNE_ENGINE__ = engine;
globalThis.__ARACHNE_INTENTS__ = INTENTS;
globalThis.__ARACHNE_SCORE_OUTFIT__ = scoreOutfit;

export { engine, INTENTS, scoreOutfit };
