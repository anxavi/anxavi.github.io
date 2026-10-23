import { copy, format, categoryGaps, availabilityChange, undoAvailability } from '../engine/availability.js';

export function InventoryPanel({ wardrobe, filteredGarments, categoryKey, lang, onChange, onOpen }) {
  const R = globalThis.React;
  const h = R.createElement;
  const t = copy(lang);
  const [status, setStatus] = R.useState(() => categoryGaps(wardrobe).some(gap => gap.total > 0) ? 'unavailable' : 'available');
  const [selecting, setSelecting] = R.useState(false);
  const [selected, setSelected] = R.useState(() => new Set());
  const [undo, setUndo] = R.useState([]);
  const [notice, setNotice] = R.useState('');
  const visible = filteredGarments.filter(garment => garment.state === status);
  const availableCount = wardrobe.filter(g => g.state === 'available').length;
  const unavailableCount = wardrobe.filter(g => g.state === 'unavailable').length;
  R.useEffect(() => { setSelected(new Set()); setSelecting(false); }, [status, categoryKey]);
  R.useEffect(() => { setSelected(previous => new Set([...previous].filter(id => visible.some(g => g.id === id)))); }, [wardrobe]);
  const button = (label, onClick, extra = {}) => h('button', {
    type: 'button', onClick,
    className: 'text-xs px-3 py-2 rounded-lg border border-arachne-border bg-white disabled:opacity-40 disabled:cursor-not-allowed', ...extra
  }, label);
  const clear = () => { setSelected(new Set()); setSelecting(false); };
  const toggle = id => {
    setSelecting(true);
    setSelected(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const change = (ids, target) => {
    const plan = availabilityChange(wardrobe, ids, target);
    if (!plan.count) return;
    setUndo(plan.undo);
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
    h('div', { className: 'flex gap-2', role: 'group' },
      button(`${t.available} (${availableCount})`, () => setStatus('available'), { 'aria-pressed': status === 'available', style: status === 'available' ? { borderColor: '#3D5A4C', backgroundColor: '#EBF1ED' } : {} }),
      button(`${t.unavailable} (${unavailableCount})`, () => setStatus('unavailable'), { 'aria-pressed': status === 'unavailable', style: status === 'unavailable' ? { borderColor: '#C88D66', backgroundColor: '#F8F1EB' } : {} })
    ),
    h('div', { className: 'flex flex-wrap gap-2 items-center' },
      selecting ? button(t.cancel, clear) : button(t.select, () => setSelecting(true), { disabled: visible.length === 0 }),
      selecting && button(t.selectVisible, () => setSelected(new Set(visible.map(g => g.id))), { disabled: visible.length === 0 }),
      selecting && button(t.clear, () => setSelected(new Set()), { disabled: selected.size === 0 }),
      status === 'unavailable' && button(t.allAvailable, reactivateAll, { disabled: unavailableCount === 0 })
    ),
    selecting && h('div', { className: 'p-3 bg-arachne-sageLight rounded-lg space-y-2' },
      h('p', { className: 'text-xs', role: 'status' }, format(t.selected, { count: selected.size })),
      button(status === 'available' ? t.toUnavailable : t.toAvailable,
        () => change([...selected].filter(id => visible.some(g => g.id === id)), status === 'available' ? 'unavailable' : 'available'),
        { disabled: selected.size === 0 })
    ),
    h('div', { className: 'text-xs space-y-2', role: 'status', 'aria-live': 'polite' },
      notice && h('p', null, notice),
      undo.length > 0 && button(t.undo, () => {
        onChange(previous => undoAvailability(previous, undo)); setUndo([]); setNotice(''); clear();
      })
    ),
    visible.length === 0 ? h('p', { className: 'p-6 text-sm text-arachne-inkMuted text-center' }, t.empty)
      : h('div', { className: 'grid grid-cols-2 gap-3 pt-1' }, ...visible.map(garment => h('article', {
        key: garment.id, className: 'relative bg-white rounded-xl overflow-hidden border border-arachne-border shadow-subtle'
      },
        h('label', { className: 'absolute top-2 right-2 z-10 bg-white rounded-md p-2 shadow-subtle', onClick: event => event.stopPropagation() },
          h('input', { type: 'checkbox', checked: selected.has(garment.id), onChange: () => toggle(garment.id), 'aria-label': format(t.choose, { name: name(garment) }), className: 'w-4 h-4 accent-[#3D5A4C]' })
        ),
        h('button', { type: 'button', className: 'w-full text-left group', 'aria-label': format(selecting ? t.choose : t.open, { name: name(garment) }), onClick: () => selecting ? toggle(garment.id) : onOpen(garment) },
          h('div', { className: 'h-40 bg-arachne-surface overflow-hidden' }, h('img', { src: garment.imageUrl, alt: name(garment), loading: 'lazy', className: 'w-full h-full object-cover' })),
          h('div', { className: 'p-3 space-y-1' }, h('p', { className: 'text-xs font-semibold truncate' }, name(garment)), h('p', { className: 'text-[10px] text-arachne-inkMuted' }, garment.brand || ''), h('p', { className: 'text-[10px]' }, status === 'available' ? t.available : t.unavailable))
        )
      )))
  );
}
