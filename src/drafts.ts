import { entryValid, type Entry } from './data';
export function readDrafts(): Entry[] {
 const raw = localStorage.getItem('ephemera-drafts-v2');
 if(raw !== null) { const data: unknown=JSON.parse(raw); if(!Array.isArray(data)||!data.every(entryValid)) throw Error('草稿读取失败'); return data; }
 const old=JSON.parse(localStorage.getItem('ephemera-draft-v1') ?? localStorage.getItem('ephemera-prototype-draft-v1') ?? 'null'); return entryValid(old)?[old]:[];
}
export function putDraft(entry: Entry) { localStorage.setItem('ephemera-drafts-v2',JSON.stringify([entry,...readDrafts().filter(d=>d.id!==entry.id)])); window.dispatchEvent(new Event('ephemera-drafts')); }
export function removeDraft(id: string) { localStorage.setItem('ephemera-drafts-v2',JSON.stringify(readDrafts().filter(d=>d.id!==id))); window.dispatchEvent(new Event('ephemera-drafts')); }
