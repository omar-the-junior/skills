// Settings shared by every video in a folder: demo.config.json, found by
// walking up from the video folder. Every key is optional; see
// templates/demo.config.json for the full set.
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
};

export function loadConfig(videoDir) {
    let dir = resolve(videoDir);
    let found = null;
    for (;;) {
        if (existsSync(join(dir, 'demo.config.json'))) {
            found = join(dir, 'demo.config.json');
            break;
        }
        if (dirname(dir) === dir) {
            break;
        }
        dir = dirname(dir);
    }
    const raw = found ? JSON.parse(readFileSync(found, 'utf8')) : {};
    const config = {
        ...DEFAULTS,
        ...raw,
        font: { ...DEFAULTS.font, ...raw.font },
        brand: { ...DEFAULTS.brand, ...raw.brand },
        labels: { ...DEFAULTS.labels, ...raw.labels },
    };
    if (process.env.BASE_URL) {
        config.baseUrl = process.env.BASE_URL;
    }
    // A font file is relative to demo.config.json; with none, the bundled Cairo
    // (Latin and Arabic) is used on the cards and in the captions.
    config.fontFile = config.font.file ? resolve(dirname(found), config.font.file) : join(KIT, 'assets/fonts/Cairo.ttf');
    config.fontName = config.font.file ? config.font.name : 'Cairo';
    config.configPath = found;
    return config;
}
