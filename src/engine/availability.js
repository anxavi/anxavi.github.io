const MESSAGES = {
  "es": {
    "available": "Disponibles",
    "unavailable": "No disponibles",
    "select": "Seleccionar",
    "cancel": "Cancelar selección",
    "selectVisible": "Seleccionar todas las visibles",
    "clear": "Quitar selección",
    "selected": "{count} seleccionadas",
    "toUnavailable": "Marcar como no disponibles",
    "toAvailable": "Marcar como disponibles",
    "allAvailable": "Reactivar todas",
    "confirmAll": "Vas a reactivar {count} prendas de todas las categorías. ¿Continuar?",
    "undo": "Deshacer último cambio",
    "changed": "Disponibilidad actualizada: {count} prendas.",
    "empty": "No hay prendas en este apartado con el filtro actual.",
    "review": "Revisar armario",
    "stale": "Este outfit contiene prendas que ya no están disponibles. Vuelve a generarlo antes de confirmar su uso.",
    "missingNone": "No tienes prendas de {category} registradas.",
    "missingUnavailable": "Todas las prendas de {category} están no disponibles. Reactiva al menos una.",
    "categories": {
      "top": "parte superior",
      "bottom": "parte inferior",
      "footwear": "calzado"
    },
    "open": "Ver ficha de {name}",
    "choose": "Seleccionar {name}"
  },
  "en": {
    "available": "Available",
    "unavailable": "Unavailable",
    "select": "Select",
    "cancel": "Cancel selection",
    "selectVisible": "Select all visible",
    "clear": "Clear selection",
    "selected": "{count} selected",
    "toUnavailable": "Mark unavailable",
    "toAvailable": "Mark available",
    "allAvailable": "Reactivate all",
    "confirmAll": "Reactivate {count} garments across all categories?",
    "undo": "Undo last change",
    "changed": "Availability updated: {count} garments.",
    "empty": "No garments match this section and filter.",
    "review": "Review wardrobe",
    "stale": "This outfit contains garments that are no longer available. Generate a new outfit before confirming wear.",
    "missingNone": "You have no registered garments for {category}.",
    "missingUnavailable": "All garments for {category} are unavailable. Reactivate at least one.",
    "categories": {
      "top": "tops",
      "bottom": "bottoms",
      "footwear": "footwear"
    },
    "open": "View details of {name}",
    "choose": "Select {name}"
  },
  "ca": {
    "available": "Disponibles",
    "unavailable": "No disponibles",
    "select": "Seleccionar",
    "cancel": "Cancel·lar selecció",
    "selectVisible": "Seleccionar totes les visibles",
    "clear": "Treure selecció",
    "selected": "{count} seleccionades",
    "toUnavailable": "Marcar com a no disponibles",
    "toAvailable": "Marcar com a disponibles",
    "allAvailable": "Reactivar totes",
    "confirmAll": "Reactivaràs {count} peces de totes les categories. Vols continuar?",
    "undo": "Desfer l’últim canvi",
    "changed": "Disponibilitat actualitzada: {count} peces.",
    "empty": "No hi ha peces en aquest apartat amb el filtre actual.",
    "review": "Revisar armari",
    "stale": "Aquest outfit conté peces que ja no estan disponibles. Genera’l de nou abans de confirmar-ne l’ús.",
    "missingNone": "No tens peces de {category} registrades.",
    "missingUnavailable": "Totes les peces de {category} estan no disponibles. Reactiva’n almenys una.",
    "categories": {
      "top": "part superior",
      "bottom": "part inferior",
      "footwear": "calçat"
    },
    "open": "Veure la fitxa de {name}",
    "choose": "Seleccionar {name}"
  }
};
export const copy = lang => MESSAGES[lang] || MESSAGES.es;
export const format = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
export function categoryGaps(wardrobe) {
  return ['top', 'bottom', 'footwear'].map(category => {
    const garments = wardrobe.filter(g => g.category === category);
    return { category, total: garments.length, available: garments.filter(g => g.state === 'available').length };
  }).filter(group => group.available === 0);
}
export function missingMessage(wardrobe, lang) {
  const t = copy(lang);
  return categoryGaps(wardrobe).map(gap => format(gap.total ? t.missingUnavailable : t.missingNone, { category: t.categories[gap.category] })).join(' ');
}
export function availabilityChange(wardrobe, ids, target) {
  if (!['available', 'unavailable'].includes(target)) throw new Error('Invalid availability target');
  const selected = new Set(ids);
  const undo = [];
  const updated = wardrobe.map(garment => {
    if (!selected.has(garment.id) || !['available','unavailable'].includes(garment.state) || garment.state === target) return garment;
    undo.push({ id: garment.id, from: garment.state, to: target });
    return { ...garment, state: target };
  });
  return { wardrobe: undo.length ? updated : wardrobe, undo, count: undo.length };
}
export function undoAvailability(wardrobe, changes) {
  const byId = new Map(changes.map(change => [change.id, change]));
  return wardrobe.map(garment => {
    const change = byId.get(garment.id);
    return change && garment.state === change.to ? { ...garment, state: change.from } : garment;
  });
}
export function unavailableOutfitIds(outfit, wardrobe) {
  if (!outfit) return [];
  const ids = ['top','bottom','outerwear','footwear'].map(key => outfit[key]?.id).filter(Boolean);
  if (outfit.transitionLayer?.item?.id) ids.push(outfit.transitionLayer.item.id);
  return [...new Set(ids)].filter(id => !wardrobe.some(g => g.id === id && g.state === 'available'));
}
