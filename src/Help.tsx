import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Help({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const ref = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const place = () => { const r = ref.current!.getBoundingClientRect(); setPosition({ left: Math.max(12, Math.min(r.left, innerWidth - 292)), top: Math.max(12, Math.min(r.bottom + 8, innerHeight - 170)) }); };
    // Scroll and resize fire far faster than paint; coalesce so each frame measures at most once.
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); }); };
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    place(); window.addEventListener('resize', schedule); document.addEventListener('scroll', schedule, true); document.addEventListener('pointerdown', close);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); document.removeEventListener('scroll', schedule, true); document.removeEventListener('pointerdown', close); };
  }, [open]);
  return <><button ref={ref} type="button" className="help-trigger" aria-label={`${label}说明`} aria-expanded={open} aria-describedby={open ? id : undefined} onClick={() => setOpen(!open)} onBlur={() => setOpen(false)} onKeyDown={e => { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21v-9M12 15C5 15 3 11 3 6c6 0 9 3 9 9ZM12 12c0-6 3-9 9-9 0 6-3 9-9 9M8 21h8"/></svg></button>{open && createPortal(<span id={id} role="note" className="help-note" style={position}>{children}</span>, document.body)}</>;
}
