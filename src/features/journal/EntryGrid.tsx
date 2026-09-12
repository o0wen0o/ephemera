import { Sprout } from "lucide-react";
import { EntryCard } from "./EntryCard";
import { VIEWS, type View } from "../../app/views";
import type { Entry } from "../../data/data";

type Props = {
    entries: Entry[];
    list: boolean;
    view: View;
    narrowed: boolean;
    userId?: string;
    onOpen: (entry: Entry) => void;
    onFavorite: (entry: Entry) => void;
    onEmptyAction: () => void;
};

/** Two independently flowing columns unless the reader asked for a single list. */
export function EntryGrid({
    entries,
    list,
    view,
    narrowed,
    userId,
    onOpen,
    onFavorite,
    onEmptyAction
}: Props) {
    // The masonry order is the entry's index in `entries`, known here without searching for it.
    const columns = list
        ? [entries.map((e, i) => [e, i] as const)]
        : [
              entries.map((e, i) => [e, i] as const).filter(([, i]) => i % 2 === 0),
              entries.map((e, i) => [e, i] as const).filter(([, i]) => i % 2 === 1)
          ];
    return entries.length ? (
        <div className={"entries-grid " + (list ? "as-list" : "")}>
            {columns.map((column, i) => (
                <div className="entry-column" key={i}>
                    {column.map(([e, order]) => (
                        <EntryCard
                            key={e.id}
                            order={order}
                            entry={e}
                            userId={userId}
                            onOpen={() => onOpen(e)}
                            onFavorite={() => onFavorite(e)}
                            list={list}
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
            <button className="outline" onClick={onEmptyAction}>
                {narrowed ? "清除筛选" : VIEWS[view].emptyAction}
            </button>
        </div>
    );
}
