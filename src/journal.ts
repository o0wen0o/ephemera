import { entryValid, moods, seeds, type Entry } from './data';

export const STORE = 'ephemera-journal-v2';
export type CollectionKind = 'tags' | 'moods';
export type Catalog = { tags: string[]; moods: string[] };
export type Tombstone = { entry: Entry; deleted_at: string };
export type SyncMeta = { dirtyIds: string[]; tombstones: Tombstone[]; bases: Record<string, string> };
export type Journal = { entries: Entry[]; catalog: Catalog; sync: SyncMeta };
export const cleanName = (name: string) => name.trim().replace(/^#+/, '').trim();
const unique = (names: string[]) => [...new Set(names.filter(Boolean))];
export const defaultCatalog = (): Catalog => ({ tags: [], moods: [...moods] });
export const defaultSync = (entries: Entry[] = []): SyncMeta => ({ dirtyIds: unique(entries.filter(e => !e.id.startsWith('sample-')).map(e => e.id)), tombstones: [], bases: {} });
export const dedupeEntries = (entries: Entry[]) => {
  const byId = new Map<string, Entry>();
  for (const entry of entries) {
    const current = byId.get(entry.id);
    if (!current || entry.updated_at > current.updated_at) byId.set(entry.id, entry);
  }
  return [...byId.values()];
};
export const mergeTombstones = (...groups: Tombstone[][]) => {
  const byId = new Map<string, Tombstone>();
  for (const tombstone of groups.flat()) {
    const current = byId.get(tombstone.entry.id);
    if (!current || tombstone.deleted_at > current.deleted_at) byId.set(tombstone.entry.id, tombstone);
  }
  return [...byId.values()];
};

const syncValid = (value: unknown): value is SyncMeta => {
  if (!value || typeof value !== 'object') return false;
  const sync = value as SyncMeta;
  return Array.isArray(sync.dirtyIds) && sync.dirtyIds.every(id => typeof id === 'string') &&
    Array.isArray(sync.tombstones) && sync.tombstones.every(t => entryValid(t?.entry) && typeof t.deleted_at === 'string') &&
    !!sync.bases && typeof sync.bases === 'object' && Object.values(sync.bases).every(v => typeof v === 'string');
};

export function parseJournal(text: string): Journal {
  const data = JSON.parse(text);
  const sourceEntries = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(sourceEntries) || !sourceEntries.every(entryValid)) throw new Error('日记格式不正确');
  const entries = dedupeEntries(sourceEntries);
  const catalog = data?.catalog ?? defaultCatalog();
  for (const kind of ['tags', 'moods'] as const) {
    if (!Array.isArray(catalog[kind]) || !catalog[kind].every((n: unknown) => typeof n === 'string')) throw new Error('分类格式不正确');
  }
  const sync = data?.sync === undefined ? defaultSync(entries) : data.sync;
  if (!syncValid(sync)) throw new Error('同步信息格式不正确');
  const tombstones = new Map(mergeTombstones(sync.tombstones).map(tombstone => [tombstone.entry.id, tombstone]));
  const live = entries.filter(entry => !tombstones.has(entry.id) || entry.updated_at > tombstones.get(entry.id)!.deleted_at);
  for (const entry of live) tombstones.delete(entry.id);
  return { entries: live, catalog: { tags: unique(catalog.tags), moods: unique(catalog.moods) }, sync: { dirtyIds: unique(sync.dirtyIds), tombstones: [...tombstones.values()], bases: { ...sync.bases } } };
}

export function readRawJournal() {
  return localStorage.getItem(STORE) ?? localStorage.getItem('ephemera-entries-v1') ?? localStorage.getItem('ephemera-prototype-entries-v1');
}

export function readJournal(): Journal & { error: string } {
  try {
    const text = readRawJournal();
    return { ...(text === null ? { entries: seeds, catalog: defaultCatalog(), sync: defaultSync() } : parseJournal(text)), error: '' };
  } catch {
    return { entries: [], catalog: defaultCatalog(), sync: defaultSync(), error: '无法读取本机日记，原数据已保留。请先导出原始备份，再导入有效备份恢复。' };
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
  return { entries, catalog: { ...journal.catalog, [kind]: nextNames }, sync: journal.sync };
}

export function trackLocalChanges(journal: Journal, nextEntries: Entry[], now = new Date().toISOString()): SyncMeta {
  const before = new Map(journal.entries.map(entry => [entry.id, entry]));
  const after = new Map(nextEntries.map(entry => [entry.id, entry]));
  const dirty = new Set(journal.sync.dirtyIds);
  const tombstones = new Map(journal.sync.tombstones.map(tombstone => [tombstone.entry.id, tombstone]));
  for (const [id, entry] of before) {
    if (!after.has(id) && !id.startsWith('sample-')) { dirty.add(id); tombstones.set(id, { entry, deleted_at: now }); }
  }
  for (const [id, entry] of after) {
    if (id.startsWith('sample-')) continue;
    const old = before.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(entry)) dirty.add(id);
    tombstones.delete(id);
  }
  return { ...journal.sync, dirtyIds: [...dirty], tombstones: [...tombstones.values()] };
}

/** Keep deletion markers so offline devices cannot silently resurrect purged rows. */
export function purgeTrash(sync: SyncMeta, now = new Date().toISOString()): SyncMeta {
  const targets = sync.tombstones.filter(t => t.entry.title || t.entry.body);
  const ids = new Set(targets.map(t => t.entry.id));
  return { ...sync, dirtyIds: [...new Set([...sync.dirtyIds, ...ids])],
    tombstones: sync.tombstones.map(t => ids.has(t.entry.id) ? {
      deleted_at: now,
      entry: { ...t.entry, title: '', body: '', mood: '', weather: '', tags: [], favorite: false, cover: false, updated_at: now }
    } : t) };
}
