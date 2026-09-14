import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEmail, isValidEmail, validateEmailInput } from './core.js';

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

test('validateEmailInput accepts empty input as clearing the setting', () => {
    assert.deepEqual(validateEmailInput(''), { ok: true, value: '' });
});

test('validateEmailInput treats whitespace only input as clearing the setting', () => {
    assert.deepEqual(validateEmailInput('   '), { ok: true, value: '' });
});

test('validateEmailInput returns the trimmed address for valid input', () => {
    assert.deepEqual(validateEmailInput('  user@example.com '), { ok: true, value: 'user@example.com' });
});

test('validateEmailInput rejects malformed input with a message', () => {
    assert.deepEqual(validateEmailInput('not-an-email'), {
        ok: false,
        value: 'not-an-email',
        message: 'Invalid email address'
    });
});
