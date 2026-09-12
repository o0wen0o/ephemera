import { useState } from "react";
import { Banners } from "./app/Banners";
import { DeskHeading } from "./app/DeskHeading";
import { MobileTabBar } from "./app/MobileTabBar";
import { PageFooter } from "./app/PageFooter";
import { Sidebar } from "./app/Sidebar";
import { Topbar } from "./app/Topbar";
import { useAppUpdate } from "./app/useAppUpdate";
import { useCloudSync } from "./app/useCloudSync";
import { useConnectivity } from "./app/useConnectivity";
import { useDrafts } from "./app/useDrafts";
import { useFilteredEntries, useFilters } from "./app/useFilters";
import { useJournal } from "./app/useJournal";
import { useMobileNav } from "./app/useMobileNav";
import { useToast } from "./app/useToast";
import { type View } from "./app/views";
import { Calendar } from "./components/Calendar";
import { Confirm } from "./components/Confirm";
import { Modal } from "./components/Modal";
import { Toast } from "./components/Toast";
import { CollectionManager } from "./features/collections/CollectionManager";
import { DraftsPage } from "./features/drafts/DraftsPage";
import { Editor } from "./features/journal/Editor";
import { JournalSection } from "./features/journal/JournalSection";
import { Reader } from "./features/journal/Reader";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { isSample, thisMonth, type Entry } from "./data/data";
import { changeCollection, purgeTrash, type CollectionKind } from "./data/journal";
import { readDrafts, removeDraft } from "./data/drafts";

