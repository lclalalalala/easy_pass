import test from 'node:test';
import assert from 'node:assert/strict';

import {
    extractMainDomain,
    executePasswordFunction,
    normalizeEmail,
    isValidEmail,
    normalizeEmailList,
    buildEmailList
} from './core.js';

// 生成规则引用语法：{{...}} 里写索引表达式，索引是 1-based
const vars = { domain: 'example' };

test('rule: {{1L}} takes the first character, lowercased', () => {
    assert.equal(executePasswordFunction('{{1L}}', vars), 'e');
});

test('rule: {{-1U}} takes the last character, uppercased', () => {
    assert.equal(executePasswordFunction('{{-1U}}', vars), 'E');
});

test('rule: the case letter is optional', () => {
    assert.equal(executePasswordFunction('{{1}}', vars), 'e');
});

test('rule: {{1_3U}} takes an inclusive range', () => {
    assert.equal(executePasswordFunction('{{1_3U}}', vars), 'EXA');
});

test('rule: {{-3_-1L}} takes a range counted from the end', () => {
    assert.equal(executePasswordFunction('{{-3_-1L}}', vars), 'ple');
});

test('rule: a mixed range can span the whole domain', () => {
    assert.equal(executePasswordFunction('{{1_-1U}}', vars), 'EXAMPLE');
});

test('rule: a reversed range is normalised', () => {
    assert.equal(executePasswordFunction('{{3_1U}}', vars), 'EXA');
});

test('rule: {{domain}} still expands to the whole domain', () => {
    assert.equal(executePasswordFunction('{{domain}}', vars), 'example');
});

test('rule: index 0 does not exist because indexing starts at 1', () => {
    assert.equal(executePasswordFunction('{{0L}}', vars), '{{0L}}');
});

test('rule: an index past the end is clamped to the last character', () => {
    assert.equal(executePasswordFunction('{{99U}}', vars), 'E');
});

test('rule: a range running past the end is truncated, not rejected', () => {
    assert.equal(executePasswordFunction('{{1_99U}}', vars), 'EXAMPLE');
});

test('rule: an index past the start is clamped to the first character', () => {
    assert.equal(executePasswordFunction('{{-99L}}', vars), 'e');
});

// 规则是全局的，各站域名长度不同：短域名必须也能算出可用密码，
// 否则一条规则就没办法在所有网站通用
const shortDomains = [
    ['x', 'x'],
    ['t', 't'],
    ['qq', 'qq']
];

for (const [domain, expected] of shortDomains) {
    test(`rule: a range wider than the domain "${domain}" still works`, () => {
        assert.equal(executePasswordFunction('pass_{{1_3L}}', { domain }), `pass_${expected}`);
    });
}

test('rule: a reference on an empty domain stays visible', () => {
    assert.equal(executePasswordFunction('{{1U}}', { domain: '' }), '{{1U}}');
});

test('rule: an unknown name stays visible', () => {
    assert.equal(executePasswordFunction('{{nope}}', vars), '{{nope}}');
});

// 用 `name in variables` 判断会顺着原型链找到 Object.prototype 的成员，
// 把 [native code] 这种函数源码拼进密码里
test('rule: inherited object members are not treated as variables', () => {
    for (const name of ['toString', 'constructor', 'hasOwnProperty', 'valueOf', '__proto__']) {
        assert.equal(
            executePasswordFunction(`{{${name}}}`, vars),
            `{{${name}}}`,
            `${name} must not resolve to an inherited member`
        );
    }
});

test('rule: the old bracket syntax is no longer substituted', () => {
    assert.equal(executePasswordFunction('{{[domain][0][2][U]}}', vars), '{{[domain][0][2][U]}}');
});

test('rule: references work inside a longer rule', () => {
    assert.equal(executePasswordFunction('pass_{{1_2L}}_{{-1U}}', vars), 'pass_ex_E');
});

test('rule: whitespace inside the braces is tolerated', () => {
    assert.equal(executePasswordFunction('{{ 1U }}', vars), 'E');
});

test('rule: plain text without references is untouched', () => {
    assert.equal(executePasswordFunction('literal_%@!123', vars), 'literal_%@!123');
});

test('rule: Math.* is not expanded any more, the text stays as written', () => {
    assert.equal(executePasswordFunction('Math.floor(3.7)', vars), 'Math.floor(3.7)');
    assert.equal(executePasswordFunction('id_{{1L}}_Math.pow(2,8)', vars), 'id_e_Math.pow(2,8)');
});

test('extractMainDomain returns the registrable domain label', () => {
    assert.equal(extractMainDomain('www.google.com'), 'google');
});

test('extractMainDomain handles multi-part public suffixes', () => {
    assert.equal(extractMainDomain('example.co.uk'), 'example');
});

