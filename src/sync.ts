import { entryValid, isSample, type Entry } from "./data";
import { dedupeEntries, latestById, type Journal, type SyncMeta, type Tombstone } from "./journal";

export type CloudEntry = Entry & { user_id?: string; deleted_at?: string | null };
export type SyncUpload = { row: CloudEntry; expectedUpdatedAt: string | null };
export type SyncPlan = {
    journal: Journal;
    uploads: SyncUpload[];
    conflicts: number;
    duplicates: number;
};

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
const tombstoneRow = (tombstone: Tombstone): CloudEntry => ({
    ...tombstone.entry,
    updated_at: tombstone.deleted_at,
    deleted_at: tombstone.deleted_at
});

export function validateCloudRows(rows: unknown[]): CloudEntry[] {
    return rows.map((row) => {
        if (!entryValid(row))
            throw new Error("云端记录格式不匹配。请先运行最新的 Supabase 数据库脚本。");
        const cloud = row as CloudEntry;
        if (
            cloud.deleted_at !== undefined &&
            cloud.deleted_at !== null &&
            typeof cloud.deleted_at !== "string"
        )
            throw new Error("云端删除记录格式不匹配。");
        return cloud;
    });
}

export function planSync(
    source: Journal,
    cloudRows: CloudEntry[],
    now = new Date().toISOString(),
    makeId = () => crypto.randomUUID()
): SyncPlan {
    const cleanEntries = dedupeEntries(source.entries);
    const duplicates = source.entries.length - cleanEntries.length;
    const local = new Map(cleanEntries.filter((e) => !isSample(e.id)).map((e) => [e.id, e]));
    const samples = cleanEntries.filter((e) => isSample(e.id));
    const tombstones = new Map(source.sync.tombstones.map((t) => [t.entry.id, t]));
    const remote = latestById(cloudRows, (row) => row.id, stamp);
    const remoteDuplicates = cloudRows.length - remote.size;
    const dirty = new Set(source.sync.dirtyIds);
    const bases = { ...source.sync.bases };
    const uploads: SyncUpload[] = [];
    let conflicts = 0;
    // Both conflict branches keep the local text as a new entry; only the original id's fate differs.
    const forkConflictCopy = (entry: Entry) => {
        const copy = {
            ...entry,
            id: makeId(),
            title: `${entry.title}（冲突副本）`,
            updated_at: now
        };
        local.set(copy.id, copy);
        uploads.push({ row: { ...copy, deleted_at: null }, expectedUpdatedAt: null });
        bases[copy.id] = copy.updated_at;
        conflicts++;
    };

    for (const id of new Set([...local.keys(), ...tombstones.keys(), ...remote.keys()])) {
        const entry = local.get(id),
            deleted = tombstones.get(id),
            cloud = remote.get(id),
            base = bases[id];
        // Postgres and the browser render the same instant differently, so compare instants, not text.
        const cloudChanged =
            !!cloud && (base === undefined || Date.parse(stamp(cloud)) !== Date.parse(base));
        if (dirty.has(id)) {
            if (deleted) {
                if (
                    cloud &&
                    !cloud.deleted_at &&
                    cloudChanged &&
                    !sameContent(deleted.entry, asEntry(cloud))
                ) {
                    local.set(id, asEntry(cloud));
                    tombstones.delete(id);
                    bases[id] = stamp(cloud);
                    conflicts++;
                } else {
                    uploads.push({
                        row: tombstoneRow(deleted),
                        expectedUpdatedAt: cloud ? cloud.updated_at : null
                    });
                    local.delete(id);
                    bases[id] = deleted.deleted_at;
                }
            } else if (entry) {
                if (cloud && cloudChanged && entry.updated_at !== base) {
                    if (cloud.deleted_at) {
                        local.delete(id);
                        tombstones.set(id, { entry, deleted_at: cloud.deleted_at });
                        bases[id] = stamp(cloud);
                        forkConflictCopy(entry);
                    } else if (sameContent(entry, asEntry(cloud))) {
                        const winner =
                            entry.updated_at >= cloud.updated_at ? entry : asEntry(cloud);
                        local.set(id, winner);
                        bases[id] = winner.updated_at;
                        if (winner === entry)
                            uploads.push({
                                row: { ...entry, deleted_at: null },
                                expectedUpdatedAt: cloud.updated_at
                            });
                    } else {
                        local.set(id, asEntry(cloud));
                        bases[id] = cloud.updated_at;
                        forkConflictCopy(entry);
                    }
                } else {
                    uploads.push({
                        row: { ...entry, deleted_at: null },
                        expectedUpdatedAt: cloud ? cloud.updated_at : null
                    });
                    bases[id] = entry.updated_at;
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
            local.set(id, asEntry(cloud));
            tombstones.delete(id);
        }
    }

    for (const [id, tombstone] of tombstones) {
        const cleared = source.sync.clearedTrash?.[id];
        if (cleared && Date.parse(tombstone.deleted_at) <= Date.parse(cleared) && !dirty.has(id)) tombstones.delete(id);
    }
    return {
        journal: {
            entries: [...samples, ...local.values()],
            catalog: source.catalog,
            sync: { ...source.sync, dirtyIds: [...dirty], tombstones: [...tombstones.values()], bases }
        },
        uploads,
        conflicts,
        duplicates: duplicates + remoteDuplicates
    };
}

/**
 * Fingerprint of everything auto-sync reacts to. Both the trigger and the post-sync record must
 * derive it the same way, or the debounce either re-fires forever or never fires again.
 */
export function syncSignature(
    userId: string,
    pulse: number,
    journal: { entries: Entry[]; sync: SyncMeta }
) {
    const dirty = new Set(journal.sync.dirtyIds);
    const stamps = journal.entries.filter((e) => dirty.has(e.id)).map((e) => e.updated_at);
    const graves = journal.sync.tombstones.map((t) => `${t.entry.id}@${t.deleted_at}`);
    return [userId, pulse, [...dirty].join(","), stamps.join(","), graves.join(",")].join("|");
}

/** A read-only cloud snapshot replaces local diaries and clears this device's trash exclusions. */
export function journalFromCloud(rows: unknown[], catalog: Journal["catalog"]): Journal {
    const records = [...latestById(validateCloudRows(rows), row => row.id, stamp).values()];
    return {
        entries: records.filter(row => !row.deleted_at).map(asEntry),
        catalog,
        sync: {
            dirtyIds: [],
            tombstones: records.filter(row => !!row.deleted_at).map(row => ({ entry: asEntry(row), deleted_at: row.deleted_at! })),
            bases: Object.fromEntries(records.map(row => [row.id, stamp(row)]))
        }
    };
}
