// Which Playwright a take runs on. Each Playwright version is pinned to one
// Chromium build, so installing "latest" downloads a new build (about 680 MB
// with its headless shell) even when an older one sits in the browser cache.
// This module finds a Playwright whose build is already on disk instead.
//
// Order: `playwrightFrom` in demo.config.json (or DEMO_PLAYWRIGHT_FROM), then
// the folder the take runs in, the video folder and the kit (each as Node
// resolves it, so their parents count), then any Playwright on this machine
// whose Chromium build is already downloaded: projects next to the videos
// folder or next to its parent first, then every install Playwright has
// registered in its browser cache (`.links`).
//
// recorder.mjs imports findPlaywright; doctor.sh calls it from the shell:
//     node playwright.mjs where    entry path, "cached"/"missing", label, note, playwright-core folder; exit 1 when none
//     node playwright.mjs advise   the install line to print when none is usable
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';

const KIT = dirname(fileURLToPath(import.meta.url));
const NAMES = ['playwright', 'playwright-core', '@playwright/test'];
/** What `playwright install chromium` downloads, and the cache folder each lands in. */
const PARTS = { chromium: 'chromium', 'chromium-headless-shell': 'chromium_headless_shell', ffmpeg: 'ffmpeg' };

/** Playwright's browser cache: PLAYWRIGHT_BROWSERS_PATH, else ~/.cache/ms-playwright. */
function cacheDir(core) {
    const env = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (env === '0') {
        return join(core, '.local-browsers');
    }
    if (env) {
        return resolve(env);
    }
    return join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'ms-playwright');
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function packageRoot(entry, name) {
    for (let dir = dirname(entry); dirname(dir) !== dir; dir = dirname(dir)) {
        try {
            if (readJson(join(dir, 'package.json')).name === name) {
                return dir;
            }
        } catch {}
    }
    return null;
}

function resolveFrom(dir, name) {
    try {
        return createRequire(join(dir, 'noop.js')).resolve(name);
    } catch {
        return null;
    }
}

/** playwright-core's folder for any of the three packages (@playwright/test reaches it through playwright). */
function coreOf(root, name) {
    if (name === 'playwright-core') {
        return root;
    }
    const direct = resolveFrom(root, 'playwright-core/package.json');
    if (direct) {
        return dirname(direct);
    }
    const playwright = resolveFrom(root, 'playwright/package.json');
    const viaPlaywright = playwright && resolveFrom(dirname(playwright), 'playwright-core/package.json');
    return viaPlaywright ? dirname(viaPlaywright) : null;
}

/** The Playwright Node resolves from `base` (base's parents included), with its Chromium build and whether that build is on disk. */
export function playwrightAt(base) {
    for (const name of NAMES) {
        const entry = resolveFrom(base, name);
        const root = entry && packageRoot(entry, name);
        const core = root && coreOf(root, name);
        if (!core) {
            continue;
        }
        const builds = Object.fromEntries(readJson(join(core, 'browsers.json')).browsers.map((b) => [b.name, b.revision]));
        const cache = cacheDir(core);
        const missing = Object.entries(PARTS)
            .filter(([part, folder]) => !existsSync(join(cache, `${folder}-${builds[part]}`, 'INSTALLATION_COMPLETE')))
            .map(([part]) => part);
        return {
            name,
            entry,
            root,
            core,
            version: readJson(join(root, 'package.json')).version,
            chromium: builds.chromium,
            chromiumCached: !missing.includes('chromium'),
            /** Parts `playwright install chromium` would download for this version. */
            missing,
        };
    }
    return null;
}

const subdirs = (dir) => {
    try {
        return readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
            .map((e) => join(dir, e.name));
    } catch {
        return [];
    }
};

const byVersion = (a, b) => b.version.localeCompare(a.version, undefined, { numeric: true });

/**
 * Every Playwright on this machine whose Chromium build is already downloaded,
 * nearest first: projects beside `home` or beside its parent, then the installs
 * registered in the browser cache's `.links` folder.
 */
