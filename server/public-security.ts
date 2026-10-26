import type { RequestHandler } from 'express';

// Single-instance beta guard. No visitor identifiers or request contents are stored.
export function publicSecurity(now: () => number = Date.now): RequestHandler {
  let windowStart = now(), requests = 0;
  return (request, response, next) => {
    response.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    });
    if (request.path.startsWith('/api/') && request.path !== '/api/health') {
      response.set('Cache-Control', 'no-store');
      if (request.get('Sec-Fetch-Site') === 'cross-site') {
        response.status(403).json({ error: { code: 'CROSS_SITE_REQUEST', message: 'Open PLOT TWIST directly to use discovery.' } }); return;
      }
      const time = now();
      if (time - windowStart >= 60_000) { windowStart = time; requests = 0; }
      if (++requests > 120) {
        response.set('Retry-After', String(Math.max(1, Math.ceil((60_000 - (time - windowStart)) / 1000))));
        response.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Discovery is busy. Please try again in a minute.' } }); return;
      }
    }
    next();
  };
}
