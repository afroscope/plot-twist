import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { runtimeConfig } from '../server/config.js';
import { publicSecurity } from '../server/public-security.js';

test('local binding stays private; public production requires a configured key and valid port', () => {
  assert.deepEqual(runtimeConfig({}, false), { host: '127.0.0.1', port: 4173 });
  assert.deepEqual(runtimeConfig({ HOST: '0.0.0.0', PORT: '10000', QLOO_API_KEY: 'test' }, true), { host: '0.0.0.0', port: 10000 });
  assert.throws(() => runtimeConfig({ QLOO_API_KEY: ' ' }, true));
  for (const PORT of ['0', '65536', 'NaN', '12.5']) assert.throws(() => runtimeConfig({ PORT }, false));
  assert.throws(() => runtimeConfig({ HOST: 'arbitrary.example' }, false));
});

test('public guard blocks cross-site API use, caps traffic, allows health and resets its window', () => {
  let now = 0;
  const guard = publicSecurity(() => now);
  function request(path: string, site = 'same-origin') {
    let status = 200, continued = false;
    const headers: Record<string, string> = {};
    const response = {
      set(key: string | Record<string, string>, value?: string) { if (typeof key === 'string') headers[key] = value!; else Object.assign(headers, key); return this; },
      status(value: number) { status = value; return this; },
      json() { return this; },
    };
    guard({ path, get: () => site } as unknown as Request, response as unknown as Response, () => { continued = true; });
    return { status, continued, headers };
  }
  const blocked = request('/api/search', 'cross-site');
  assert.equal(blocked.status, 403); assert.equal(blocked.continued, false);
  assert.equal(blocked.headers['Cache-Control'], 'no-store');
  const page = request('/');
  assert(page.continued); assert(page.headers['Content-Security-Policy'].includes("script-src 'self'"));
  for (let i = 0; i < 120; i++) assert(request('/api/search').continued);
  const limited = request('/api/search');
  assert.equal(limited.status, 429); assert.equal(limited.headers['Retry-After'], '60');
  assert(request('/api/health').continued); assert(request('/assets/app.js').continued);
  now = 60_000;
  assert(request('/api/search').continued);
});