export default function App() {
    const { toast, setToast } = useToast();
    const notify = setToast;
    const journal = useJournal(notify);
    const { entries, catalog, syncMeta, storageError, persist, tags, moodOptions, trash } = journal;
    const drafts = useDrafts(notify);
    const { online, syncPulse, install, setInstall } = useConnectivity();
    const updateApp = useAppUpdate(notify);
    const cloud = useCloudSync({ journal, notify, online, syncPulse });
    const { mobileNav, setMobileNav } = useMobileNav();
    const filters = useFilters();

    const [view, setView] = useState<View>("all");
    const [list, setList] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [organizing, setOrganizing] = useState(false);
    const [editing, setEditing] = useState<Entry | "new" | null>(null);
    const [photoBusy, setPhotoBusy] = useState(false);
    const [reading, setReading] = useState<Entry | null>(null);
    const [settings, setSettings] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [discardDraft, setDiscardDraft] = useState<string | null>(null);
    const [emptyTrash, setEmptyTrash] = useState(false);

    const filtered = useFilteredEntries(entries, view, filters);
    const hasSamples = entries.some((e) => isSample(e.id));
    const pendingSync = syncMeta.dirtyIds.length;

    const selectView = (v: View) => {
        setView(v);
        filters.clear();
        setMobileNav(false);
    };
    const startWriting = () => {
        try {
            const createdIds = new Set([
                ...entries.map((entry) => entry.id),
                ...syncMeta.tombstones.map((t) => t.entry.id)
            ]);
            const pending = readDrafts()
                .filter((draft) => !createdIds.has(draft.id))
                .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
            setMobileNav(false);
            setEditing(pending ?? "new");
        } catch {
            setToast("草稿读取失败，请刷新页面重试。");
        }
    };
    const closeEditor = () => {
        if (!photoBusy) setEditing(null);
    };
    const closeOrganizer = () => setOrganizing(false);
    const closeReader = () => setReading(null);
    const closeSettings = () => setSettings(false);
    const closeDelete = () => setDeleteId(null);
    const closeEmptyTrash = () => setEmptyTrash(false);
    const closeReplaceLocal = () => {
        if (!cloud.busy) cloud.setReplaceLocal(false);
    };

    const organize = (kind: CollectionKind, from: string | null, to: string | null) => {
        const next = changeCollection({ entries, catalog, sync: syncMeta }, kind, from, to);
        if (!persist(next.entries, next.catalog)) return false;
        if (kind === "tags" && filters.tag === from) filters.setTag(to || "");
        if (kind === "moods" && filters.mood === from) filters.setMood(to || "");
        notify(
            from === null
                ? "已添加，可在写日记时选择。"
                : to === null
                  ? "分类已移除，日记正文保留。"
                  : "名称已更新，相关日记已一起整理。"
        );
        return true;
    };
    const save = (entry: Entry) => {
        const ok = persist([entry, ...entries.filter((e) => e.id !== entry.id)]);
        if (ok) notify("日记已收好，保存在这台设备。");
        return ok;
    };
    const favorite = (entry: Entry) => {
        const changed = {
            ...entry,
            favorite: !entry.favorite,
            updated_at: new Date().toISOString()
        };
        if (persist(entries.map((e) => (e.id === entry.id ? changed : e)))) {
            if (reading?.id === entry.id) setReading(changed);
            notify(changed.favorite ? "已夹进珍藏。" : "已取消收藏。");
        }
    };
    const emptyAction = () => {
        if (filters.narrowed) filters.clear();
        else if (view === "calendar") filters.setMonth(thisMonth());
        else if (view === "favorites") selectView("all");
        else startWriting();
    };
    const restoreEntry = (entry: Entry) => {
        if (
            persist([
                { ...entry, updated_at: new Date().toISOString() },
                ...entries.filter((e) => e.id !== entry.id)
            ])
        )
            notify("日记已恢复。");
    };
    const clearSamples = () => {
        if (persist(entries.filter((e) => !e.id.startsWith("sample-"))))
            notify("示例已收起，书页留给你的故事。");
    };

    return (
        <div className="app">
            {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} />}
            <Sidebar
                open={mobileNav}
                view={view}
                draftCount={drafts.length}
                online={online}
                onSelectView={selectView}
                onWrite={startWriting}
                onOrganize={() => {
                    setOrganizing(true);
                    setMobileNav(false);
                }}
                onSettings={() => {
                    setSettings(true);
                    setMobileNav(false);
                }}
            />
            <div className="workspace">
                <Topbar
                    view={view}
                    query={filters.query}
                    onQueryChange={filters.setQuery}
                    onOpenNav={() => setMobileNav(true)}
                />
                <Banners
                    storageError={storageError}
                    online={online}
                    updateApp={updateApp}
                    onExportRaw={() => journal.exportData(true)}
                />
                <main>
                    <DeskHeading view={view} />
                    <div className={"journal-body " + (view === "calendar" ? "review-body" : "")}>
                        {view === "calendar" && (
                            <Calendar
                                month={filters.month}
                                onMonthChange={(date) => {
                                    filters.setMonth(date);
                                    filters.setSelectedDate("");
                                }}
                                value={filters.selectedDate}
                                onChange={(date) =>
                                    filters.setSelectedDate((d) => (d === date ? "" : date))
                                }
                                entries={entries}
                            />
                        )}
                        {view === "drafts" ? (
                            <DraftsPage
                                drafts={drafts}
                                entries={entries}
                                query={filters.query}
                                list={list}
                                setList={setList}
                                setEditing={setEditing}
                                setDiscardDraft={setDiscardDraft}
                            />
                        ) : (
                            <JournalSection
                                view={view}
                                filters={filters}
                                entries={filtered}
                                tags={tags}
                                moods={moodOptions}
                                list={list}
                                onListChange={setList}
                                showFilters={showFilters}
                                onShowFiltersChange={setShowFilters}
                                hasSamples={hasSamples}
                                userId={cloud.session?.user.id}
                                onOpen={setReading}
                                onFavorite={favorite}
                                onOrganize={() => setOrganizing(true)}
                                onEmptyAction={emptyAction}
                            />
                        )}
                    </div>
                    <PageFooter
                        signedIn={!!cloud.session}
                        online={online}
                        pendingSync={pendingSync}
                        accountAllowed={cloud.accountAllowed}
                    />
                </main>
            </div>
            <MobileTabBar view={view} onSelectView={selectView} onWrite={startWriting} />
            {discardDraft && (
                <Confirm
                    label="丢弃草稿"
                    title="丢弃这份草稿？"
                    confirm="丢弃草稿"
                    cancel="继续保留"
                    onCancel={() => setDiscardDraft(null)}
                    onConfirm={() => {
                        try {
                            removeDraft(discardDraft);
                            setDiscardDraft(null);
                        } catch {
                            notify("草稿移除失败，请重试。");
                        }
                    }}
                >
                    只移除这份未保存的草稿，已保存的日记保留。
                </Confirm>
            )}
            {organizing && (
                <Modal label="整理书页" onClose={closeOrganizer}>
                    <CollectionManager
                        tags={tags}
                        moods={moodOptions}
                        entries={entries}
                        onChange={organize}
                        onClose={closeOrganizer}
                    />
                </Modal>
            )}
            {editing !== null && (
                <Modal wide label="写日记" onClose={closeEditor}>
                    <Editor
                        photoUserId={cloud.accountAllowed ? cloud.session?.user.id : undefined}
                        photoBusy={photoBusy}
                        onPhotoBusy={setPhotoBusy}
                        tags={tags}
                        moods={moodOptions}
                        entry={editing === "new" ? undefined : editing}
                        onClose={closeEditor}
                        onSave={save}
                    />
                </Modal>
            )}
            {reading && (
                <Modal wide label={reading.title} onClose={closeReader}>
                    <Reader
                        entry={reading}
                        userId={cloud.session?.user.id}
                        onClose={closeReader}
                        onEdit={() => {
                            setEditing(reading);
                            setReading(null);
                        }}
                        onFavorite={() => favorite(reading)}
                        onDelete={() => setDeleteId(reading.id)}
                    />
                </Modal>
            )}
            {settings && (
                <Modal label="我的小天地" onClose={closeSettings}>
                    <SettingsPanel
                        onClose={closeSettings}
                        notify={notify}
                        session={cloud.session}
                        owner={cloud.owner}
                        accountAllowed={cloud.accountAllowed}
                        online={online}
                        busy={cloud.busy}
                        signingOut={cloud.signingOut}
                        pendingSync={pendingSync}
                        cloudMessage={cloud.cloudMessage}
                        hasLocalBackup={cloud.hasLocalBackup}
                        email={cloud.email}
                        onEmailChange={cloud.setEmail}
                        onAuth={() => void cloud.auth()}
                        onSignOut={() => cloud.setConfirmSignOut(true)}
                        onBindAccount={() => cloud.setBindAccount(true)}
                        onSync={() => void cloud.cloudSync()}
                        onReplaceLocal={() => cloud.setReplaceLocal(true)}
                        onExportLocalBackup={cloud.exportLocalBackup}
                        storageError={storageError}
                        onExport={journal.exportData}
                        onImport={(file) => void journal.importData(file)}
                        install={install}
                        onInstalled={() => setInstall(null)}
                        hasSamples={hasSamples}
                        onClearSamples={clearSamples}
                        trash={trash}
                        onEmptyTrash={() => setEmptyTrash(true)}
                        onRestore={restoreEntry}
                    />
                </Modal>
            )}
            {deleteId && (
                <Confirm
                    label="删除日记"
                    title="要与这一页告别吗？"
                    cancel="再留一会儿"
                    confirm="移入回收站"
                    onCancel={closeDelete}
                    onConfirm={() => {
                        if (persist(entries.filter((e) => e.id !== deleteId))) {
                            setDeleteId(null);
                            setReading(null);
                            notify("已移入回收站，可在设置中恢复。");
                        }
                    }}
                >
                    日记将移入回收站，正文、心情与标签完整保留，随时可以恢复。
                </Confirm>
            )}
            {cloud.bindAccount && cloud.session && (
                <Confirm
                    label="关联账号"
                    title="将本机日记关联此账号？"
                    cancel="暂不关联"
                    confirm="关联并开启同步"
                    onCancel={() => cloud.setBindAccount(false)}
                    onConfirm={cloud.linkAccount}
                >
                    确认这些本机日记属于 {cloud.session.user.email}
                    。关联后会与该账号的云端日记同步。
                </Confirm>
            )}
            {cloud.confirmSignOut && (
                <Confirm
                    label="退出登录"
                    title="退出登录？"
                    cancel="取消"
                    confirm="退出登录"
                    disabled={cloud.signingOut}
                    onCancel={() => {
                        if (!cloud.signingOut) cloud.setConfirmSignOut(false);
                    }}
                    onConfirm={() => void cloud.signOutNow()}
                >
                    已同步的日记会从这台设备移除，云端仍保留，重新登录即可取回。未同步的改动留在本机。
                </Confirm>
            )}
            {cloud.replaceLocal && (
                <Confirm
                    label="用云端覆盖本机"
                    title="用云端覆盖本机？"
                    cancel="取消"
                    confirm="确认覆盖本机"
                    disabled={cloud.busy || !online}
                    onCancel={closeReplaceLocal}
                    onConfirm={() => void cloud.overwriteFromCloud()}
                >
                    本机日记将被云端内容替换，未同步的改动会丢失。覆盖前会自动保存一份本机备份。云端内容不变。
                </Confirm>
            )}
            {emptyTrash && (
                <Confirm
                    label="清空回收站"
                    title="清空回收站？"
                    cancel="取消"
                    confirm="清空本机回收站"
                    disabled={cloud.busy}
                    onCancel={closeEmptyTrash}
                    onConfirm={() => {
                        if (persist(entries, catalog, purgeTrash(syncMeta))) {
                            setEmptyTrash(false);
                            notify("回收站已清空。");
                        }
                    }}
                >
                    仅清空这台设备回收站中的 {trash.length} 篇日记。云端和其他设备不受影响。
                </Confirm>
            )}
            {toast && <Toast message={toast} onClose={() => setToast("")} />}
        </div>
    );
}
