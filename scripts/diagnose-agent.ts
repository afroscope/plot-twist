import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createQlooProvider } from '../server/providers/qloo.js';
import { createDiscoveryAgent } from '../server/agent/discovery.js';
import { createOpenAIModel } from '../server/agent/model.js';
import { DiscoveryError } from '../server/providers/provider.js';

if (existsSync('.env')) loadEnvFile('.env');
const qloo = createQlooProvider({ apiKey: process.env.QLOO_API_KEY });
const agent = createDiscoveryAgent(qloo, createOpenAIModel({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL }),
  { onEvent: event => console.log(JSON.stringify(event)) });
if (!agent.configured) {
  console.error('Both QLOO_API_KEY and OPENAI_API_KEY are needed. Run the private setup commands first.'); process.exitCode = 1;
} else {
  try {
    const matches = await qloo.search('Fela Kuti', 'Music');
    const seed = matches.find(item => item.title.toLowerCase() === 'fela kuti');
    if (!seed) throw new DiscoveryError('NO_SEED', 503, 'The diagnostic starting point was not found. Try the app’s search.');
    const journey = await agent.createJourney({ mode: 'agent', favouriteIds: [seed.id], adventure: 'curious', revision: 0, feedback: {} });
    console.log(JSON.stringify({ method: journey.method, journeyStatus: journey.status, categories: journey.stops.map(stop => stop.medium) }));
    if (journey.status !== 'ok') process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify(error instanceof DiscoveryError ? { error: error.code, message: error.message } : { error: 'DIAGNOSTIC_FAILED' })); process.exitCode = 1;
  }
}
