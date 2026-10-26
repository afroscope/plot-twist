import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import express from 'express';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { runtimeConfig } from './config.js';

if (existsSync('.env')) loadEnvFile('.env');
const production = process.argv.includes('--production');
const { port, host } = runtimeConfig(process.env, production);
const app = createApp(undefined, undefined, production);
if (production) {
  const directory = resolve('dist');
  app.use(express.static(directory, { dotfiles: 'deny' }));
  app.get('/{*path}', (_request, response) => { response.sendFile(resolve(directory, 'index.html')); });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const server = app.listen(port, host, () => {
  console.info(`PLOT TWIST listening on ${host}:${port} (${production ? 'production' : 'development'}; Qloo ${process.env.QLOO_API_KEY ? 'configured' : 'key required'})`);
});
server.on('error', () => { console.error('Could not start the server. Check whether HOST and PORT are available.'); process.exit(1); });
process.on('SIGTERM', () => server.close(() => process.exit(0)));
