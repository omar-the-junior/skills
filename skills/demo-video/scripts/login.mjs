// Signing in as a named account from demo.config.json's `accounts`, shared by
// the recorder (`r.login`), the preflight run.sh starts with, and probe.mjs.
// An account holds an `email` and either a `password` (seeded fake accounts)
// or a `passwordFile` + `passwordKey` (a dotenv file, mode 600, for real
// accounts on staging). The password is read at sign-in and never printed.
import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { advise, findPlaywright } from './playwright.mjs';

/** One value from a dotenv file: `KEY=value`, `export KEY=value`, quotes stripped. */
export function readSecret(file, key) {
    if (statSync(file).mode & 0o077) {
        throw new Error(`${file} is readable by other users; run chmod 600 on it.`);
    }
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = raw.replace(/^\s*export\s+/, '');
        if (line.startsWith(`${key}=`)) {
            return line.slice(key.length + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        }
    }
    throw new Error(`${key} is not set in ${file}.`);
}

/** Every account name a video script signs in as (`r.login('name')`). */
export function accountsIn(scriptText) {
    return [...new Set([...scriptText.matchAll(/\.login\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]))];
}

/**
 * Signs `page` in as `name`, starting signed out (cookies and storage cleared).
 * Done once the browser leaves the login path; otherwise throws with whatever
 * the form said.
 */
export async function logIn(page, config, name) {
    const account = config.accounts[name];
    if (!account) {
        const known = Object.keys(config.accounts).join(', ') || 'none';
        throw new Error(`No account "${name}" in demo.config.json accounts (known: ${known}).`);
    }
    const password = account.password ?? readSecret(account.passwordFile, account.passwordKey);
    const { login } = config;
    const url = new URL(login.path, config.baseUrl);
    await page.context().clearCookies();
    await page.goto(url.href);
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
    // Loaded again, so an app that read a token on start starts signed out.
    await page.goto(url.href);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator(login.email).first().fill(account.email);
    await page.locator(login.password).first().fill(password);
    await page.locator(login.submit).first().click();
    try {
        await page.waitForURL((u) => u.pathname !== url.pathname, { timeout: login.timeout });
    } catch {
        const said = (await page.locator('[role=alert], [aria-live=assertive], [aria-live=polite]').allInnerTexts().catch(() => []))
            .map((t) => t.trim())
            .filter(Boolean);
        throw new Error(
            `Sign-in as "${name}" (${account.email}) stayed on ${url.pathname}` +
                (said.length ? `; the page said: ${said.join(' | ')}` : '') +
                '. When the person can sign in by hand, ask which email and password file they use before changing anything else.',
        );
    }
    await page.waitForLoadState('networkidle').catch(() => {});
}

/** Chromium from the Playwright findPlaywright picks (playwrightFrom, this folder, the kit, then one already on the machine). */
export async function loadChromium(videoDir, config) {
    const pw = findPlaywright(videoDir, config);
    if (!pw) {
        throw new Error(`Playwright not found. Run scripts/doctor.sh in the videos folder; it prints what to install. ${advise(videoDir, config)}`);
    }
    const mod = await import(pathToFileURL(pw.entry).href);
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (!chromium) {
        throw new Error(`${pw.entry} has no chromium export.`);
    }
    return chromium;
}
