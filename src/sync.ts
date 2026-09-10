import { entryValid, type Entry } from './data';
import { dedupeEntries, type Journal, type Tombstone } from './journal';

export type CloudEntry = Entry & { user_id?: string; deleted_at?: string | null };
export type SyncUpload = { row: CloudEntry; expectedUpdatedAt: string | null };
export type SyncPlan = { journal: Journal; uploads: SyncUpload[]; conflicts: number; duplicates: number };

const stamp = (row: CloudEntry) => row.deleted_at || row.updated_at;
const sameContent = (left: Entry, right: Entry) => {
  const { updated_at: _leftTime, ...leftContent } = left;
  const { updated_at: _rightTime, ...rightContent } = right;
  return JSON.stringify(leftContent) === JSON.stringify(rightContent);
};
const asEntry = (row: CloudEntry): Entry => {
  const { user_id: _user, deleted_at: _deleted, ...entry } = row;
  return entry;
};
const tombstoneRow = (tombstone: Tombstone): CloudEntry => ({ ...tombstone.entry, updated_at: tombstone.deleted_at, deleted_at: tombstone.deleted_at });

export function validateCloudRows(rows: unknown[]): CloudEntry[] {
  return rows.map(row => {
    if (!entryValid(row)) throw new Error('云端记录格式不匹配。请先运行最新的 Supabase 数据库脚本。');
    const cloud = row as CloudEntry;
    if (cloud.deleted_at !== undefined && cloud.deleted_at !== null && typeof cloud.deleted_at !== 'string') throw new Error('云端删除记录格式不匹配。');
    return cloud;
  });
}

export function planSync(source: Journal, cloudRows: CloudEntry[], now = new Date().toISOString(), makeId = () => crypto.randomUUID()): SyncPlan {
  const cleanEntries = dedupeEntries(source.entries);
  const duplicates = source.entries.length - cleanEntries.length;
  const local = new Map(cleanEntries.filter(e => !e.id.startsWith('sample-')).map(e => [e.id, e]));
  const samples = cleanEntries.filter(e => e.id.startsWith('sample-'));
  const tombstones = new Map(source.sync.tombstones.map(t => [t.entry.id, t]));
  const remote = new Map<string, CloudEntry>();
  for (const row of cloudRows) {
    const old = remote.get(row.id);
    if (!old || stamp(row) > stamp(old)) remote.set(row.id, row);
  }
  const remoteDuplicates = cloudRows.length - remote.size;
  const dirty = new Set(source.sync.dirtyIds);
  const bases = { ...source.sync.bases };
  const uploads: SyncUpload[] = [];
  let conflicts = 0;

  for (const id of new Set([...local.keys(), ...tombstones.keys(), ...remote.keys()])) {
    const entry = local.get(id), deleted = tombstones.get(id), cloud = remote.get(id), base = bases[id];
    const cloudChanged = !!cloud && Date.parse(stamp(cloud)) !== Date.parse(base);
    if (dirty.has(id)) {
      if (deleted) {
        if (cloud && !cloud.deleted_at && cloudChanged && !sameContent(deleted.entry, asEntry(cloud))) {
          local.set(id, asEntry(cloud)); tombstones.delete(id); bases[id] = stamp(cloud); conflicts++;
        } else {
          uploads.push({ row: tombstoneRow(deleted), expectedUpdatedAt: cloud ? cloud.updated_at : null }); local.delete(id); bases[id] = deleted.deleted_at;
        }
      } else if (entry) {
        if (cloud && cloudChanged && entry.updated_at !== base) {
          if (cloud.deleted_at) {
            const copy = { ...entry, id: makeId(), title: `${entry.title}（冲突副本）`, updated_at: now };
            local.delete(id); tombstones.set(id, { entry, deleted_at: cloud.deleted_at }); bases[id] = stamp(cloud);
            local.set(copy.id, copy); uploads.push({ row: { ...copy, deleted_at: null }, expectedUpdatedAt: null }); bases[copy.id] = copy.updated_at; conflicts++;
          } else if (sameContent(entry, asEntry(cloud))) {
            const winner = entry.updated_at >= cloud.updated_at ? entry : asEntry(cloud);
            local.set(id, winner); bases[id] = winner.updated_at;
            if (winner === entry) uploads.push({ row: { ...entry, deleted_at: null }, expectedUpdatedAt: cloud.updated_at });
          } else {
            const copy = { ...entry, id: makeId(), title: `${entry.title}（冲突副本）`, updated_at: now };
            local.set(id, asEntry(cloud)); bases[id] = cloud.updated_at;
            local.set(copy.id, copy); uploads.push({ row: { ...copy, deleted_at: null }, expectedUpdatedAt: null }); bases[copy.id] = copy.updated_at; conflicts++;
          }
        } else {
          uploads.push({ row: { ...entry, deleted_at: null }, expectedUpdatedAt: cloud ? cloud.updated_at : null }); bases[id] = entry.updated_at;
        }
      }
      dirty.delete(id);
      continue;
    }
    if (!cloud) continue;
    bases[id] = stamp(cloud);
    if (cloud.deleted_at) {
      tombstones.set(id, { entry: asEntry(cloud), deleted_at: cloud.deleted_at });
      local.delete(id);
    } else {
      local.set(id, asEntry(cloud)); tombstones.delete(id);
    }
  }

  return {
    journal: { entries: [...samples, ...local.values()], catalog: source.catalog, sync: { dirtyIds: [...dirty], tombstones: [...tombstones.values()], bases } },
    uploads,
    conflicts,
    duplicates: duplicates + remoteDuplicates,
  };
}

export function rowForUser(row: CloudEntry, userId: string) {
  return { ...row, user_id: userId };
}
