import { ALLOWED_CATEGORIES, REQUIRED_CATEGORIES } from './constants.js';

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const clone = (value) => JSON.parse(JSON.stringify(value));

export function normalizeGarment(rawGarment, index = 0) {
  const garment = clone(rawGarment || {});
  const errors = [];
  const warnings = [];

  if (!garment.id || typeof garment.id !== 'string') {
    errors.push({ code: 'INVALID_ID', message: 'Garment id must be a non-empty string', path: `garment[${index}].id` });
  }
  if (!ALLOWED_CATEGORIES.includes(garment.category)) {
    errors.push({ code: 'INVALID_CATEGORY', message: `Unsupported category: ${garment.category || 'unknown'}`, path: `garment[${index}].category` });
  }
  if (garment.state !== 'available' && garment.state !== 'unavailable') {
    warnings.push({ code: 'INVALID_STATE', message: 'Unknown state. Normalized to unavailable.', path: `garment[${index}].state` });
    garment.state = 'unavailable';
  }

  const min = garment.thermalRange?.minTempC;
  const max = garment.thermalRange?.maxTempC;
  if (!isFiniteNumber(min) || !isFiniteNumber(max)) {
    errors.push({ code: 'INVALID_THERMAL_RANGE', message: 'Thermal range must have finite min/max temperatures', path: `garment[${index}].thermalRange` });
  } else {
    garment.thermalRange = { minTempC: Number(min), maxTempC: Number(max) };
    if (garment.thermalRange.minTempC > garment.thermalRange.maxTempC) {
      errors.push({ code: 'INVERTED_THERMAL_RANGE', message: 'Thermal range minTempC cannot exceed maxTempC', path: `garment[${index}].thermalRange` });
    }
  }

  if (!isFiniteNumber(garment.formality)) {
    errors.push({ code: 'INVALID_FORMALITY', message: 'Formality must be finite numeric value', path: `garment[${index}].formality` });
  } else {
    garment.formality = Math.max(0, Math.min(10, Number(garment.formality)));
  }

  garment.timesWorn = isFiniteNumber(garment.timesWorn) ? Math.max(0, Number(garment.timesWorn)) : 0;
  garment.attributes = Array.isArray(garment.attributes) ? garment.attributes : [];

  return { garment, errors, warnings };
}

export function validateAndNormalizeWardrobe(wardrobe) {
  const errors = [];
  const warnings = [];
  const normalized = [];
  const ids = new Set();

  for (let i = 0; i < (Array.isArray(wardrobe) ? wardrobe.length : 0); i += 1) {
    const { garment, errors: itemErrors, warnings: itemWarnings } = normalizeGarment(wardrobe[i], i);
    if (garment.id && ids.has(garment.id)) {
      itemErrors.push({ code: 'DUPLICATE_ID', message: `Duplicate garment id: ${garment.id}`, path: `garment[${i}].id` });
    }
    ids.add(garment.id);
    errors.push(...itemErrors);
    warnings.push(...itemWarnings);
    normalized.push(garment);
  }

  if (!Array.isArray(wardrobe)) {
    errors.push({ code: 'INVALID_WARDROBE', message: 'Wardrobe must be an array', path: 'wardrobe' });
  }

  for (const category of REQUIRED_CATEGORIES) {
    const hasAny = normalized.some((item) => item.category === category && item.state === 'available');
    if (!hasAny) {
      errors.push({ code: 'MISSING_REQUIRED_CATEGORY', message: `No available garment for required category: ${category}`, path: 'wardrobe' });
    }
  }

  return {
    wardrobe: normalized,
    diagnostics: {
      valid: errors.length === 0,
      errors,
      warnings
    }
  };
}

export function validateContext(context = {}) {
  const errors = [];
  const warnings = [];

  if (!context.occasion || typeof context.occasion !== 'string') {
    errors.push({ code: 'INVALID_OCCASION', message: 'occasion must be provided', path: 'context.occasion' });
  }
  if (context.tempC != null && !isFiniteNumber(context.tempC)) {
    errors.push({ code: 'INVALID_TEMP', message: 'tempC must be finite when provided', path: 'context.tempC' });
  }
  if (context.rainProb != null && !isFiniteNumber(context.rainProb)) {
    errors.push({ code: 'INVALID_RAIN', message: 'rainProb must be finite when provided', path: 'context.rainProb' });
  }
  if (context.windKph != null && !isFiniteNumber(context.windKph)) {
    errors.push({ code: 'INVALID_WIND', message: 'windKph must be finite when provided', path: 'context.windKph' });
  }
  if (context.tempC == null) {
    warnings.push({ code: 'MISSING_TEMP', message: 'No temperature provided. Thermal fit will be low-confidence.', path: 'context.tempC' });
  }

  return {
    context: {
      ...context,
      tempC: context.tempC == null ? null : Number(context.tempC),
      rainProb: context.rainProb == null ? null : Number(context.rainProb),
      windKph: context.windKph == null ? null : Number(context.windKph),
      dualJourney: context.dualJourney || { enabled: false }
    },
    diagnostics: {
      valid: errors.length === 0,
      errors,
      warnings
    }
  };
}
