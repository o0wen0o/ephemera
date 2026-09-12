import { ChevronDown, LayoutGrid, List as ListIcon } from "lucide-react";
import { ActiveFilters } from "./ActiveFilters";
import { EntryGrid } from "./EntryGrid";
import { FilterPanel } from "./FilterPanel";
import { VIEWS, type View } from "../../app/views";
import type { Filters } from "../../app/useFilters";
import { displayDate, type Entry } from "../../data/data";

type Props = {
    view: View;
    filters: Filters;
    entries: Entry[];
    tags: string[];
    moods: string[];
    list: boolean;
    onListChange: (list: boolean) => void;
    showFilters: boolean;
    onShowFiltersChange: (show: boolean) => void;
    hasSamples: boolean;
    userId?: string;
    onOpen: (entry: Entry) => void;
    onFavorite: (entry: Entry) => void;
    onOrganize: () => void;
    onEmptyAction: () => void;
};

/** The desk itself: what is on it, how it is narrowed, and how it is laid out. */
export function JournalSection({
    view,
    filters,
    entries,
    tags,
    moods,
    list,
    onListChange,
    showFilters,
    onShowFiltersChange,
    hasSamples,
    userId,
    onOpen,
    onFavorite,
    onOrganize,
    onEmptyAction
}: Props) {
    // The calendar view always reads as a list, whatever the card toggle says.
    const asList = list || view === "calendar";
    const sectionTitle = filters.selectedDate
        ? displayDate(filters.selectedDate)
        : VIEWS[view].section;
    return (
        <section className="diary-section">
            <div className="section-heading">
                <div>
                    <h2>{sectionTitle}</h2>
                    <span>
                        {entries.length} 篇{hasSamples ? " · 含示例" : ""}
                    </span>
                </div>
                <div className="list-tools">
                    <button
                        className="filter-trigger"
                        aria-expanded={showFilters}
                        aria-controls="diary-filters"
                        onClick={() => onShowFiltersChange(!showFilters)}
                    >
                        筛选{(filters.tag || filters.mood) && <i />}
                        <ChevronDown size={15} />
                    </button>
                    {view !== "calendar" && (
                        <div className="view-toggle">
                            <button
                                aria-label="卡片视图"
                                aria-pressed={!list}
                                className={!list ? "active" : ""}
                                onClick={() => onListChange(false)}
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                aria-label="列表视图"
                                aria-pressed={list}
                                className={list ? "active" : ""}
                                onClick={() => onListChange(true)}
                            >
                                <ListIcon size={17} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {showFilters && (
                <FilterPanel filters={filters} tags={tags} moods={moods} onOrganize={onOrganize} />
            )}
            <ActiveFilters filters={filters} />
            <EntryGrid
                entries={entries}
                list={asList}
                view={view}
                narrowed={filters.narrowed}
                userId={userId}
                onOpen={onOpen}
                onFavorite={onFavorite}
                onEmptyAction={onEmptyAction}
            />
            <p className="end-note">— 纸短情长，日子还在继续 —</p>
        </section>
    );
}
