import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiscoveryAgent } from '../server/agent/discovery.js';
import { createOpenAIModel, type AgentModel, type ModelMessage, type ToolCall } from '../server/agent/model.js';
import { DiscoveryError } from '../server/providers/provider.js';
import { createQlooProvider, type QlooCandidate, type QlooProvider, type QlooQuery } from '../server/providers/qloo.js';
import { journeyInputSchema, type JourneyInput } from '../shared/contracts.js';
import type { Medium } from '../shared/catalog.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const candidate = (n: number, medium: Medium): QlooCandidate => ({ id: id(n), medium, title: `Title ${n}`, creator: 'Catalogue creator', tags: ['quiet'], palette: 'clay', description: 'Verified catalogue description.' });
const seed = candidate(1, 'Music');
const picks = [candidate(10, 'Music'), candidate(20, 'Film'), candidate(30, 'Book')];
const input: JourneyInput = { mode: 'agent', favouriteIds: [seed.id], adventure: 'curious', revision: 0, feedback: {} };
const query = (medium: Medium, signalIds = [seed.id], offset = 0) => ({ medium, signalIds, offset });
const call = (name: string, args: unknown): ToolCall => ({ id: 'call-test', type: 'function', function: { name, arguments: JSON.stringify(args) } });
const explore = (queries = picks.map(item => query(item.medium))) => call('explore', { queries });
const finish = (items = picks) => call('finish_journey', { title: 'A quiet detour.', summary: 'An editorial journey through Qloo candidates.', stops: items.map(item => ({ id: item.id, interpretation: 'I would try this as a quiet next step.' })) });
function fixture(steps: (ToolCall | ((messages: ModelMessage[]) => ToolCall))[], options: {
  items?: QlooCandidate[]; recommend?: (query: QlooQuery) => Promise<QlooCandidate[]>;
} = {}) {
  const items = new Map([seed, ...picks, ...(options.items ?? [])].map(item => [item.id, item]));
  const requests: QlooQuery[] = [];
  const histories: ModelMessage[][] = [];
  const qloo: QlooProvider = { configured: true, lookup: id => items.get(id), search: async () => [seed],
    createJourney: async () => { throw new Error('Fixed baseline must not run in agent mode'); },
    recommend: async request => { requests.push(request); return options.recommend ? options.recommend(request) : picks.filter(item => item.medium === request.medium); },
  };
  const model: AgentModel = { configured: true, next: async messages => {
    histories.push(structuredClone(messages)); const step = steps.shift(); assert(step, 'Unexpected model turn');
    return typeof step === 'function' ? step(messages) : step;
  } };
  return { qloo, model, requests, histories, agent: createDiscoveryAgent(qloo, model) };
}
function toolResult(messages: ModelMessage[]) {
  const message = messages.at(-1); assert(message?.role === 'tool'); return JSON.parse(message.content);
}

