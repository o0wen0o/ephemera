import { Bookmark, Image as ImageIcon } from "lucide-react";
import { asDate, type Entry } from "../../data/data";
import { moodGlyph, weatherIcon } from "../../data/entryMeta";
import { PhotoStrip } from "./Photos";
export function EntryCard({
    entry,
    onOpen,
    onFavorite,
    userId,
    list = false,
    order = 0
}: {
    entry: Entry;
    order?: number;
    onOpen: () => void;
    onFavorite: () => void;
    userId?: string;
    list?: boolean;
}) {
    const d = asDate(entry.date);
    const WeatherIcon = weatherIcon(entry.weather);
    const photos = entry.images?.length || 0;
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
                            {photos > 0 && (
                                <span className="photo-mark">
                                    <ImageIcon size={12} /> {photos} 张
                                </span>
                            )}
                            <WeatherIcon size={13} /> {entry.weather}
                        </span>
                    </div>
                    <h3>{entry.title}</h3>
                    <p>{entry.body}</p>
                </div>
            </button>
            <div className="card-footer">
                <div className="entry-tags">
                    {photos > 0 && <PhotoStrip paths={entry.images} userId={userId} />}
                    <span className="mood-tag">
                        {entry.mood ? moodGlyph(entry.mood) : ""} {entry.mood || "未标记心情"}
                    </span>
                    {entry.tags.slice(0, 2).map((t) => (
                        <span className="tag-chip" key={t}>#{t}</span>
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
