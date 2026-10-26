import { z } from 'zod';
import type { CulturalItem, Medium } from '../../shared/catalog.js';
import type { Journey, JourneyInput, JourneyStop } from '../../shared/contracts.js';
import { DiscoveryError, ProviderUnavailableError, type RecommendationProvider } from './provider.js';

const types: Record<Medium, string> = { Music: 'urn:entity:artist', Film: 'urn:entity:movie', Book: 'urn:entity:book' };
const uuid = z.string().uuid();
const entitySchema = z.object({
  entity_id: uuid, name: z.string().min(1).max(500),
  types: z.array(z.string()).optional(), subtype: z.string().optional(),
  disambiguation: z.string().optional(), popularity: z.number().optional(),
  properties: z.object({ description: z.string().optional() }).passthrough().optional(),
  tags: z.array(z.object({ name: z.string() }).passthrough()).optional(),
}).passthrough();
type Entity = z.infer<typeof entitySchema>;
export interface QlooOptions { apiKey?: string; fetch?: typeof fetch; now?: () => number; timeoutMs?: number }
export interface QlooProvider extends RecommendationProvider {
  configured: boolean;
  search(query: string, medium?: Medium): Promise<CulturalItem[]>;
}
// Direct REST adapter, reviewed against Qloo's public API documentation.
// No credentials, raw upstream bodies, or personal identifiers leave this boundary.
export function createQlooProvider(options: QlooOptions = {}): QlooProvider {
  const apiKey = options.apiKey?.trim();
  const request = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const entities = new Map<string, { entity: Entity; time: number }>();
  const cache = new Map<string, { entities: Entity[]; time: number }>();
  let calls: number[] = [];
  const mediumOf = (item: Entity) => (Object.keys(types) as Medium[]).find(m => item.subtype === types[m] || item.types?.includes(types[m]));
  function remember(items: Entity[]) {
    for (const entity of items) {
      entities.delete(entity.entity_id);
      entities.set(entity.entity_id, { entity, time: now() });
    }
    while (entities.size > 500) entities.delete(entities.keys().next().value!);
  }
  function known(id: string) {
    const found = entities.get(id);
    return found && now() - found.time < 30 * 60_000 ? found.entity : undefined;
  }
  function cultural(item: Entity): CulturalItem {
    const medium = mediumOf(item)!;
    return { id: item.entity_id, title: item.name, medium,
      creator: item.disambiguation || `${medium === 'Music' ? 'Artist' : medium} · Qloo catalogue`,
      tags: (item.tags ?? []).slice(0, 8).map(tag => tag.name),
      palette: { Music: 'clay', Film: 'wine', Book: 'blue' }[medium] };
  }
  async function get(path: string, params: Record<string, string>): Promise<Entity[]> {
    if (!apiKey) throw new ProviderUnavailableError('Qloo key is not configured.');
    const url = new URL(path, 'https://hackathon.api.qloo.com');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const cached = cache.get(url.href);
    if (cached && now() - cached.time < 5 * 60_000) { remember(cached.entities); return cached.entities; }
    calls = calls.filter(time => now() - time < 60_000);
    if (calls.length >= 30) throw new DiscoveryError('RATE_LIMITED', 429, 'Discovery is taking a short break. Try again in a minute.');
    calls.push(now());
    try {
      const response = await request(url, { headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(options.timeoutMs ?? 8000) });
      if (response.status === 401 || response.status === 403) throw new DiscoveryError('QLOO_AUTH', 503, 'Qloo access needs attention. Check the server’s hackathon API key.');
      if (response.status === 429) throw new DiscoveryError('RATE_LIMITED', 429, 'Qloo’s request limit has been reached. Please try again later.');
      if (response.status === 404 && path === '/search') return [];
      if (!response.ok) throw new DiscoveryError('QLOO_UNAVAILABLE', 503, 'Qloo could not complete this request. Please try again later.');
      const body: unknown = await response.json();
      const envelope = z.object({ success: z.boolean().optional(), results: z.union([z.array(z.unknown()), z.object({ entities: z.array(z.unknown()) })]) }).safeParse(body);
      if (!envelope.success || envelope.data.success === false) throw new DiscoveryError('QLOO_RESPONSE', 502, 'Qloo returned an unexpected response. Please try again later.');
      const raw = Array.isArray(envelope.data.results) ? envelope.data.results : envelope.data.results.entities;
      const parsed = raw.map(item => entitySchema.safeParse(item));
      // A malformed record must not be disguised as a successful empty result.
      if (parsed.some(item => !item.success)) throw new DiscoveryError('QLOO_RESPONSE', 502, 'Qloo returned incomplete entity information. Please try again later.');
      const items = parsed.flatMap(item => item.success && mediumOf(item.data) ? [item.data] : []);
      remember(items);
      cache.set(url.href, { entities: items, time: now() });
      while (cache.size > 100) cache.delete(cache.keys().next().value!);
      return items;
    } catch (error) {
      if (error instanceof DiscoveryError || error instanceof ProviderUnavailableError) throw error;
      throw new DiscoveryError('QLOO_UNAVAILABLE', 503, 'We couldn’t reach Qloo. Please try again later.');
    }
  }
  return {
    configured: Boolean(apiKey),
    async search(query, medium) {
      const params = { query, types: medium ? types[medium] : Object.values(types).join(','), take: '12' };
      const items = await get('/search', params);
      return items.filter(item => !medium || mediumOf(item) === medium).map(cultural);
    },
    async createJourney(input: JourneyInput): Promise<Journey> {
      if (!apiKey) throw new ProviderUnavailableError('Qloo key is not configured.');
      const ids = [...input.favouriteIds, ...Object.keys(input.feedback)];
      if (ids.some(id => !uuid.safeParse(id).success || !known(id))) {
        return { source: 'qloo', status: 'needs_input', title: 'Let’s reconnect your favourites.',
          summary: 'Search for and select your favourites again. Their catalogue references have expired or are unrecognised.', stops: [] };
      }
      const seeds = input.favouriteIds.map(id => known(id)!);
      const loved = Object.entries(input.feedback).filter(([,value]) => value === 'love').map(([id]) => known(id)!);
      const skipped = Object.entries(input.feedback).filter(([,value]) => value === 'skip').map(([id]) => id);
      const signals = [...new Set([...input.favouriteIds, ...loved.map(item => item.entity_id)])];
      const excluded = new Set([...signals, ...skipped]);
      const results = await Promise.allSettled((Object.keys(types) as Medium[]).map(async medium => {
        const retained = loved.find(item => mediumOf(item) === medium);
        let item = retained;
        if (!item) {
          const candidates = (await get('/v2/insights', { 'filter.type': types[medium],
            'signal.interests.entities': signals.join(','), 'filter.exclude.entities': [...excluded].join(','),
            sort_by: 'affinity', take: '12' })).filter(item => mediumOf(item) === medium && !excluded.has(item.entity_id));
          // Product interpretation: widen the selection window within Qloo's ranked candidates.
          // This is not a Qloo novelty score or an individual match probability.
          const start = Math.min({ gentle: 0, curious: 3, wild: 7 }[input.adventure], Math.max(0, candidates.length - 1));
          const window = candidates.slice(start, start + 3);
          item = window[input.revision % Math.max(1, window.length)];
        }
        if (!item) return undefined;
        return { ...cultural(item), description: item.properties?.description?.slice(0, 700) || 'Explore this discovery from Qloo’s cultural catalogue.',
          connection: retained ? 'Kept because you chose it. It also informs the next suggestions.'
            : `Returned by Qloo using your selected favourites${loved.length ? ' and kept discoveries' : ''} as taste signals: ${seeds.map(s => s.name).join(', ')}.`,
          invitation: medium === 'Music' ? 'Explore a track by this artist.' : medium === 'Film' ? 'Watch the trailer and see what catches your attention.' : 'Try a few opening pages.',
        } satisfies JourneyStop;
      }));
      const failures = results.filter(result => result.status === 'rejected');
      const stops = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
      if (!stops.length && failures.length) throw (failures[0] as PromiseRejectedResult).reason;
      return { source: 'qloo', status: failures.length ? 'degraded' : stops.length === 3 ? 'ok' : stops.length ? 'partial' : 'empty',
        title: ['Familiar feeling. New world.', 'Follow the unexpected thread.', 'A very different kind of familiar.'][{ gentle: 0, curious: 1, wild: 2 }[input.adventure]],
        summary: 'Qloo supplies cultural affinities. PLOT TWIST chooses a path through them; adventure level explores different positions in the returned ranking.',
        notices: failures.length ? ['Some categories could not be reached. These are the available results; try revising later.']
          : stops.length < 3 ? ['Qloo did not return an available discovery in every category. Try changing your favourites or resetting feedback.'] : [], stops };
    },
  };
}
export const qlooProvider = createQlooProvider();
