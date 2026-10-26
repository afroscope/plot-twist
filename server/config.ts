export function runtimeConfig(env: NodeJS.ProcessEnv, production: boolean) {
  const port = Number(env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number.');
  const host = env.HOST || '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0', '::1'].includes(host)) throw new Error('HOST must be a supported bind address.');
  if (production && !env.QLOO_API_KEY?.trim()) throw new Error('Set QLOO_API_KEY in the hosting environment before starting production.');
  return { port, host };
}
