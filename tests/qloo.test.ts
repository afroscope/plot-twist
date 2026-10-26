import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQlooProvider, type QlooDiagnostic } from '../server/providers/qloo.js';
import { DiscoveryError, ProviderUnavailableError } from '../server/providers/provider.js';
import type { JourneyInput } from '../shared/contracts.js';

// These are contract fixtures, not captured live Qloo responses.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const entity = (n: number, subtype = 'urn:entity:artist') => ({ entity_id: id(n), name: `Title ${n}`, subtype,
  disambiguation: `Creator ${n}`, properties: { description: `Description ${n}` } });
const input: JourneyInput = { mode: 'qloo', favouriteIds: [id(1)], adventure: 'gentle', feedback: {}, revision: 0 };
function harness(fail?: string) {
  const calls: URL[] = [];
  const provider = createQlooProvider({ apiKey: 'test-only-credential', fetch: async (target, options) => {
    const url = new URL(String(target)); calls.push(url);
    assert.equal(url.origin, 'https://hackathon.api.qloo.com');
    assert.equal(new Headers(options?.headers).get('X-Api-Key'), 'test-only-credential');
    assert.equal(options?.redirect, 'error');
    assert(!url.href.includes('test-only-credential'));
    if (url.pathname === '/search') return Response.json({ results: [entity(1), entity(2)] });
    const type = url.searchParams.get('filter.type')!;
    if (type === fail) return new Response('', { status: 503 });
    const start = type === 'urn:entity:artist' ? 10 : type === 'urn:entity:movie' ? 30 : 50;
    return Response.json({ success: true, results: { entities: Array.from({ length: 12 }, (_, i) => entity(start + i, type)) } });
  } });
  return { provider, calls };
}
test('Qloo key stays on backend; search returns explicit matches and caches requests', async () => {
  const { provider, calls } = harness();
  const items = await provider.search('Sade', 'Music');
  assert.equal(items[0].id, id(1)); assert.equal(items[0].creator, 'Creator 1');
  assert.equal(calls[0].searchParams.get('types'), 'urn:entity:artist');
  await provider.search('Sade', 'Music'); assert.equal(calls.length, 1);
  assert(!JSON.stringify(items).includes('test-only-credential'));
});
test('journey queries three categories using only confirmed IDs and distinguishes provenance', async () => {
  const { provider, calls } = harness(); await provider.search('Sade');
  const journey = await provider.createJourney(input);
  assert.equal(journey.source, 'qloo'); assert.equal(journey.status, 'ok');
  assert.deepEqual(journey.stops.map(s => s.medium), ['Music', 'Film', 'Book']);
  assert(calls.slice(1).every(url => url.searchParams.get('signal.interests.entities') === id(1)));
  assert(calls.slice(1).every(url => url.searchParams.get('filter.exclude.entities') === id(1)));
});
test('adventure levels select different positions within returned rankings', async () => {
  const { provider } = harness(); await provider.search('Sade');
  const gentle = await provider.createJourney(input);
  const curious = await provider.createJourney({ ...input, adventure: 'curious' });
  const wild = await provider.createJourney({ ...input, adventure: 'wild' });
  assert.equal(gentle.stops[0].id, id(10)); assert.equal(curious.stops[0].id, id(13)); assert.equal(wild.stops[0].id, id(17));
});
test('feedback retains loves, adds them to signals and excludes skips even if upstream returns them', async () => {
  const { provider, calls } = harness(); await provider.search('Sade');
  const first = await provider.createJourney(input);
  const love = first.stops[0].id, skip = first.stops[1].id;
  const next = await provider.createJourney({ ...input, revision: 1, feedback: { [love]: 'love', [skip]: 'skip' } });
  assert(next.stops.some(s => s.id === love)); assert(!next.stops.some(s => s.id === skip));
  assert(calls.at(-1)!.searchParams.get('signal.interests.entities')!.includes(love));
  assert(calls.at(-1)!.searchParams.get('filter.exclude.entities')!.includes(skip));
});
test('changing favourites changes Qloo signals', async () => {
  const { provider, calls } = harness(); await provider.search('Sade');
  await provider.createJourney({ ...input, favouriteIds: [id(2)] });
  assert.equal(calls.at(-1)!.searchParams.get('signal.interests.entities'), id(2));
});
test('unknown and expired IDs require reselection instead of silently substituting a favourite', async () => {
  let now = 0;
  const provider = createQlooProvider({ apiKey: 'test', now: () => now, fetch: async () => Response.json({ results: [entity(1)] }) });
  assert.equal((await provider.createJourney(input)).status, 'needs_input');
  await provider.search('Sade'); now = 31 * 60_000;
  assert.equal((await provider.createJourney(input)).status, 'needs_input');
});
test('unconfigured Qloo never silently falls back to demo data', async () => {
  const provider = createQlooProvider();
  await assert.rejects(provider.search('Sade'), ProviderUnavailableError);
  await assert.rejects(provider.createJourney(input), ProviderUnavailableError);
});
test('one failing category returns labelled degraded results', async () => {
  const { provider } = harness('urn:entity:movie'); await provider.search('Sade');
  const result = await provider.createJourney(input);
  assert.equal(result.status, 'degraded'); assert.equal(result.stops.length, 2); assert(result.notices?.length);
});
test('empty categories return partial or empty states without demo substitutions', async () => {
  for (const partial of [true, false]) {
    const provider = createQlooProvider({ apiKey: 'test', fetch: async target => {
      const url = new URL(String(target));
      if (url.pathname === '/search') return Response.json({ results: [entity(1)] });
      return Response.json({ results: { entities: partial && url.searchParams.get('filter.type') === 'urn:entity:artist' ? [entity(10)] : [] } });
    } });
    await provider.search('Sade'); const result = await provider.createJourney(input);
    assert.equal(result.status, partial ? 'partial' : 'empty');
    assert.equal(result.stops.length, partial ? 1 : 0);
  }
});
test('authentication and quota errors are distinct and are never retried', async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0;
    const provider = createQlooProvider({ apiKey: 'test', fetch: async () => { calls++; return new Response('private-upstream-value', { status }); } });
    await assert.rejects(provider.search('Sade'), error => error instanceof DiscoveryError && error.code === (status === 429 ? 'RATE_LIMITED' : 'QLOO_AUTH') && !error.message.includes('private-upstream-value'));
    assert.equal(calls, 1);
  }
});
test('malformed successful payloads fail explicitly instead of becoming empty results', async () => {
  for (const body of [{}, { results: [{ entity_id: 'invented', name: 'Name' }] }, { success: false, results: [] }]) {
    const provider = createQlooProvider({ apiKey: 'test', fetch: async () => Response.json(body) });
    await assert.rejects(provider.search('Sade'), error => error instanceof DiscoveryError && error.code === 'QLOO_RESPONSE');
  }
});
test('network and timeout failures do not leak raw exceptions', async () => {
  const provider = createQlooProvider({ apiKey: 'test', fetch: async () => { throw new Error('private-key-and-url'); } });
  await assert.rejects(provider.search('Sade'), error => error instanceof DiscoveryError && !error.message.includes('private-key'));
  const timeout = createQlooProvider({ apiKey: 'test', timeoutMs: 1, fetch: async (_url, options) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 50);
      options?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('timeout')); });
    });
    return Response.json({ results: [] });
  } });
  await assert.rejects(timeout.search('Sade'), DiscoveryError);
});
test('local request budget caps unique searches and recovers after a minute', async () => {
  let now = 0, calls = 0;
  const provider = createQlooProvider({ apiKey: 'test', now: () => now, fetch: async () => { calls++; return Response.json({ results: [] }); } });
  for (let n = 0; n < 30; n++) await provider.search(`query-${n}`);
  await assert.rejects(provider.search('query-31'), error => error instanceof DiscoveryError && error.code === 'RATE_LIMITED');
  assert.equal(calls, 30); now = 61_000; await provider.search('query-31'); assert.equal(calls, 31);
});

