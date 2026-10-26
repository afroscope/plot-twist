import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Run this command in your own interactive terminal.'); process.exit(1);
}
const old = existsSync('.env') ? readFileSync('.env', 'utf8') : 'PORT=4173\n';
if (/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*\S+/m.test(old) && !process.argv.includes('--replace')) {
  console.error('A model key is already saved. To replace it privately, run npm run setup:agent -- --replace.'); process.exit(1);
}
console.log('Paste your OpenAI API key, then press Enter. Nothing will appear as you type.');
console.log('If you make a mistake, press Ctrl+U to clear the entire hidden line before pasting again. Ctrl+C cancels.');
const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
rl.question('', value => {
  rl.close(); const key = value.trim();
  if (!/^sk-[A-Za-z0-9_-]{16,1000}$/.test(key)) {
    console.error('Key format was not recognised. Nothing was saved.'); process.exitCode = 1; return;
  }
  const next = old.replace(/^\s*(?:export\s+)?OPENAI_API_KEY\s*=.*\r?\n?/gm, '').trimEnd() + '\nOPENAI_API_KEY=' + key + '\n';
  writeFileSync('.env', next, { mode: 0o600 }); chmodSync('.env', 0o600);
  console.log('Model key saved privately. Your Qloo key was preserved.');
  console.log('Run npm run diagnose:agent to verify access, then restart npm run dev and reload the app.');
  if (process.env.OPENAI_API_KEY) console.log('An exported OPENAI_API_KEY overrides this file; unset it in this terminal if you intend to use the saved key.');
});
rl.on('SIGINT', () => { rl.close(); console.log('\nCancelled. Nothing was saved.'); });
