import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [], entries: [] }, server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
const { parseJournal, changeCollection, collectionNames, readJournal, trackLocalChanges, defaultSync, purgeTrash, STORE } = await server.ssrLoadModule('/src/journal.ts');
// One journal literal so a new SyncMeta field does not have to be added to every test.
const journalOf = ({ entries = [], catalog = { tags: [], moods: [] }, ...sync }) => ({ entries, catalog, sync: { dirtyIds: [], tombstones: [], bases: {}, ...sync } });
const { planSync } = await server.ssrLoadModule('/src/sync.ts');
const entry = { id: 'test-only', title: '测试书页', body: '保留正文', date: '2026-09-10', mood: '开心', weather: '晴天', tags: ['阅读', '日常'], favorite: true, updated_at: '2026-09-09T00:00:00.000Z' };
const fixture = () => ({ entries: [structuredClone(entry), { ...structuredClone(entry), id: 'unrelated', tags: ['散步'], mood: '平静' }], catalog: { tags: ['阅读', '日常', '散步', '尚未使用'], moods: ['开心', '平静'] }, sync: defaultSync() });

test('reads original array and version 1 export without changing diary data', () => {
  for (const old of [[entry], { app: '芸窗', version: 1, entries: [entry] }]) assert.deepEqual(parseJournal(JSON.stringify(old)).entries, [entry]);
});
test('new snapshot round trip preserves unused custom choices and empty mood catalogs', () => {
  const value = { entries: [entry], catalog: { tags: ['未使用'], moods: [] }, sync: { dirtyIds: ['test-only'], tombstones: [], bases: {} } };
  assert.deepEqual(parseJournal(JSON.stringify(value)), value);
});
test('duplicate entry ids collapse to the most recently updated copy', () => {
  const newer = { ...entry, title: '较新的内容', updated_at: '2026-09-10T00:00:00.000Z' };
  const parsed = parseJournal(JSON.stringify({ entries: [entry, newer, entry], catalog: { tags: [], moods: [] } }));
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].title, '较新的内容');
});
test('tag merge deduplicates associations and changes only affected timestamps', () => {
  const source = fixture();
  const merged = changeCollection(source, 'tags', '阅读', '日常', '2026-09-10T00:00:00.000Z');
  assert.deepEqual(merged.entries[0].tags, ['日常']);
  assert.equal(merged.entries[0].body, entry.body);
  assert.equal(merged.entries[0].favorite, true);
  assert.equal(merged.entries[1], source.entries[1]);
  assert.deepEqual(source.entries[0].tags, ['阅读', '日常']);
  assert.ok(!collectionNames(merged, 'tags').includes('阅读'));
});
test('removing a mood leaves the diary intact and unmarked', () => {
  const next = changeCollection(fixture(), 'moods', '开心', null, 'now');
  assert.equal(next.entries[0].mood, '');
  assert.equal(next.entries[0].body, entry.body);
  assert.equal(next.entries.length, 2);
  assert.ok(!collectionNames(next, 'moods').includes('开心'));
});
test('new unused labels persist and can be renamed before being used', () => {
  const added = changeCollection(fixture(), 'tags', null, '旅行');
  const renamed = changeCollection(added, 'tags', '旅行', '远行');
  assert.ok(collectionNames(parseJournal(JSON.stringify(renamed)), 'tags').includes('远行'));
  assert.deepEqual(renamed.entries, fixture().entries);
});
test('repeated merge is idempotent', () => {
  const once = changeCollection(fixture(), 'moods', '开心', '平静', 'first');
  assert.deepEqual(changeCollection(once, 'moods', '开心', '平静', 'second'), once);
});
test('malformed data fails closed instead of seeding or overwriting it', () => {
  for (const data of ['null', '{}', 'oops', '{"entries":[],"catalog":{"tags":3,"moods":[]}}']) assert.throws(() => parseJournal(data));
});
test('storage migration reads old records without writing, prefers v2, and retains original on errors', () => {
  const storage = new Map([['ephemera-entries-v1', JSON.stringify([entry])]]);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: () => { throw new Error('Reading must not write'); } };
  assert.deepEqual(readJournal().entries, [entry]);
  assert.equal(storage.size, 1);
  storage.set(STORE, JSON.stringify({ entries: [], catalog: { tags: [], moods: [] } }));
  assert.deepEqual(readJournal().entries, []);
  storage.set(STORE, 'broken');
  assert.ok(readJournal().error);
  assert.equal(storage.get('ephemera-entries-v1'), JSON.stringify([entry]));
  delete globalThis.localStorage;
});

