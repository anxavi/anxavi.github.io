import { ENGINE_CONTRACT_VERSION, INTENTS, DEFAULT_RUNTIME_CONFIG } from './constants.js';
import { makeResponse, validateGenerateRequest, validateGenerateResponse } from './contracts.js';
import { generateLocalOutfit } from './generator.js';
import { validateAndNormalizeWardrobe, validateContext } from './validation.js';
import { validateOutfitAgainstInventory } from './rules.js';

function raceTimeout(ms, signal) {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Operation canceled', 'AbortError'));
      }, { once: true });
    }
  });
}

async function fetchRemote({ endpoint, body, timeoutMs, signal }) {
  if (!endpoint) {
    throw new Error('Remote endpoint not configured');
  }
  if (!/^https:\/\//i.test(endpoint)) {
    throw new Error('Remote endpoint must be HTTPS');
  }

  const request = fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  const response = await Promise.race([request, raceTimeout(timeoutMs, signal)]);
  if (!response.ok) {
    throw new Error(`Remote provider failed with ${response.status}`);
  }
  return response.json();
}

function buildRequest({ context, wardrobe }) {
  return {
    version: ENGINE_CONTRACT_VERSION,
    context,
    candidates: wardrobe.map((item) => ({ id: item.id, category: item.category, state: item.state, formality: item.formality, thermalRange: item.thermalRange }))
  };
}

export function createOutfitEngine(userConfig = {}) {
  const config = {
    remoteEnabled: false,
    remoteEndpoint: '',
    runtime: { ...DEFAULT_RUNTIME_CONFIG },
    ...userConfig,
    runtime: { ...DEFAULT_RUNTIME_CONFIG, ...(userConfig.runtime || {}) }
  };

  async function generate(input) {
    const { wardrobe, context, intent = INTENTS.DEFAULT, currentOutfit = null, history = [], signal } = input;
    const contextValidation = validateContext({ ...context, intent });
    const wardrobeValidation = validateAndNormalizeWardrobe(wardrobe);

    const diagnostics = {
      errors: [...contextValidation.diagnostics.errors, ...wardrobeValidation.diagnostics.errors],
      warnings: [...contextValidation.diagnostics.warnings, ...wardrobeValidation.diagnostics.warnings]
    };

    if (diagnostics.errors.length > 0) {
      return makeResponse({
        provider: 'local',
        diagnostics,
        result: {
          status: 'error',
          outfit: currentOutfit,
          score: null,
          editorial: null,
          transitionLayer: null,
          explanation: 'Validation failed before generation.'
        }
      });
    }

    const normalizedContext = contextValidation.context;
    const normalizedWardrobe = wardrobeValidation.wardrobe;

    const requestPayload = buildRequest({ context: normalizedContext, wardrobe: normalizedWardrobe });
    const requestContract = validateGenerateRequest(requestPayload);
    if (!requestContract.valid) {
      return makeResponse({
        provider: 'local',
        diagnostics: { errors: [...diagnostics.errors, ...requestContract.errors], warnings: diagnostics.warnings },
        result: {
          status: 'error',
          outfit: currentOutfit,
          score: null,
          editorial: null,
          transitionLayer: null,
          explanation: 'Request contract validation failed.'
        }
      });
    }

    let remoteWarnings = [];
    if (config.remoteEnabled) {
      try {
        const remotePayload = await fetchRemote({
          endpoint: config.remoteEndpoint,
          body: requestPayload,
          timeoutMs: config.runtime.timeoutMs,
          signal
        });

        const responseContract = validateGenerateResponse(remotePayload);
        if (!responseContract.valid) {
          throw new Error(`Remote contract invalid: ${responseContract.errors.map((e) => e.code).join(', ')}`);
        }

        const remoteOutfit = remotePayload.result.outfit;
        const remoteErrors = validateOutfitAgainstInventory(remoteOutfit, normalizedWardrobe);
        if (remoteErrors.length > 0) {
          throw new Error(`Remote outfit rejected: ${remoteErrors.map((e) => e.code).join(', ')}`);
        }

        return makeResponse({
          provider: 'remote',
          diagnostics: {
            errors: diagnostics.errors,
            warnings: [...diagnostics.warnings, ...(remotePayload.diagnostics?.warnings || [])]
          },
          result: {
            status: 'success',
            outfit: remoteOutfit,
            score: remotePayload.result.score,
            editorial: remotePayload.result.editorial,
            transitionLayer: remotePayload.result.transitionLayer || null,
            explanation: remotePayload.result.explanation || 'Remote provider response accepted.'
          }
        });
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        remoteWarnings.push({ code: 'REMOTE_FALLBACK_LOCAL', message: `Remote provider failed, using local engine: ${error.message}`, path: 'provider' });
      }
    }

    const local = generateLocalOutfit({
      wardrobe: normalizedWardrobe,
      context: normalizedContext,
      currentOutfit,
      history,
      runtimeConfig: config.runtime
    });

    if (!local.ok) {
      return makeResponse({
        provider: 'local',
        diagnostics: {
          errors: [...diagnostics.errors, ...(local.diagnostics?.errors || [])],
          warnings: [...diagnostics.warnings, ...remoteWarnings, ...(local.diagnostics?.warnings || [])]
        },
        result: {
          status: 'error',
          outfit: currentOutfit,
          score: null,
          editorial: null,
          transitionLayer: null,
          explanation: local.error?.message || 'Local generation failed.'
        }
      });
    }

    const localOutfitErrors = validateOutfitAgainstInventory(local.result.outfit, normalizedWardrobe);
    if (localOutfitErrors.length > 0) {
      return makeResponse({
        provider: 'local',
        diagnostics: {
          errors: [...diagnostics.errors, ...localOutfitErrors],
          warnings: [...diagnostics.warnings, ...remoteWarnings, ...(local.diagnostics?.warnings || [])]
        },
        result: {
          status: 'error',
          outfit: currentOutfit,
          score: null,
          editorial: null,
          transitionLayer: null,
          explanation: 'Local revalidation failed.'
        }
      });
    }

    return makeResponse({
      provider: 'local',
      diagnostics: {
        errors: diagnostics.errors,
        warnings: [...diagnostics.warnings, ...remoteWarnings, ...(local.diagnostics?.warnings || [])]
      },
      result: {
        status: 'success',
        outfit: local.result.outfit,
        score: local.result.score,
        editorial: local.result.editorial,
        transitionLayer: local.result.transitionLayer,
        explanation: local.result.score.explanation
      }
    });
  }

  return {
    config,
    generate
  };
}
