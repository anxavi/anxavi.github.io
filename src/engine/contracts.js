import { ENGINE_CONTRACT_VERSION } from './constants.js';

function makeError(code, message, path = '') {
  return { code, message, path };
}

export function validateGenerateRequest(payload = {}) {
  const errors = [];

  if (payload.version !== ENGINE_CONTRACT_VERSION) {
    errors.push(makeError('VERSION_MISMATCH', `Expected version ${ENGINE_CONTRACT_VERSION}`, 'version'));
  }
  if (!payload.context || typeof payload.context !== 'object') {
    errors.push(makeError('INVALID_CONTEXT', 'context must be an object', 'context'));
  }
  if (!Array.isArray(payload.candidates)) {
    errors.push(makeError('INVALID_CANDIDATES', 'candidates must be an array', 'candidates'));
  }

  return { valid: errors.length === 0, errors };
}

export function validateGenerateResponse(payload = {}) {
  const errors = [];

  if (payload.version !== ENGINE_CONTRACT_VERSION) {
    errors.push(makeError('VERSION_MISMATCH', `Expected version ${ENGINE_CONTRACT_VERSION}`, 'version'));
  }
  if (!payload.result || typeof payload.result !== 'object') {
    errors.push(makeError('INVALID_RESULT', 'result must be an object', 'result'));
  }
  if (!payload.result?.outfit || typeof payload.result?.outfit !== 'object') {
    errors.push(makeError('INVALID_OUTFIT', 'result.outfit must be an object', 'result.outfit'));
  }
  if (!payload.result?.score || typeof payload.result?.score !== 'object') {
    errors.push(makeError('INVALID_SCORE', 'result.score must be an object', 'result.score'));
  }

  return { valid: errors.length === 0, errors };
}

export function makeResponse({ result, diagnostics = { errors: [], warnings: [] }, provider = 'local' }) {
  return {
    version: ENGINE_CONTRACT_VERSION,
    provider,
    result,
    diagnostics
  };
}
