// The recorder: a headed Chromium on the Xvfb display in $DISPLAY, filmed by
// ffmpeg x11grab at 30 fps and cropped to the page, with a drawn pointer,
// chapter cards and cuts. A video script imports it through run.sh:
//
//     const { record } = await import(`${process.env.DEMO_KIT}/recorder.mjs`);
//     await record(import.meta.url, async (r) => { ... });
//
// The script's folder is the video folder: it holds video.json (title, cover,
// chapters), cues.json and, after a take, out/ with screen.mp4, marks.json and
// checks.json. The video starts at the script's first mark; everything before
// it (browser start, crop measurement) is cut.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { loadChromium, logIn } from './login.mjs';

const W = 1280;
const H = 720;
const HOLD = 4000;
/** The video starts about this long after ffmpeg is spawned; captions are shifted by it. */
const OFFSET = 0.1;

export const checks = [];
/** Fails the take when a claim the captions make is false at this moment. */
export function verify(name, ok, detail = '') {
    checks.push({ name, ok: Boolean(ok), detail: String(detail) });
    if (!ok) {
        throw new Error(`check failed: ${name} (${detail})`);
    }
}

/** A drawn pointer and click ripple: the filmed screen has no cursor of its own. */
function installPointer(accent) {
    const install = () => {
        if (document.getElementById('demo-pointer')) {
            return;
        }
        const pointer = document.createElement('div');
        pointer.id = 'demo-pointer';
        pointer.innerHTML =
            '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2.5l15 8.2-6.6 1.6-3 6.2z" fill="#111111" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
        Object.assign(pointer.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            zIndex: '2147483647',
            pointerEvents: 'none',
            transform: 'translate(-100px, -100px)',
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))',
        });
        document.documentElement.appendChild(pointer);
        const style = document.createElement('style');
        style.textContent =
            '@keyframes demo-ripple{from{transform:translate(-50%,-50%) scale(.3);opacity:.9}to{transform:translate(-50%,-50%) scale(1.6);opacity:0}}';
        document.documentElement.appendChild(style);
        window.__demoPointerTo = (x, y) => {
            pointer.style.transform = `translate(${x - 5}px, ${y - 3}px)`;
        };
        window.addEventListener(
            'mousedown',
            (event) => {
                const ring = document.createElement('div');
                Object.assign(ring.style, {
                    position: 'fixed',
                    left: `${event.clientX}px`,
                    top: `${event.clientY}px`,
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    border: `3px solid ${accent}`,
                    zIndex: '2147483646',
                    pointerEvents: 'none',
                    animation: 'demo-ripple .6s ease-out forwards',
                });
                document.documentElement.appendChild(ring);
                setTimeout(() => ring.remove(), 700);
            },
            true,
        );
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install);
    } else {
        install();
    }
}

const escape = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * A full-screen card in the brand's colours: the cover (no animation, so the
 * first frame is the finished card) or a chapter card ("Part 2 of 4").
 */
function cardPage(config, { label, title, subtitle, animate }) {
    const { brand, lang, rtl } = config;
    const font = config.fontFile ? `@font-face{font-family:DemoFont;src:url(data:font/ttf;base64,${readFileSync(config.fontFile).toString('base64')})}` : '';
    return `<!doctype html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}" translate="no"><head><meta charset="utf-8"><meta name="google" content="notranslate"><style>
${font}
#demo-pointer{display:none!important}
html,body{margin:0;height:100%;background:${brand.background};font-family:DemoFont,${config.fontName},sans-serif;color:${brand.text}}
body{display:flex;align-items:center;justify-content:center}
main{text-align:center;max-width:1000px;padding:0 40px${animate ? ';animation:rise .7s ease-out both' : ''}}
.label{color:${brand.muted};font-size:26px;font-weight:600}
h1{font-size:60px;margin:8px 0 18px;font-weight:700;line-height:1.3}
.bar{width:120px;height:6px;border-radius:3px;background:${brand.accent};margin:0 auto 24px}
p{font-size:30px;margin:0;opacity:.9;line-height:1.5}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
</style></head><body><main>${label ? `<div class="label">${escape(label)}</div>` : ''}<h1>${escape(title)}</h1><div class="bar"></div>${subtitle ? `<p>${escape(subtitle)}</p>` : ''}</main></body></html>`;
}

