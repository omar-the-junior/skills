// Settings shared by every video in a folder: demo.config.json, found by
// walking up from the video folder. Every key is optional; see
// templates/demo.config.json for the full set. A demo.config.json nearer the
// video overrides the keys it sets (a video filmed on staging sets its own
// baseUrl and accounts), and its paths are relative to the file that sets them.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = dirname(dirname(fileURLToPath(import.meta.url)));

const DEFAULTS = {
    baseUrl: 'http://localhost:3000/',
    lang: 'en',
    rtl: false,
    font: { file: null, name: 'Cairo' },
    brand: { background: '#111418', text: '#f2f2f0', muted: '#8a8a86', accent: '#3b82f6' },
    labels: { part: 'Part {n} of {total}' },
    // The sign-in form login.mjs fills; the selectors fit most email + password forms.
    login: {
        path: '/login',
        email: 'input[type=email], input[name=email], input[name=username]',
        password: 'input[type=password]',
        submit: 'button[type=submit], input[type=submit]',
        timeout: 15000,
    },
    accounts: {},
};

/** Every demo.config.json from the video folder up to the root, outermost first. */
function configFiles(videoDir) {
    const files = [];
    for (let dir = resolve(videoDir); ; dir = dirname(dir)) {
        if (existsSync(join(dir, 'demo.config.json'))) {
            files.unshift(join(dir, 'demo.config.json'));
        }
        if (dirname(dir) === dir) {
            return files;
        }
    }
}

/** One file's settings with its paths made absolute. */
function readConfigFile(file) {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const at = (p) => resolve(dirname(file), p);
    if (raw.font?.file) {
        raw.font = { ...raw.font, file: at(raw.font.file) };
    }
    if (raw.playwrightFrom) {
        raw.playwrightFrom = at(raw.playwrightFrom);
    }
    for (const account of Object.values(raw.accounts ?? {})) {
        if (account.passwordFile) {
            account.passwordFile = at(account.passwordFile);
        }
    }
    return raw;
}

export function loadConfig(videoDir) {
    const files = configFiles(videoDir);
    let config = { ...DEFAULTS };
    for (const file of files) {
        const raw = readConfigFile(file);
        config = {
            ...config,
            ...raw,
            font: { ...config.font, ...raw.font },
            brand: { ...config.brand, ...raw.brand },
            labels: { ...config.labels, ...raw.labels },
            login: { ...config.login, ...raw.login },
            accounts: { ...config.accounts, ...raw.accounts },
        };
    }
    if (process.env.BASE_URL) {
        config.baseUrl = process.env.BASE_URL;
    }
    // With no font file, the bundled Cairo (Latin and Arabic) is used on the
    // cards and in the captions.
    config.fontFile = config.font.file ?? join(KIT, 'assets/fonts/Cairo.ttf');
    config.fontName = config.font.file ? config.font.name : 'Cairo';
    // A folder whose Playwright the takes use (its own node_modules or a parent's).
    // Unset, playwright.mjs searches; see its header.
    config.playwrightFrom ??= null;
    // The outermost file marks the videos folder.
    config.configPath = files[0] ?? null;
    return config;
}
