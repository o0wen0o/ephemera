import { blankEntryFields, entryValid, isSample, type Entry } from "../data/data";
import {
    dedupeEntries,
    latestById,
    type Journal,
    type SyncMeta,
    type Tombstone
} from "../data/journal";

// A column added after the first release is nullable in Postgres, so a row can carry null
// where the local Entry simply omits the field.
export type CloudEntry = Omit<Entry, "created_at" | "updated_at"> & {
    user_id?: string;
    created_at?: string | null;
    updated_at: string;
    deleted_at?: string | null;
};
export type SyncUpload = { row: CloudEntry; expectedUpdatedAt: string | null };
export type SyncPlan = {
    journal: Journal;
    uploads: SyncUpload[];
    conflicts: number;
    duplicates: number;
};

const stamp = (row: CloudEntry) => row.deleted_at || row.updated_at;
/**
 * Content equality that survives the round trip through Postgres: key order, an absent field
 * versus its column default, and an instant re-rendered with an offset must all read as equal.
 */
const contentKey = (entry: Entry) => {
    const { updated_at: _stamp, ...content } = entry;
    const normalized: Record<string, unknown> = { ...content };
    // The shared blank list is the one place an optional field declares its column default, so a
    // field the local entry omits still reads as equal to the default the cloud row carries.
    for (const [key, fallback] of Object.entries(blankEntryFields())) normalized[key] ??= fallback;
    // An imported backup can still spell an instant with an offset, so compare the instant itself.
    normalized.created_at = entry.created_at ? Date.parse(entry.created_at) : 0;
    return JSON.stringify(normalized, Object.keys(normalized).sort());
};
const sameContent = (left: Entry, right: Entry) => contentKey(left) === contentKey(right);
const asEntry = (row: CloudEntry): Entry => {
    const { user_id: _user, deleted_at: _deleted, created_at, ...rest } = row;
    return { ...rest, ...(created_at ? { created_at } : {}) };
};
const tombstoneRow = (tombstone: Tombstone): CloudEntry => ({
    ...tombstone.entry,
    updated_at: tombstone.deleted_at,
    deleted_at: tombstone.deleted_at
});

// Postgres renders an instant as "+00:00" where the browser writes a trailing "Z". Every stored
// stamp is canonicalised on arrival so the rest of the app only ever compares one spelling.
const canonicalStamp = (value: string) => {
    const at = Date.parse(value);
    return Number.isNaN(at) ? value : new Date(at).toISOString();
};

export function validateCloudRows(rows: unknown[]): CloudEntry[] {
    return rows.map((row) => {
        if (!entryValid(row)) throw new Error("云端数据暂时无法读取，请稍后再试。");
        const cloud = row as CloudEntry;
        if (
            cloud.deleted_at !== undefined &&
            cloud.deleted_at !== null &&
            typeof cloud.deleted_at !== "string"
        )
            throw new Error("云端数据暂时无法读取，请稍后再试。");
        return {
            ...cloud,
            created_at: cloud.created_at && canonicalStamp(cloud.created_at),
            updated_at: canonicalStamp(cloud.updated_at),
            deleted_at: cloud.deleted_at && canonicalStamp(cloud.deleted_at)
        };
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
        if (cleared && Date.parse(tombstone.deleted_at) <= Date.parse(cleared) && !dirty.has(id))
            tombstones.delete(id);
    }
    return {
        journal: {
            entries: [...samples, ...local.values()],
            catalog: source.catalog,
            sync: {
                ...source.sync,
                dirtyIds: [...dirty],
                tombstones: [...tombstones.values()],
                bases
            }
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
    const records = [...latestById(validateCloudRows(rows), (row) => row.id, stamp).values()];
    return {
        entries: records.filter((row) => !row.deleted_at).map(asEntry),
        catalog,
        sync: {
            dirtyIds: [],
            tombstones: records
                .filter((row) => !!row.deleted_at)
                .map((row) => ({ entry: asEntry(row), deleted_at: row.deleted_at! })),
            bases: Object.fromEntries(records.map((row) => [row.id, stamp(row)]))
        }
    };
}
