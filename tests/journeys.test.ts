import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { demoItems, demoProvider } from '../server/providers/demo.js';
import { qlooProvider } from '../server/providers/qloo.js';
import type { RecommendationProvider } from '../server/providers/provider.js';
import type { JourneyInput } from '../shared/contracts.js';

const input: JourneyInput = { favouriteIds: ['seed-sade', 'seed-wong', 'seed-octavia'], adventure: 'curious', revision: 0, feedback: {} };

async function withServer(run: (url: string) => Promise<void>, provider?: RecommendationProvider) {
  // Fixtures never inherit a deployed server's real Qloo credential.
  const server = createApp(provider, qlooProvider).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
function post(url: string, value: unknown) {
  return fetch(`${url}/api/journeys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
}

test('demo journey returns one item per medium with explicit provenance', async () => {
  const journey = await demoProvider.createJourney(input);
  assert.equal(journey.source, 'demo');
  assert.equal(journey.status, 'ok');
  assert.deepEqual(journey.stops.map(stop => stop.medium), ['Music', 'Film', 'Book']);
  assert(journey.stops.every(stop => stop.connection.length > 0));
});
test('adventure and seed choices influence the demo result', async () => {
  const gentle = await demoProvider.createJourney({ ...input, adventure: 'gentle' });
  const wild = await demoProvider.createJourney({ ...input, adventure: 'wild' });
  assert.notDeepEqual(gentle.stops.map(stop => stop.id), wild.stops.map(stop => stop.id));
  const differentTaste = await demoProvider.createJourney({ ...input, favouriteIds: ['seed-bjork'] });
  const original = await demoProvider.createJourney(input);
  assert.notDeepEqual(differentTaste.stops.map(stop => stop.id), original.stops.map(stop => stop.id));
});
test('revision preserves loved items and excludes skipped items', async () => {
  const first = await demoProvider.createJourney(input);
  const loved = first.stops[0]!.id;
  const skipped = first.stops[1]!.id;
  const revised = await demoProvider.createJourney({ ...input, revision: 1, feedback: { [loved]: 'love', [skipped]: 'skip' } });
  assert(revised.stops.some(stop => stop.id === loved));
  assert(!revised.stops.some(stop => stop.id === skipped));
});
test('exhausting a medium returns an explicit empty state', async () => {
  const feedback = Object.fromEntries(demoItems.filter(item => item.medium === 'Music').map(item => [item.id, 'skip' as const]));
  const result = await demoProvider.createJourney({ ...input, feedback });
  assert.equal(result.status, 'empty');
  assert.deepEqual(result.stops, []);
});
test('API validates input, keeps errors generic, and labels demo health', async () => {
  await withServer(async url => {
    assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { status: 'ok', mode: 'demo', qloo: 'not-configured', agent: 'not-configured' });
    const response = await post(url, input);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    for (const invalid of [ {}, { ...input, favouriteIds: [] }, { ...input, favouriteIds: ['unknown'] },
      { ...input, favouriteIds: ['seed-sade', 'seed-sade'] }, { ...input, adventure: 'invalid' },
      { ...input, revision: -1 }, { ...input, feedback: { invented: 'skip' } }, { ...input, credential: 'not-a-real-key' } ]) {
      assert.equal((await post(url, invalid)).status, 400);
    }
    const malformed = await fetch(`${url}/api/journeys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.equal((await post(url, { ...input, extra: 'x'.repeat(10000) })).status, 413);
    assert.equal((await fetch(`${url}/api/missing`)).status, 404);
  });
});
test('unconfigured Qloo fails explicitly without returning demo data', async () => {
  await withServer(async url => {
    const response = await post(url, input);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'PROVIDER_UNAVAILABLE');
  }, qlooProvider);
});
test('agent mode accepts live IDs and reports missing configuration without demo fallback', async () => {
  await withServer(async url => {
    const response = await post(url, { ...input, mode: 'agent', favouriteIds: ['00000000-0000-4000-8000-000000000001'] });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'AGENT_NOT_CONFIGURED');
  });
});
test('unexpected provider errors never expose private details', async () => {
  await withServer(async url => {
    const response = await post(url, input);
    assert.equal(response.status, 500);
    assert(!JSON.stringify(await response.json()).includes('private-upstream-value'));
  }, { async createJourney() { throw new Error('private-upstream-value'); } });
});