test('offline edits and deletes are queued without losing the deleted body', () => {
  const source = journalOf({ entries: [entry], bases: { [entry.id]: entry.updated_at } });
  const edited = { ...entry, body: '离线修改', updated_at: '2026-09-10T01:00:00.000Z' };
  assert.deepEqual(trackLocalChanges(source, [edited]).dirtyIds, [entry.id]);
  const deleted = trackLocalChanges(source, [], '2026-09-10T02:00:00.000Z');
  assert.equal(deleted.tombstones[0].entry.body, entry.body);
  assert.equal(deleted.tombstones[0].deleted_at, '2026-09-10T02:00:00.000Z');
});

test('a normal sync uploads local changes and clears the pending queue', () => {
  const source = journalOf({ entries: [entry], dirtyIds: [entry.id] });
  const plan = planSync(source, [], '2026-09-10T03:00:00.000Z', () => 'copy-id');
  assert.equal(plan.uploads.length, 1);
  assert.equal(plan.uploads[0].row.deleted_at, null);
  assert.equal(plan.uploads[0].expectedUpdatedAt, null);
  assert.deepEqual(plan.journal.sync.dirtyIds, []);
  assert.equal(plan.journal.sync.bases[entry.id], entry.updated_at);
});

test('simultaneous local and cloud edits preserve both versions as a conflict copy', () => {
  const base = '2026-09-08T00:00:00.000Z';
  const local = { ...entry, body: '本机文字', updated_at: '2026-09-10T01:00:00.000Z' };
  const cloud = { ...entry, body: '云端文字', updated_at: '2026-09-10T02:00:00.000Z', deleted_at: null };
  const source = journalOf({ entries: [local], dirtyIds: [entry.id], bases: { [entry.id]: base } });
  const plan = planSync(source, [cloud], '2026-09-10T03:00:00.000Z', () => 'conflict-copy');
  assert.equal(plan.conflicts, 1);
  assert.equal(plan.journal.entries.find(e => e.id === entry.id).body, '云端文字');
  assert.equal(plan.journal.entries.find(e => e.id === 'conflict-copy').body, '本机文字');
  assert.match(plan.journal.entries.find(e => e.id === 'conflict-copy').title, /冲突副本/);
  assert.equal(plan.uploads[0].row.id, 'conflict-copy');
});

test('cloud deletion removes a clean local copy while edit-versus-delete preserves the edit as a new entry', () => {
  const deletedAt = '2026-09-10T02:00:00.000Z';
  const cloudDelete = { ...entry, title: '', body: '', mood: '', weather: '', tags: [], favorite: false, updated_at: deletedAt, deleted_at: deletedAt };
  const clean = journalOf({ entries: [entry], bases: { [entry.id]: entry.updated_at } });
  assert.equal(planSync(clean, [cloudDelete]).journal.entries.length, 0);
  const localEdit = { ...entry, body: '删除前写下的新内容', updated_at: '2026-09-10T03:00:00.000Z' };
  const dirty = { ...clean, entries: [localEdit], sync: { ...clean.sync, dirtyIds: [entry.id] } };
  const plan = planSync(dirty, [cloudDelete], '2026-09-10T04:00:00.000Z', () => 'rescued-copy');
  assert.equal(plan.conflicts, 1);
  assert.equal(plan.journal.entries[0].id, 'rescued-copy');
  assert.equal(plan.journal.entries[0].body, '删除前写下的新内容');
});

test('a queued local deletion preserves cloud content and uses the last seen version as its write condition', () => {
  const deletedAt = '2026-09-10T02:00:00.000Z';
  const source = journalOf({ dirtyIds: [entry.id], tombstones: [{ entry, deleted_at: deletedAt }], bases: { [entry.id]: entry.updated_at } });
  const plan = planSync(source, [{ ...entry, deleted_at: null }]);
  assert.equal(plan.uploads[0].row.id, entry.id);
  for (const key of ['title','body','mood','weather','tags','favorite']) assert.deepEqual(plan.uploads[0].row[key], entry[key]);
  assert.equal(plan.uploads[0].row.deleted_at, deletedAt);
  assert.equal(plan.uploads[0].expectedUpdatedAt, entry.updated_at);
});

test('a remote edit wins over a concurrent local deletion and is surfaced as a conflict', () => {
  const base = entry.updated_at;
  const deletedAt = '2026-09-10T02:00:00.000Z';
  const remote = { ...entry, body: '另一台设备刚写的正文', updated_at: '2026-09-10T03:00:00.000Z', deleted_at: null };
  const source = journalOf({ dirtyIds: [entry.id], tombstones: [{ entry, deleted_at: deletedAt }], bases: { [entry.id]: base } });
  const plan = planSync(source, [remote]);
  assert.equal(plan.conflicts, 1);
  assert.equal(plan.uploads.length, 0);
  assert.equal(plan.journal.entries[0].body, '另一台设备刚写的正文');
});

