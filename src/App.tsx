import { cloudError, accountMatches } from "./account";
import { readDrafts, removeDraft } from "./drafts";
import { journalFromCloud } from "./sync";
import { purgeTrash } from "./journal";
import { Help } from "./Help";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    BookOpen,
    CalendarDays,
    Bookmark,
    Search,
    Plus,
    ChevronDown,
    Sprout,
    Settings,
    Cloud,
    Download,
    Upload,
    X,
    Feather,
    Leaf,
    ArrowLeft,
    Pencil,
    Trash2,
    Check,
    WifiOff,
    Menu,
    LogOut,
    Mail,
    LayoutGrid,
    List,
    Tags,
    MonitorSmartphone,
    type LucideIcon
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { registerSW } from "virtual:pwa-register";
import {
    type Entry,
    asDate,
    countWords,
    displayDate,
    isSample,
    localDate,
    thisMonth
} from "./data";
import { moodGlyph, weatherIcon } from "./entryMeta";
import { Calendar } from "./Calendar";
import { CollectionManager } from "./CollectionManager";
import {
    STORE,
    readJournal,
    readRawJournal,
    parseJournal,
    changeCollection,
    collectionNames,
    trackLocalChanges,
    mergeTombstones,
    dedupeEntries,
    trashedTombstones,
    unique,
    type Catalog,
    type CollectionKind,
    type SyncMeta
} from "./journal";
import { planSync, syncSignature, validateCloudRows, type SyncPlan } from "./sync";
import { Editor } from "./Editor";
import { supabase } from "./supabase";
type View = "all" | "drafts" | "calendar" | "favorites";
type InstallEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
};
// One table per view so adding or renaming a view is a single edit instead of six parallel ternaries.
const VIEWS: Record<
    View,
    {
        icon: LucideIcon;
        title: string;
        crumb: string;
        h1: string;
        sub: string;
        section: string;
        emptyHead: string;
        emptyBody: string;
        emptyAction: string;
    }
