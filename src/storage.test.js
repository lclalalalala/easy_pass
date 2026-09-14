import test from 'node:test';
import assert from 'node:assert/strict';

import { createSettingsStore, SETTINGS_KEYS } from './storage.js';

// Minimal stand-in for a chrome.storage area (sync or local).
function fakeArea(initial = {}) {
    const data = { ...initial };
    const calls = { set: [], remove: [] };
    return {
        data,
        calls,
        set(obj) {
            calls.set.push(obj);
            Object.assign(data, obj);
            return Promise.resolve();
        },
        get(keys) {
            const out = {};
            for (const key of keys) {
                if (key in data) out[key] = data[key];
            }
            return Promise.resolve(out);
        },
        remove(keys) {
            calls.remove.push(keys);
            for (const key of keys) delete data[key];
            return Promise.resolve();
        }
    };
}

function failingArea(error) {
    return {
        set: () => Promise.reject(error),
        get: () => Promise.reject(error),
        remove: () => Promise.reject(error)
    };
}

test('save writes settings to sync', async () => {
    const sync = fakeArea();
    const local = fakeArea();
    const store = createSettingsStore(sync, local);

    const result = await store.save({ emails: ['me@example.com'] });

    assert.deepEqual(sync.data, { emails: ['me@example.com'] });
    assert.equal(result.backend, 'sync');
});

test('save clears the local fallback copy once sync succeeds', async () => {
    const sync = fakeArea();
    const local = fakeArea({ emails: ['stale@example.com'] });
    const store = createSettingsStore(sync, local);

    await store.save({ emails: ['fresh@example.com'] });

    assert.deepEqual(local.data, {});
});

test('save falls back to local when sync fails', async () => {
    const syncError = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
    const sync = failingArea(syncError);
    const local = fakeArea();
    const store = createSettingsStore(sync, local);

    const result = await store.save({ emails: ['me@example.com'] });

    assert.deepEqual(local.data, { emails: ['me@example.com'] });
    assert.equal(result.backend, 'local');
    assert.equal(result.syncError, syncError);
});

test('save reports only the sync error, not a local failure, when sync fails', async () => {
    const syncError = new Error('sync unavailable');
    const store = createSettingsStore(failingArea(syncError), fakeArea());

    const result = await store.save({ emails: ['me@example.com'] });

    assert.equal(result.syncError.message, 'sync unavailable');
});

test('save still succeeds when the local fallback cleanup fails', async () => {
    const sync = fakeArea();
    const local = fakeArea();
    local.remove = () => Promise.reject(new Error('cleanup unavailable'));
    const store = createSettingsStore(sync, local);

    // 这条用例故意让清理失败，clearFallback 会 warn，不要污染测试输出
    const realWarn = console.warn;
    console.warn = () => {};
    try {
        const result = await store.save({ emails: ['me@example.com'] });

        assert.deepEqual(sync.data, { emails: ['me@example.com'] });
        assert.equal(result.backend, 'sync');
    } finally {
        console.warn = realWarn;
    }
});

test('save rejects when both sync and local fail', async () => {
    const store = createSettingsStore(failingArea(new Error('sync down')), failingArea(new Error('local down')));

    await assert.rejects(() => store.save({ emails: ['me@example.com'] }), /local down/);
});

test('load prefers the local fallback over stale sync values', async () => {
    const sync = fakeArea({ emails: ['stale@example.com'] });
    const local = fakeArea({ emails: ['fresh@example.com'] });
    const store = createSettingsStore(sync, local);

    assert.deepEqual((await store.load()).data, { emails: ['fresh@example.com'] });
});

test('load merges local fallback keys over sync keys', async () => {
    const sync = fakeArea({ emails: ['synced@example.com'], passwordFunction: 'sync-pass' });
    const local = fakeArea({ passwordFunction: 'local-pass' });
    const store = createSettingsStore(sync, local);

    assert.deepEqual((await store.load()).data, {
        emails: ['synced@example.com'],
        passwordFunction: 'local-pass'
    });
});

test('load returns sync values when no local fallback exists', async () => {
    const sync = fakeArea({ emails: ['me@example.com'] });
    const store = createSettingsStore(sync, fakeArea());

    assert.deepEqual((await store.load()).data, { emails: ['me@example.com'] });
});

test('load still returns local values when the sync read fails', async () => {
    const local = fakeArea({ emails: ['me@example.com'] });
    const store = createSettingsStore(failingArea(new Error('sync down')), local);

    assert.deepEqual((await store.load()).data, { emails: ['me@example.com'] });
});

test('load returns no data when every read fails', async () => {
    const store = createSettingsStore(failingArea(new Error('sync down')), failingArea(new Error('local down')));

    assert.deepEqual((await store.load()).data, {});
});

test('load reports no read errors when both areas are readable', async () => {
    const store = createSettingsStore(fakeArea(), fakeArea());

    assert.deepEqual((await store.load()).readErrors, { sync: false, local: false });
});

test('load reports which area failed to read', async () => {
    const store = createSettingsStore(failingArea(new Error('sync down')), fakeArea());

    assert.deepEqual((await store.load()).readErrors, { sync: true, local: false });
});

test('load reports both areas failing to read', async () => {
    const store = createSettingsStore(failingArea(new Error('sync down')), failingArea(new Error('local down')));

    assert.deepEqual((await store.load()).readErrors, { sync: true, local: true });
});

test('SETTINGS_KEYS covers every stored setting', () => {
    assert.deepEqual([...SETTINGS_KEYS].sort(), ['emails', 'passwordFunction', 'usernameFunction']);
});

test('load also reads the legacy email key so old settings can be migrated', async () => {
    const sync = fakeArea({ defaultEmail: 'old@x.com' });
    const store = createSettingsStore(sync, fakeArea());

    assert.deepEqual((await store.load()).data, { defaultEmail: 'old@x.com' });
});

test('save clears the legacy email key now that the settings are migrated', async () => {
    const sync = fakeArea({ defaultEmail: 'old@x.com' });
    const local = fakeArea({ defaultEmail: 'old@x.com' });
    const store = createSettingsStore(sync, local);

    await store.save({ emails: ['new@x.com'], passwordFunction: '', usernameFunction: '' });

    assert.deepEqual(sync.data, {
        emails: ['new@x.com'],
        passwordFunction: '',
        usernameFunction: ''
    });
    assert.deepEqual(local.data, {});
});

test('save still succeeds when the legacy key cannot be cleared', async () => {
    const sync = fakeArea({ defaultEmail: 'old@x.com' });
    sync.remove = () => Promise.reject(new Error('remove unavailable'));
    const store = createSettingsStore(sync, fakeArea());

    const realWarn = console.warn;
    console.warn = () => {};
    try {
        const result = await store.save({ emails: ['new@x.com'], passwordFunction: '', usernameFunction: '' });
        assert.equal(result.backend, 'sync');
    } finally {
        console.warn = realWarn;
    }
});
