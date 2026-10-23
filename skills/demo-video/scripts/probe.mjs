// Looks at a page before it is filmed: which elements a text or selector
// matches, where they sit at the recorder's 1280x720, whether they show, and
// the shortest selector that finds each one alone. One run answers what a
// failed take would otherwise answer, headless and without filming.
// usage: node probe.mjs <video-dir> <url> [--as <account>] [--text <t>]... [--css <selector>]...
//                       [--shot <file.png>] [--wait <ms>] [--raw]
// With no --text or --css it lists the page's visible headings, buttons, links and inputs.
// With "rtl": true in demo.config.json, right-to-left text prints as "?" (terminals
// lay it out wrongly); --raw prints it as it is.
import { resolve } from 'node:path';
import { loadConfig } from './config.mjs';
import { loadChromium, logIn } from './login.mjs';

const args = process.argv.slice(2);
const [dir, path] = args;
if (!dir || !path) {
    console.error('usage: node probe.mjs <video-dir> <url> [--as <account>] [--text <t>]... [--css <selector>]... [--shot <file.png>] [--wait <ms>] [--raw]');
    process.exit(2);
}
const all = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] !== undefined ? [args[i + 1]] : []));
const one = (flag) => all(flag).at(-1);

const videoDir = resolve(dir);
const config = loadConfig(videoDir);
const shown = (s) => {
    const flat = String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 70);
    return config.rtl && !args.includes('--raw') ? flat.replace(/[֐-ࣿיִ-﷿ﹰ-﻿]/g, '?') : flat;
};

const chromium = await loadChromium(videoDir, config);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: config.lang });
const page = await context.newPage();
try {
    if (one('--as')) {
        await logIn(page, config, one('--as'));
    }
    await page.goto(/^[a-z]+:/.test(path) ? path : new URL(path, config.baseUrl).href);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(Number(one('--wait') ?? 800));
    console.log(`page ${page.url()}`);

    const queries = [...all('--text').map((t) => ({ label: `text ${shown(t)}`, locator: page.getByText(t) })), ...all('--css').map((c) => ({ label: `css ${c}`, locator: page.locator(c) }))];
    if (!queries.length) {
        queries.push({ label: 'outline', locator: page.locator('h1, h2, h3, button, a[href], input, select, textarea, [role=button], [role=tab], [role=link]') });
    }
    for (const { label, locator } of queries) {
        const count = await locator.count();
        console.log(`\n${label}: ${count} match${count === 1 ? '' : 'es'}`);
        for (let i = 0; i < Math.min(count, 40); i++) {
            const el = locator.nth(i);
            const info = await el.evaluate((node) => {
                const tag = node.tagName.toLowerCase();
                const classes = [...node.classList];
                const candidates = [];
                if (node.id) {
                    candidates.push(`#${CSS.escape(node.id)}`);
                }
                for (const attr of ['data-testid', 'data-test', 'name', 'aria-label']) {
                    if (node.getAttribute(attr)) {
                        candidates.push(`${tag}[${attr}="${node.getAttribute(attr).replace(/"/g, '\\"')}"]`);
                    }
                }
                if (classes.length) {
                    candidates.push(`${tag}.${classes.map((c) => CSS.escape(c)).join('.')}`);
                    candidates.push(...classes.map((c) => `${tag}.${CSS.escape(c)}`));
                }
                const counted = candidates.map((selector) => ({ selector, n: document.querySelectorAll(selector).length }));
                let fixed = false;
                for (let up = node; up && up !== document.body; up = up.parentElement) {
                    const position = getComputedStyle(up).position;
                    fixed ||= position === 'fixed' || position === 'sticky';
                }
                return { tag, classes, counted, fixed, text: node.innerText || node.value || node.getAttribute('aria-label') || '' };
            });
            const box = await el.boundingBox();
            const visible = await el.isVisible();
            const where = box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : 'no box';
            const inView = box && box.y >= 0 && box.y + box.height <= 720 ? 'in view' : 'needs scroll';
            const unique = info.counted.find((c) => c.n === 1);
            const best = unique ? `unique: ${unique.selector}` : info.counted.length ? `nearest: ${info.counted.sort((a, b) => a.n - b.n)[0].selector} (${info.counted[0].n} on page)` : 'no selector: use a role or text inside a unique parent';
            console.log(`  #${i} <${info.tag}${info.classes.length ? '.' + info.classes.join('.') : ''}> ${where} ${visible ? 'visible' : 'HIDDEN'}, ${inView}${info.fixed ? ', fixed/sticky layer' : ''}`);
            console.log(`      "${shown(info.text)}"  ${best}`);
        }
        if (count > 40) {
            console.log(`  … ${count - 40} more`);
        }
    }
    if (one('--shot')) {
        await page.screenshot({ path: resolve(one('--shot')) });
        console.log(`\nscreenshot ${resolve(one('--shot'))}`);
    }
} finally {
    await browser.close();
}
