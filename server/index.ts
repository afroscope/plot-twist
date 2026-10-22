import express from 'express';
import { resolve } from 'node:path';
import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number.');
if (process.argv.includes('--production')) {
  const directory = resolve('dist');
  app.use(express.static(directory, { dotfiles: 'deny' }));
  app.get('/{*path}', (_request, response) => { response.sendFile(resolve(directory, 'index.html')); });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const server = app.listen(port, '127.0.0.1', () => {
  console.info(`PLOT TWIST demo: http://127.0.0.1:${port} (Qloo is not configured)`);
});
server.on('error', () => { console.error('Could not start the local server. Check whether PORT is in use.'); process.exit(1); });
process.on('SIGTERM', () => server.close(() => process.exit(0)));
