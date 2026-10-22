import express, { type ErrorRequestHandler } from 'express';
import { journeyInputSchema } from '../shared/contracts.js';
import { favourites } from '../shared/catalog.js';
import { demoItems, demoProvider } from './providers/demo.js';
import { ProviderUnavailableError, type RecommendationProvider } from './providers/provider.js';

export function createApp(provider: RecommendationProvider = demoProvider) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    response.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use('/api', express.json({ limit: '8kb' }));
  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', mode: 'demo', qloo: 'not-configured' });
  });
  app.post('/api/journeys', async (request, response, next) => {
    const input = journeyInputSchema.safeParse(request.body);
    if (!input.success || input.data.favouriteIds.some(id => !favourites.some(item => item.id === id))
      || Object.keys(input.data.feedback).some(id => !demoItems.some(item => item.id === id))) {
      response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Choose 1–5 favourites from the demo catalogue and a valid adventure level.' } });
      return;
    }
    try { response.json(await provider.createJourney(input.data)); }
    catch (error) { next(error); }
  });
  app.use('/api', (_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'This API route does not exist.' } });
  });
  const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ProviderUnavailableError) {
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
