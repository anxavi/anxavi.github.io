export const ENGINE_CONTRACT_VERSION = '1.0.0';

export const CATEGORIES = Object.freeze({
  TOP: 'top',
  BOTTOM: 'bottom',
  OUTERWEAR: 'outerwear',
  FOOTWEAR: 'footwear'
});

export const REQUIRED_CATEGORIES = Object.freeze([
  CATEGORIES.TOP,
  CATEGORIES.BOTTOM,
  CATEGORIES.FOOTWEAR
]);

export const OPTIONAL_CATEGORIES = Object.freeze([CATEGORIES.OUTERWEAR]);

export const ALLOWED_CATEGORIES = Object.freeze([
  ...REQUIRED_CATEGORIES,
  ...OPTIONAL_CATEGORIES,
  'accessory'
]);

export const OCCASION_FORMALITY_TARGET = Object.freeze({
  office: 8,
  casual: 5,
  dinner: 7,
  weekend: 4,
  gym: 3,
  party: 6
});

export const INTENTS = Object.freeze({
  DEFAULT: 'default',
  WARMER: 'warmer',
  FORMAL: 'formal',
  SHOES: 'shoes',
  LIGHTER: 'lighter',
  ACTIVE: 'active',
  EFFORTLESS: 'effortless'
});

export const DEFAULT_WEIGHTS = Object.freeze({
  formality: 0.28,
  thermal: 0.26,
  color: 0.14,
  preferences: 0.14,
  rotation: 0.12,
  comfort: 0.06
});

export const DEFAULT_RUNTIME_CONFIG = Object.freeze({
  timeoutMs: 8000,
  minVisualMs: 1200,
  maxVisualMs: 2500,
  maxCandidatesPerCategory: 8,
  maxCombinations: 400,
  relaxThermalMarginC: 4
});
