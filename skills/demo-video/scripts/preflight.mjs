// Signs in, headless, as every account the video script names (`r.login('name')`)
// before run.sh starts the display and the filming, so a wrong email or
// password costs seconds rather than a take. Prints one line per account.
// usage: node preflight.mjs <video-dir>/script.mjs    (run.sh calls it; DEMO_SKIP_PREFLIGHT=1 skips)
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadConfig } from './config.mjs';
import { accountsIn, loadChromium, logIn } from './login.mjs';

const script = resolve(process.argv[2] ?? '');
const names = accountsIn(readFileSync(script, 'utf8'));
if (!names.length) {
    process.exit(0);
}
const videoDir = dirname(script);
const config = loadConfig(videoDir);
const chromium = await loadChromium(videoDir, config);
const browser = await chromium.launch();
let failed = false;
for (const name of names) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: config.lang });
    try {
        await logIn(await context.newPage(), config, name);
        console.log(`  ok    sign-in as ${name} (${config.accounts[name].email})`);
    } catch (error) {
        console.error(`  FAIL  ${error.message}`);
        failed = true;
    }
    await context.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
