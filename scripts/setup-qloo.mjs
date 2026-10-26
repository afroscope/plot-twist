import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Run this command in your own interactive terminal.'); process.exit(1);
}
if (existsSync('.env') && /^QLOO_API_KEY=.+/m.test(readFileSync('.env', 'utf8'))) {
  console.error('A key is already configured in .env. Edit that file privately to replace it.'); process.exit(1);
}
console.log('Enter your personal Qloo hackathon key. Input is hidden and will be saved only to the ignored local .env file.');
const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
rl.question('', value => {
  rl.close(); const key = value.trim();
  if (!/^[A-Za-z0-9._~-]{8,500}$/.test(key)) { console.error('Key format was not recognised. Nothing was saved.'); process.exitCode = 1; return; }
  const old = existsSync('.env') ? readFileSync('.env', 'utf8') : 'PORT=4173\n';
  const next = old.replace(/^QLOO_API_KEY=.*\r?\n?/gm, '').trimEnd() + '\nQLOO_API_KEY=' + key + '\n';
  writeFileSync('.env', next, { mode: 0o600 });
  chmodSync('.env', 0o600);
  console.log('Key saved locally. Run npm run dev, open http://127.0.0.1:4173 and search for a favourite.');
});
rl.on('SIGINT', () => { rl.close(); console.log('\nCancelled. Nothing was saved.'); });