test('diagnostics identify invalid music fields without exposing credentials or payload values', async () => {
  const events: QlooDiagnostic[] = [];
  const provider = createQlooProvider({ apiKey: 'private-secret', onDiagnostic: event => events.push(event), fetch: async target => {
    const url = new URL(String(target));
    if (url.pathname === '/search') return Response.json({ results: [entity(1)] });
    const type = url.searchParams.get('filter.type')!;
    const row = entity(10, type);
    return Response.json({ results: { entities: [type === 'urn:entity:artist' ? { ...row, disambiguation: { private: 'payload-secret' } } : row] } });
  } });
  await provider.search('Fela Kuti');
  const journey = await provider.createJourney(input);
  assert.equal(journey.status, 'degraded');
  const validation = events.find(event => event.stage === 'validation');
  assert.equal(validation?.category, 'Music');
  assert.deepEqual(validation?.issues, [{ record: 0, path: 'disambiguation', code: 'invalid_type' }]);
  const text = JSON.stringify(events);
  assert(!text.includes('private-secret')); assert(!text.includes('payload-secret'));
  assert(!text.includes('https:')); assert(!text.includes('Title'));
});

test('diagnostics distinguish upstream HTTP errors, invalid JSON, network errors and timeouts', async () => {
  for (const kind of ['http', 'validation', 'network', 'timeout']) {
    const events: QlooDiagnostic[] = [];
    const provider = createQlooProvider({ apiKey: 'test', timeoutMs: 5, onDiagnostic: event => events.push(event), fetch: async (_target, options) => {
      if (kind === 'http') return new Response('', { status: 503 });
      if (kind === 'validation') return new Response('not-json');
      if (kind === 'timeout') await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 100);
        options?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('private-exception')); });
      });
      throw new Error('private-exception');
    } });
    await assert.rejects(provider.search('Fela Kuti'), DiscoveryError);
    assert.equal(events.at(-1)?.stage, kind);
    if (kind === 'http') assert.equal(events.at(-1)?.status, 503);
    assert(!JSON.stringify(events).includes('private-exception'));
  }
});

