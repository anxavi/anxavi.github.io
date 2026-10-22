import { DEFAULT_RUNTIME_CONFIG, INTENTS } from './constants.js';
import { scoreOutfit } from './scoring.js';
import { applyThermalByCategory, isCompleteOutfit, outfitKey, partitionByCategory, validateCategoryCoverage } from './rules.js';

const OCCASION_LABELS = {
  es: { office: 'oficina', casual: 'casual', dinner: 'cena', weekend: 'fin de semana', gym: 'gimnasio', party: 'noche' },
  en: { office: 'office', casual: 'casual', dinner: 'dinner', weekend: 'weekend', gym: 'gym', party: 'night' },
  ca: { office: 'oficina', casual: 'casual', dinner: 'sopar', weekend: 'cap de setmana', gym: 'gimnàs', party: 'nit' }
};

function editorial(lang, context, score, notes = []) {
  const l = OCCASION_LABELS[lang] ? lang : 'es';
  const secondary = context.dualJourney?.enabled ? ` + ${OCCASION_LABELS[l][context.dualJourney.type] || context.dualJourney.type}` : '';
  const tempPart = context.tempC == null
    ? (l === 'en' ? 'without confirmed temperature data' : l === 'ca' ? 'sense temperatura confirmada' : 'sin temperatura confirmada');
  const occasionPart = `${OCCASION_LABELS[l][context.occasion] || context.occasion}${secondary}`;
  const intro = l === 'en'
    ? `Heuristic outfit for ${occasionPart}, ${tempPart}.`
    : l === 'ca'
      ? `Outfit heurístic per a ${occasionPart}, ${tempPart}.`
      : `Outfit heurístico para ${occasionPart}, ${tempPart}.`;

  return `${intro} ${score.explanation}. ${notes.join(' ')}`.trim();
}

function orderedCandidates(items, maxPerCategory) {
  return [...items]
    .sort((a, b) => (a.timesWorn || 0) - (b.timesWorn || 0))
    .slice(0, maxPerCategory);
}

function* buildCombinations(partition, currentOutfit, maxCombinations) {
  const tops = partition.top;
  const bottoms = partition.bottom;
  const shoes = partition.footwear;
  const outers = [null, ...partition.outerwear];
  let count = 0;

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const footwear of shoes) {
        for (const outerwear of outers) {
          const outfit = { top, bottom, footwear, outerwear };
          if (!isCompleteOutfit(outfit)) continue;
          count += 1;
          if (count > maxCombinations) return;
          yield outfit;
        }
      }
    }
  }

  if (count === 0 && currentOutfit) {
    yield {
      top: currentOutfit.top,
      bottom: currentOutfit.bottom,
      footwear: currentOutfit.footwear,
      outerwear: currentOutfit.outerwear || null
    };
  }
}

function intentGate(intent, candidate, currentOutfit) {
  if (!currentOutfit || intent === INTENTS.DEFAULT) return { pass: true };

  if (intent === INTENTS.SHOES) {
    if (currentOutfit.footwear?.id && candidate.footwear.id === currentOutfit.footwear.id) {
      return { pass: false, reason: 'Requested shoe change excludes current footwear.' };
    }
    const preservesRest = candidate.top?.id === currentOutfit.top?.id &&
      candidate.bottom?.id === currentOutfit.bottom?.id &&
      (candidate.outerwear?.id || null) === (currentOutfit.outerwear?.id || null);
    return { pass: preservesRest, reason: preservesRest ? '' : 'Shoe tweak should preserve other pieces.' };
  }

  if (intent === INTENTS.LIGHTER && currentOutfit.outerwear && candidate.outerwear?.id === currentOutfit.outerwear.id) {
    return { pass: false, reason: 'Lighter intent prefers reducing outer layer.' };
  }

  if (intent === INTENTS.WARMER && currentOutfit.outerwear?.id && !candidate.outerwear) {
    return { pass: false, reason: 'Warmer intent should not drop the outer layer.' };
  }

  return { pass: true };
}

function chooseTransition(baseOutfit, context, scoredBase, alternatives) {
  if (!context.dualJourney?.enabled) return null;

  const secondaryContext = {
    ...context,
    occasion: context.dualJourney.type || context.occasion,
    dualJourney: { enabled: false },
    intent: INTENTS.DEFAULT
  };

  let best = { outfit: baseOutfit, score: scoredBase.overall, changed: 0, item: null };
  for (const candidate of alternatives) {
    const changes = ['top', 'bottom', 'footwear', 'outerwear'].filter((cat) => candidate[cat]?.id !== baseOutfit[cat]?.id).length;
    if (changes > 1) continue;
    const secondaryScore = scoreOutfit(candidate, secondaryContext).overall;
    const blended = Math.round((scoredBase.overall + secondaryScore) / 2) - (changes * 8);
    if (blended > best.score) {
      const changedCategory = ['top', 'bottom', 'footwear', 'outerwear'].find((cat) => candidate[cat]?.id !== baseOutfit[cat]?.id);
      best = {
        outfit: candidate,
        score: blended,
        changed: changes,
        item: changedCategory ? { category: changedCategory, garment: candidate[changedCategory] } : null
      };
    }
  }

  if (!best.item) return null;
  return {
    title: context.lang === 'en' ? 'Dual journey modular transition' : context.lang === 'ca' ? 'Transició modular de jornada doble' : 'Transición modular de jornada doble',
    item: best.item.garment,
    notes: context.lang === 'en'
      ? `Switch ${best.item.category} for second context.`
      : context.lang === 'ca'
        ? `Canvia ${best.item.category} per al segon context.`
        : `Cambia ${best.item.category} para el segundo contexto.`
  };
}

