import { CATEGORIES, REQUIRED_CATEGORIES } from './constants.js';

export function partitionByCategory(garments) {
  const categories = {
    [CATEGORIES.TOP]: [],
    [CATEGORIES.BOTTOM]: [],
    [CATEGORIES.OUTERWEAR]: [],
    [CATEGORIES.FOOTWEAR]: []
  };

  for (const garment of garments) {
    if (categories[garment.category]) categories[garment.category].push(garment);
  }
  return categories;
}

export function isThermallyCompatible(garment, tempC, margin = 0) {
  if (tempC == null) return true;
  const min = garment.thermalRange.minTempC - margin;
  const max = garment.thermalRange.maxTempC + margin;
  return tempC >= min && tempC <= max;
}

export function applyThermalByCategory(partition, context, relaxMarginC) {
  const warnings = [];
  const filtered = {};

  for (const [category, items] of Object.entries(partition)) {
    const strict = items.filter((item) => isThermallyCompatible(item, context.tempC, 0));
    if (strict.length > 0) {
      filtered[category] = strict;
      continue;
    }

    const relaxed = items.filter((item) => isThermallyCompatible(item, context.tempC, relaxMarginC));
    if (relaxed.length > 0) {
      filtered[category] = relaxed;
      warnings.push({
        code: 'THERMAL_RELAXATION_APPLIED',
        message: `Thermal constraints relaxed by ±${relaxMarginC}°C for category ${category}`,
        path: `candidates.${category}`
      });
      continue;
    }

    filtered[category] = items;
    if (context.tempC != null && items.length > 0) {
      warnings.push({
        code: 'THERMAL_RELAXATION_EXHAUSTED',
        message: `No thermal matches for ${category}; using all available garments in category.`,
        path: `candidates.${category}`
      });
    }
  }

  return { filtered, warnings };
}

export function validateCategoryCoverage(partition) {
  const errors = [];
  for (const category of REQUIRED_CATEGORIES) {
    if (!partition[category] || partition[category].length === 0) {
      errors.push({ code: 'MISSING_CATEGORY_COVERAGE', message: `No candidates for required category ${category}`, path: `candidates.${category}` });
    }
  }
  return errors;
}

export function isCompleteOutfit(outfit) {
  return Boolean(outfit.top && outfit.bottom && outfit.footwear);
}

export function outfitKey(outfit) {
  return [outfit.top?.id, outfit.bottom?.id, outfit.outerwear?.id || 'none', outfit.footwear?.id]
    .join('|');
}

export function validateOutfitAgainstInventory(outfit, inventory) {
  const byId = new Map(inventory.map((g) => [g.id, g]));
  const errors = [];
  const seen = new Set();

  for (const category of ['top', 'bottom', 'outerwear', 'footwear']) {
    const item = outfit[category];
    if (!item) {
      if (category !== 'outerwear') errors.push({ code: 'OUTFIT_INCOMPLETE', message: `Missing required category ${category}`, path: `outfit.${category}` });
      continue;
    }
    if (!byId.has(item.id)) {
      errors.push({ code: 'UNKNOWN_GARMENT_ID', message: `Garment ${item.id} not in inventory`, path: `outfit.${category}` });
      continue;
    }
    const source = byId.get(item.id);
    if (source.category !== category) {
      errors.push({ code: 'CATEGORY_MISMATCH', message: `Garment ${item.id} is category ${source.category} but used as ${category}`, path: `outfit.${category}` });
    }
    if (source.state !== 'available') {
      errors.push({ code: 'UNAVAILABLE_GARMENT', message: `Garment ${item.id} is not available`, path: `outfit.${category}` });
    }
    if (seen.has(item.id)) {
      errors.push({ code: 'DUPLICATE_GARMENT', message: `Garment ${item.id} duplicated in outfit`, path: `outfit.${category}` });
    }
    seen.add(item.id);
  }

  return errors;
}
