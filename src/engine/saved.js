export function removeSavedLook(history, savedId) {
  if (!Array.isArray(history)) throw new TypeError('Invalid saved history');
  if (typeof savedId !== 'string' || !savedId.trim()) return history;
  const matches = history.filter(entry => entry?.id === savedId);
  if (matches.length !== 1) return history;
  return history.filter(entry => entry?.id !== savedId);
}