export function reusablePlaywrights(home) {
    const seen = new Set();
    const keep = (pw, source) => {
        if (!pw || !pw.chromiumCached || seen.has(pw.core)) {
            return null;
        }
        seen.add(pw.core);
        return { ...pw, source };
    };
    const near = [];
    for (const dir of [home, dirname(home)]) {
        for (const sibling of subdirs(dirname(dir))) {
            if (sibling === dir || !existsSync(join(sibling, 'node_modules'))) {
                continue;
            }
            const pw = playwrightAt(sibling);
            // Resolving from a sibling also climbs into shared parents; only its own install counts here.
            if (pw && pw.root.startsWith(realpathSync(sibling) + '/')) {
                const found = keep(pw, `next to ${basename(dir)}: ${sibling}`);
                found && near.push(found);
            }
        }
    }
    const links = join(cacheDir(''), '.links');
    const registered = [];
    for (const file of existsSync(links) ? readdirSync(links) : []) {
        const core = readFileSync(join(links, file), 'utf8').trim();
        if (existsSync(join(core, 'browsers.json'))) {
            const found = keep(playwrightAt(dirname(core)), `registered in ${links}: ${core}`);
            found && registered.push(found);
        }
    }
    return [...near.sort(byVersion), ...registered.sort(byVersion)];
}

/** The Playwright a take in `videoDir` runs on, or null. Throws when an explicit setting points at nothing. */
export function findPlaywright(videoDir = process.cwd(), config = loadConfig(videoDir)) {
    const fromEnv = process.env.DEMO_PLAYWRIGHT_FROM;
    const from = fromEnv ? resolve(fromEnv) : config.playwrightFrom;
    if (from) {
        const pw = playwrightAt(from);
        if (!pw) {
            const where = fromEnv ? 'DEMO_PLAYWRIGHT_FROM' : `playwrightFrom in ${config.configPath}`;
            throw new Error(`No Playwright resolves from ${from} (set by ${where}).`);
        }
        return { ...pw, source: fromEnv ? 'DEMO_PLAYWRIGHT_FROM' : 'playwrightFrom in demo.config.json' };
    }
    for (const [base, source] of [
        [process.cwd(), 'this folder'],
        [videoDir, 'the video folder'],
        [KIT, 'the kit'],
    ]) {
        const pw = playwrightAt(base);
        if (pw) {
            return { ...pw, source };
        }
    }
    return reusablePlaywrights(homeOf(videoDir, config))[0] ?? null;
}

/** The videos folder: where demo.config.json sits, else the video folder itself. */
const homeOf = (videoDir, config) => (config.configPath ? dirname(config.configPath) : resolve(videoDir));

const latest = 'npm init -y && npm i -D playwright && npx playwright install chromium';

/** What to run when no usable Playwright was found, or the one found has no Chromium on disk. */
export function advise(videoDir = process.cwd(), config = loadConfig(videoDir)) {
    const pw = findPlaywright(videoDir, config);
    const reuse = reusablePlaywrights(homeOf(videoDir, config)).filter((r) => r.core !== pw?.core);
    const pin = reuse.find((r) => r.missing.length === 0) ?? reuse[0];
    const pinLine = pin
        ? `npm i -D playwright@${pin.version} here: its Chromium build ${pin.chromium} is already downloaded` +
          (pin.missing.length ? ` (still downloads ${pin.missing.join(', ')})` : ', so `npx playwright install chromium` downloads nothing')
        : null;
    if (pw) {
        const download = `download build ${pw.chromium}: node ${join(pw.core, 'cli.js')} install chromium`;
        return pinLine ? `${pinLine}; or ${download}` : download;
    }
    if (pinLine) {
        return `npm init -y && ${pinLine.replace(' here', '')}`;
    }
    return `no Playwright on this machine has its Chromium downloaded, so this downloads one: ${latest}`;
}

function describe(pw) {
    const build = pw.chromiumCached ? `Chromium build ${pw.chromium} on disk` : `Chromium build ${pw.chromium} NOT downloaded`;
    return `playwright ${pw.version} (${pw.name}) from ${pw.root} [${pw.source}], ${build}`;
}

// argv[1] may be a symlinked path to the kit; compare real paths.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [command, dir = process.cwd()] = process.argv.slice(2);
    try {
        if (command === 'where') {
            const pw = findPlaywright(dir);
            if (!pw) {
                process.exit(1);
            }
            const shared = !['this folder', 'the video folder'].includes(pw.source);
            const note = shared ? `to pin this folder to it without a download: npm i -D playwright@${pw.version}` : '';
            console.log([pw.entry, pw.chromiumCached ? 'cached' : 'missing', describe(pw), note, pw.core].join('\n'));
        } else if (command === 'advise') {
            console.log(advise(dir));
        } else {
            console.error('usage: playwright.mjs where|advise [video-dir]');
            process.exit(2);
        }
    } catch (error) {
        console.error(error.message);
        process.exit(2);
    }
}
