import { useMemo, useState } from "react";
import { localDate, thisMonth, type Entry } from "../data/data";
import type { View } from "./views";

export type Filters = ReturnType<typeof useFilters>;

/** Search, tag, mood and day narrow the desk; the month only applies to the calendar view. */
export function useFilters() {
    const [query, setQuery] = useState("");
    const [tag, setTag] = useState("");
    const [mood, setMood] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [month, setMonth] = useState(thisMonth);
    const clear = () => {
        setQuery("");
        setTag("");
        setMood("");
        setSelectedDate("");
    };
    return {
        query,
        setQuery,
        tag,
        setTag,
        mood,
        setMood,
        selectedDate,
        setSelectedDate,
        month,
        setMonth,
        clear,
        narrowed: Boolean(query || tag || mood || selectedDate)
    };
}

/** The entries the current view and filters leave on the desk, newest first. */
export function useFilteredEntries(entries: Entry[], view: View, filters: Filters) {
    const { query, tag, mood, selectedDate, month } = filters;
    return useMemo(() => {
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
}
