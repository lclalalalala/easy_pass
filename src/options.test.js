// options.js 的 DOM 胶水层测试：邮箱列表的增删改与保存。
import test from 'node:test';
import assert from 'node:assert/strict';

import fs from 'node:fs';

import { executePasswordFunction } from './core.js';
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

// 帮助文案和实现很容易悄无声息地脱节，这里拿真实实现把文档里的例子跑一遍
test('every example shown in options.html is a rule that actually works', () => {
    const html = fs.readFileSync(OPTIONS_HTML, 'utf8');

    // 输入框标签下面那行可复制的示例
    const examples = [...html.matchAll(/<p class="rule-example">([\s\S]*?)<\/p>/g)]
        .map((block) => block[1].match(/<code>([^<]+)<\/code>/))
        .filter(Boolean)
        .map((match) => match[1]);

    assert.ok(examples.length >= 2, 'expected a copyable example for both rule boxes');
    for (const example of examples) {
        assert.doesNotMatch(
            executePasswordFunction(example, { domain: 'example' }),
            /\{\{/,
            `example does not expand: ${example}`
        );
    }

    // 帮助区里 “规则 -> 结果” 的配对必须和实现一致（示例域名是 www.example.com）
    const pairs = [...html.matchAll(
        /Generation Rule:<\/strong><code[^>]*>([^<]*)<\/code><br>\s*<strong[^>]*>Generation Result:<\/strong><code[^>]*>([^<]*)<\/code>/g
    )];

    assert.ok(pairs.length > 0, 'expected documented rule/result pairs');
    for (const pair of pairs) {
        assert.equal(
            executePasswordFunction(pair[1].trim(), { domain: 'example' }),
            pair[2].trim(),
            `documented result is wrong for ${pair[1].trim()}`
        );
    }
});

test('saving an empty list clears the stored emails', async () => {
    const page = await openOptions({ storage: { emails: ['a@x.com'] } });

    page.clickRemove(0);
    page.click('saveEmailBtn');
    await flush();

    assert.deepEqual(page.sync.data.emails, []);
});