test('an invalid name at music record 1 tags 87 does not discard music recommendations', async () => {
  const events: QlooDiagnostic[] = [];
  const provider = createQlooProvider({ apiKey: 'test', onDiagnostic: event => events.push(event), fetch: async target => {
    const url = new URL(String(target));
    if (url.pathname === '/search') return Response.json({ results: [entity(1)] });
    const type = url.searchParams.get('filter.type')!;
    const rows = [entity(10, type), { ...entity(11, type), tags: [
      ...Array.from({ length: 87 }, (_, i) => ({ name: `Genre ${i}` })), { name: null },
    ] }];
    return Response.json({ results: { entities: rows } });
  } });
  await provider.search('Fela Kuti');
  const journey = await provider.createJourney({ ...input, revision: 1 });
  assert.equal(journey.status, 'ok');
  assert.deepEqual(journey.stops.map(stop => stop.medium), ['Music', 'Film', 'Book']);
  assert.equal(journey.stops[0].id, id(11));
  assert.deepEqual(journey.stops[0].tags, Array.from({ length: 8 }, (_, i) => `Genre ${i}`));
  assert(!events.some(event => event.stage === 'validation'));
});

test('optional tags drop invalid entries without coercion while artist identity remains strict', async () => {
  const tags = [{ name: 'Afrobeat' }, { name: null }, {}, null, 42, { name: 7 }, { name: ' ' }, { name: 'Jazz' }];
  const provider = createQlooProvider({ apiKey: 'test', fetch: async () => Response.json({ results: [{ ...entity(1), tags }] }) });
  assert.deepEqual((await provider.search('Fela Kuti'))[0].tags, ['Afrobeat', 'Jazz']);
  for (const invalid of [{ entity_id: 'invalid' }, { name: null }, { name: '' }]) {
    const strict = createQlooProvider({ apiKey: 'test', fetch: async () => Response.json({ results: [{ ...entity(1), ...invalid, tags }] }) });
    await assert.rejects(strict.search('Fela Kuti'), error => error instanceof DiscoveryError && error.code === 'QLOO_RESPONSE');
  }
});
