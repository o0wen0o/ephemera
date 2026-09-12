import {
    blankEntryFields,
    defaultTags,
    entryValid,
    isSample,
    moods,
    seeds,
    type Entry
} from "./data";

export const STORE = "ephemera-journal";
export type CollectionKind = "tags" | "moods";
export type Catalog = { tags: string[]; moods: string[] };
export type Tombstone = { entry: Entry; deleted_at: string };
export type SyncMeta = {
    dirtyIds: string[];
    tombstones: Tombstone[];
    bases: Record<string, string>;
    clearedTrash?: Record<string, string>;
};
export type Journal = { entries: Entry[]; catalog: Catalog; sync: SyncMeta };
export const cleanName = (name: string) => name.trim().replace(/^#+/, "").trim();
export const NAME_LIMIT = 16;
/** One naming rule for tags and moods, shared by the editor and the collection manager. */
export const validName = (name: string) =>
    !!name && name.length <= NAME_LIMIT && !/[,，]/.test(name);
export const unique = (names: string[]) => [...new Set(names.filter(Boolean))];
export const defaultCatalog = (): Catalog => ({ tags: [...defaultTags], moods: [...moods] });
export const defaultSync = (entries: Entry[] = []): SyncMeta => ({
    dirtyIds: unique(entries.filter((e) => !isSample(e.id)).map((e) => e.id)),
    tombstones: [],
    bases: {}
});

/**
 * Signing out returns the device to local-only mode: whatever the cloud already holds leaves this
 * browser, whatever is still queued stays and re-queues, and nothing is recorded as deleted — the
 * account's cloud copies must survive.
 */
export function detachAccount(journal: Journal): Journal {
    const dirty = new Set(journal.sync.dirtyIds);
    const inCloud = (id: string) => journal.sync.bases[id] !== undefined && !dirty.has(id);
    const entries = journal.entries.filter((e) => isSample(e.id) || !inCloud(e.id));
    const tombstones = journal.sync.tombstones.filter((t) => !inCloud(t.entry.id));
    const kept = new Set(tombstones.map((t) => t.entry.id));
    const clearedTrash = Object.fromEntries(
        Object.entries(journal.sync.clearedTrash ?? {}).filter(([id]) => kept.has(id))
    );
    return {
        entries,
        catalog: journal.catalog,
        sync: {
            dirtyIds: unique([
                ...entries.filter((e) => !isSample(e.id)).map((e) => e.id),
                ...tombstones.map((t) => t.entry.id)
            ]),
            tombstones,
            ...(Object.keys(clearedTrash).length ? { clearedTrash } : {}),
            bases: {}
        }
    };
}

/** Latest-wins fold by id: the single place that decides how two versions of one record are ordered. */
export const latestById = <T>(items: T[], id: (item: T) => string, stamp: (item: T) => string) => {
    const byId = new Map<string, T>();
    for (const item of items) {
        const current = byId.get(id(item));
        if (!current || stamp(item) > stamp(current)) byId.set(id(item), item);
    }
    return byId;
};
export const dedupeEntries = (entries: Entry[]) => [
    ...latestById(
        entries,
        (e) => e.id,
        (e) => e.updated_at
    ).values()
];
export const mergeTombstones = (...groups: Tombstone[][]) => [
    ...latestById(
        groups.flat(),
        (t) => t.entry.id,
        (t) => t.deleted_at
    ).values()
];
/** Tombstones that still hold recoverable content — the contract between the recycle list and purging. */
export const trashedTombstones = (sync: SyncMeta) =>
    sync.tombstones.filter(
        (t) =>
            (t.entry.title || t.entry.body) &&
            !(
                sync.clearedTrash?.[t.entry.id] &&
                Date.parse(t.deleted_at) <= Date.parse(sync.clearedTrash[t.entry.id])
            )
    );

const syncValid = (value: unknown): value is SyncMeta => {
    if (!value || typeof value !== "object") return false;
    const sync = value as SyncMeta;
    return (
        Array.isArray(sync.dirtyIds) &&
        sync.dirtyIds.every((id) => typeof id === "string") &&
        Array.isArray(sync.tombstones) &&
        sync.tombstones.every((t) => entryValid(t?.entry) && typeof t.deleted_at === "string") &&
        (sync.clearedTrash === undefined ||
            (!!sync.clearedTrash &&
                typeof sync.clearedTrash === "object" &&
                Object.values(sync.clearedTrash).every((v) => typeof v === "string"))) &&
        !!sync.bases &&
        typeof sync.bases === "object" &&
        Object.values(sync.bases).every((v) => typeof v === "string")
    );
};

export function parseJournal(text: string): Journal {
    const data = JSON.parse(text);
    const sourceEntries = Array.isArray(data) ? data : data?.entries;
    if (!Array.isArray(sourceEntries) || !sourceEntries.every(entryValid))
        throw new Error("日记格式不正确");
    const entries = dedupeEntries(sourceEntries);
    const catalog = data?.catalog ?? defaultCatalog();
    for (const kind of ["tags", "moods"] as const) {
        if (
            !Array.isArray(catalog[kind]) ||
            !catalog[kind].every((n: unknown) => typeof n === "string")
        )
            throw new Error("分类格式不正确");
    }
    const sync = data?.sync === undefined ? defaultSync(entries) : data.sync;
    if (!syncValid(sync)) throw new Error("同步信息格式不正确");
    const tombstones = latestById(
        sync.tombstones,
        (t) => t.entry.id,
        (t) => t.deleted_at
    );
    const live = entries.filter((entry) => {
        const tombstone = tombstones.get(entry.id);
        if (!tombstone) return true;
        if (entry.updated_at <= tombstone.deleted_at) return false;
        tombstones.delete(entry.id);
        return true;
    });
    return {
        entries: live,
        catalog: { tags: unique(catalog.tags), moods: unique(catalog.moods) },
        sync: {
            dirtyIds: unique(sync.dirtyIds),
            tombstones: [...tombstones.values()],
            ...(sync.clearedTrash ? { clearedTrash: { ...sync.clearedTrash } } : {}),
            bases: { ...sync.bases }
        }
    };
}

export function readRawJournal() {
    return localStorage.getItem(STORE);
}

export function readJournal(): Journal & { error: string } {
    try {
        const text = readRawJournal();
        return {
            ...(text === null
                ? { entries: seeds, catalog: defaultCatalog(), sync: defaultSync() }
                : parseJournal(text)),
            error: ""
        };
    } catch {
        return {
            entries: [],
            catalog: defaultCatalog(),
            sync: defaultSync(),
            error: "无法读取本机日记，原数据仍保留。请导出原始备份后再恢复。"
        };
    }
}

export function collectionNames(journal: Journal, kind: CollectionKind) {
    return unique([
        ...journal.catalog[kind],
        ...journal.entries.flatMap((e) => (kind === "tags" ? e.tags : [e.mood]))
    ]);
}

// One snapshot makes the label edit and its affected diary entries an atomic write.
export function changeCollection(
    journal: Journal,
    kind: CollectionKind,
    from: string | null,
    to: string | null,
    now = new Date().toISOString()
): Journal {
    const names = collectionNames(journal, kind);
    const nextNames = unique([...names.filter((n) => n !== from), ...(to ? [to] : [])]);
    const rename =
        from === null
            ? null
            : kind === "tags"
              ? (entry: Entry) =>
                    entry.tags.includes(from)
                        ? {
                              ...entry,
                              tags: to
                                  ? unique(entry.tags.map((t) => (t === from ? to : t)))
                                  : entry.tags.filter((t) => t !== from),
                              updated_at: now
                          }
                        : entry
              : (entry: Entry) =>
                    entry.mood === from ? { ...entry, mood: to ?? "", updated_at: now } : entry;
    const entries = rename === null ? journal.entries : journal.entries.map(rename);
    return { entries, catalog: { ...journal.catalog, [kind]: nextNames }, sync: journal.sync };
}

export function trackLocalChanges(
    journal: Journal,
    nextEntries: Entry[],
    now = new Date().toISOString()
): SyncMeta {
    const before = new Map(journal.entries.map((entry) => [entry.id, entry]));
    const after = new Map(nextEntries.map((entry) => [entry.id, entry]));
    const dirty = new Set(journal.sync.dirtyIds);
    const tombstones = new Map(
        journal.sync.tombstones.map((tombstone) => [tombstone.entry.id, tombstone])
    );
    for (const [id, entry] of before) {
        if (!after.has(id) && !isSample(id)) {
            dirty.add(id);
            tombstones.set(id, { entry, deleted_at: now });
        }
    }
    for (const [id, entry] of after) {
        if (isSample(id)) continue;
        const old = before.get(id);
        // Edits always produce a new object, so an identical reference is unchanged without serializing.
        if (!old || (old !== entry && JSON.stringify(old) !== JSON.stringify(entry))) dirty.add(id);
        tombstones.delete(id);
    }
    return { ...journal.sync, dirtyIds: [...dirty], tombstones: [...tombstones.values()] };
}

/** Clear this device only; pending soft deletions retain content until uploaded. */
export function purgeTrash(sync: SyncMeta): SyncMeta {
    const targets = trashedTombstones(sync);
    if (!targets.length) return sync;
    const clearedTrash = { ...sync.clearedTrash };
    for (const t of targets) clearedTrash[t.entry.id] = t.deleted_at;
    return {
        ...sync,
        clearedTrash,
        tombstones: sync.tombstones.filter(
            (t) => !clearedTrash[t.entry.id] || sync.dirtyIds.includes(t.entry.id)
        )
    };
}