> = {
    all: {
        icon: BookOpen,
        title: "日记",
        crumb: "我的日记",
        h1: "日子，慢慢写。",
        sub: "把平凡留在心里。",
        section: "我的日记",
        emptyHead: "故事，从今天开始",
        emptyBody: "给今天留几句话，往后翻起，便是回忆。",
        emptyAction: "写第一篇日记"
    },
    drafts: { icon: Pencil, title: "草稿", crumb: "我的草稿", h1: "未完的文字，留待下次。", sub: "那些还在酝酿的日子。", section: "我的草稿", emptyHead: "暂无草稿", emptyBody: "", emptyAction: "写日记" },
    calendar: {
        icon: CalendarDays,
        title: "回顾",
        crumb: "日历回顾",
        h1: "沿着日历，遇见从前。",
        sub: "选一个日子，翻开那天的书页。",
        section: "这个月的书页",
        emptyHead: "这个月还没有书页",
        emptyBody: "试试另一个月份，看看那些有记录的日子。",
        emptyAction: "回到本月"
    },
    favorites: {
        icon: Bookmark,
        title: "珍藏",
        crumb: "我的珍藏",
        h1: "值得留下的片刻。",
        sub: "你收藏的文字，都在这里。",
        section: "我的珍藏",
        emptyHead: "还没有珍藏的片刻",
        emptyBody: "点击日记上的书签，就能把喜欢的文字放在这里。",
        emptyAction: "浏览日记"
    }
};
const VIEW_ORDER = Object.keys(VIEWS) as View[];
// Intl construction is expensive and the value only changes at midnight, so build it once.
const HEADING_FMT = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long"
});
function Botanical({ small = false }: { small?: boolean }) {
    return (
        <svg
            className={small ? "botanical small" : "botanical"}
            viewBox="0 0 320 290"
            fill="none"
            aria-hidden="true"
        >
            <g stroke="currentColor" strokeWidth="1.1">
                <path d="M138 293C159 227 175 155 153 54M159 196C213 163 231 110 251 66M159 211C113 175 98 137 73 102M166 150C195 122 197 81 199 42M145 268C195 245 227 212 258 185" />
                <path
                    d="M153 55C113 29 125 4 128 7C167 20 161 39 153 55ZM160 95C112 90 116 59 115 57C151 57 167 77 160 95ZM165 128C135 122 115 105 122 88C154 88 166 109 165 128ZM163 151C185 133 187 105 176 97C155 107 153 134 163 151ZM164 185C120 177 117 158 120 145C154 144 166 163 164 185ZM196 159C222 164 245 146 242 134C214 132 200 145 196 159ZM221 122C201 102 208 78 218 74C238 92 229 111 221 122ZM240 90C267 86 281 64 273 53C250 57 239 70 240 90ZM250 66C232 44 245 26 249 21C268 41 260 58 250 66ZM199 64C177 42 190 23 199 15C216 38 207 54 199 64ZM191 105C211 104 225 87 224 70C201 73 189 85 191 105ZM110 165C82 172 59 152 61 143C86 136 104 150 110 165ZM91 134C113 115 98 97 96 89C76 104 80 123 91 134ZM76 107C47 103 44 81 46 72C71 77 79 90 76 107ZM199 237C201 216 222 202 234 210C229 229 212 239 199 237ZM228 215C252 224 270 211 273 202C254 192 237 204 228 215ZM255 189C250 167 269 153 278 155C280 175 265 188 255 189Z"
                    fill="currentColor"
                    fillOpacity=".10"
                />
            </g>
        </svg>
    );
}
function Modal({
    children,
    onClose,
    label,
    wide = false
}: {
    children: ReactNode;
    onClose: () => void;
    label: string;
    wide?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    // Held in a ref so the focus trap arms once per dialog; re-running it would steal focus mid-edit.
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const prev = document.activeElement as HTMLElement;
        const old = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
        const key = (e: KeyboardEvent) => {
            if (e.key !== "Escape" && e.key !== "Tab") return;
            if (
                e.defaultPrevented ||
                Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) !== ref.current
            )
                return;
            if (e.key === "Escape") closeRef.current();
            if (e.key === "Tab") {
                const nodes = Array.from(
                    ref.current?.querySelectorAll<HTMLElement>(
                        'button,input,textarea,select,a[href],[tabindex="0"]'
                    ) || []
                ).filter(
                    (el) =>
                        !el.hasAttribute("disabled") && el.offsetParent !== null && el.tabIndex >= 0
                );
                const first = nodes[0],
                    last = nodes.at(-1);
                if (
                    e.shiftKey &&
                    (document.activeElement === first || document.activeElement === ref.current)
                ) {
                    e.preventDefault();
                    last?.focus();
                } else if (
                    !e.shiftKey &&
                    (document.activeElement === last || document.activeElement === ref.current)
                ) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener("keydown", key);
        return () => {
            document.body.style.overflow = old;
            document.removeEventListener("keydown", key);
            prev?.focus();
        };
    }, []);
    return (
        <div
            className="modal-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={ref}
                className={"modal " + (wide ? "wide" : "")}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
            >
                {children}
            </div>
        </div>
    );
}
function Confirm({
    label,
    title,
    cancel,
    confirm,
    onCancel,
    onConfirm,
    disabled = false,
    children
}: {
    label: string;
    title: string;
    cancel: string;
    confirm: string;
    onCancel: () => void;
    onConfirm: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <Modal label={label} onClose={onCancel}>
            <div className="confirm-dialog">
                <Trash2 size={25} />
                <h2>{title}</h2>
                <p>{children}</p>
                <div className="button-row">
                    <button className="outline" onClick={onCancel}>
                        {cancel}
                    </button>
                    <button className="danger" disabled={disabled} onClick={onConfirm}>
                        {confirm}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
function EntryCard({
    entry,
    onOpen,
    onFavorite,
    list = false,
    order = 0
}: {
    entry: Entry;
    order?: number;
    onOpen: () => void;
    onFavorite: () => void;
    list?: boolean;
}) {
    const d = asDate(entry.date);
    const WeatherIcon = weatherIcon(entry.weather);
    return (
        <article
            style={{ order }}
            className={"entry-card " + (entry.cover ? "featured " : "") + (list ? "list-card" : "")}
        >
            <button className="card-open" onClick={onOpen} aria-label={"阅读：" + entry.title}>
                {entry.cover && (
                    <div className="entry-cover">
                        <img src="/garden.jpg" alt="阳光穿过茂密的绿色森林" />
                        <span>把生活，过成喜欢的样子。</span>
                    </div>
                )}
                <div className="card-content">
                    <div className="entry-date">
                        <span>
                            {d.getMonth() + 1} 月 {d.getDate()} 日{" "}
                            <span className="weekday">
                                {
                                    ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
                                        d.getDay()
                                    ]
                                }
                            </span>
                        </span>
                        <span className="weather">
                            <WeatherIcon size={13} /> {entry.weather}
                        </span>
                    </div>
                    <h3>{entry.title}</h3>
                    <p>{entry.body}</p>
                </div>
            </button>
            <div className="card-footer">
                <div className="entry-tags">
                    <span className="mood-tag">
                        {entry.mood ? moodGlyph(entry.mood) : ""} {entry.mood || "未标记心情"}
                    </span>
                    {entry.tags.slice(0, 2).map((t) => (
                        <span key={t}>#{t}</span>
                    ))}
                </div>
                <button
                    className={"icon-btn bookmark " + (entry.favorite ? "active" : "")}
                    aria-label={(entry.favorite ? "取消收藏：" : "收藏：") + entry.title}
                    onClick={onFavorite}
                >
                    <Bookmark size={16} fill={entry.favorite ? "currentColor" : "none"} />
                </button>
            </div>
        </article>
    );
}
export default function App() {
    const initial = useMemo(readJournal, []);
    const [entries, setEntries] = useState<Entry[]>(initial.entries);
    const [catalog, setCatalog] = useState<Catalog>(initial.catalog);
    const [syncMeta, setSyncMeta] = useState<SyncMeta>(initial.sync);
    const [organizing, setOrganizing] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [storageError, setStorageError] = useState(initial.error);
    const [drafts, setDrafts] = useState<Entry[]>(() => { try { return readDrafts(); } catch { return []; } });
    const [discardDraft, setDiscardDraft] = useState<string | null>(null);
    useEffect(() => {
        const refresh = () => { try { setDrafts(readDrafts()); } catch { setToast("草稿读取失败，请保留浏览器数据。"); } };
        refresh(); window.addEventListener('ephemera-drafts', refresh); window.addEventListener('storage', refresh);
        return () => { window.removeEventListener('ephemera-drafts', refresh); window.removeEventListener('storage', refresh); };
    }, []);
    const [view, setView] = useState<View>("all");
    const [query, setQuery] = useState("");
    const [tag, setTag] = useState("");
    const [mood, setMood] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [month, setMonth] = useState(thisMonth);
    const [list, setList] = useState(false);
    const [editing, setEditing] = useState<Entry | "new" | null>(null);
    const [reading, setReading] = useState<Entry | null>(null);
    const [settings, setSettings] = useState(false);
    const [replaceLocal, setReplaceLocal] = useState(false);
    const closeReplaceLocal = () => { if (!busy) setReplaceLocal(false); };
    const [hasLocalBackup, setHasLocalBackup] = useState(() => { try { return !!localStorage.getItem(STORE + "-before-cloud"); } catch { return false; } });
    const [emptyTrash, setEmptyTrash] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [mobileNav, setMobileNav] = useState(false);
    const [toast, setToast] = useState("");
    const [online, setOnline] = useState(navigator.onLine);
    const [syncPulse, setSyncPulse] = useState(0);
    const [install, setInstall] = useState<InstallEvent | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [email, setEmail] = useState("");
    const [owner, setOwner] = useState<string | null>(() => { try { return localStorage.getItem(STORE + '-owner'); } catch { return null; } });
    const [bindAccount, setBindAccount] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const signingOutRef = useRef(false);
    const activeUserRef = useRef<string | null>(null);
    const accountAllowed = !!session && accountMatches(owner, session.user.id);
    const ensureAccount = (userId: string) => {
        if (activeUserRef.current !== userId || localStorage.getItem(STORE + '-owner') !== userId) throw new Error('账号已变化，同步已停止，本机内容保留。');
    };
    const [busy, setBusy] = useState(false);
    const [installMessage, setInstallMessage] = useState("");
    const [cloudMessage, setCloudMessage] = useState("");
    const [updateApp, setUpdateApp] = useState<((reload?: boolean) => Promise<void>) | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const revisionRef = useRef(0);
    const autoAttemptRef = useRef("");
    const notify = setToast;
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(""), 4500);
            return () => clearTimeout(timer);
        }
    }, [toast]);
    useEffect(() => {
        const onlineFn = () => {
            setOnline(navigator.onLine);
            if (navigator.onLine) setSyncPulse((n) => n + 1);
        };
        const focusFn = () => {
            if (document.visibilityState === "visible") setSyncPulse((n) => n + 1);
        };
        const installFn = (e: Event) => {
            e.preventDefault();
            setInstall(e as InstallEvent);
        };
        window.addEventListener("online", onlineFn);
        window.addEventListener("offline", onlineFn);
        window.addEventListener("focus", focusFn);
        window.addEventListener("beforeinstallprompt", installFn);
        const done = () => setInstall(null);
        window.addEventListener("appinstalled", done);
        return () => {
            window.removeEventListener("online", onlineFn);
            window.removeEventListener("offline", onlineFn);
            window.removeEventListener("focus", focusFn);
            window.removeEventListener("beforeinstallprompt", installFn);
            window.removeEventListener("appinstalled", done);
        };
    }, []);
    useEffect(() => {
        const update = registerSW({
            onNeedRefresh() {
                setUpdateApp(() => update);
            },
            onOfflineReady() {
                setToast("离线书页已备好，断网也可以写日记。");
            }
        });
    }, []);
    useEffect(() => {
        if (!supabase) return;
        let authChanged = false;
        supabase.auth.getSession().then(({ data, error }) => {
            if (authChanged) return;
            if (error) setCloudMessage(cloudError(error));
            else { activeUserRef.current = data.session?.user.id ?? null; setSession(data.session); }
        }).catch(error => setCloudMessage(cloudError(error)));
        const { data } = supabase.auth.onAuthStateChange((_event, s) => { authChanged = true; activeUserRef.current = s?.user.id ?? null; setSession(s); });
        return () => data.subscription.unsubscribe();
    }, []);
    const persist = (next: Entry[], nextCatalog: Catalog = catalog, nextSync?: SyncMeta) => {
        if (storageError) {
            notify("请先导出原始备份，再恢复数据，避免覆盖原有日记。");
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
            notify("保存失败：浏览器存储空间不足或不可用。请保留此页后重试。");
            return false;
        }
    };
    const closeOrganizer = () => setOrganizing(false);
    const organize = (kind: CollectionKind, from: string | null, to: string | null) => {
        const next = changeCollection({ entries, catalog, sync: syncMeta }, kind, from, to);
        if (!persist(next.entries, next.catalog)) return false;
        if (kind === "tags" && tag === from) setTag(to || "");
        if (kind === "moods" && mood === from) setMood(to || "");
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
    const clearFilters = () => {
        setQuery("");
        setTag("");
        setMood("");
        setSelectedDate("");
    };
    const selectView = (v: View) => {
        setView(v);
        clearFilters();
        setMobileNav(false);
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
    const filtered = useMemo(() => {
        const needle = query.toLowerCase();
        const monthPrefix = localDate(month).slice(0, 7);
        const matches = (e: Entry) =>
            !needle ||
            e.title.toLowerCase().includes(needle) ||
            e.body.toLowerCase().includes(needle) ||
            e.tags.some((t) => t.toLowerCase().includes(needle));
        return entries
            .filter(
                (e) =>
                    (view !== "favorites" || e.favorite) &&
                    (view !== "calendar" || e.date.startsWith(monthPrefix)) &&
                    (!tag || e.tags.includes(tag)) &&
                    (!mood || e.mood === mood) &&
                    (!selectedDate || e.date === selectedDate) &&
                    matches(e)
            )
            .sort(
                (a, b) => b.date.localeCompare(a.date) || b.updated_at.localeCompare(a.updated_at)
            );
    }, [entries, view, tag, mood, selectedDate, query, month]);
    const trash = useMemo(() => trashedTombstones(syncMeta), [syncMeta]);
    const closeEmptyTrash = () => setEmptyTrash(false);
    const today = localDate();
    const hasSamples = entries.some((e) => isSample(e.id));
    const pendingSync = syncMeta.dirtyIds.length;
    const narrowed = Boolean(query || tag || mood || selectedDate);
    const headingDate = useMemo(() => HEADING_FMT.format(new Date()), []);
    const closeEditor = () => setEditing(null);
    const closeReader = () => setReading(null);
    const closeSettings = () => setSettings(false);
    const closeDelete = () => setDeleteId(null);
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
            notify("浏览器拒绝读取存储，无法导出。");
            return;
        }
        const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `芸窗-${raw ? "原始备份-" : ""}${today}.json`;
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
            notify("无法导入，请使用芸窗导出的有效 JSON 备份。");
        }
    };
    const auth = async () => {
        if (!supabase) return;
        if (!email.includes("@")) {
            setCloudMessage("请输入有效的邮箱地址。");
            return;
        }
        setBusy(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: location.origin }
            });
            setCloudMessage(error ? cloudError(error) : "登录链接已发送，请到邮箱中打开。");
        } catch {
            setCloudMessage("连接失败，请检查网络后重试。");
        } finally {
            setBusy(false);
        }
    };
    const overwriteFromCloud = async () => {
        if (!supabase || !session || !online || busy || signingOutRef.current || !accountAllowed || storageError) return;
        const revision = revisionRef.current;
        setBusy(true);
        try {
            const rows: unknown[] = [];
            // Fetch every page: Supabase applies a default result limit.
            for (let offset = 0; ; offset += 500) {
                const { data, error } = await supabase.from("entries").select("*").eq("user_id", session.user.id).order("id").range(offset, offset + 499);
                if (error) throw error;
                rows.push(...(data || []));
                if (!data || data.length < 500) break;
            }
            ensureAccount(session.user.id);
            const next = journalFromCloud(rows, catalog);
            if (revision !== revisionRef.current) throw new Error("本机日记刚有改动，请重新确认覆盖。");
            localStorage.setItem(STORE + "-before-cloud", JSON.stringify({ version: 3, entries, catalog, sync: syncMeta }));
            setHasLocalBackup(true);
            if (!persist(next.entries, next.catalog, next.sync)) return;
            autoAttemptRef.current = syncSignature(session.user.id, syncPulse, next);
            setReplaceLocal(false);
            setCloudMessage("已用云端覆盖本机，覆盖前的备份已保存。");
        } catch (error) {
            setReplaceLocal(false);
            setCloudMessage(cloudError(error));
        } finally { setBusy(false); }
    };
    const exportLocalBackup = () => {
        try {
            const body = localStorage.getItem(STORE + "-before-cloud");
            if (!body) return;
            const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url; link.download = "芸窗-覆盖前本机备份.json"; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch { notify("备份读取失败，请重试。"); }
    };
    const cloudSync = useCallback(
        async (silent = false) => {
            if (!supabase || !session || !online || busy || signingOutRef.current || !accountAllowed) return;
            const revision = revisionRef.current;
            setBusy(true);
            if (!silent) setCloudMessage("正在核对本机与云端书页…");
            try {
                ensureAccount(session.user.id);
                let plan: SyncPlan | undefined;
                for (let attempt = 0; attempt < 2; attempt++) {
                    const { data, error } = await supabase
                        .from("entries")
                        .select("*")
                        .eq("user_id", session.user.id);
                    if (error) throw error;
                    plan = planSync(
                        { entries, catalog, sync: syncMeta },
                        validateCloudRows(data || [])
                    );
                    const userId = session.user.id;
                    let raced = false;
                    const newRows = plan.uploads
                        .filter((u) => !u.expectedUpdatedAt)
                        .map((u) => ({ ...u.row, user_id: userId }));
                    const edits = plan.uploads.filter((u) => u.expectedUpdatedAt);
                    // One insert for every new row, then the compare-and-set edits together: they target distinct ids.
                    ensureAccount(userId);
                    if (newRows.length) {
                        const { error: insertError } = await supabase
                            .from("entries")
                            .insert(newRows);
                        if (insertError) {
                            if (insertError.code === "23505") raced = true;
                            else throw insertError;
                        }
                    }
                    ensureAccount(userId);
                    if (!raced && edits.length) {
                        const db = supabase;
                        const results = await Promise.all(
                            edits.map((u) =>
                                db
                                    .from("entries")
                                    .update({ ...u.row, user_id: userId })
                                    .eq("id", u.row.id)
                                    .eq("user_id", userId)
                                    .eq("updated_at", u.expectedUpdatedAt!)
                                    .select("id")
                            )
                        );
                        for (const result of results) {
                            if (result.error) throw result.error;
                            if (!result.data?.length) raced = true;
                        }
                    }
                    if (!raced) break;
                    if (attempt === 1)
                        throw new Error("云端刚刚发生了新的修改，本机内容已保留，请再次同步。");
                }
                ensureAccount(session.user.id);
                if (!plan) throw new Error("无法生成同步计划。");
                if (revisionRef.current !== revision) {
                    setCloudMessage("同步期间又有新的本机改动，已保留并会在下一轮继续同步。");
                    return;
                }
                autoAttemptRef.current = syncSignature(session.user.id, syncPulse, plan.journal);
                if (!persist(plan.journal.entries, plan.journal.catalog, plan.journal.sync)) return;
                const notes = [
                    `已同步 ${plan.journal.entries.filter((e) => !isSample(e.id)).length} 篇日记`
                ];
                if (plan.conflicts) notes.push(`${plan.conflicts} 处冲突已另存副本`);
                if (plan.duplicates) notes.push(`${plan.duplicates} 条重复记录已合并`);
                const message = notes.join("，") + "。";
                setCloudMessage(message);
                if (silent && (plan.conflicts || plan.duplicates)) notify(message);
            } catch (e) {
                const message =
                    cloudError(e);
                setCloudMessage(
                    message.includes("deleted_at")
                        ? "请在 Supabase SQL Editor 运行 supabase/migrations/20260910_sync.sql，再重试同步。"
                        : message
                );
            } finally {
                setBusy(false);
            }
        },
        [session, online, busy, entries, catalog, syncMeta, storageError, syncPulse, accountAllowed]
    );
    useEffect(() => {
        if (!supabase || !session || !online || busy || signingOut || !accountAllowed || replaceLocal) return;
        const signature = syncSignature(session.user.id, syncPulse, { entries, sync: syncMeta });
        if (autoAttemptRef.current === signature) return;
        autoAttemptRef.current = signature;
        const timer = setTimeout(() => void cloudSync(true), 1200);
        return () => clearTimeout(timer);
    }, [session, online, busy, syncMeta, entries, cloudSync, syncPulse, replaceLocal, accountAllowed, signingOut]);
    const installApp = async () => {
        if (install) {
            await install.prompt();
            await install.userChoice;
            setInstall(null);
        } else {
            setSettings(true);
            setInstallMessage(
                "电脑：浏览器菜单中选择“安装芸窗”；iPhone：用 Safari 打开，分享 → 添加到主屏幕。需使用 HTTPS 或 localhost。"
            );
        }
    };
    const renderCards = () => {
        const asList = list || view === "calendar";
        // The masonry order is the entry's index in `filtered`, known here without searching for it.
        const columns = asList
            ? [filtered.map((e, i) => [e, i] as const)]
            : [
                  filtered.map((e, i) => [e, i] as const).filter(([, i]) => i % 2 === 0),
                  filtered.map((e, i) => [e, i] as const).filter(([, i]) => i % 2 === 1)
              ];
        return filtered.length ? (
            <div className={"entries-grid " + (asList ? "as-list" : "")}>
                {columns.map((column, i) => (
                    <div className="entry-column" key={i}>
                        {column.map(([e, order]) => (
                            <EntryCard
                                key={e.id}
                                order={order}
                                entry={e}
                                onOpen={() => setReading(e)}
                                onFavorite={() => favorite(e)}
                                list={asList}
                            />
                        ))}
                    </div>
                ))}
            </div>
        ) : (
            <div className="empty-state">
                <Sprout size={36} />
                <h3>{narrowed ? "没有找到符合条件的日记" : VIEWS[view].emptyHead}</h3>
                <p>{narrowed ? "换一个条件，或清除筛选。" : VIEWS[view].emptyBody}</p>
                <button
                    className="outline"
                    onClick={() => {
                        if (narrowed) clearFilters();
                        else if (view === "calendar") setMonth(thisMonth());
                        else if (view === "favorites") selectView("all");
                        else setEditing("new");
                    }}
                >
                    {narrowed ? "清除筛选" : VIEWS[view].emptyAction}
                </button>
            </div>
        );
    };
    const sectionTitle = selectedDate ? displayDate(selectedDate) : VIEWS[view].section;
    const filters = (
        <div className="active-filters">
            {query && (
                <button className="filter-chip" onClick={() => setQuery("")}>
                    搜索：{query}
                    <X size={13} />
                </button>
            )}
            {tag && (
                <button className="filter-chip" onClick={() => setTag("")}>
                    #{tag}
                    <X size={13} />
                </button>
            )}
            {mood && (
                <button className="filter-chip" onClick={() => setMood("")}>
                    心情：{mood}
                    <X size={13} />
                </button>
            )}
            {selectedDate && (
                <button className="filter-chip" onClick={() => setSelectedDate("")}>
                    {selectedDate}
                    <X size={13} />
                </button>
            )}
            {narrowed && (
                <button className="text-btn" onClick={clearFilters}>
                    清除全部
                </button>
            )}
        </div>
    );
    const listHeading = (
        <div className="section-heading">
            <div>
                <h2>{sectionTitle}</h2>
                <span>
                    {filtered.length} 篇{hasSamples ? " · 含示例" : ""}
                </span>
            </div>
            <div className="list-tools">
                <button
                    className="filter-trigger"
                    aria-expanded={showFilters}
                    aria-controls="diary-filters"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    筛选{(tag || mood) && <i />}
                    <ChevronDown size={15} />
                </button>
                {view !== "calendar" && (
                    <div className="view-toggle">
                        <button
                            aria-label="卡片视图"
                            aria-pressed={!list}
                            className={!list ? "active" : ""}
                            onClick={() => setList(false)}
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            aria-label="列表视图"
                            aria-pressed={list}
                            className={list ? "active" : ""}
                            onClick={() => setList(true)}
                        >
                            <List size={17} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
    return (
        <div className="app">
            {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} />}
            <aside className={"sidebar " + (mobileNav ? "mobile-open" : "")}>
                <a
                    className="brand"
                    href="/"
                    onClick={(e) => {
                        e.preventDefault();
                        selectView("all");
                    }}
                >
                    <img src="/icon.svg" alt="" />
                    <span>
                        <strong>芸窗</strong>
                        <em>Ephemera</em>
                    </span>
                </a>
                <div className="sidebar-intro">一扇窗，一本日记，一方心安。</div>
                <button
                    className="new-entry"
                    onClick={() => {
                        setEditing("new");
                        setMobileNav(false);
                    }}
                >
                    <Plus size={18} />
                    写一篇日记
                    <Feather size={17} />
                </button>
                <div className="nav-label">我的书页</div>
                <nav aria-label="主导航">
                    {VIEW_ORDER.map((id) => {
                        const Icon = VIEWS[id].icon;
                        return (
                            <button
                                key={id}
                                className={view === id ? "selected" : ""}
                                aria-current={view === id ? "page" : undefined}
                                onClick={() => selectView(id)}
                            >
                                <Icon size={18} />
                                <span>{VIEWS[id].title}{id === "drafts" && drafts.length > 0 ? " · " + drafts.length : ""}</span>
                            </button>
                        );
                    })}
                </nav>
                <button
                    className="organize-link"
                    onClick={() => {
                        setOrganizing(true);
                        setMobileNav(false);
                    }}
                >
                    <Tags size={18} />
                    <span>
                        整理书页<small>管理标签与心情</small>
                    </span>
                </button>
                <div className="sidebar-poem">
                    <Botanical small />
                    <p>
                        岁月不声不响，
                        <br />
                        而你落笔有光。
                    </p>
                    <span>Collect the little things.</span>
                </div>
                <div className="sidebar-bottom">
                    <button
                        onClick={() => {
                            setSettings(true);
                            setMobileNav(false);
                        }}
                    >
                        <Settings size={18} />
                        <span>
                            设置与备份
                            <small>
                                <i />
                                {online ? "本机保存" : "离线记录中"}
                            </small>
                        </span>
                    </button>
                </div>
            </aside>
            <div className="workspace">
                <header className="topbar">
                    <div className="breadcrumb">
                        <button
                            className="icon-btn mobile-menu"
                            aria-label="打开导航"
                            onClick={() => setMobileNav(true)}
                        >
                            <Menu size={21} />
                        </button>
                        <BookOpen size={16} />
                        <span>{VIEWS[view].crumb}</span>
                        <span className="breadcrumb-slash">/</span>
                        <span className="topbar-sub">记录生活，也照见自己</span>
                    </div>
                    <div className="topbar-actions">
                        <label className="search">
                            <Search size={16} />
                            <input
                                aria-label="搜索日记"
                                placeholder="寻找一段回忆…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            {query && (
                                <button aria-label="清除搜索" onClick={() => setQuery("")}>
                                    <X size={13} />
                                </button>
                            )}
                        </label>
                    </div>
                </header>
                {storageError && (
                    <div className="storage-warning" role="alert">
                        {storageError}
                        <button onClick={() => exportData(true)}>导出原始备份</button>
                    </div>
                )}
                {!online && (
                    <div className="offline-banner">
                        <WifiOff size={14} />
                        此刻离线，日记仍会保存在这台设备。
                    </div>
                )}
                {updateApp && (
                    <div className="offline-banner">
                        芸窗有新版本。请先收好正在写的日记。
                        <button onClick={() => updateApp(true)}>更新并重新打开</button>
                    </div>
                )}
                <main>
                    <header className="desk-heading">
                        <div>
                            <p>{headingDate}</p>
                            <h1>{VIEWS[view].h1}</h1>
                            <span>{VIEWS[view].sub}</span>
                        </div>
                        <div className="desk-heading-art" aria-hidden="true">
                            <Botanical />
                            <span>芸窗手记</span>
                        </div>
                    </header>
                    <div className={"journal-body " + (view === "calendar" ? "review-body" : "")}>
                        {view === "calendar" && (
                            <Calendar
                                month={month}
                                onMonthChange={(date) => {
                                    setMonth(date);
                                    setSelectedDate("");
                                }}
                                value={selectedDate}
                                onChange={(date) =>
                                    setSelectedDate((d) => (d === date ? "" : date))
                                }
                                entries={entries}
                            />
                        )}
                        {view === "drafts" ? <section className="diary-section draft-page">
                            <div className="section-heading"><div><h2>我的草稿 <Help label="草稿">草稿仅保存在这台设备，不参与云端同步。修改草稿不会改变原日记，直到点击保存日记。</Help></h2><span>{drafts.length} 篇</span></div>                    <div className="view-toggle">
                        <button
                            aria-label="卡片视图"
                            aria-pressed={!list}
                            className={!list ? "active" : ""}
                            onClick={() => setList(false)}
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            aria-label="列表视图"
                            aria-pressed={list}
                            className={list ? "active" : ""}
                            onClick={() => setList(true)}
                        >
                            <List size={17} />
                        </button>
                    </div></div>
                            <div className={"draft-list" + (list ? " draft-list-rows" : "")}>{drafts.filter(d => (d.title+d.body).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).map(d => <article className="draft-card" key={d.id}>
                                <div className="draft-meta"><span>{entries.some(e=>e.id===d.id) ? "修改中" : "尚未创建"}</span><time dateTime={d.updated_at}>{new Date(d.updated_at).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})} 更新</time></div>
                                <h3>{d.title || "未命名草稿"}</h3><p>{d.body || "还没写下正文"}</p>
                                <div className="draft-actions"><button className="text-btn" onClick={()=>setEditing(d)}><Pencil size={15}/>继续编辑</button><button className="icon-btn" aria-label={"丢弃草稿："+(d.title || "未命名草稿")} onClick={()=>setDiscardDraft(d.id)}><Trash2 size={16}/></button></div>
                            </article>)}
                            {!drafts.length && <div className="empty-state"><Pencil size={28}/><h3>没有未完成的草稿</h3><button className="text-btn" onClick={()=>setEditing("new")}>写一篇日记</button></div>}
                            {!!drafts.length && !drafts.some(d=>(d.title+d.body).toLowerCase().includes(query.toLowerCase())) && <p>没有找到匹配的草稿。</p>}
                            </div></section> : <section className="diary-section">
                            {listHeading}
                            {showFilters && (
                                <section
                                    className="diary-filters"
                                    id="diary-filters"
                                    aria-label="筛选日记"
                                >
                                    <div className="filter-group">
                                        <span>心情</span>
                                        <div className="choice-chips">
                                            <button
                                                aria-pressed={!mood}
                                                onClick={() => setMood("")}
                                            >
                                                全部
                                            </button>
                                            {moodOptions.map((m) => (
                                                <button
                                                    key={m}
                                                    aria-pressed={mood === m}
                                                    onClick={() => setMood(mood === m ? "" : m)}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="filter-group">
                                        <span>标签</span>
                                        <div className="choice-chips">
                                            <button aria-pressed={!tag} onClick={() => setTag("")}>
                                                全部
                                            </button>
                                            {tags.map((t) => (
                                                <button
                                                    key={t}
                                                    aria-pressed={tag === t}
                                                    onClick={() => setTag(tag === t ? "" : t)}
                                                >
                                                    #{t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        className="text-btn"
                                        onClick={() => setOrganizing(true)}
                                    >
                                        <Tags size={15} />
                                        管理标签与心情
                                    </button>
                                </section>
                            )}
                            {filters}
                            {renderCards()}
                            <p className="end-note">— 纸短情长，日子还在继续 —</p>
                        </section>}
                    </div>
                    <footer className="page-footer">
                        <span>芸窗 Ephemera</span>
                        <span>让每一个平凡的日子，有迹可循。</span>
                        <span>
                            <Cloud size={13} />
                            {session
                                ? online
                                    ? pendingSync
                                        ? `${pendingSync} 项待同步`
                                        : accountAllowed ? "云端已同步" : "同步已暂停"
                                    : "离线记录中"
                                : "文字存于本机"}
                        </span>
                    </footer>
                </main>
            </div>
            <nav className="mobile-bottom" aria-label="手机导航">
                {VIEW_ORDER.map((id) => {
                    const Icon = VIEWS[id].icon;
                    const button = (
                        <button
                            key={id}
                            className={view === id ? "active" : ""}
                            aria-current={view === id ? "page" : undefined}
                            onClick={() => selectView(id)}
                        >
                            <Icon size={19} />
                            {VIEWS[id].title}
                        </button>
                    );
                    // The write button sits between 回顾 and 珍藏, so emit it alongside the view it follows.
                    return id === "calendar"
                        ? [
                              button,
                              <button
                                  key="write"
                                  className="mobile-write"
                                  aria-label="写日记"
                                  onClick={() => setEditing("new")}
                              >
                                  <Plus size={24} />
                              </button>
                          ]
                        : button;
                })}
                <button onClick={() => setOrganizing(true)}>
                    <Tags size={19} />
                    整理
                </button>
            </nav>
            {discardDraft && <Confirm label="丢弃草稿" title="丢弃这份草稿？" confirm="丢弃草稿" cancel="继续保留" onCancel={()=>setDiscardDraft(null)} onConfirm={()=>{try{removeDraft(discardDraft);setDiscardDraft(null);}catch{notify("草稿移除失败，请重试。");}}}>只移除这份未保存的草稿，已保存的日记保留。</Confirm>}
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
                    <article className="reader">
                        <div className="reader-top">
                            <button className="text-btn" onClick={closeReader}>
                                <ArrowLeft size={16} />
                                回到书页
                            </button>
                            <div>
                                <button
                                    className="icon-btn"
                                    aria-label="编辑这篇日记"
                                    onClick={() => {
                                        setEditing(reading);
                                        setReading(null);
                                    }}
                                >
                                    <Pencil size={17} />
                                </button>
                                <button
                                    className="icon-btn"
                                    aria-label="收藏这篇日记"
                                    onClick={() => favorite(reading)}
                                >
                                    <Bookmark
                                        size={17}
                                        fill={reading.favorite ? "currentColor" : "none"}
                                    />
                                </button>
                                <button
                                    className="icon-btn"
                                    aria-label="删除这篇日记"
                                    onClick={() => setDeleteId(reading.id)}
                                >
                                    <Trash2 size={17} />
                                </button>
                                <button
                                    className="icon-btn"
                                    aria-label="关闭日记"
                                    onClick={closeReader}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        {reading.cover && (
                            <img className="reader-cover" src="/garden.jpg" alt="阳光透过森林" />
                        )}
                        <div className="reader-text">
                            <span className="reader-date">
                                {displayDate(reading.date)}　·　{reading.weather}　·　{reading.mood}
                            </span>
                            <h1>{reading.title}</h1>
                            <div className="reader-body">{reading.body}</div>
                            <div className="reader-tags">
                                {reading.tags.map((t) => (
                                    <span key={t}>#{t}</span>
                                ))}
                            </div>
                            <div className="reader-end">
                                <Leaf size={20} />
                                <span>{countWords(reading.body)} 字，都是生活的回声。</span>
                            </div>
                        </div>
                    </article>
                </Modal>
            )}
            {settings && (
                <Modal label="我的小天地" onClose={closeSettings}>
                    <section className="settings-panel">
                        <div className="dialog-heading">
                            <h2>设置</h2>
                            <button
                                className="icon-btn"
                                aria-label="关闭设置"
                                onClick={closeSettings}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="setting-section">
                            <h3>
                                <Cloud size={18} />
                                云端同步
                            </h3>
                            {!supabase ? (
                                <>
                                    <Help label="本机模式">
                                        当前为本机模式，日记保存在这个浏览器。清除浏览器数据会移除日记，请定期导出备份。
                                    </Help>
                                    <div className="connection-status">
                                        <i />
                                        尚未连接云端
                                    </div>
                                </>
                            ) : session ? (
                                <>
                                    <div className="account-row">
                                        <span>{session.user.email}</span>
                                        <button
                                            className="text-btn signout"
                                            disabled={busy || signingOut}
                                            onClick={async () => {
                                                if (signingOutRef.current) return;
                                                signingOutRef.current = true; setSigningOut(true);
                                                try {
                                                    const { error } = await supabase!.auth.signOut();
                                                    setCloudMessage(error ? cloudError(error) : "已退出，日记仍保留在本机。");
                                                } catch (error) { setCloudMessage(cloudError(error)); }
                                                finally { signingOutRef.current = false; setSigningOut(false); }
                                            }}
                                        >
                                            <LogOut size={14} />
                                            {signingOut ? "正在退出…" : "退出登录"}
                                        </button>
                                    </div>
                                    {!accountAllowed && <div className="cloud-message" role="status">{owner ? "本机日记已关联其他账号。请登录原账号后同步，本机内容仍可编辑。" : "请确认本机日记属于当前账号，再开启同步。"}{!owner && <button className="text-btn" onClick={() => setBindAccount(true)}>关联当前账号</button>}</div>}
                                    <Help label="同步">
                                        联网时自动合并本机与云端改动。离线编辑和删除会排队；同一篇在两台设备都修改时，本机版本会另存为「冲突副本」。
                                    </Help>
                                    <div className="connection-status">
                                        <i />
                                        {online
                                            ? pendingSync
                                                ? `${pendingSync} 项改动等待同步`
                                                : "暂无待上传改动"
                                            : `离线中 · ${pendingSync} 项改动待同步`}
                                    </div>
                                    <div className="button-row">
                                        <button
                                            className="outline"
                                            disabled={busy || !online || signingOut || !accountAllowed}
                                            onClick={() => void cloudSync()}
                                        >
                                            <Upload size={15} />
                                            {busy ? "正在同步…" : "立即同步"}
                                        </button>
                                        <button className="outline" disabled={busy || !online || signingOut || !accountAllowed || !!storageError} onClick={() => setReplaceLocal(true)}><Download size={15}/>用云端覆盖本机</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Help label="登录">
                                        使用邮箱登录；登录后，日记会在自己的设备间自动同步。
                                    </Help>
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            void auth();
                                        }}
                                    >
                                        <input
                                            type="email"
                                            required
                                            aria-label="登录邮箱"
                                            placeholder="你的邮箱地址"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                        <button className="primary" disabled={busy || !online}>
                                            <Mail size={16} />
                                            {busy ? "正在发送…" : "发送登录链接"}
                                        </button>
                                    </form>
                                </>
                            )}
                            {hasLocalBackup && <button className="text-btn" onClick={exportLocalBackup}>导出覆盖前备份</button>}
                            {cloudMessage && (
                                <p className="cloud-message" role="status">
                                    {cloudMessage}
                                </p>
                            )}
                        </div>
                        <div className="setting-section">
                            <h3>
                                <BookOpen size={18} />
                                带走你的文字
                                <Help label="备份">
                                    导出完整 JSON 备份；导入时按日记 ID
                                    合并，删除记录和同步状态也会保留。
                                </Help>
                            </h3>
                            <div className="button-row">
                                <button className="outline" onClick={() => exportData()}>
                                    <Download size={16} />
                                    导出日记
                                </button>
                                <button
                                    className="outline"
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <Upload size={16} />
                                    导入备份
                                </button>
                                {storageError && (
                                    <button className="outline" onClick={() => exportData(true)}>
                                        导出原始备份
                                    </button>
                                )}
                            </div>
                            <input
                                ref={fileRef}
                                hidden
                                type="file"
                                accept="application/json,.json"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void importData(file);
                                    e.target.value = "";
                                }}
                            />
                        </div>
                        <div className="setting-section">
                            <h3>
                                <MonitorSmartphone size={18} />
                                随时打开芸窗
                                <Help label="安装">
                                    支持电脑和手机。首次在线打开后，已缓存的应用可离线使用。iPhone
                                    请在 Safari 分享菜单中选择「添加到主屏幕」。
                                </Help>
                            </h3>
                            <button className="outline" onClick={installApp}>
                                <Plus size={16} />
                                {install ? "安装芸窗" : "查看安装方式"}
                            </button>
                            {installMessage && (
                                <p className="cloud-message" role="status">
                                    {installMessage}
                                </p>
                            )}
                        </div>
                        {hasSamples && (
                            <div className="setting-section">
                                <h3>
                                    <Sprout size={18} />
                                    从自己的故事开始
                                    <Help label="示例">
                                        书桌上的几篇文字是示例，帮助你感受芸窗。
                                    </Help>
                                </h3>
                                <button
                                    className="text-btn"
                                    onClick={() => {
                                        if (
                                            persist(
                                                entries.filter((e) => !e.id.startsWith("sample-"))
                                            )
                                        )
                                            notify("示例已收起，书页留给你的故事。");
                                    }}
                                >
                                    清除示例日记
                                </button>
                            </div>
                        )}
                        <div className="setting-section">
                            <h3>
                                <Trash2 size={18} />
                                回收站 <small>{trash.length}</small>
                                <Help label="回收站">
                                    删除只收起书页，完整内容保留，恢复后会同步。
                                </Help>
                            </h3>
                            <button
                                className="text-btn empty-trash"
                                disabled={!trash.length || busy}
                                onClick={() => setEmptyTrash(true)}
                            >
                                清空回收站
                            </button>
                            <div className="recycle-list">
                                {trash.length ? (
                                    trash.map((t) => (
                                        <div className="recycle-row" key={t.entry.id}>
                                            <div>
                                                <strong>{t.entry.title || "无题"}</strong>
                                                <small>{t.entry.date}</small>
                                            </div>
                                            <button
                                                className="outline"
                                                onClick={() => {
                                                    if (
                                                        persist([
                                                            {
                                                                ...t.entry,
                                                                updated_at: new Date().toISOString()
                                                            },
                                                            ...entries.filter(
                                                                (e) => e.id !== t.entry.id
                                                            )
                                                        ])
                                                    )
                                                        notify("日记已恢复。");
                                                }}
                                            >
                                                恢复
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p>暂无收起的书页</p>
                                )}
                            </div>
                        </div>
                        <div className="settings-signature">
                            芸窗 · Ephemera <span>版本 0.2</span>
                        </div>
                    </section>
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
            {bindAccount && session && <Confirm label="关联账号" title="将本机日记关联此账号？" cancel="暂不关联" confirm="关联并开启同步" onCancel={() => setBindAccount(false)} onConfirm={() => {
                try { localStorage.setItem(STORE + '-owner', session.user.id); setOwner(session.user.id); setBindAccount(false); setCloudMessage("已关联当前账号。"); }
                catch { setCloudMessage("无法保存账号关联，请检查浏览器存储权限。"); }
            }}>确认这些本机日记属于 {session.user.email}。关联后会与该账号的云端日记同步。</Confirm>}
            {replaceLocal && <Confirm label="用云端覆盖本机" title="用云端覆盖本机？" cancel="取消" confirm="确认覆盖本机" disabled={busy || !online} onCancel={closeReplaceLocal} onConfirm={() => void overwriteFromCloud()}>
                云端的日记与回收站将替换本机数据，包括重新取回本机清空过的回收站项目。本机未同步的改动将被替换，覆盖前会自动保留一份本机备份。云端内容不会更改。
            </Confirm>}
            {emptyTrash && (
                <Confirm
                    label="清空回收站"
                    title="清空回收站？"
                    cancel="取消"
                    confirm="清空本机回收站"
                    disabled={busy}
                    onCancel={closeEmptyTrash}
                    onConfirm={() => {
                        if (persist(entries, catalog, purgeTrash(syncMeta))) {
                            setEmptyTrash(false);
                            notify("回收站已清空。");
                        }
                    }}
                >
                    仅清理这台设备回收站中的 {trash.length}{" "}
                    篇日记。云端与其他设备的内容保留；尚未同步的删除会先完成软删除同步，再清理本机副本。
                </Confirm>
            )}
            {toast && (
                <div className="toast" role="status">
                    <Check size={17} />
                    {toast}
                    <button className="icon-btn" aria-label="关闭提示" onClick={() => setToast("")}>
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
