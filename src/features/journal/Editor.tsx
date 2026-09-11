import { Photos } from "./Photos";
import { Help } from "../../components/Help";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Plus, Save, X } from "lucide-react";
import { type Entry, countWords, localDate } from "../../data/data";
import { moodGlyph, weatherOptions } from "../../data/entryMeta";
import { cleanName, NAME_LIMIT, validName } from "../../data/journal";
import { DatePicker } from "../../components/Calendar";

import { readDrafts, putDraft, removeDraft } from "../../data/drafts";

export function Editor({
    entry,
    photoUserId,
    photoBusy,
    onPhotoBusy,
    tags,
    moods,
    onClose,
    onSave
}: {
    entry?: Entry;
    photoUserId?: string;
    photoBusy: boolean;
    onPhotoBusy: (busy: boolean) => void;
    tags: string[];
    moods: string[];
    onClose: () => void;
    onSave: (entry: Entry) => boolean;
}) {
    const [value, setValue] = useState<Entry>(() => {
        try {
            const draft = entry && readDrafts().find((d) => d.id === entry.id);
            if (draft) return draft;
        } catch {
            /* Start from the saved entry when draft storage is unavailable. */
        }
        return entry
            ? { ...entry }
            : {
                  id: crypto.randomUUID(),
                  title: "",
                  body: "",
                  date: localDate(),
                  mood: "",
                  weather: "晴天",
                  tags: [],
                  favorite: false,
                  updated_at: new Date().toISOString()
              };
    });
    const [tagQuery, setTagQuery] = useState("");
    const [saved, setSaved] = useState("");
    const [error, setError] = useState("");
    const [dirty, setDirty] = useState(false);
    const titleRef = useRef<HTMLInputElement>(null);
    const update = (part: Partial<Entry>) => {
        const next = { ...value, ...part, updated_at: new Date().toISOString() };
        setValue(next);
        try {
            putDraft(next);
            setSaved("草稿已保存 · 本机");
        } catch {
            setSaved("草稿保存失败，请勿关闭页面");
        }
        setDirty(true);
        setError("");
    };
    useEffect(() => {
        titleRef.current?.focus();
    }, []);
    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => {
            if (dirty) e.preventDefault();
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);
    const addTag = (raw: string) => {
        const name = cleanName(raw);
        if (!name) return;
        if (!validName(name)) {
            setError(`标签请使用 1–${NAME_LIMIT} 个字，不含逗号。`);
            return;
        }
        if (value.tags.includes(name)) {
            setTagQuery("");
            return;
        }
        if (value.tags.length >= 8) {
            setError("一篇日记最多添加 8 个标签。");
            return;
        }
        update({ tags: [...value.tags, name] });
        setTagQuery("");
    };
    const submit = () => {
        if (photoBusy) return;
        if (!value.title.trim() && !value.body.trim() && !value.images?.length) {
            setError("写下一句话，再把今天收好。");
            return;
        }
        if (tagQuery.trim()) {
            setError("请先添加或清空正在输入的标签。");
            return;
        }
        if (
            onSave({
                ...value,
                title: value.title.trim() || "无题",
                updated_at: new Date().toISOString()
            })
        ) {
            setDirty(false);
            try {
                removeDraft(value.id);
            } catch {
                /* The diary itself is saved. */
            }
            onClose();
        }
    };
    const needle = tagQuery.toLocaleLowerCase();
    const suggestions = tags.filter(
        (t) => !value.tags.includes(t) && t.toLocaleLowerCase().includes(needle)
    );
    // Keep showing a mood the entry still carries after it was removed from the catalog.
    const availableMoods =
        value.mood && !moods.includes(value.mood) ? [...moods, value.mood] : moods;
    return (
        <section className="editor writing-sheet" aria-label="写日记">
            <div className="editor-top">
                <button type="button" className="text-btn" onClick={onClose}>
                    <ArrowLeft size={17} />
                    返回书页
                </button>
                <span className="draft-status" role="status">
                    <Check size={13} />
                    {saved}
                </span>
            </div>
            <div className="editor-paper">
                <div className="writing-date">
                    <DatePicker value={value.date} onChange={(date) => update({ date })} />
                </div>
                <label className="sr-only" htmlFor="entry-title">
                    日记标题
                </label>
                <input
                    ref={titleRef}
                    id="entry-title"
                    className="title-input"
                    placeholder="为今天，起一个名字"
                    value={value.title}
                    onChange={(e) => update({ title: e.target.value })}
                    maxLength={120}
                />
                <label className="sr-only" htmlFor="entry-body">
                    日记正文
                </label>
                <textarea
                    id="entry-body"
                    className="body-input"
                    placeholder={"此刻，你想留下什么？\n\n一阵风，一次相遇，或一件微不足道的小事……"}
                    value={value.body}
                    onChange={(e) => update({ body: e.target.value })}
                />
                <Photos
                    paths={value.images}
                    userId={photoUserId}
                    onBusy={onPhotoBusy}
                    onChange={(images) => update({ images })}
                />
                <div className="writing-details">
                    <fieldset>
                        <legend>窗外天气</legend>
                        <div className="choice-chips">
                            {weatherOptions.map((w) => (
                                <button
                                    type="button"
                                    key={w.name}
                                    aria-pressed={value.weather === w.name}
                                    onClick={() => update({ weather: w.name })}
                                >
                                    <w.icon size={16} />
                                    {w.name}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    <fieldset>
                        <legend>
                            此刻心情{" "}
                            <Help label="心情">可不选，再次点击取消；在整理书页中管理心情。</Help>
                        </legend>
                        <div className="choice-chips">
                            {availableMoods.map((m) => (
                                <button
                                    type="button"
                                    key={m}
                                    aria-pressed={value.mood === m}
                                    onClick={() => update({ mood: value.mood === m ? "" : m })}
                                >
                                    <span aria-hidden="true">{moodGlyph(m)}</span>
                                    {m}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    <fieldset>
                        <legend>
                            生活标签 <span>{value.tags.length} / 8</span>
                            <Help label="标签">输入名字后点击加号添加；在整理书页中统一管理。</Help>
                        </legend>
                        <div className="selected-tags">
                            {value.tags.map((t) => (
                                <button
                                    type="button"
                                    key={t}
                                    aria-label={`移除标签${t}`}
                                    onClick={() =>
                                        update({ tags: value.tags.filter((n) => n !== t) })
                                    }
                                >
                                    #{t}
                                    <X size={13} />
                                </button>
                            ))}
                        </div>
                        <div className="tag-entry">
                            <input
                                aria-label="搜索或新建标签"
                                placeholder="搜索标签，或输入新名字…"
                                maxLength={NAME_LIMIT}
                                value={tagQuery}
                                onChange={(e) => setTagQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        addTag(tagQuery);
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="icon-btn"
                                aria-label="添加输入的标签"
                                disabled={!tagQuery.trim()}
                                onClick={() => addTag(tagQuery)}
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="tag-suggestions">
                            {suggestions.slice(0, 12).map((t) => (
                                <button type="button" key={t} onClick={() => addTag(t)}>
                                    + {t}
                                </button>
                            ))}
                            {tagQuery.trim() &&
                                !tags.includes(cleanName(tagQuery)) &&
                                !value.tags.includes(cleanName(tagQuery)) && (
                                    <button
                                        type="button"
                                        className="create-tag"
                                        onClick={() => addTag(tagQuery)}
                                    >
                                        新建「{cleanName(tagQuery)}」
                                    </button>
                                )}
                        </div>
                    </fieldset>
                </div>
            </div>
            <footer className="editor-footer">
                <span>{countWords(value.body)} 字</span>
                <button type="button" className="primary" disabled={photoBusy} onClick={submit}>
                    <Save size={16} />
                    保存日记
                </button>
                {error && (
                    <p className="field-error" role="alert">
                        {error}
                    </p>
                )}
            </footer>
        </section>
    );
}