test('empty trash stays local across reload and sync, and retains pending cloud content', () => {
 const deletedAt='2026-09-10T02:00:00.000Z';
 const cloud={...entry,updated_at:deletedAt,deleted_at:deletedAt};
 const source=journalOf({bases:{[entry.id]:deletedAt},tombstones:[{entry,deleted_at:deletedAt}]});
 const sync=purgeTrash(source.sync);
 assert.equal(sync.tombstones.length,0);
 assert.deepEqual(sync.dirtyIds,source.sync.dirtyIds);
 const reloaded=parseJournal(JSON.stringify({...source,sync}));
 const plan=planSync(reloaded,[cloud]);
 assert.equal(plan.uploads.length,0);
 assert.equal(plan.journal.sync.tombstones.length,0);
 assert.equal(planSync(source,[cloud]).journal.sync.tombstones[0].entry.body,entry.body);
 const pending=purgeTrash({...source.sync,dirtyIds:[entry.id]});
 assert.equal(pending.tombstones[0].entry.body,entry.body);
 const uploaded=planSync({...source,sync:pending},[]);
 assert.equal(uploaded.uploads[0].row.body,entry.body);
 assert.equal(uploaded.journal.sync.tombstones.length,0);
 assert.equal(planSync(uploaded.journal,uploaded.uploads.map(u=>u.row)).journal.sync.tombstones.length,0);
 assert.deepEqual(purgeTrash(plan.journal.sync),plan.journal.sync);
});

test('cloud replacement includes cloud trash and removes local exclusions and pending edits', async () => {
 const { journalFromCloud } = await server.ssrLoadModule('/src/sync.ts');
 const deleted={...entry,id:'deleted',deleted_at:'2026-09-10T04:00:00.000Z'};
 const rows=[{...entry,deleted_at:null},deleted];
 const snapshot=journalFromCloud(rows,{tags:[],moods:[]});
 assert.deepEqual(snapshot.entries,[entry]);
 assert.equal(snapshot.sync.tombstones[0].entry.body,entry.body);
 assert.deepEqual(snapshot.sync.dirtyIds,[]);
 assert.equal(snapshot.sync.clearedTrash,undefined);
 assert.equal(planSync(snapshot,rows).uploads.length,0);
 assert.equal(journalFromCloud([],{tags:[],moods:[]}).entries.length,0);
 assert.throws(()=>journalFromCloud([{}],{tags:[],moods:[]}));
});


test('draft migration, independent updates and discard preserve other drafts', async () => {
 const { readDrafts, putDraft, removeDraft } = await server.ssrLoadModule('/src/drafts.ts');
 const previousStorage=globalThis.localStorage, previousWindow=globalThis.window;
 const values=new Map([['ephemera-draft-v1',JSON.stringify(entry)]]);
 globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 globalThis.window={dispatchEvent:()=>true};
 try {
  assert.deepEqual(readDrafts(),[entry]);
  putDraft({...entry,id:'new-draft',body:'新日记'});
  putDraft({...entry,body:'未保存的修改'});
  assert.equal(readDrafts().length,2);
  assert.equal(readDrafts().find(d=>d.id==='new-draft').body,'新日记');
  removeDraft(entry.id);
  assert.equal(readDrafts().length,1);
  assert.equal(entry.body,'保留正文');
  removeDraft('new-draft');
  assert.deepEqual(readDrafts(),[]);
  values.set('ephemera-drafts-v2','broken');
  assert.throws(()=>putDraft(entry));
  assert.equal(values.get('ephemera-drafts-v2'),'broken');
 } finally { globalThis.localStorage=previousStorage; globalThis.window=previousWindow; }
});


test('account guard requires an explicit matching owner and errors are readable', async () => {
 const { accountMatches, cloudError } = await server.ssrLoadModule('/src/account.ts');
 assert.equal(accountMatches(null,'account-a'),false);
 assert.equal(accountMatches('account-a','account-b'),false);
 assert.equal(accountMatches('account-a','account-a'),true);
 assert.match(cloudError({message:'Failed to fetch'}),/网络/);
 assert.match(cloudError({status:429}),/频繁/);
 assert.match(cloudError({message:'JWT expired'}),/登录已失效/);
 assert.match(cloudError({message:'unrecognized backend error'}),/本机内容/);
});
