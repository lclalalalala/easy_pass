// popup.js 的 DOM 胶水层测试：用手写的极小 DOM / chrome / clipboard 替身跑真实代码，
// 不引入 jsdom 之类的依赖。每次 import 都带一个递增的 query，拿一份全新的模块状态。
import test from 'node:test';
import assert from 'node:assert/strict';

import { installDom, installBrowser, installTimers, loadPage, flush } from '../test-helpers/dom-double.js';

const POPUP_HTML = new URL('../popup.html', import.meta.url);
const POPUP_JS = new URL('./popup.js', import.meta.url);

async function openPopup({
    storage = {},
    clipboardFails = false,
    storageReadFails = false,
    syncReadFails = false,
    tabUrl
} = {}) {
    const elements = installDom([POPUP_HTML]);
    const { timers, cancelled } = installTimers();
    const browser = installBrowser({
        storage,
        clipboardFails,
        readFails: storageReadFails,
        syncReadFails,
        tabUrl
    });
    await loadPage(POPUP_JS);

    return {
        elements,
        timers,
        cancelled,
        ...browser,
        text: (id) => elements.get(id).textContent,
        value: (id) => elements.get(id).value,
        display: (id) => elements.get(id).style.display,
        options: (id) => elements.get(id).options.map((option) => option.value),
        click: (id) => elements.get(id).dispatch('click')
    };
}

test('popup lists the emails with the default first and pre-selects it', async () => {
    const popup = await openPopup({ storage: { emails: ['work@x.com', 'home@y.com'] } });

    assert.deepEqual(popup.options('emailSelect'), ['work@x.com', 'home@y.com']);
    assert.equal(popup.value('emailSelect'), 'work@x.com');
    assert.notEqual(popup.display('emailSelect'), 'none');
    assert.notEqual(popup.display('copyEmailBtn'), 'none');
});

test('popup copies the email selected in the dropdown', async () => {
    const popup = await openPopup({ storage: { emails: ['work@x.com', 'home@y.com'] } });

    popup.elements.get('emailSelect').value = 'home@y.com';
    popup.click('copyEmailBtn');
    await flush();

    assert.equal(popup.copied[popup.copied.length - 1], 'home@y.com');
    assert.equal(popup.text('notification'), 'Email copied to clipboard');
});

test('popup keeps the email row visible and explains itself when nothing is set', async () => {
    const popup = await openPopup({ storage: {} });

    // 整行隐藏会让用户不知道有这个功能，所以未设置时也要露出这一行
    assert.notEqual(popup.display('emailGroup'), 'none');
    assert.match(popup.text('emailEmpty'), /no emails set/i);
    // 没有邮箱可选 / 可复制时，把下拉和复制按钮藏起来
    assert.equal(popup.display('emailSelect'), 'none');
    assert.equal(popup.display('copyEmailBtn'), 'none');
});

test('popup migrates the legacy single email into the dropdown', async () => {
    const popup = await openPopup({ storage: { defaultEmail: 'old@x.com' } });

    assert.deepEqual(popup.options('emailSelect'), ['old@x.com']);
    assert.equal(popup.value('emailSelect'), 'old@x.com');
});

// 下面两条用例故意让剪贴板失败，core.js 会 console.error，别污染测试输出
async function withSilencedConsoleError(body) {
    const realError = console.error;
    console.error = () => {};
    try {
        await body();
    } finally {
        console.error = realError;
    }
}

test('popup does not claim the password was copied when the clipboard write fails', async () => {
    await withSilencedConsoleError(async () => {
        const popup = await openPopup({ storage: { emails: ['me@example.com'] }, clipboardFails: true });

        assert.deepEqual(popup.copied, []);
        assert.notEqual(popup.text('notification'), 'Password copied to clipboard');
        assert.match(popup.text('notification'), /failed/i);
    });
});

test('popup reports a failed manual copy instead of claiming success', async () => {
    await withSilencedConsoleError(async () => {
        const popup = await openPopup({ clipboardFails: true });

        popup.click('copyUsernameBtn');
        await flush();

        assert.deepEqual(popup.copied, []);
        assert.match(popup.text('notification'), /failed/i);
    });
});

test('showing a new notification cancels the previous timer', async () => {
    const popup = await openPopup({ storage: { emails: ['me@example.com'] } });

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
    const popup = await openPopup({ storage: { emails: ['me@example.com'] }, storageReadFails: true });

    assert.match(popup.text('notification'), /could not read/i);
    // 用默认规则算出的密码不是该站真实密码，绝不能自动进剪贴板
    assert.deepEqual(popup.copied, []);
});

test('popup also flags a partial read failure, not just a total one', async () => {
    const popup = await openPopup({ storage: { emails: ['me@example.com'] }, syncReadFails: true });

    assert.match(popup.text('notification'), /could not read/i);
    assert.deepEqual(popup.copied, []);
});

test('popup does not auto-copy anything on a page without a website', async () => {
    const popup = await openPopup({ tabUrl: 'chrome://extensions' });

    assert.deepEqual(popup.copied, []);
    assert.match(popup.text('notification'), /no website/i);
});

test('popup still copies normally when there is a website and settings', async () => {
    const popup = await openPopup({ storage: { emails: ['me@example.com'] } });

    assert.equal(popup.copied[0], 'google!@#');
    assert.equal(popup.text('notification'), 'Password copied to clipboard');
});