test('extractMainDomain falls back to the host for localhost', () => {
    assert.equal(extractMainDomain('localhost'), 'localhost');
});

test('extractMainDomain falls back to the host for an IP address', () => {
    assert.equal(extractMainDomain('192.168.1.10'), '192.168.1.10');
});

test('extractMainDomain falls back to the host for an intranet name', () => {
    assert.equal(extractMainDomain('myintranet'), 'myintranet');
});

test('extractMainDomain strips www when falling back to the host', () => {
    assert.equal(extractMainDomain('www.myintranet'), 'myintranet');
});

test('extractMainDomain returns null for an empty host', () => {
    assert.equal(extractMainDomain(''), null);
    assert.equal(extractMainDomain(undefined), null);
});

test('normalizeEmail trims surrounding whitespace', () => {
    assert.equal(normalizeEmail('  user@example.com  '), 'user@example.com');
});

test('normalizeEmail returns empty string for null or undefined', () => {
    assert.equal(normalizeEmail(null), '');
    assert.equal(normalizeEmail(undefined), '');
});

test('isValidEmail accepts a normal address', () => {
    assert.equal(isValidEmail('user@example.com'), true);
});

test('isValidEmail rejects empty string', () => {
    assert.equal(isValidEmail(''), false);
});

test('isValidEmail rejects a string without @', () => {
    assert.equal(isValidEmail('user.example.com'), false);
});

test('isValidEmail rejects an address without a top level domain', () => {
    assert.equal(isValidEmail('user@example'), false);
});

test('isValidEmail rejects an address containing whitespace', () => {
    assert.equal(isValidEmail('user name@example.com'), false);
});

// 邮箱列表：第一个元素就是默认邮箱

test('normalizeEmailList keeps the stored order', () => {
    assert.deepEqual(normalizeEmailList({ emails: ['a@x.com', 'b@y.com'] }), ['a@x.com', 'b@y.com']);
});

test('normalizeEmailList trims entries and drops empty ones', () => {
    assert.deepEqual(normalizeEmailList({ emails: [' a@x.com ', '', '   ', 'b@y.com'] }), ['a@x.com', 'b@y.com']);
});

test('normalizeEmailList de-duplicates case-insensitively', () => {
    assert.deepEqual(normalizeEmailList({ emails: ['A@x.com', 'a@x.com'] }), ['A@x.com']);
});

test('normalizeEmailList migrates the single defaultEmail of older versions', () => {
    assert.deepEqual(normalizeEmailList({ defaultEmail: 'old@x.com' }), ['old@x.com']);
});

test('normalizeEmailList does not resurrect the legacy email once the list exists', () => {
    assert.deepEqual(normalizeEmailList({ emails: [], defaultEmail: 'old@x.com' }), []);
});

test('normalizeEmailList returns an empty list for empty storage', () => {
    assert.deepEqual(normalizeEmailList({}), []);
    assert.deepEqual(normalizeEmailList(null), []);
});

test('buildEmailList moves the chosen default to the front', () => {
    const result = buildEmailList([{ address: 'a@x.com' }, { address: 'b@y.com', isDefault: true }]);

    assert.deepEqual(result, { ok: true, emails: ['b@y.com', 'a@x.com'], message: '' });
});

test('buildEmailList keeps the first email first when none is marked default', () => {
    const result = buildEmailList([{ address: 'a@x.com' }, { address: 'b@y.com' }]);

    assert.deepEqual(result.emails, ['a@x.com', 'b@y.com']);
});

test('buildEmailList ignores empty rows', () => {
    const result = buildEmailList([{ address: '   ' }, { address: 'a@x.com' }]);

    assert.deepEqual(result.emails, ['a@x.com']);
});

test('buildEmailList accepts a list with nothing filled in', () => {
    assert.deepEqual(buildEmailList([{ address: '' }]), { ok: true, emails: [], message: '' });
});

test('buildEmailList rejects an invalid address and names it', () => {
    const result = buildEmailList([{ address: 'a@x.com' }, { address: 'nope' }]);

    assert.equal(result.ok, false);
    assert.equal(result.emails, undefined);
    assert.match(result.message, /nope/);
});

test('buildEmailList de-duplicates case-insensitively and still honours the default', () => {
    const result = buildEmailList([
        { address: 'a@x.com', isDefault: true },
        { address: 'A@X.com' },
        { address: 'b@y.com' }
    ]);

    assert.deepEqual(result.emails, ['a@x.com', 'b@y.com']);
});

test('buildEmailList falls back to the first email when the default row is empty', () => {
    const result = buildEmailList([{ address: '', isDefault: true }, { address: 'b@y.com' }]);

    assert.deepEqual(result.emails, ['b@y.com']);
});