const xdo = (...args) => execFileSync('xdotool', args.map(String), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const grab = (w, h, x = 0, y = 0) =>
    execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'x11grab', '-video_size', `${w}x${h}`, '-i', `${process.env.DISPLAY}+${x},${y}`,
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 64 << 20 });

async function start(videoDir) {
    if (!process.env.DISPLAY) {
        throw new Error('No $DISPLAY. Run the script through scripts/run.sh, which starts Xvfb.');
    }
    const config = loadConfig(videoDir);
    const out = join(videoDir, 'out');
    mkdirSync(out, { recursive: true });
    const chromium = await loadChromium(videoDir, config);
    // Wayland, desktop-scale and D-Bus variables are dropped: Chromium opens on
    // Xvfb at scale 1, never on the real desktop, and system dialogs stay on Xvfb.
    const { WAYLAND_DISPLAY, GDK_SCALE, OZONE_PLATFORM, ELECTRON_OZONE_PLATFORM_HINT, DBUS_SESSION_BUS_ADDRESS, ...env } = process.env;
    const browser = await chromium.launch({
        headless: false,
        env,
        args: ['--ozone-platform=x11', '--force-device-scale-factor=1', '--hide-scrollbars', '--window-position=0,0', `--window-size=${W},900`],
    });
    // Some third-party pages refuse "HeadlessChrome"; give the real version a desktop user agent.
    const major = browser.version().split('.')[0];
    const context = await browser.newContext({
        viewport: { width: W, height: H + 4 },
        userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`,
        locale: config.lang,
    });
    // Chromium offers to translate any page whose language differs from its own;
    // marking every page as not translatable is what keeps the bar away.
    await context.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
            document.documentElement.setAttribute('translate', 'no');
            const meta = document.createElement('meta');
            meta.name = 'google';
            meta.content = 'notranslate';
            document.head.appendChild(meta);
        });
    });
    await context.addInitScript(installPointer, config.brand.accent);
    await context.route('**/__demo-card/*', (route) => {
        route.fulfill({ contentType: 'text/html; charset=utf-8', body: context.__nextCard });
    });
    // Cards load in a tab of their own, opened first so it sits behind; it comes
    // to the front only once drawn, and the page underneath is never reloaded.
    const cardPage = await context.newPage();
    const page = await context.newPage();

    // The page's first screen row: paint it magenta and read one grabbed column.
    // This screen is before the first mark, so it never reaches the video.
    await page.setContent('<body style="margin:0;background:#ff00ff"></body>');
    let top = -1;
    for (let attempt = 0; attempt < 20 && top < 0; attempt++) {
        await page.waitForTimeout(400);
        const column = grab(1, 900, W / 2, 0);
        for (let y = 0; y < 900; y++) {
            if (column[y * 3] === 255 && column[y * 3 + 1] === 0 && column[y * 3 + 2] === 255) {
                top = y;
                break;
            }
        }
    }
    if (top < 0) {
        throw new Error('page not found on the Xvfb screen');
    }
    await page.setContent(`<body style="margin:0;background:${config.brand.background}"></body>`);
    const ffmpeg = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', `${W}x${H}`,
        '-i', `${process.env.DISPLAY}+0,${top}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', join(out, 'screen.mp4')],
    { stdio: ['pipe', 'inherit', 'inherit'] });
    return new Recorder({ config, videoDir, out, browser, context, page, cardPage, ffmpeg });
}

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

export class Recorder {
    constructor({ config, videoDir, out, browser, context, page, cardPage, ffmpeg }) {
        Object.assign(this, { config, videoDir, out, browser, context, page, cardPage, ffmpeg });
        this.video = existsSync(join(videoDir, 'video.json')) ? JSON.parse(readFileSync(join(videoDir, 'video.json'), 'utf8')) : {};
        this.t0 = Date.now();
        this.marks = [];
        this.cuts = [];
        this.pointerAt = { x: 900, y: 420 };
        this.onCard = false;
        this.verify = verify;
    }

    now() {
        return (Date.now() - this.t0) / 1000;
    }
    /** A cue's start. `quiet-<name>` ends the cue before it without showing text. */
    mark(key) {
        this.marks.push({ key, at: this.now() });
    }
    hold(ms = HOLD) {
        return this.page.waitForTimeout(ms);
    }
    /** Starts a cut: time the viewer gains nothing from. Pass the result to endCut. */
    beginCut() {
        return this.now();
    }
    /** Ends a cut only once the next page is drawn, so the previous page never flashes. */
    async endCut(from) {
        await this.page.waitForLoadState('networkidle').catch(() => {});
        await this.page.waitForTimeout(700);
        await this.redraw();
        this.cuts.push({ from, to: this.now() });
    }
    /** Runs `fn` off camera (a login, seeding, a rebuild): all of it is cut. */
    async offCamera(fn) {
        const from = this.beginCut();
        await fn(this.page);
        await this.toPage();
        await this.endCut(from);
    }
    /**
     * Signs in as an account from demo.config.json's `accounts`, off camera.
     * With `card` ({ label, title, subtitle }), the sign-in runs behind that
     * card, which names the account for the viewer (SKILL.md step 5).
     */
    async login(name, { card } = {}) {
        this.loggingIn = true;
        try {
            if (card) {
                await this.showCard(card, `quiet-account-${name}`, undefined, { behind: (p) => logIn(p, this.config, name) });
                await this.toPage();
            } else {
                await this.offCamera((p) => logIn(p, this.config, name));
            }
        } finally {
            this.loggingIn = false;
        }
    }
    /**
     * For takes on real data (staging, a copy of production): every request to
     * the site (baseUrl's origin) other than GET, HEAD or OPTIONS is blocked
     * before it leaves, and the take fails at the end if there was one. Sign-in
     * through `login` is let through. `allow` lists URL parts or patterns for
     * reads the site sends as POST (a search, a GraphQL query).
     */
    async readOnly({ allow = [] } = {}) {
        const origin = new URL(this.config.baseUrl).origin;
        this.writes = [];
        await this.context.route('**/*', (route) => {
            const request = route.request();
            const url = request.url();
            const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method());
            const allowed = allow.some((p) => (typeof p === 'string' ? url.includes(p) : p.test(url)));
            if (read || allowed || this.loggingIn || new URL(url).origin !== origin) {
                return route.fallback();
            }
            this.writes.push(`${request.method()} ${url}`);
            return route.abort('blockedbyclient');
        });
    }

    drawPointer(x, y) {
        return this.page.evaluate(([px, py]) => window.__demoPointerTo?.(px, py), [x, y]).catch(() => {});
    }
    async moveTo(x, y, ms = 650) {
        const from = { ...this.pointerAt };
        const steps = Math.max(10, Math.round(ms / 20));
        for (let step = 1; step <= steps; step++) {
            const p = ease(step / steps);
            await this.drawPointer(from.x + (x - from.x) * p, from.y + (y - from.y) * p);
            await this.page.waitForTimeout(16);
        }
        this.pointerAt = { x, y };
    }
    /** The real mouse off the page: hovering a link makes Chromium show its URL in the corner. */
    parkMouse() {
        return this.page.mouse.move(-20, -20);
    }
    async redraw() {
        await this.page.waitForFunction(() => window.__demoPointerTo, null, { timeout: 5000 }).catch(() => {});
        await this.drawPointer(this.pointerAt.x, this.pointerAt.y);
    }
    async scrollTo(locator) {
        await locator.first().evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
        await this.page.waitForTimeout(900);
    }
    async pointAt(locator) {
        await this.toPage();
        const seen = await locator.boundingBox();
        if (!seen || seen.y < 0 || seen.y + seen.height > H) {
            await this.scrollTo(locator);
        }
        const box = await locator.boundingBox();
        await this.moveTo(box.x + box.width / 2, box.y + box.height / 2);
    }
    async clickOn(locator) {
        await this.pointAt(locator);
        await this.page.waitForTimeout(150);
        await locator.click();
        await this.parkMouse();
    }
    async typeInto(locator, value, { clear = true } = {}) {
        await this.clickOn(locator);
        if (clear) {
            await locator.fill('');
        }
        await locator.pressSequentially(value, { delay: 45 });
    }
    /** Clicks a button that opens the system file picker and hands it the files; the picker itself never opens. */
    async upload(locator, files) {
        await this.pointAt(locator);
        await this.page.waitForTimeout(150);
        const chooser = this.page.waitForEvent('filechooser');
        await locator.click();
        await this.parkMouse();
        await (await chooser).setFiles(files);
    }
    /** Scrolls with the mouse wheel in small steps, the mouse in the left margin, off every link. */
    async wheel(dy, steps = 6) {
        await this.page.mouse.move(12, H / 2);
        for (let i = 0; i < steps; i++) {
            await this.page.mouse.wheel(0, dy / steps);
            await this.page.waitForTimeout(120);
        }
        await this.parkMouse();
        await this.page.waitForTimeout(900);
    }

    /**
     * Scales the page (or the fixed layer holding the target) so the target sits
     * mid-screen. `text: true` aims at the element's text rather than its box,
     * for a full-width line whose words sit at one edge.
     */
    async zoomOn(locator, maxScale = 2, { text = false } = {}) {
        await locator.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(200);
        const measure = () =>
            text
                ? locator.evaluate((el) => {
                      const range = document.createRange();
                      range.selectNodeContents(el);
                      const b = range.getBoundingClientRect();
                      return { x: b.x, y: b.y, width: b.width, height: b.height };
                  })
                : locator.boundingBox();
        const box = await measure();
        await locator.evaluate(
            (target, { box, maxScale }) => {
                let layer = target;
                while (layer && layer !== document.body && getComputedStyle(layer).position !== 'fixed') {
                    layer = layer.parentElement;
                }
                if (!layer || layer === document.documentElement) {
                    layer = document.body;
                }
                const vw = innerWidth;
                const vh = innerHeight;
                const scale = Math.max(1.25, Math.min(maxScale, (0.75 * vw) / box.width, (0.6 * vh) / box.height));
                const rect = layer.getBoundingClientRect();
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                const ox = cx - rect.left;
                const oy = cy - rect.top;
                let tx = vw / 2 - cx;
                let ty = vh / 2 - cy;
                const left = rect.left + ox * (1 - scale);
                const top = rect.top + oy * (1 - scale);
                tx = Math.min(tx, -left);
                tx = Math.max(tx, vw - left - scale * rect.width);
                ty = Math.min(ty, -top);
                ty = Math.max(ty, vh - top - scale * rect.height);
                // Some sites move a layer with their own inline transform; keep it to put back.
                layer.dataset.demoZoom = layer.style.transform || 'none';
                layer.style.transformOrigin = `${ox}px ${oy}px`;
                layer.style.transition = 'transform .8s cubic-bezier(.4,0,.2,1)';
                layer.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
            },
            { box, maxScale },
        );
        await this.page.waitForTimeout(900);
        const zoomed = await measure();
        // Beside a text the pointer would cover its words, so it waits just before
        // the first line: at its left edge, or its right edge in a right-to-left language.
        if (text) {
            const px = this.config.rtl ? zoomed.x + zoomed.width + 14 : zoomed.x - 26;
            await this.moveTo(px, zoomed.y + Math.min(zoomed.height / 2, 16), 500);
        } else {
            await this.moveTo(zoomed.x + zoomed.width * 0.15, zoomed.y + zoomed.height / 2, 500);
        }
    }
    async unzoom() {
        await this.page.evaluate(() => {
            for (const layer of document.querySelectorAll('[data-demo-zoom]')) {
                layer.style.transform = layer.dataset.demoZoom === 'none' ? '' : layer.dataset.demoZoom;
                setTimeout(() => {
                    layer.style.transition = '';
                    layer.style.transformOrigin = '';
                    delete layer.dataset.demoZoom;
                }, 750);
            }
        });
        await this.page.waitForTimeout(850);
    }

    /** Brings the page tab back in front of a card. */
    async toPage() {
        if (this.onCard) {
            await this.page.bringToFront();
            await this.page.waitForTimeout(300);
            this.onCard = false;
        }
        await this.redraw();
    }
    /**
     * Opens a URL (relative to baseUrl). On camera only for the first page of a
     * clip or a chapter's resume; every later page change is `navigate`.
     */
    url(path) {
        return /^[a-z]+:/.test(path) ? path : new URL(path, this.config.baseUrl).href;
    }
    async go(url) {
        await this.page.goto(this.url(url));
        await this.page.waitForLoadState('networkidle');
        await this.toPage();
    }
    /** Follows a link or button with the pointer, the way a viewer could repeat it. */
    async navigate(locator, toUrl) {
        await this.clickOn(locator);
        await this.page.waitForURL(toUrl);
        await this.page.waitForLoadState('networkidle');
        await this.redraw();
        await this.page.waitForTimeout(900);
    }
    /** Clicks something that opens a new tab and films that tab from then on. */
    async followPopup(locator) {
        const popup = this.page.waitForEvent('popup');
        await this.clickOn(locator);
        this.opener = this.page;
        this.page = await popup;
        await this.page.waitForLoadState('networkidle');
        await this.redraw();
    }
    /** Closes the followed tab and films the tab that opened it again. */
    async closePopup() {
        await this.page.close();
        this.page = this.opener;
        await this.page.bringToFront();
        await this.redraw();
        await this.page.waitForTimeout(600);
    }

    /**
     * A full-screen card for `holdMs`. `behind(page)` runs on the page while the
     * drawn card is in front, and its time is cut: the card is still, so the
     * join cannot be seen, and the page is ready when the card leaves.
     */
    async showCard(card, key, holdMs = 3400, { behind } = {}) {
        this.context.__nextCard = cardPage(this.config, card);
        await this.cardPage.goto(`http://demo.invalid/__demo-card/${key}`);
        await this.cardPage.evaluate(() => document.fonts.ready);
        // A caption running from the page ends as the card comes up, not once it has risen.
        if (this.marks.length) {
            this.mark(`quiet-before-${key}`);
        }
        await this.cardPage.bringToFront();
        this.onCard = true;
        // An animated card is marked once it has risen, so no frame of the card
        // half-drawn opens a cue (or the video).
        await this.cardPage.waitForTimeout(card.animate ? 800 : 300);
        this.mark(key);
        if (behind) {
            const from = this.beginCut();
            await behind(this.page);
            await this.endCut(from);
        }
        await this.cardPage.waitForTimeout(holdMs);
    }
    /**
     * The cover: video.json's `cover` ({ title, subtitle }), fully drawn, as the
     * first mark, so it is frame 0 and the thumbnail every app shows.
     */
    async cover(holdMs = 2500) {
        const { title = this.video.title, subtitle } = this.video.cover ?? {};
        await this.showCard({ title, subtitle, animate: false }, 'cover', holdMs);
    }
    /**
     * Chapter card n from video.json's `chapters` ([{ title, subtitle }]). The
     * page underneath keeps its state; the next `go`, `navigate` or `offCamera`
     * brings it back, or call `toPage()` to return to it as it was.
     * `open` (a URL, or a function given the page) loads the chapter's first
     * page behind the card, so the card is not held while it loads, and the
     * chapter opens on that page drawn.
     */
    async chapter(n, options = {}) {
        const { hold = 3400, open } = typeof options === 'number' ? { hold: options } : options;
        const chapters = this.video.chapters ?? [];
        const label = this.config.labels.part.replace('{n}', n).replace('{total}', chapters.length);
        const behind = typeof open === 'string' ? (p) => p.goto(this.url(open)) : open;
        await this.showCard({ ...chapters[n - 1], label, animate: true }, `chapter-${n}`, hold, { behind });
        if (open) {
            await this.toPage();
            await this.page.waitForTimeout(600);
        }
    }

    /**
     * Clicks the filled button of a Chromium permission bubble ("Allow", "Save
     * changes"). The bubble is browser UI, not page DOM, so it is found by its
     * colour on the screen and clicked with xdotool. Only ever inside a cut.
     */
    acceptBrowserPrompt() {
        const w = W;
        const h = 400;
        const px = grab(w, h);
        const blue = (i) => Math.abs(px[i] - 11) < 30 && Math.abs(px[i + 1] - 87) < 30 && Math.abs(px[i + 2] - 208) < 30;
        let x1 = -1;
        let y0 = h;
        let y1 = -1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (blue((y * w + x) * 3)) {
                    x1 = Math.max(x1, x);
                    y0 = Math.min(y0, y);
                    y1 = Math.max(y1, y);
                }
            }
        }
        if (x1 < 0) {
            throw new Error('no permission button on screen');
        }
        // The filled button is the right-most blue; the one beside it has only a
        // blue focus ring, so take the rows holding blue within 20 px of the right edge.
        let top = h;
        let bottom = -1;
        for (let y = y0; y <= y1; y++) {
            for (let x = x1 - 20; x <= x1; x++) {
                if (blue((y * w + x) * 3)) {
                    top = Math.min(top, y);
                    bottom = Math.max(bottom, y);
                }
            }
        }
        xdo('mousemove', '--sync', x1 - 30, Math.round((top + bottom) / 2));
        xdo('click', '1');
    }

    async finish() {
        const exited = new Promise((resolve) => this.ffmpeg.on('exit', resolve));
        this.ffmpeg.stdin.end('q');
        await exited;
        await this.context.close();
        await this.browser.close();
        // Everything before the first mark (browser start, crop measurement) is cut.
        const lead = this.marks.length ? [{ from: 0, to: this.marks[0].at }] : [];
        writeFileSync(join(this.out, 'marks.json'), JSON.stringify({ offset: OFFSET, marks: this.marks, cuts: [...lead, ...this.cuts] }, null, 2));
        writeFileSync(join(this.out, 'checks.json'), JSON.stringify(checks, null, 2));
        console.log(`${checks.filter((c) => c.ok).length}/${checks.length} checks`);
        console.log(JSON.stringify(this.marks.map((m) => `${m.key}@${m.at.toFixed(1)}`)));
    }
}

/**
 * Records one take: starts the capture, runs the script, and always finalizes
 * the recording; on a failure it saves the screen as out/error.png and exits 1.
 */
export async function record(scriptUrl, script) {
    const videoDir = resolve(dirname(fileURLToPath(scriptUrl)));
    const r = await start(videoDir);
    let failed = null;
    try {
        await script(r);
        if (!r.marks.length) {
            throw new Error('the script set no mark, so the video would be empty');
        }
        if (r.writes) {
            verify('the page sent no writes', r.writes.length === 0, r.writes.slice(0, 3).join(', '));
        }
    } catch (error) {
        failed = error;
        await r.page.screenshot({ path: join(r.out, 'error.png') }).catch(() => {});
    }
    await r.finish();
    if (failed) {
        console.error(failed);
        process.exit(1);
    }
}