export function generateLocalOutfit({ wardrobe, context, runtimeConfig = {}, currentOutfit = null, history = [] }) {
  const config = { ...DEFAULT_RUNTIME_CONFIG, ...runtimeConfig };
  const notes = [];
  const available = wardrobe.filter((item) => item.state === 'available');
  const partition = partitionByCategory(available);
  const { filtered, warnings: thermalWarnings } = applyThermalByCategory(partition, context, config.relaxThermalMarginC);
  const coverageErrors = validateCategoryCoverage(filtered);

  if (coverageErrors.length > 0) {
    return {
      ok: false,
      diagnostics: { errors: coverageErrors, warnings: thermalWarnings },
      error: {
        code: 'NO_VALID_COMBINATION',
        message: 'Missing required category coverage for outfit generation.'
      }
    };
  }

  const candidatePartition = {
    top: orderedCandidates(filtered.top, config.maxCandidatesPerCategory),
    bottom: orderedCandidates(filtered.bottom, config.maxCandidatesPerCategory),
    footwear: orderedCandidates(filtered.footwear, config.maxCandidatesPerCategory),
    outerwear: orderedCandidates(filtered.outerwear || [], config.maxCandidatesPerCategory)
  };

  const recentOutfitKeys = (history || [])
    .slice(0, 12)
    .map((entry) => [entry.top?.id, entry.bottom?.id, entry.outerwear?.id || 'none', entry.footwear?.id].join('|'));

  const scoringContext = {
    ...context,
    recentOutfitKeys
  };

  const alternatives = [];
  for (const combo of buildCombinations(candidatePartition, currentOutfit, config.maxCombinations)) {
    const gate = intentGate(context.intent, combo, currentOutfit);
    if (!gate.pass) continue;
    const score = scoreOutfit(combo, scoringContext);
    const changeCount = currentOutfit
      ? ['top', 'bottom', 'outerwear', 'footwear'].filter((cat) => combo[cat]?.id !== currentOutfit[cat]?.id).length
      : 0;
    const stabilityBonus = currentOutfit ? Math.max(0, 3 - changeCount) : 0;
    alternatives.push({ combo, score, adjusted: score.overall + stabilityBonus, changeCount });
  }

  if (alternatives.length === 0) {
    return {
      ok: false,
      diagnostics: { errors: [{ code: 'NO_ALTERNATIVES', message: 'No outfit satisfies hard constraints', path: 'outfit' }], warnings: thermalWarnings },
      error: { code: 'NO_ALTERNATIVES', message: 'No valid alternatives found.' }
    };
  }

  alternatives.sort((a, b) => b.adjusted - a.adjusted);
  const best = alternatives[0];

  if (currentOutfit) {
    const currentScore = scoreOutfit(currentOutfit, scoringContext);
    if ((context.intent === INTENTS.WARMER && best.score.factors.thermal.score <= currentScore.factors.thermal.score) ||
        (context.intent === INTENTS.FORMAL && best.score.factors.formality.score <= currentScore.factors.formality.score)) {
      notes.push(context.lang === 'en'
        ? 'No higher-scoring improvement for requested tweak. Keeping current outfit.'
        : context.lang === 'ca'
          ? 'No hi ha millora vàlida per al retoc sol·licitat. Es manté l’outfit actual.'
          : 'No hay mejora válida para el ajuste solicitado. Se conserva el outfit actual.');
      return {
        ok: true,
        diagnostics: { errors: [], warnings: [...thermalWarnings, { code: 'NO_VALID_TWEAK_IMPROVEMENT', message: notes[0], path: 'intent' }] },
        result: {
          outfit: currentOutfit,
          score: currentScore,
          editorial: editorial(context.lang, context, currentScore, notes),
          transitionLayer: chooseTransition(currentOutfit, context, currentScore, alternatives.map((a) => a.combo))
        }
      };
    }
  }

  const transitionLayer = chooseTransition(best.combo, context, best.score, alternatives.map((a) => a.combo));

  return {
    ok: true,
    diagnostics: { errors: [], warnings: [...thermalWarnings] },
    result: {
      outfit: best.combo,
      score: best.score,
      editorial: editorial(context.lang, context, best.score, notes),
      transitionLayer
    }
  };
}
