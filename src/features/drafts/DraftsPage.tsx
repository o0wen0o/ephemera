import { LayoutGrid, List, Pencil, Trash2 } from "lucide-react";
import { Help } from "../../components/Help";
import type { Entry } from "../../data/data";
export function DraftsPage({
    drafts,
    entries,
    query,
    list,
    setList,
    setEditing,
    setDiscardDraft
}: {
    drafts: Entry[];
    entries: Entry[];
    query: string;
    list: boolean;
    setList: (list: boolean) => void;
    setEditing: (entry: Entry | "new") => void;
    setDiscardDraft: (id: string) => void;
}) {
    return (
        <section className="diary-section draft-page">
            <div className="section-heading">
                <div>
                    <h2>
                        我的草稿{" "}
                        <Help label="草稿">
                            草稿只存在这台设备，不会同步。点击保存日记后，原日记才会更新。
                        </Help>
                    </h2>
                    <span>{drafts.length} 篇</span>
                </div>{" "}
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
            </div>
            <div className={"draft-list" + (list ? " draft-list-rows" : "")}>
                {drafts
                    .filter((d) => (d.title + d.body).toLowerCase().includes(query.toLowerCase()))
                    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                    .map((d) => (
                        <article className="draft-card" key={d.id}>
                            <div className="draft-meta">
                                <span>
                                    {entries.some((e) => e.id === d.id) ? "修改中" : "尚未创建"}
                                </span>
                                <time dateTime={d.updated_at}>
                                    {new Date(d.updated_at).toLocaleString("zh-CN", {
                                        month: "long",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit"
                                    })}{" "}
                                    更新
                                </time>
                            </div>
                            <h3>{d.title || "未命名草稿"}</h3>
                            <p>{d.body || "还没写下正文"}</p>
                            <div className="draft-actions">
                                <button className="text-btn" onClick={() => setEditing(d)}>
                                    <Pencil size={15} />
                                    继续编辑
                                </button>
                                <button
                                    className="icon-btn"
                                    aria-label={"丢弃草稿：" + (d.title || "未命名草稿")}
                                    onClick={() => setDiscardDraft(d.id)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </article>
                    ))}
                {!drafts.length && (
                    <div className="empty-state">
                        <Pencil size={28} />
                        <h3>没有未完成的草稿</h3>
                        <button className="text-btn" onClick={() => setEditing("new")}>
                            写一篇日记
                        </button>
                    </div>
                )}
                {!!drafts.length &&
                    !drafts.some((d) =>
                        (d.title + d.body).toLowerCase().includes(query.toLowerCase())
                    ) && <p>没有找到匹配的草稿。</p>}
            </div>
        </section>
    );
}
