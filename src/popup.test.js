// popup.js 的 DOM 胶水层测试：用手写的极小 DOM / chrome / clipboard 替身跑真实代码，
// 不引入 jsdom 之类的依赖。每次 import 都带一个递增的 query，拿一份全新的模块状态。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const POPUP_HTML = fs.readFileSync(new URL('../popup.html', import.meta.url), 'utf8');
const realSetTimeout = globalThis.setTimeout;

let importCounter = 0;

function makeElement(id) {
    return {
        id,
        textContent: '',
        value: '',
        style: {},
        _listeners: {},
        addEventListener(type, handler) {
            (this._listeners[type] = this._listeners[type] || []).push(handler);
        },
        classList: {
            classes: [],
            add(name) { this.classes.push(name); },
            remove(name) { this.classes = this.classes.filter((c) => c !== name); }
        }
    };
}

// chrome.storage 区域替身
function storageArea(initial = {}, { readFails = false } = {}) {
    const area = {
        data: { ...initial },
        set(obj) { Object.assign(area.data, obj); return Promise.resolve(); },
        get(keys) {
            if (readFails) return Promise.reject(new Error('storage read failed'));
            const out = {};
            for (const key of keys) {
                if (key in area.data) out[key] = area.data[key];
            }
            return Promise.resolve(out);
        },
        remove(keys) { for (const key of keys) delete area.data[key]; return Promise.resolve(); }
    };
    return area;
}

const flush = () => new Promise((resolve) => realSetTimeout(resolve, 0));

// 把 popup.html 里真实存在的 id 全部建出来，再加载 popup.js 并触发 DOMContentLoaded
async function openPopup({
    storage = {},
    clipboardFails = false,
    storageReadFails = false,
    tabUrl = 'https://www.google.com/search?q=x'
} = {}) {
    const elements = new Map();
    for (const match of POPUP_HTML.matchAll(/id="([^"]+)"/g)) {
        elements.set(match[1], makeElement(match[1]));
    }

    const timers = [];
    const cancelled = [];
    const copied = [];

    globalThis.document = {
        readyHandlers: [],
        addEventListener(type, handler) {
            if (type === 'DOMContentLoaded') this.readyHandlers.push(handler);
        },
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, makeElement(id));
            return elements.get(id);
        }
    };

    // 捕获通知计时器；被 clearTimeout 取消的标记出来，模拟事件循环不会执行它
    globalThis.setTimeout = (fn) => {
        timers.push({ fn, cancelled: false });
        return timers.length;
    };
    // 真实的 clearTimeout 对 undefined / 未知 id 都是静默 no-op，替身也照此处理
    globalThis.clearTimeout = (id) => {
        if (!id) return;
        if (timers[id - 1]) timers[id - 1].cancelled = true;
        cancelled.push(id);
    };

    Object.defineProperty(globalThis, 'navigator', {
        value: {
            clipboard: {
                writeText: async (text) => {
                    if (clipboardFails) throw new Error('NotAllowedError: Document is not focused');
                    copied.push(text);
                }
            }
        },
        configurable: true,
        writable: true
    });

    globalThis.chrome = {
        tabs: { query: async () => [{ url: tabUrl }] },
        storage: {
            sync: storageArea(storage, { readFails: storageReadFails }),
            local: storageArea({}, { readFails: storageReadFails })
        },
        runtime: { openOptionsPage() {} }
    };

    importCounter += 1;
    await import(`./popup.js?scenario=${importCounter}`);
    for (const handler of document.readyHandlers) await handler();
    await flush();

    return {
        elements,
        timers,
        cancelled,
        copied,
        text: (id) => (elements.get(id) || {}).textContent,
        click: (id) => elements.get(id)._listeners.click[0]()
    };
}

test('popup renders the default email and copies it on demand', async () => {
    const popup = await openPopup({ storage: { defaultEmail: 'me@example.com' } });

    assert.equal(popup.text('email'), 'me@example.com');
    assert.equal(popup.elements.get('emailGroup').style.display, '');
    assert.notEqual(popup.elements.get('copyEmailBtn').style.display, 'none');

    popup.click('copyEmailBtn');
    await flush();

    assert.deepEqual(popup.copied, ['google!@#', 'me@example.com']);
    assert.equal(popup.text('notification'), 'Email copied to clipboard');
});

test('popup keeps the email row visible and explains itself when nothing is set', async () => {
    const popup = await openPopup({ storage: {} });

    // 整行隐藏会让用户不知道有这个功能，所以未设置时也要露出这一行
    assert.notEqual(popup.elements.get('emailGroup').style.display, 'none');
    assert.match(popup.text('email'), /no default email/i);
    // 没有邮箱可复制时不要把提示文字复制出去
    assert.equal(popup.elements.get('copyEmailBtn').style.display, 'none');
});

test('popup does not claim the password was copied when the clipboard write fails', async () => {
    const popup = await openPopup({ clipboardFails: true });

    assert.deepEqual(popup.copied, []);
    assert.notEqual(popup.text('notification'), 'Password copied to clipboard');
    assert.match(popup.text('notification'), /failed/i);
});

test('popup reports a failed manual copy instead of claiming success', async () => {
    const popup = await openPopup({ clipboardFails: true });

    popup.click('copyUsernameBtn');
    await flush();

    assert.deepEqual(popup.copied, []);
    assert.match(popup.text('notification'), /failed/i);
});

test('showing a new notification cancels the previous timer', async () => {
    const popup = await openPopup({ storage: { defaultEmail: 'me@example.com' } });

    assert.equal(popup.timers.length, 1); // the automatic password copy

    popup.click('copyEmailBtn');
    await flush();

    assert.equal(popup.timers.length, 2);
    assert.deepEqual(popup.cancelled, [1], 'the auto-copy timer must be cancelled');
    assert.equal(popup.text('notification'), 'Email copied to clipboard');
});

test('popup generates a usable default password for a host with no public suffix', async () => {
    const popup = await openPopup({ tabUrl: 'http://localhost:3000/login' });

    assert.equal(popup.text('mainDomain'), 'localhost');
    assert.equal(popup.text('password'), 'localhost!@#');
});

test('popup flags settings it could not read instead of silently showing defaults', async () => {
    const popup = await openPopup({ storage: { defaultEmail: 'me@example.com' }, storageReadFails: true });

    assert.match(popup.text('notification'), /could not read/i);
});
