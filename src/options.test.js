// options.js 的 DOM 胶水层测试：邮箱列表的增删改与保存。
import test from 'node:test';
import assert from 'node:assert/strict';

import { installDom, installBrowser, loadPage, flush, findByClassName } from '../test-helpers/dom-double.js';

const OPTIONS_HTML = new URL('../options.html', import.meta.url);
const OPTIONS_JS = new URL('./options.js', import.meta.url);

async function openOptions({ storage = {}, storageWriteFails = false } = {}) {
    const elements = installDom([OPTIONS_HTML]);
    const browser = installBrowser({ storage, writeFails: storageWriteFails });
    await loadPage(OPTIONS_JS);

    // 每次都重新查找：重绘后容器里的子元素是新的
    const container = elements.get('emailList');
    const inputs = () => findByClassName(container, 'email-input');
    const radios = () => findByClassName(container, 'email-default');

    return {
        elements,
        ...browser,
        addresses: () => inputs().map((input) => input.value),
        defaults: () => radios().map((radio) => radio.checked),
        setAddress: (index, value) => { inputs()[index].value = value; },
        markDefault: (index) => {
            radios().forEach((radio, i) => { radio.checked = i === index; });
        },
        click: (id) => elements.get(id).dispatch('click'),
        clickRemove: (index) => findByClassName(container, 'email-remove')[index].dispatch('click')
    };
}

test('options lists the stored emails with the first marked as default', async () => {
    const page = await openOptions({ storage: { emails: ['work@x.com', 'home@y.com'] } });

    assert.deepEqual(page.addresses(), ['work@x.com', 'home@y.com']);
    assert.deepEqual(page.defaults(), [true, false]);
});

test('options seeds a single empty row when nothing is stored', async () => {
    const page = await openOptions({ storage: {} });

    assert.deepEqual(page.addresses(), ['']);
    assert.deepEqual(page.defaults(), [true]);
});

test('options migrates the legacy single email into the list', async () => {
    const page = await openOptions({ storage: { defaultEmail: 'old@x.com' } });

    assert.deepEqual(page.addresses(), ['old@x.com']);
});

test('Add Email appends an empty row that is not the default', async () => {
    const page = await openOptions({ storage: { emails: ['work@x.com'] } });

    page.click('addEmailBtn');

    assert.deepEqual(page.addresses(), ['work@x.com', '']);
    assert.deepEqual(page.defaults(), [true, false]);
});

test('removing a row drops only that row and keeps the default', async () => {
    const page = await openOptions({ storage: { emails: ['a@x.com', 'b@y.com', 'c@z.com'] } });

    page.clickRemove(1);

    assert.deepEqual(page.addresses(), ['a@x.com', 'c@z.com']);
    assert.deepEqual(page.defaults(), [true, false]);
});

test('removing the last row leaves one empty row to type in', async () => {
    const page = await openOptions({ storage: { emails: ['a@x.com'] } });

    page.clickRemove(0);

    assert.deepEqual(page.addresses(), ['']);
    assert.deepEqual(page.defaults(), [true]);
});

test('saving persists the list with the chosen default moved to the front', async () => {
    const page = await openOptions({ storage: { emails: ['a@x.com', 'b@y.com'] } });

    page.markDefault(1);
    page.click('saveEmailBtn');
    await flush();

    assert.deepEqual(page.sync.data.emails, ['b@y.com', 'a@x.com']);
    // 重绘后默认邮箱排在第一位
    assert.deepEqual(page.addresses(), ['b@y.com', 'a@x.com']);
    assert.deepEqual(page.defaults(), [true, false]);
});

test('saving rejects an invalid address without writing anything', async () => {
    const page = await openOptions({ storage: { emails: ['a@x.com'] } });

    page.setAddress(0, 'nope');
    page.click('saveEmailBtn');
    await flush();

    // 存的是改动前的值，说明这次保存根本没写进去
    assert.deepEqual(page.sync.data.emails, ['a@x.com']);
    assert.match(page.alerts[0], /nope/);
});

test('saving an empty list clears the stored emails', async () => {
    const page = await openOptions({ storage: { emails: ['a@x.com'] } });

    page.clickRemove(0);
    page.click('saveEmailBtn');
    await flush();

    assert.deepEqual(page.sync.data.emails, []);
});
