import { entryValid, moods, seeds, type Entry } from './data';

export const STORE = 'ephemera-journal-v2';
export type CollectionKind = 'tags' | 'moods';
export type Catalog = { tags: string[]; moods: string[] };
export type Journal = { entries: Entry[]; catalog: Catalog };
export const cleanName = (name: string) => name.trim().replace(/^#+/, '').trim();
const unique = (names: string[]) => [...new Set(names.filter(Boolean))];
export const defaultCatalog = (): Catalog => ({ tags: [], moods: [...moods] });

export function parseJournal(text: string): Journal {
  const data = JSON.parse(text);
  const entries = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(entries) || !entries.every(entryValid)) throw new Error('日记格式不正确');
  const catalog = data?.catalog ?? defaultCatalog();
  for (const kind of ['tags', 'moods'] as const) {
    if (!Array.isArray(catalog[kind]) || !catalog[kind].every((n: unknown) => typeof n === 'string')) throw new Error('分类格式不正确');
  }
  return { entries, catalog: { tags: unique(catalog.tags), moods: unique(catalog.moods) } };
}

export function readRawJournal() {
  return localStorage.getItem(STORE) ?? localStorage.getItem('ephemera-entries-v1') ?? localStorage.getItem('ephemera-prototype-entries-v1');
}

export function readJournal(): Journal & { error: string } {
  try {
    const text = readRawJournal();
    return { ...(text === null ? { entries: seeds, catalog: defaultCatalog() } : parseJournal(text)), error: '' };
  } catch {
    return { entries: [], catalog: defaultCatalog(), error: '无法读取本机日记，原数据已保留。请先导出原始备份，再导入有效备份恢复。' };
  }
}

export function collectionNames(journal: Journal, kind: CollectionKind) {
  return unique([...journal.catalog[kind], ...journal.entries.flatMap(e => kind === 'tags' ? e.tags : [e.mood])]);
}

// One snapshot makes the label edit and its affected diary entries an atomic write.
export function changeCollection(journal: Journal, kind: CollectionKind, from: string | null, to: string | null, now = new Date().toISOString()): Journal {
  const names = collectionNames(journal, kind);
  const nextNames = unique([...names.filter(n => n !== from), ...(to ? [to] : [])]);
  const entries = from === null ? journal.entries : journal.entries.map(entry => {
    if (kind === 'tags' && entry.tags.includes(from)) return { ...entry, tags: unique(entry.tags.flatMap(t => t !== from ? [t] : to ? [to] : [])), updated_at: now };
    if (kind === 'moods' && entry.mood === from) return { ...entry, mood: to ?? '', updated_at: now };
    return entry;
  });
  return { entries, catalog: { ...journal.catalog, [kind]: nextNames } };
}
