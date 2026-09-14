import test from 'node:test';
import assert from 'node:assert/strict';

import {
    extractMainDomain,
    normalizeEmail,
    isValidEmail,
    normalizeEmailList,
    buildEmailList
} from './core.js';

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
