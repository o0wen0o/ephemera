import { Help } from "../../components/Help";
import { useMemo, useState } from "react";
import { Check, Hash, Heart, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { cleanName, NAME_LIMIT, validName, type CollectionKind } from "../../data/journal";
import type { Entry } from "../../data/data";

// One table per collection kind, so a third kind is a new entry here rather than eight ternaries.
const KINDS = {
    tags: {
        label: "标签",
        icon: Hash,
        names: (e: Entry) => e.tags,
        help: "改名会更新相关日记；改成已有名称可以合并标签。"
    },
    moods: {
        label: "心情",
        icon: Heart,
        names: (e: Entry) => [e.mood],
        help: "可以添加自己的心情。移除后，相关日记的心情会留空。"
    }
} satisfies Record<CollectionKind, unknown>;

export function CollectionManager({
    tags,
    moods,
    entries,
    onChange,
    onClose
}: {
    tags: string[];
    moods: string[];
    entries: Entry[];
    onChange: (kind: CollectionKind, from: string | null, to: string | null) => boolean;
    onClose: () => void;
}) {
    const [kind, setKind] = useState<CollectionKind>("tags");
    const [search, setSearch] = useState("");
    const [name, setName] = useState("");
    const [editing, setEditing] = useState<string | null>(null);
    const [rename, setRename] = useState("");
    const [error, setError] = useState("");
    const [confirm, setConfirm] = useState<{ from: string; to: string | null } | null>(null);
    const { label, icon: KindIcon, help, names: fieldOf } = KINDS[kind];
    const names = kind === "tags" ? tags : moods;
    const needle = search.toLocaleLowerCase();
    const matching = names.filter((n) => n.toLocaleLowerCase().includes(needle));
    // One pass over the diary instead of a full scan per rendered row.
    const counts = useMemo(() => {
        const byName = new Map<string, number>();
        for (const entry of entries)
            for (const name of fieldOf(entry))
                if (name) byName.set(name, (byName.get(name) ?? 0) + 1);
        return byName;
    }, [entries, fieldOf]);
    const count = (n: string) => counts.get(n) ?? 0;
    const change = (from: string | null, to: string | null) => {
        if (onChange(kind, from, to)) {
            setConfirm(null);
            setEditing(null);
            setName("");
            setError("");
        }
    };
    const validate = (n: string) => {
        if (!validName(n)) {
            setError(`请填写 1–${NAME_LIMIT} 个字，不含逗号。`);
            return false;
        }
        setError("");
        return true;
    };
    return (
        <section className="collections">
            <div className="dialog-heading">
                <div>
                    <h2>整理书页</h2>
                    <p>给你的生活，留一些自己的名字。</p>
                </div>
                <button type="button" className="icon-btn" aria-label="关闭整理" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>
            <div className="collection-tabs" aria-label="分类类型">
                {(Object.keys(KINDS) as CollectionKind[]).map((k) => {
                    const Icon = KINDS[k].icon;
                    return (
                        <button
                            type="button"
                            key={k}
                            aria-pressed={kind === k}
                            onClick={() => {
                                setKind(k);
                                setEditing(null);
                                setConfirm(null);
                                setSearch("");
                                setName("");
                                setError("");
                            }}
                        >
                            <Icon size={17} /> {KINDS[k].label}
                            <small>{(k === "tags" ? tags : moods).length}</small>
                        </button>
                    );
                })}
            </div>
            <div className="collection-help">
                <Help label="分类管理">{help}</Help>
            </div>
            <form
                className="collection-create"
                onSubmit={(e) => {
                    e.preventDefault();
                    const next = cleanName(name);
                    if (!validate(next)) return;
                    if (names.includes(next)) {
                        setError("这个名称已经存在。");
                        return;
                    }
                    change(null, next);
                }}
            >
                <input
                    aria-label={`新${label}名称`}
                    maxLength={NAME_LIMIT}
                    placeholder={`添加一个${label}…`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <button type="submit" className="primary" disabled={!name.trim()}>
                    <Plus size={16} />
                    添加
                </button>
            </form>
            {error && (
                <p className="field-error" role="alert">
                    {error}
                </p>
            )}
            <label className="collection-search">
                <Search size={15} />
                <input
                    aria-label={`查找${label}`}
                    placeholder={`查找${label}`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </label>
            <div className="collection-list">
                {matching.map((n) => (
                    <div className="collection-row" key={n}>
                        {editing === n ? (
                            <form
                                className="rename-form"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const next = cleanName(rename);
                                    if (!validate(next)) return;
                                    if (next === n) {
                                        setEditing(null);
                                        return;
                                    }
                                    if (names.includes(next)) setConfirm({ from: n, to: next });
                                    else change(n, next);
                                }}
                            >
                                <input
                                    autoFocus
                                    aria-label={`重命名${n}`}
                                    maxLength={NAME_LIMIT}
                                    value={rename}
                                    onChange={(e) => setRename(e.target.value)}
                                />
                                <button type="submit" className="icon-btn" aria-label="保存名称">
                                    <Check size={18} />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label="取消改名"
                                    onClick={() => {
                                        setEditing(null);
                                        setConfirm(null);
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </form>
                        ) : (
                            <div className="collection-row-main">
                                <span className="collection-name">
                                    <KindIcon size={15} />
                                    <strong>{n}</strong>
                                </span>
                                <small>{count(n)} 篇日记</small>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label={`重命名${n}`}
                                    onClick={() => {
                                        setEditing(n);
                                        setRename(n);
                                        setConfirm(null);
                                    }}
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label={`移除${n}`}
                                    onClick={() => {
                                        setEditing(null);
                                        setConfirm({ from: n, to: null });
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                        {confirm?.from === n && (
                            <div className="collection-confirm">
                                <p>
                                    {confirm.to
                                        ? `将「${n}」合并到「${confirm.to}」？`
                                        : `移除${label}「${n}」？`}
                                    <br />
                                    {count(n)} 篇日记会更新，正文保留。
                                </p>
                                <div>
                                    <button
                                        type="button"
                                        className="outline"
                                        onClick={() => setConfirm(null)}
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="button"
                                        className="primary"
                                        onClick={() => change(confirm.from, confirm.to)}
                                    >
                                        {confirm.to ? "确认合并" : "确认移除"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {!matching.length && (
                    <p className="collection-empty">
                        {search ? "没有找到，试试其他名字。" : `还没有${label}，在上方添加一个。`}
                    </p>
                )}
            </div>
        </section>
    );
}
