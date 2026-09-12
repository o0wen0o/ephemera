import { Tags } from "lucide-react";
import type { Filters } from "../../app/useFilters";

type Props = {
    filters: Filters;
    tags: string[];
    moods: string[];
    onOrganize: () => void;
};

/** The expandable drawer of every mood and tag the journal knows about. */
export function FilterPanel({ filters, tags, moods, onOrganize }: Props) {
    const { tag, setTag, mood, setMood } = filters;
    return (
        <section className="diary-filters" id="diary-filters" aria-label="筛选日记">
            <div className="filter-group">
                <span>心情</span>
                <div className="choice-chips">
                    <button aria-pressed={!mood} onClick={() => setMood("")}>
                        全部
                    </button>
                    {moods.map((m) => (
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
            <button className="text-btn" onClick={onOrganize}>
                <Tags size={15} />
                管理标签与心情
            </button>
        </section>
    );
}
