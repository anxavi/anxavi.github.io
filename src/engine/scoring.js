import { DEFAULT_WEIGHTS, OCCASION_FORMALITY_TARGET, INTENTS } from './constants.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const avg = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

const hasColorData = (garment) => Boolean(garment?.color?.family);

function computeFormalityScore(outfit, context) {
  const target = OCCASION_FORMALITY_TARGET[context.occasion] ?? 5;
  const values = [outfit.top, outfit.bottom, outfit.footwear, outfit.outerwear].filter(Boolean).map((g) => g.formality);
  const outfitFormality = avg(values);
  const diff = Math.abs(outfitFormality - target);
  const score = clamp01(1 - diff / 6);
  return {
    score,
    reason: `Target ${target.toFixed(1)} vs outfit ${outfitFormality.toFixed(1)}`,
    coverage: values.length / 4,
    limitations: []
  };
}

function computeThermalScore(outfit, context) {
  if (context.tempC == null) {
    return {
      score: 0.55,
      reason: 'Temperature missing. Using neutral thermal estimate.',
      coverage: 0,
      limitations: ['no_temperature']
    };
  }

  const garments = [outfit.top, outfit.bottom, outfit.footwear, outfit.outerwear].filter(Boolean);
  const comfortScores = garments.map((g) => {
    const min = g.thermalRange.minTempC;
    const max = g.thermalRange.maxTempC;
    if (context.tempC >= min && context.tempC <= max) return 1;
    const distance = context.tempC < min ? (min - context.tempC) : (context.tempC - max);
    return clamp01(1 - distance / 10);
  });

  const windPenalty = context.windKph != null ? Math.min(0.2, context.windKph / 150) : 0;
  const rainPenalty = context.rainProb != null ? Math.min(0.2, context.rainProb / 200) : 0;
  const score = clamp01(avg(comfortScores) - windPenalty - rainPenalty);

  return {
    score,
    reason: `Estimated thermal comfort at ${context.tempC}°C${context.windKph != null ? `, wind ${context.windKph} km/h` : ''}${context.rainProb != null ? `, rain ${context.rainProb}%` : ''}`,
    coverage: garments.length / 4,
    limitations: ['heuristic_not_scientific']
  };
}

function computeColorScore(outfit) {
  const garments = [outfit.top, outfit.bottom, outfit.footwear, outfit.outerwear].filter(Boolean);
  const withColor = garments.filter(hasColorData);
  if (withColor.length < 2) {
    return {
      score: 0.58,
      reason: 'Insufficient color metadata for robust harmony estimate.',
      coverage: withColor.length / Math.max(garments.length, 1),
      limitations: ['limited_color_data']
    };
  }

  const families = withColor.map((g) => g.color.family);
  const uniqueFamilies = new Set(families).size;
  const score = clamp01(1 - (uniqueFamilies - 1) * 0.18);

  return {
    score,
    reason: uniqueFamilies <= 2 ? 'Compact color family palette.' : 'Higher palette diversity reduces cohesion.',
    coverage: withColor.length / garments.length,
    limitations: []
  };
}

function computePreferenceScore(outfit, context) {
  const garments = [outfit.top, outfit.bottom, outfit.footwear, outfit.outerwear].filter(Boolean);
  let score = 0.6;
  const notes = [];

  if (context.intent === INTENTS.FORMAL) {
    const formality = avg(garments.map((g) => g.formality));
    score = clamp01(0.4 + formality / 10);
    notes.push('formal_intent');
  } else if (context.intent === INTENTS.ACTIVE) {
    const hasActive = garments.some((g) => (g.attributes || []).some((attr) => ['stretch', 'breathable', 'active', 'sneakers'].includes(String(attr).toLowerCase())));
    score = hasActive ? 0.82 : 0.45;
    notes.push(hasActive ? 'active_attributes_found' : 'active_attributes_missing');
  } else if (context.intent === INTENTS.EFFORTLESS) {
    const uniqueFamilies = new Set(garments.filter(hasColorData).map((g) => g.color.family)).size;
    score = uniqueFamilies <= 2 ? 0.78 : 0.6;
    notes.push('effortless_prefers_low_contrast_palette');
  }

  return {
    score,
    reason: notes.length ? notes.join(', ') : 'No explicit preference requested.',
    coverage: notes.length ? 1 : 0,
    limitations: notes.includes('active_attributes_missing') ? ['limited_comfort_metadata'] : []
  };
}

function computeRotationScore(outfit, context) {
  const garments = [outfit.top, outfit.bottom, outfit.footwear, outfit.outerwear].filter(Boolean);
  const usageAvg = avg(garments.map((g) => g.timesWorn || 0));
  let score = clamp01(1 - usageAvg / 80);

  const ids = garments.map((g) => g.id).sort().join('|');
  if (Array.isArray(context.recentOutfitKeys) && context.recentOutfitKeys.includes(ids)) {
    score = clamp01(score - 0.3);
  }

  return {
    score,
    reason: `Rotation based on average usage (${usageAvg.toFixed(1)} wears).`,
    coverage: 1,
    limitations: ['depends_on_local_usage_history']
  };
}

function computeComfortScore(outfit, context) {
  if (context.intent !== INTENTS.ACTIVE) {
    return { score: 0.6, reason: 'Neutral comfort baseline.', coverage: 0, limitations: [] };
  }

  const garments = [outfit.top, outfit.bottom, outfit.footwear].filter(Boolean);
  const comfortHits = garments.map((g) => (g.attributes || []).some((attr) => ['stretch', 'breathable', 'lightweight', 'active', 'sneakers'].includes(String(attr).toLowerCase())) ? 1 : 0);
  const score = comfortHits.length ? avg(comfortHits) : 0.45;

  return {
    score,
    reason: 'Comfort score based on available garment attributes.',
    coverage: garments.length ? 1 : 0,
    limitations: ['attribute_based_heuristic']
  };
}

export function scoreOutfit(outfit, context, weights = DEFAULT_WEIGHTS) {
  const factors = {
    formality: computeFormalityScore(outfit, context),
    thermal: computeThermalScore(outfit, context),
    color: computeColorScore(outfit),
    preferences: computePreferenceScore(outfit, context),
    rotation: computeRotationScore(outfit, context),
    comfort: computeComfortScore(outfit, context)
  };

  const total = Object.entries(weights).reduce((sum, [key, weight]) => {
    return sum + ((factors[key]?.score ?? 0) * weight);
  }, 0);

  const overall = Math.round(clamp01(total) * 100);

  return {
    overall,
    factors,
    coverage: avg(Object.values(factors).map((f) => f.coverage || 0)),
    limitations: Array.from(new Set(Object.values(factors).flatMap((f) => f.limitations || []))),
    explanation: Object.entries(factors)
      .map(([key, value]) => `${key}: ${value.reason}`)
      .join(' | ')
  };
}
