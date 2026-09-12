import { X } from "lucide-react";
import type { Filters } from "../../app/useFilters";

/** Every narrowing currently in force, each removable on its own. */
export function ActiveFilters({ filters }: { filters: Filters }) {
    const { query, setQuery, tag, setTag, mood, setMood, selectedDate, setSelectedDate } = filters;
    return (
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
            {filters.narrowed && (
                <button className="text-btn" onClick={filters.clear}>
                    清除全部
                </button>
            )}
        </div>
    );
}
