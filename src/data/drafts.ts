import { entryValid, type Entry } from "./data";

const DRAFT_STORE = "ephemera-drafts";

export function readDrafts(): Entry[] {
    const raw = localStorage.getItem(DRAFT_STORE);
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(entryValid)) throw Error("草稿读取失败");
    return data;
}

export function putDraft(entry: Entry) {
    localStorage.setItem(
        DRAFT_STORE,
        JSON.stringify([entry, ...readDrafts().filter((draft) => draft.id !== entry.id)])
    );
    window.dispatchEvent(new Event("ephemera-drafts"));
}

export function removeDraft(id: string) {
    localStorage.setItem(
        DRAFT_STORE,
        JSON.stringify(readDrafts().filter((draft) => draft.id !== id))
    );
    window.dispatchEvent(new Event("ephemera-drafts"));
}
