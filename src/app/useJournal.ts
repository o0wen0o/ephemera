import { useMemo, useRef, useState } from "react";
import { localDate, type Entry } from "../data/data";
import {
    STORE,
    collectionNames,
    dedupeEntries,
    mergeTombstones,
    parseJournal,
    readJournal,
    readRawJournal,
    trackLocalChanges,
    trashedTombstones,
    unique,
    type Catalog,
    type SyncMeta
} from "../data/journal";

export type JournalStore = ReturnType<typeof useJournal>;

/**
 * The single owner of the stored journal: every write goes through `persist`, which
 * keeps local storage, React state and the sync bookkeeping in step.
 */
export function useJournal(notify: (message: string) => void) {
    const initial = useMemo(readJournal, []);
    const [entries, setEntries] = useState<Entry[]>(initial.entries);
    const [catalog, setCatalog] = useState<Catalog>(initial.catalog);
    const [syncMeta, setSyncMeta] = useState<SyncMeta>(initial.sync);
    const [storageError, setStorageError] = useState(initial.error);
    const revisionRef = useRef(0);

    const persist = (next: Entry[], nextCatalog: Catalog = catalog, nextSync?: SyncMeta) => {
        if (storageError) {
            notify("暂时无法保存，请先导出原始备份。");
            return false;
        }
        try {
            const resolvedSync =
                nextSync ?? trackLocalChanges({ entries, catalog, sync: syncMeta }, next);
            localStorage.setItem(
                STORE,
                JSON.stringify({
                    version: 3,
                    entries: next,
                    catalog: nextCatalog,
                    sync: resolvedSync
                })
            );
            revisionRef.current++;
            setEntries(next);
            setCatalog(nextCatalog);
            setSyncMeta(resolvedSync);
            return true;
        } catch {
            notify("保存失败，本机存储空间不足。请清理后重试。");
            return false;
        }
    };

    // collectionNames reads only entries and the catalog, so sync progress must not invalidate these.
    const tags = useMemo(
        () => collectionNames({ entries, catalog, sync: syncMeta }, "tags"),
        [entries, catalog]
    );
    const moodOptions = useMemo(
        () => collectionNames({ entries, catalog, sync: syncMeta }, "moods"),
        [entries, catalog]
    );
    const trash = useMemo(() => trashedTombstones(syncMeta), [syncMeta]);

    const exportData = (raw = false) => {
        let body: string;
        try {
            body = raw
                ? readRawJournal() || "[]"
                : JSON.stringify(
                      {
                          app: "芸窗 Ephemera",
                          version: 3,
                          exportedAt: new Date().toISOString(),
                          entries,
                          catalog,
                          sync: syncMeta
                      },
                      null,
                      2
                  );
        } catch {
            notify("无法读取本机日记，导出失败。");
            return;
        }
        const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `芸窗-${raw ? "原始备份-" : ""}${localDate()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify("日记备份已导出。");
    };

    const importData = async (file: File) => {
        if (file.size > 5e6) {
            notify("请选择小于 5 MB 的日记备份。");
            return;
        }
        try {
            const incoming = parseJournal(await file.text());
            const merged = new Map(
                dedupeEntries([...entries, ...incoming.entries]).map((e) => [e.id, e])
            );
            for (const tombstone of incoming.sync.tombstones) {
                const old = merged.get(tombstone.entry.id);
                if (!old || tombstone.deleted_at >= old.updated_at)
                    merged.delete(tombstone.entry.id);
            }
            const next = [...merged.values()];
            const nextCatalog = {
                tags: unique([...catalog.tags, ...incoming.catalog.tags]),
                moods: unique([...catalog.moods, ...incoming.catalog.moods])
            };
            const tracked = trackLocalChanges({ entries, catalog, sync: syncMeta }, next);
            const nextSync = {
                ...tracked,
                dirtyIds: unique([
                    ...tracked.dirtyIds,
                    ...incoming.sync.tombstones.map((t) => t.entry.id)
                ]),
                tombstones: mergeTombstones(tracked.tombstones, incoming.sync.tombstones)
            };
            if (storageError) {
                localStorage.setItem(STORE + "-recovery-" + Date.now(), readRawJournal() || "");
                localStorage.setItem(
                    STORE,
                    JSON.stringify({
                        version: 3,
                        entries: next,
                        catalog: nextCatalog,
                        sync: nextSync
                    })
                );
                setStorageError("");
                setEntries(next);
                setCatalog(nextCatalog);
                setSyncMeta(nextSync);
                notify("原数据已备份，日记已恢复。");
            } else if (persist(next, nextCatalog, nextSync))
                notify(`已按版本合并 ${incoming.entries.length} 篇日记。`);
        } catch {
            notify("无法导入，请选择芸窗导出的备份文件。");
        }
    };

    return {
        entries,
        catalog,
        syncMeta,
        storageError,
        revisionRef,
        persist,
        tags,
        moodOptions,
        trash,
        exportData,
        importData
    };
}
