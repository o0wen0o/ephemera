import { useEffect, useRef, useState } from "react";
import { readDrafts } from "../data/drafts";
import type { Entry } from "../data/data";

/** Drafts live in their own storage key, so mirror them here and follow other tabs. */
export function useDrafts(notify: (message: string) => void) {
    const [drafts, setDrafts] = useState<Entry[]>(() => {
        try {
            return readDrafts();
        } catch {
            return [];
        }
    });
    const notifyRef = useRef(notify);
    notifyRef.current = notify;
    useEffect(() => {
        const refresh = () => {
            try {
                setDrafts(readDrafts());
            } catch {
                notifyRef.current("草稿读取失败，请刷新页面重试。");
            }
        };
        refresh();
        window.addEventListener("ephemera-drafts", refresh);
        window.addEventListener("storage", refresh);
        return () => {
            window.removeEventListener("ephemera-drafts", refresh);
            window.removeEventListener("storage", refresh);
        };
    }, []);
    return drafts;
}
