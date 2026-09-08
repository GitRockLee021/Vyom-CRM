import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders } from './authHeader.js';

const TOKEN_KEY = 'vyom_token';

function withStorages({ local = {}, session = {} }, fn) {
  const ls = new Map(Object.entries(local));
  const ss = new Map(Object.entries(session));
  const origLocal = globalThis.localStorage;
  const origSession = globalThis.sessionStorage;
  globalThis.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null) };
  globalThis.sessionStorage = { getItem: (k) => (ss.has(k) ? ss.get(k) : null) };
  try {
    return fn();
  } finally {
    globalThis.localStorage = origLocal;
    globalThis.sessionStorage = origSession;
  }
}

test('authHeaders adds no Authorization header when no token is stored', () => {
  withStorages({}, () => {
    assert.deepEqual(authHeaders(), {});
  });
});

test('authHeaders uses the token from localStorage (Remember me on)', () => {
  withStorages({ local: { [TOKEN_KEY]: 'ls-token' } }, () => {
    assert.deepEqual(authHeaders(), { Authorization: 'Bearer ls-token' });
  });
});

test('authHeaders uses the token from sessionStorage (Remember me off)', () => {
  withStorages({ session: { [TOKEN_KEY]: 'ss-token' } }, () => {
    assert.deepEqual(authHeaders(), { Authorization: 'Bearer ss-token' });
  });
});

test('authHeaders falls back to sessionStorage when localStorage is empty', () => {
  withStorages({ local: { [TOKEN_KEY]: null }, session: { [TOKEN_KEY]: 'ss-token' } }, () => {
    assert.deepEqual(authHeaders(), { Authorization: 'Bearer ss-token' });
  });
});

test('authHeaders merges and preserves extra headers', () => {
  withStorages({ session: { [TOKEN_KEY]: 'ss-token' } }, () => {
    assert.deepEqual(authHeaders({ 'Content-Type': 'application/json' }), {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ss-token',
    });
  });
});