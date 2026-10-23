import { copy, format, categoryGaps, availabilityChange } from '../engine/availability.js';

export function InventoryPanel({ wardrobe, filteredGarments, categoryKey, lang, onChange, onOpen }) {
  const R = globalThis.React;
  const h = R.createElement;
  const t = copy(lang);
  const [status, setStatus] = R.useState(() => categoryGaps(wardrobe).some(gap => gap.total > 0) ? 'unavailable' : 'available');
  const [selected, setSelected] = R.useState(() => new Set());
  const [notice, setNotice] = R.useState('');
  const visible = filteredGarments.filter(garment => garment.state === status);
  const visibleKey = JSON.stringify(visible.map(g => g.id));
  const selectedVisible = visible.filter(g => selected.has(g.id));
  const availableCount = wardrobe.filter(g => g.state === 'available').length;
  const unavailableCount = wardrobe.filter(g => g.state === 'unavailable').length;
  R.useEffect(() => { setSelected(new Set()); }, [status, categoryKey]);
  R.useEffect(() => { setSelected(previous => new Set([...previous].filter(id => visible.some(g => g.id === id)))); }, [visibleKey]);
  const button = (label, onClick, extra = {}) => h('button', {
    type: 'button', onClick,
    className: 'text-xs px-3 py-2 rounded-lg border border-arachne-border bg-white disabled:opacity-40 disabled:cursor-not-allowed', ...extra
  }, label);
  const clear = () => setSelected(new Set());
  const toggle = id => setSelected(previous => {
    const next = new Set(previous);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const change = (ids, target) => {
    const plan = availabilityChange(wardrobe, ids, target);
    if (!plan.count) return;
    onChange(previous => availabilityChange(previous, ids, target).wardrobe);
    clear();
    setNotice(format(t.changed, { count: plan.count }));
  };
  const reactivateAll = () => {
    const ids = wardrobe.filter(g => g.state === 'unavailable').map(g => g.id);
    if (ids.length && globalThis.confirm(format(t.confirmAll, { count: ids.length }))) change(ids, 'available');
  };
  const name = garment => typeof garment.name === 'string' ? garment.name : garment.name?.[lang] || garment.name?.es || garment.id;
  return h('section', { className: 'space-y-3', 'aria-label': `${t.available} / ${t.unavailable}` },
    h('div', { className: 'flex flex-wrap gap-2', role: 'group' },
      button(`${t.available} (${availableCount})`, () => setStatus('available'), { 'aria-pressed': status === 'available', style: status === 'available' ? { borderColor: '#3D5A4C', backgroundColor: '#EBF1ED' } : {} }),
      button(`${t.unavailable} (${unavailableCount})`, () => setStatus('unavailable'), { 'aria-pressed': status === 'unavailable', style: status === 'unavailable' ? { borderColor: '#C88D66', backgroundColor: '#F8F1EB' } : {} })
    ),
    status === 'unavailable' && button(t.allAvailable, reactivateAll, { disabled: unavailableCount === 0 }),
    selectedVisible.length > 0 && h('div', { 'data-inventory-selection': 'true', className: 'p-3 bg-arachne-sageLight rounded-lg space-y-2' },
      h('p', { className: 'text-xs', role: 'status' }, format(t.selected, { count: selectedVisible.length })),
      h('div', { className: 'flex flex-wrap gap-2 items-center' },
        button(t.selectVisible, () => setSelected(new Set(visible.map(g => g.id)))),
        button(t.clear, clear),
        button(status === 'available' ? t.toUnavailable : t.toAvailable,
          () => change(selectedVisible.map(g => g.id), status === 'available' ? 'unavailable' : 'available'))
      )
    ),
    h('div', { className: 'text-xs', role: 'status', 'aria-live': 'polite' }, notice && h('p', null, notice)),
    visible.length === 0 ? h('p', { className: 'p-6 text-sm text-arachne-inkMuted text-center' }, t.empty)
      : h('div', { className: 'grid grid-cols-2 gap-3 pt-1' }, ...visible.map(garment => {
        const checked = selected.has(garment.id);
        return h('article', { key: garment.id, className: 'relative bg-white rounded-xl overflow-hidden border border-arachne-border shadow-subtle' },
          h('button', {
            type: 'button', 'data-garment-select': garment.id, 'aria-pressed': checked,
            'aria-label': format(t.choose, { name: name(garment) }),
            onClick: event => { event.stopPropagation(); toggle(garment.id); },
            className: 'absolute top-2 left-2 z-10 w-11 h-11 rounded-full border flex items-center justify-center shadow-subtle backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arachne-sage focus-visible:ring-offset-2 ' + (checked ? 'bg-arachne-sage/85 border-arachne-sage text-white' : 'bg-white/70 border-white/80 text-arachne-ink')
          }, checked && h('svg', { 'aria-hidden': 'true', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', className: 'w-5 h-5' },
            h('path', { d: 'M4.5 12.75l6 6 9-13.5', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })
          )),
          h('button', { type: 'button', className: 'w-full text-left group', 'aria-label': format(t.open, { name: name(garment) }), onClick: () => onOpen(garment) },
            h('div', { className: 'h-40 bg-arachne-surface overflow-hidden' }, h('img', { src: garment.imageUrl, alt: name(garment), loading: 'lazy', className: 'w-full h-full object-cover' })),
            h('div', { className: 'p-3 space-y-1' }, h('p', { className: 'text-xs font-semibold truncate' }, name(garment)), h('p', { className: 'text-[10px] text-arachne-inkMuted' }, garment.brand || ''), h('p', { className: 'text-[10px]' }, status === 'available' ? t.available : t.unavailable))
          )
        );
      }))
  );
}
