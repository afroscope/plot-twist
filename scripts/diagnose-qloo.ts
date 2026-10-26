import { loadEnvFile } from 'node:process';
import { createQlooProvider } from '../server/providers/qloo.js';
import { DiscoveryError } from '../server/providers/provider.js';

// Only fixed diagnostic fields are printed: never credentials, URLs, bodies,
// entity metadata, or raw exception messages. Uses the app's actual adapter.
try {
  loadEnvFile('.env');
  if (!process.env.QLOO_API_KEY?.trim()) throw new Error('missing-key');
  const provider = createQlooProvider({
    apiKey: process.env.QLOO_API_KEY,
    onDiagnostic: event => console.log(JSON.stringify(event)),
  });
  const matches = await provider.search('Fela Kuti', 'Music');
  const seed = matches.find(item => item.title.toLowerCase() === 'fela kuti');
  if (!seed) {
    console.log('Exact Fela Kuti match unavailable; no recommendation requests made.');
    process.exitCode = 1;
  } else {
    const journey = await provider.createJourney({ mode: 'qloo', favouriteIds: [seed.id], adventure: 'curious', feedback: {}, revision: 0 });
    console.log(JSON.stringify({ journeyStatus: journey.status, categories: journey.stops.map(stop => stop.medium) }));
  }
} catch (error) {
  console.log(JSON.stringify({ error: error instanceof DiscoveryError ? error.code : 'SETUP_OR_LOCAL_FAILURE' }));
  process.exitCode = 1;
}
