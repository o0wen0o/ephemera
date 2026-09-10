import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [], entries: [] }, server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
const { parseJournal, changeCollection, collectionNames, readJournal, STORE } = await server.ssrLoadModule('/src/journal.ts');
const entry = { id: 'test-only', title: '测试书页', body: '保留正文', date: '2026-09-10', mood: '开心', weather: '晴天', tags: ['阅读', '日常'], favorite: true, updated_at: '2026-09-09T00:00:00.000Z' };
const fixture = () => ({ entries: [structuredClone(entry), { ...structuredClone(entry), id: 'unrelated', tags: ['散步'], mood: '平静' }], catalog: { tags: ['阅读', '日常', '散步', '尚未使用'], moods: ['开心', '平静'] } });

test('reads original array and version 1 export without changing diary data', () => {
  for (const old of [[entry], { app: '芸窗', version: 1, entries: [entry] }]) assert.deepEqual(parseJournal(JSON.stringify(old)).entries, [entry]);
});
test('new snapshot round trip preserves unused custom choices and empty mood catalogs', () => {
  const value = { entries: [entry], catalog: { tags: ['未使用'], moods: [] } };
  assert.deepEqual(parseJournal(JSON.stringify(value)), value);
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
