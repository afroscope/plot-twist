import { z } from 'zod';
import { createQlooProvider, type QlooProvider } from './providers/qloo.js';
import express, { type ErrorRequestHandler } from 'express';
import { journeyInputSchema } from '../shared/contracts.js';
import { favourites } from '../shared/catalog.js';
import { demoItems, demoProvider } from './providers/demo.js';
import { DiscoveryError, ProviderUnavailableError, type RecommendationProvider } from './providers/provider.js';
import { publicSecurity } from './public-security.js';
import { createDiscoveryAgent, type DiscoveryAgent } from './agent/discovery.js';
import { createOpenAIModel } from './agent/model.js';

export function createApp(provider: RecommendationProvider = demoProvider, liveProvider: QlooProvider = createQlooProvider({ apiKey: process.env.QLOO_API_KEY }), publicDeployment = false,
  agent: DiscoveryAgent = createDiscoveryAgent(liveProvider, createOpenAIModel({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL }))) {
  const app = express();
  app.disable('x-powered-by');
  if (publicDeployment) app.use(publicSecurity());
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    response.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use('/api', express.json({ limit: '8kb' }));
  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', mode: agent.configured ? 'agent' : liveProvider.configured ? 'qloo' : 'demo',
      qloo: liveProvider.configured ? 'configured-unverified' : 'not-configured', agent: agent.configured ? 'configured-unverified' : 'not-configured' });
  });
  app.get('/api/search', async (request, response, next) => {
    const input = z.object({ q: z.string().trim().min(2).max(120), medium: z.enum(['Music', 'Film', 'Book']).optional() }).strict().safeParse(request.query);
    if (!input.success) { response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter 2–120 characters and choose a supported category.' } }); return; }
    try { response.json({ source: 'qloo', items: await liveProvider.search(input.data.q, input.data.medium) }); }
    catch (error) { next(error); }
  });
  app.post('/api/journeys', async (request, response, next) => {
    const input = journeyInputSchema.safeParse(request.body);
    if (!input.success || ((input.data.mode === 'demo' || !input.data.mode) && (input.data.favouriteIds.some(id => !favourites.some(item => item.id === id))
      || Object.keys(input.data.feedback).some(id => !demoItems.some(item => item.id === id))))) {
      response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Choose 1–5 distinct favourites, a valid adventure level and at most 30 feedback choices.' } });
      return;
    }
    const controller = new AbortController();
    const cancel = () => { if (!response.writableEnded) controller.abort(); };
    response.on('close', cancel);
    try {
      const selected = input.data.mode === 'agent' ? agent : input.data.mode === 'qloo' ? liveProvider : provider;
      const journey = await selected.createJourney(input.data, controller.signal);
      if (!controller.signal.aborted) response.json(journey);
    } catch (error) { if (!controller.signal.aborted) next(error); }
    finally { response.off('close', cancel); }
  });
  app.use('/api', (_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'This API route does not exist.' } });
  });
  const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof DiscoveryError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
    } else if (error instanceof ProviderUnavailableError) {
      response.status(503).json({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'Live discovery is not configured. The demo is available separately.' } });
    } else if (error?.type === 'entity.too.large') {
      response.status(413).json({ error: { code: 'TOO_LARGE', message: 'This request is too large.' } });
    } else if (error instanceof SyntaxError) {
      response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Send a valid JSON request.' } });
    } else {
      // Never log request bodies, upstream responses, secrets, or raw exceptions.
      response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The journey could not be prepared. Please try again.' } });
    }
  };
  app.use(handleError);
  return app;
}