test('agent chooses queries, inspects Qloo results and refines an empty category before finishing', async () => {
  const f = fixture([explore(), messages => {
    const results = toolResult(messages).result;
    assert.equal(results.find((result: { medium: string }) => result.medium === 'Book').candidates.length, 0);
    // This scripted model decides to use the returned film as a bridge.
    return explore([query('Book', [picks[1].id], 12)]);
  }, finish()], { recommend: async q => q.medium === 'Book' && q.offset === 0 ? [] : picks.filter(item => item.medium === q.medium) });
  const journey = await f.agent.createJourney(input);
  assert.equal(journey.method, 'agent'); assert.equal(journey.status, 'ok');
  assert.equal(f.requests.length, 4);
  assert.deepEqual(f.requests[3].signalIds, [picks[1].id]);
  assert.match(journey.stops[2].connection, /Title 20/);
  assert.equal(journey.stops[2].description, picks[2].description);
  assert(journey.explanation);
  assert.deepEqual(journey.explanation.searches.map(search => [search.number, search.round, search.medium, search.candidateCount]),
    [[1, 1, 'Music', 1], [2, 1, 'Film', 1], [3, 1, 'Book', 0], [4, 2, 'Book', 1]]);
  assert.equal(journey.explanation.searches[3].signals[0].source, 'discovery');
  assert.equal(journey.explanation.selections[2].searchNumber, 4);
  assert.equal(journey.explanation.uniqueCandidates, 3);
});
test('kept book is retained and becomes a signal; more adventurous music is excluded and explored further', async () => {
  const nextMusic = candidate(11, 'Music');
  const f = fixture([messages => {
    const brief = JSON.parse((messages[1] as { content: string }).content);
    assert.equal(brief.feedback.find((entry: { item: { id: string } }) => entry.item.id === picks[0].id).action, 'farther');
    assert.deepEqual(brief.keptIds, [picks[2].id]);
    return explore([query('Music', [seed.id, picks[2].id], 12), query('Film', [picks[2].id])]);
  }, finish([nextMusic, picks[1], picks[2]])], { items: [nextMusic], recommend: async q => q.medium === 'Music' ? [picks[0], nextMusic] : [picks[1]] });
  const journey = await f.agent.createJourney({ ...input, revision: 1, feedback: { [picks[2].id]: 'love', [picks[0].id]: 'farther' } });
  assert.deepEqual(journey.stops.map(item => item.id), [nextMusic.id, picks[1].id, picks[2].id]);
  assert.equal(f.requests.some(q => q.medium === 'Book'), false);
  assert(f.requests.every(q => q.excludeIds.includes(picks[0].id)));
  assert.match(journey.stops[2].connection, /^Kept/);
  assert(journey.explanation);
  assert.deepEqual(journey.explanation.selections[2], { item: { id: picks[2].id, title: picks[2].title, medium: 'Book' }, kept: true });
  assert.equal(journey.explanation.searches[0].signals[1].source, 'kept');
  assert.equal(journey.explanation.brief.feedback.find(entry => entry.action === 'farther')?.item.medium, 'Music');
  assert.equal(journey.explanation.uniqueCandidates, 2);
});
test('known and disliked items stay distinct in the brief and both are excluded even if upstream returns them', async () => {
  const dislike = candidate(2, 'Music'), known = candidate(3, 'Music');
  const f = fixture([explore(), messages => {
    const brief = JSON.parse((messages[1] as { content: string }).content);
    assert.equal(brief.disliked[0].id, dislike.id); assert.equal(brief.known[0].id, known.id);
    const music = toolResult(messages).result.find((result: { medium: string }) => result.medium === 'Music');
    assert.deepEqual(music.candidates.map((item: { id: string }) => item.id), [picks[0].id]);
    return finish();
  }], { items: [dislike, known], recommend: async q => [...picks.filter(item => item.medium === q.medium), dislike, known, seed] });
  const journey = await f.agent.createJourney({ ...input, dislikedIds: [dislike.id], knownIds: [known.id], context: 'A quiet evening.' });
  assert.equal(journey.status, 'ok');
  assert(f.requests.every(q => [seed.id, dislike.id, known.id].every(value => q.excludeIds.includes(value))));
  assert.equal(journey.explanation?.brief.context, 'A quiet evening.');
  assert.equal(journey.explanation?.brief.known[0].id, known.id);
  assert.equal(journey.explanation?.brief.disliked[0].id, dislike.id);
  assert.deepEqual(journey.explanation?.searches.map(search => search.candidateCount), [1, 1, 1]);
});
test('unknown final IDs, omitted categories and dropping a kept stop are rejected and can be corrected', async () => {
  const f = fixture([finish(), explore([query('Music'), query('Film')]), finish([candidate(99, 'Music'), picks[1], picks[2]]),
    finish([picks[0], picks[1]]), messages => { assert.match(toolResult(messages).result.error, /preserve/); return finish(); }]);
  const journey = await f.agent.createJourney({ ...input, feedback: { [picks[2].id]: 'love' } });
  assert.equal(journey.status, 'ok'); assert.equal(f.histories.length, 5);
});
test('invented or excluded tool signals never reach Qloo', async () => {
  const dislike = candidate(2, 'Music');
  const f = fixture([explore([query('Music', [id(999)])]), explore([query('Music', [dislike.id])]), explore(), finish()], { items: [dislike] });
  await f.agent.createJourney({ ...input, dislikedIds: [dislike.id] });
  assert.equal(f.requests.length, 3);
});
test('farther feedback requires a changed retrieval strategy for that category', async () => {
  const replacement = candidate(11, 'Music');
  const f = fixture([explore(), messages => {
    assert.match(toolResult(messages).result.error, /marked farther/);
    return explore([query('Music', [seed.id], 12), query('Film'), query('Book')]);
  }, finish([replacement, picks[1], picks[2]])], { items: [replacement], recommend: async q => q.medium === 'Music' ? [replacement] : picks.filter(item => item.medium === q.medium) });
  await f.agent.createJourney({ ...input, feedback: { [picks[0].id]: 'farther' } });
  assert.equal(f.requests.length, 3); assert.equal(f.requests[0].offset, 12);
});
test('a third simultaneous run is rejected and cancellation releases the slots', async () => {
  const f = fixture([]);
  const controllers = [new AbortController(), new AbortController()];
  const model: AgentModel = { configured: true, next: async (_messages, _tools, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true });
  }) };
  const agent = createDiscoveryAgent(f.qloo, model);
  const pending = controllers.map(controller => agent.createJourney(input, controller.signal));
  await assert.rejects(agent.createJourney(input), { code: 'AGENT_BUSY' });
  controllers.forEach(controller => controller.abort());
  const results = await Promise.allSettled(pending);
  assert(results.every(result => result.status === 'rejected' && result.reason.code === 'AGENT_TIMEOUT'));
  const again = new AbortController();
  const last = agent.createJourney(input, again.signal); again.abort();
  await assert.rejects(last, { code: 'AGENT_TIMEOUT' });
});
test('expired IDs need reselection before spending model calls', async () => {
  const f = fixture([]);
  const result = await f.agent.createJourney({ ...input, knownIds: [id(999)] });
  assert.equal(result.status, 'needs_input'); assert.equal(f.histories.length, 0);
});
test('contradictory keeps and multiple keeps in a category fail before model calls', async () => {
  const other = candidate(11, 'Music'); const f = fixture([], { items: [other] });
  for (const bad of [{ ...input, dislikedIds: [picks[0].id], feedback: { [picks[0].id]: 'love' as const } },
    { ...input, feedback: { [picks[0].id]: 'love' as const, [other.id]: 'love' as const } }]) {
    await assert.rejects(f.agent.createJourney(bad), { code: 'INVALID_INPUT' });
  }
  assert.equal(f.histories.length, 0);
});
test('bounded repair never falls back to the fixed sequence or demo', async () => {
  const f = fixture(Array.from({ length: 6 }, () => call('arbitrary_tool', { url: 'https://example.invalid' })));
  await assert.rejects(f.agent.createJourney(input), { code: 'AGENT_LIMIT' });
  assert.equal(f.histories.length, 6); assert.equal(f.requests.length, 0);
});
test('at most six Qloo queries; duplicate queries cannot waste upstream calls', async () => {
  const f = fixture([explore(), explore(), explore(picks.map(item => query(item.medium, [seed.id], 12))),
    explore([query('Music', [seed.id], 24)]), finish()]);
  await f.agent.createJourney(input);
  assert.equal(f.requests.length, 6);
  assert.match(toolResult(f.histories[4]).result.error, /budget/);
});
test('partial Qloo failure is visible; empty results are not invented', async () => {
  const f = fixture([explore(), finish(picks.slice(0, 2))], { recommend: async q => {
    if (q.medium === 'Book') throw new DiscoveryError('QLOO_UNAVAILABLE', 503, 'Private upstream detail');
    return picks.filter(item => item.medium === q.medium);
  } });
  const journey = await f.agent.createJourney(input);
  assert.equal(journey.status, 'degraded'); assert.equal(journey.stops.length, 2);
  assert.equal(journey.explanation?.searches[2].status, 'unavailable');
  assert.equal(journey.explanation?.searches[2].candidateCount, 0);
  assert(!JSON.stringify(journey.explanation).includes('Private upstream detail'));
  assert(!JSON.stringify(f.histories).includes('Private upstream detail'));
  const empty = fixture([explore(), finish([])], { recommend: async () => [] });
  assert.equal((await empty.agent.createJourney(input)).status, 'empty');
});
test('explanation counts distinct candidates once and records only executed searches', async () => {
  const f = fixture([explore(), explore(), explore(picks.map(item => query(item.medium, [seed.id], 12))), finish()]);
  const journey = await f.agent.createJourney(input);
  assert(journey.explanation);
  assert.equal(journey.explanation.searches.length, 6);
  assert.equal(journey.explanation.searches.reduce((sum, search) => sum + search.candidateCount, 0), 6);
  assert.equal(journey.explanation.uniqueCandidates, 3);
  assert.deepEqual(journey.explanation.selections.map(selection => selection.searchNumber), [1, 2, 3]);
  assert.deepEqual(journey.explanation.searches.map(search => search.signals.map(item => item.id)), f.requests.map(request => request.signalIds));
});
test('all-kept journey explanation invents neither new searches nor new candidates', async () => {
  const f = fixture([finish()]);
  const journey = await f.agent.createJourney({ ...input, feedback: Object.fromEntries(picks.map(item => [item.id, 'love' as const])) });
  assert.equal(journey.explanation?.uniqueCandidates, 0);
  assert.deepEqual(journey.explanation?.searches, []);
  assert(journey.explanation?.selections.every(selection => selection.kept && selection.searchNumber === undefined));
});
test('cancellation after a model response stops all following tools', async () => {
  const controller = new AbortController();
  const f = fixture([() => { controller.abort(); return explore(); }]);
  await assert.rejects(f.agent.createJourney(input, controller.signal), { code: 'AGENT_TIMEOUT' });
  assert.equal(f.requests.length, 0);
});
test('run deadline aborts a pending model request', async () => {
  const f = fixture([]);
  const model: AgentModel = { configured: true, next: async (_messages, _tools, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Timed out')), { once: true });
  }) };
  // Keep the test process alive: AbortSignal.timeout deliberately uses an unref timer.
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(createDiscoveryAgent(f.qloo, model, { timeoutMs: 10 }).createJourney(input), { code: 'AGENT_TIMEOUT' }); }
  finally { clearTimeout(keepAlive); }
});
test('model configuration failure and shared run allowance are explicit', async () => {
  const f = fixture(Array.from({ length: 20 }, () => [explore(), finish()]).flat());
  await assert.rejects(createDiscoveryAgent(f.qloo, { ...f.model, configured: false }).createJourney(input), { code: 'AGENT_NOT_CONFIGURED' });
  for (let run = 0; run < 20; run++) await f.agent.createJourney(input);
  await assert.rejects(f.agent.createJourney(input), { code: 'AGENT_BUSY' });
});
test('structured input rejects contradictory groups, duplicates, oversized context and feedback', () => {
  assert(journeyInputSchema.safeParse({ ...input, knownIds: [id(2)], context: 'Some context' }).success);
  for (const bad of [{ ...input, knownIds: [seed.id] }, { ...input, dislikedIds: [id(2), id(2)] }, { ...input, context: 'x'.repeat(1001) },
    { ...input, feedback: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [id(i + 100), 'known'])) }]) assert(!journeyInputSchema.safeParse(bad).success);
});
test('model adapter uses server-only auth, bounded tool calls, no storage or redirects', async () => {
  let calls = 0;
  const model = createOpenAIModel({ apiKey: 'fixture-secret', fetch: async (url, init) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/chat/completions'); assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fixture-secret');
    const body = JSON.parse(String(init?.body)); assert.equal(body.store, false); assert.equal(body.parallel_tool_calls, false);
    assert.equal(body.max_completion_tokens, 2000); assert.equal(body.reasoning_effort, 'none');
    assert(!String(init?.body).includes('fixture-secret'));
    return Response.json({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [explore()] } }] });
  } });
  assert.equal((await model.next([], [], new AbortController().signal)).function.name, 'explore'); assert.equal(calls, 1);
});
test('model auth, quota, malformed output and network errors are sanitised with no retry', async () => {
  for (const [status, code] of [[401, 'AGENT_AUTH'], [429, 'AGENT_RATE_LIMITED'], [500, 'AGENT_UNAVAILABLE'], [200, 'AGENT_RESPONSE']] as const) {
    let calls = 0;
    const model = createOpenAIModel({ apiKey: 'fixture-secret', fetch: async () => { calls++; return Response.json({ secret: 'private-body' }, { status }); } });
    await assert.rejects(model.next([], [], new AbortController().signal), error => {
      assert(error instanceof DiscoveryError); assert.equal(error.code, code); assert(!error.message.includes('private-body')); return true;
    }); assert.equal(calls, 1);
  }
  const model = createOpenAIModel({ apiKey: 'fixture-secret', fetch: async () => { throw new Error('private-network-details'); } });
  await assert.rejects(model.next([], [], new AbortController().signal), { code: 'AGENT_UNAVAILABLE' });
});
test('real Qloo tool adapter enforces category, exclusion and fixed endpoint boundaries', async () => {
  const artist = (item: QlooCandidate) => ({ entity_id: item.id, name: item.title, types: ['urn:entity:artist'] });
  let count = 0;
  const qloo = createQlooProvider({ apiKey: 'fixture-secret', fetch: async url => {
    count++; const parsed = new URL(String(url)); assert.equal(parsed.origin, 'https://hackathon.api.qloo.com');
    if (parsed.pathname === '/search') return Response.json({ results: [artist(seed)] });
    assert.equal(parsed.searchParams.get('offset'), '12');
    assert.equal(parsed.searchParams.get('filter.exclude.entities'), seed.id);
    return Response.json({ results: { entities: [artist(seed), artist(picks[0])] } });
  } });
  await qloo.search('seed');
  assert.equal(qloo.lookup(seed.id)?.title, seed.title);
  const result = await qloo.recommend({ medium: 'Music', signalIds: [seed.id], excludeIds: [seed.id], offset: 12 });
  assert.deepEqual(result.map(item => item.id), [picks[0].id]);
  await assert.rejects(qloo.recommend({ medium: 'Music', signalIds: [id(999)], excludeIds: [], offset: 0 }), { code: 'INVALID_TOOL_INPUT' });
  assert.equal(count, 2);
});
test('model quota exhaustion is distinguished from temporary rate limiting without exposing upstream details', async () => {
  for (const error of [{ code: 'insufficient_quota', type: 'insufficient_quota' }, { code: null, type: 'insufficient_quota' },
    ...['credit_balance_exhausted', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'organization_usage_limit_exceeded'].map(code => ({ code, type: 'quota' })),
    { code: 'rate_limit_exceeded', type: 'requests' }]) {
    let count = 0;
    const model = createOpenAIModel({ apiKey: 'fixture-secret', fetch: async () => {
      count++; return Response.json({ error: { ...error, message: 'private-account-value' } }, { status: 429 });
    } });
    await assert.rejects(model.next([], [], new AbortController().signal), caught => {
      assert(caught instanceof DiscoveryError);
      assert.equal(caught.code, error.type !== 'requests' ? 'AGENT_QUOTA_EXHAUSTED' : 'AGENT_RATE_LIMITED');
      assert(!caught.message.includes('private-account-value')); return true;
    });
    assert.equal(count, 1);
  }
});
