import { Help } from './Help';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { asDate, displayDate, localDate, monthStart, thisMonth, type Entry } from './data';

export function Calendar({ value, onChange, month, onMonthChange, entries = [], compact = false }: {
  value: string; onChange: (date: string) => void; month: Date; onMonthChange: (date: Date) => void; entries?: Entry[]; compact?: boolean;
}) {
  const [chooseMonth, setChooseMonth] = useState(false);
  const [focusDay, setFocusDay] = useState(value || localDate());
  const root = useRef<HTMLElement>(null);
  const focusAfterMove = useRef(false);
  const year = month.getFullYear(), monthIndex = month.getMonth();
  // Hold only the in-progress text; the committed year always comes from the month prop.
  const [yearDraft, setYearDraft] = useState<string | null>(null);
  const yearInput = yearDraft ?? String(year);
  const commitYear = () => {
    const next = Number(yearInput);
    if (Number.isInteger(next) && next >= 1900 && next <= 9999) onMonthChange(monthStart(next, monthIndex));
    setYearDraft(null);
  };
  const first = monthStart(year, monthIndex);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  // Only a count and the first title are rendered, so keep those rather than retaining entry arrays.
  const marks = useMemo(() => {
    const byDate = new Map<string, { count: number; title: string }>();
    for (const entry of entries) {
      const mark = byDate.get(entry.date);
      if (mark) mark.count++;
      else byDate.set(entry.date, { count: 1, title: entry.title });
    }
    return byDate;
  }, [entries]);
  useEffect(() => {
    if (focusAfterMove.current) { root.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDay}"]`)?.focus({ preventScroll: true }); focusAfterMove.current = false; }
  }, [focusDay, month]);
  const moveMonth = (delta: number) => onMonthChange(monthStart(year, monthIndex + delta));
  const moveDay = (event: KeyboardEvent, date: string) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = asDate(date); next.setDate(next.getDate() + step);
    focusAfterMove.current = true; setFocusDay(localDate(next));
    if (next.getMonth() !== monthIndex || next.getFullYear() !== year) onMonthChange(monthStart(next.getFullYear(), next.getMonth()));
  };
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  const today = localDate();
  const tabDate = focusDay.startsWith(monthPrefix.slice(0, 7)) ? focusDay : localDate(first);
  return <section ref={root} className={`journal-calendar${compact ? ' compact' : ''}`} aria-label={compact ? '选择日记日期' : '日历回顾'}>
    <div className="cal-toolbar">
      <button type="button" className="cal-month" aria-label="选择年月" aria-expanded={chooseMonth} onClick={() => setChooseMonth(!chooseMonth)}>{year} 年 {monthIndex + 1} 月 <ChevronDown size={15}/></button>
      <div><button type="button" className="icon-btn" aria-label="上个月" onClick={() => moveMonth(-1)}><ChevronLeft size={18}/></button><button type="button" className="icon-btn" aria-label="下个月" onClick={() => moveMonth(1)}><ChevronRight size={18}/></button></div>
    </div>
    {chooseMonth ? <div className="month-picker">
      <div className="year-picker"><button type="button" className="icon-btn" aria-label="上一年" onClick={() => moveMonth(-12)}><ChevronLeft size={17}/></button><label>年份 <input aria-label="年份" type="number" min="1900" max="9999" value={yearInput} onChange={e => setYearDraft(e.target.value)} onBlur={commitYear} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitYear(); } }}/></label><button type="button" className="icon-btn" aria-label="下一年" onClick={() => moveMonth(12)}><ChevronRight size={17}/></button></div>
      <div className="month-options">{Array.from({ length: 12 }, (_, i) => <button type="button" key={i} aria-pressed={i === monthIndex} onClick={() => { onMonthChange(monthStart(year, i)); setChooseMonth(false); }}>{i + 1} 月</button>)}</div>
    </div> : <>
      <div className="cal-weekdays" aria-hidden="true">{['一','二','三','四','五','六','日'].map(d => <span key={d}>{d}</span>)}</div>
      <div className="cal-days">{Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
        const day = i - offset + 1;
        if (day < 1 || day > days) return <span key={i} className="cal-blank"/>;
        const date = monthPrefix + String(day).padStart(2, '0'); const mark = marks.get(date);
        return <button type="button" key={i} data-date={date} tabIndex={tabDate === date ? 0 : -1} onFocus={() => setFocusDay(date)} onKeyDown={e => moveDay(e, date)} aria-label={`${date}${mark ? `，${mark.count} 篇日记` : ''}`} aria-pressed={value === date} aria-current={date === today ? 'date' : undefined} className={`cal-day${mark ? ' has-record' : ''}`} onClick={() => onChange(date)}><span>{day}</span>{mark && <i/>}{!compact && mark && <small>{mark.title}</small>}</button>;
      })}</div>
    </>}
    <div className="cal-footer"><Help label="日历">{compact ? "方向键移动，回车选择日期。" : "圆点标记有日记的日子。"}</Help><button type="button" onClick={() => { onMonthChange(thisMonth()); setChooseMonth(false); onChange(today); }}>今天</button></div>
  </section>;
}

export function DatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => asDate(value));
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    root.current?.querySelector<HTMLButtonElement>('.cal-day[tabindex="0"]')?.focus({ preventScroll: true });
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div className="date-picker" ref={root} onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setOpen(false); }} onKeyDown={e => { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus({ preventScroll: true }); } }}>
    <button ref={trigger} type="button" className="date-trigger" aria-label="日记日期" aria-expanded={open} aria-controls={id} onClick={() => { setMonth(asDate(value)); setOpen(!open); }}><CalendarDays size={16}/>{displayDate(value)}<ChevronDown size={14}/></button>
    {open && <div id={id} className="date-popover"><Calendar compact month={month} onMonthChange={setMonth} value={value} onChange={date => { onChange(date); setOpen(false); trigger.current?.focus({ preventScroll: true }); }}/></div>}
  </div>;
}
