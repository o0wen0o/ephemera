import { ArrowLeft, Bookmark, Leaf, Pencil, Trash2, X } from "lucide-react";
import { Help } from "../../components/Help";
import { Photos } from "./Photos";
import { countWords, displayDate, displayStamp, type Entry } from "../../data/data";

type Props = {
    entry: Entry;
    userId?: string;
    onClose: () => void;
    onEdit: () => void;
    onFavorite: () => void;
    onDelete: () => void;
};

/** One entry opened full width, with the actions that belong to that single page. */
export function Reader({ entry, userId, onClose, onEdit, onFavorite, onDelete }: Props) {
    return (
        <article className="reader">
            <div className="reader-top">
                <button className="text-btn" onClick={onClose}>
                    <ArrowLeft size={16} />
                    回到书页
                </button>
                <div>
                    <button className="icon-btn" aria-label="编辑这篇日记" onClick={onEdit}>
                        <Pencil size={17} />
                    </button>
                    <button className="icon-btn" aria-label="收藏这篇日记" onClick={onFavorite}>
                        <Bookmark size={17} fill={entry.favorite ? "currentColor" : "none"} />
                    </button>
                    <button className="icon-btn" aria-label="删除这篇日记" onClick={onDelete}>
                        <Trash2 size={17} />
                    </button>
                    <button className="icon-btn" aria-label="关闭日记" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
            </div>
            {entry.cover && <img className="reader-cover" src="/garden.jpg" alt="阳光透过森林" />}
            <div className="reader-text">
                <span className="reader-date">
                    {displayDate(entry.date)}　·　{entry.weather}　·　{entry.mood}
                </span>
                <h1>{entry.title}</h1>
                <div className="reader-body">{entry.body}</div>
                <Photos paths={entry.images} userId={userId} />
                <div className="reader-tags">
                    {entry.tags.map((t) => (
                        <span key={t}>#{t}</span>
                    ))}
                </div>
                <div className="reader-end">
                    <Leaf size={20} />
                    <span>{countWords(entry.body)} 字，都是生活的回声。</span>
                    <Help label="时间">
                        {entry.created_at && <span>写于 {displayStamp(entry.created_at)}</span>}
                        <span>更新于 {displayStamp(entry.updated_at)}</span>
                    </Help>
                </div>
            </div>
        </article>
    );
}
