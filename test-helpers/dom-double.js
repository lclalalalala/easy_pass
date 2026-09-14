// 手写的极小 DOM / chrome / clipboard 替身，只实现扩展真正用到的那些 API。
// 放在 test-helpers/ 下是有意的：这个文件名不匹配 node --test 的发现规则，不会被当成测试执行。
import fs from 'node:fs';

const realSetTimeout = globalThis.setTimeout;
export const flush = () => new Promise((resolve) => realSetTimeout(resolve, 0));

function makeElement(tagName = 'div') {
    return {
        tagName: tagName.toUpperCase(),
        id: '',
        className: '',
        type: '',
        name: '',
        value: '',
        textContent: '',
        checked: false,
        style: {},
        children: [],
        options: [],
        _listeners: {},
        addEventListener(type, handler) {
            (this._listeners[type] = this._listeners[type] || []).push(handler);
        },
        dispatch(type) {
            for (const handler of this._listeners[type] || []) handler();
        },
        appendChild(child) {
            this.children.push(child);
            // 粗略模拟浏览器的行为：select 默认选中第一个 option
            if (child.tagName === 'OPTION') {
                this.options.push(child);
                if (this.value === '') this.value = child.value;
            }
            return child;
        },
        replaceChildren() {
            this.children = [];
            this.options = [];
            this.value = '';
        },
        classList: {
            classes: [],
            add(name) { this.classes.push(name); },
            remove(name) { this.classes = this.classes.filter((c) => c !== name); }
        }
    };
}

export function findByClassName(root, className) {
    const found = [];
    for (let i = 0; i < root.children.length; i += 1) {
        const child = root.children[i];
        if (child.className === className) found.push(child);
        found.push(...findByClassName(child, className));
    }
    return found;
}

export function installDom(htmlFiles) {
    const elements = new Map();
    for (const file of htmlFiles) {
        const html = fs.readFileSync(file, 'utf8');
        for (const match of html.matchAll(/id="([^"]+)"/g)) {
            const element = makeElement('div');
            element.id = match[1];
            elements.set(match[1], element);
        }
    }

    globalThis.document = {
        readyHandlers: [],
        addEventListener(type, handler) {
            if (type === 'DOMContentLoaded') this.readyHandlers.push(handler);
        },
        getElementById(id) {
            if (!elements.has(id)) {
                const element = makeElement('div');
                element.id = id;
                elements.set(id, element);
            }
            return elements.get(id);
        },
        createElement(tagName) {
            return makeElement(tagName);
        }
    };

    return elements;
}

export function installTimers() {
    const timers = [];
    const cancelled = [];
    globalThis.setTimeout = (fn) => {
        timers.push({ fn, cancelled: false });
        return timers.length;
    };
    // 真实的 clearTimeout 对 undefined / 未知 id 都是静默 no-op
    globalThis.clearTimeout = (id) => {
        if (!id) return;
        if (timers[id - 1]) timers[id - 1].cancelled = true;
        cancelled.push(id);
    };
    return { timers, cancelled };
}

function createStorageArea(initial = {}, { readFails = false, readNever = false, writeFails = false } = {}) {
    const area = {
        data: { ...initial },
        set(obj) {
            if (writeFails) return Promise.reject(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));
            Object.assign(area.data, obj);
            return Promise.resolve();
        },
        get(keys) {
            // 挂住不返回：用来模拟“设置还没读回来”的那个窗口
            if (readNever) return new Promise(() => {});
            if (readFails) return Promise.reject(new Error('storage read failed'));
            const out = {};
            for (const key of keys) {
                if (key in area.data) out[key] = area.data[key];
            }
            return Promise.resolve(out);
        },
        remove(keys) {
            for (const key of keys) delete area.data[key];
            return Promise.resolve();
        }
    };
    return area;
}

export function installBrowser({
    storage = {},
    tabUrl = 'https://www.google.com/search',
    clipboardFails = false,
    readFails = false,
    // 两个区域可以分别失效：真实的 chrome.storage 里 sync 和 local 是独立操作
    syncReadFails = readFails,
    localReadFails = readFails,
    readNever = false,
    writeFails = false
} = {}) {
    const copied = [];
    const alerts = [];

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

    globalThis.alert = (message) => alerts.push(message);

    const sync = createStorageArea(storage, { readFails: syncReadFails, readNever, writeFails });
    const local = createStorageArea({}, { readFails: localReadFails, readNever });

    const runtime = {
        optionsPageOpened: 0,
        openOptionsPage() {
            runtime.optionsPageOpened += 1;
        }
    };

    globalThis.chrome = {
        tabs: { query: async () => [{ url: tabUrl }] },
        storage: { sync, local },
        runtime
    };

    return { copied, alerts, sync, local, runtime };
}

let importCounter = 0;

// 每次带一个递增的 query 重新 import，拿到一份全新的模块状态
export async function loadPage(moduleUrl) {
    importCounter += 1;
    globalThis.document.readyHandlers = [];
    await import(`${moduleUrl.href}?scenario=${importCounter}`);
    for (const handler of globalThis.document.readyHandlers) await handler();
    await flush();
}
