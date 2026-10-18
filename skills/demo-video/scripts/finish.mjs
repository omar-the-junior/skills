// Turns a take into the delivered video. Drops the cuts (the lead-in before
// the first mark included), writes captions from cues.json and burns them into
// a band under the page so they never cover the UI, then writes the poster
// (frame 0) beside the video.
//
// usage: node finish.mjs <video-dir> [--no-captions]
// writes: out/<name>.mp4, out/<name>.<lang>.srt, out/<name>.poster.png
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';

const BAND = 110;
/** Free-plan GitHub repositories refuse attached videos over 10 MB. */
const GITHUB_FREE_LIMIT = 10 * 1024 * 1024;

/** Marks and cuts moved into final-video time. */
export function timeline(recording) {
    const offset = recording.offset ?? 0.1;
    const cuts = (recording.cuts ?? []).map((cut) => ({ from: Math.max(0, cut.from - offset), to: Math.max(0, cut.to - offset) }));
    // A time inside a cut lands where the cut is joined.
    const removedBefore = (t) => cuts.reduce((sum, cut) => sum + Math.max(0, Math.min(t, cut.to) - cut.from), 0);
    const final = (t) => {
        const at = Math.max(0, t - offset);
        return at - removedBefore(at);
    };
    return { cuts, removedBefore, final };
}

const stamp = (seconds) => {
    const ms = Math.round(seconds * 1000);
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

/** The .srt text: a cue lasts until the next mark, and must stay at least 2.5 s. */
export function captions(recording, cues, { rtl }) {
    const { final } = timeline(recording);
    const marks = recording.marks
        .map((mark) => ({ ...mark, at: final(mark.at) }))
        // A quiet mark only ends the cue before it; one that would cut that cue short is dropped.
        .filter((mark, index, all) => !mark.key.startsWith('quiet-') || index === 0 || mark.at - all[index - 1].at >= 3);
    const missing = Object.keys(cues).filter((key) => !marks.some((mark) => mark.key === key));
    if (missing.length) {
        throw new Error(`cues without a mark: ${missing.join(', ')}`);
    }
    const blocks = [];
    marks.forEach((mark, index) => {
        const text = cues[mark.key];
        if (!text) {
            return;
        }
        const next = marks[index + 1];
        const start = mark.at + 0.3;
        const end = next ? next.at - 0.1 : mark.at + 3;
        if (end - start < 2.5) {
            throw new Error(`cue ${mark.key} is on screen only ${(end - start).toFixed(1)}s`);
        }
        // In right-to-left captions a right-to-left mark opens every line, so a
        // line that starts with a Latin word is still laid out right to left.
        const lines = text.split('\n').map((line) => (rtl ? `\u200f${line}` : line));
        blocks.push(`${blocks.length + 1}\n${stamp(start)} --> ${stamp(end)}\n${lines.join('\n')}\n`);
    });
    return { srt: blocks.join('\n'), count: blocks.length };
}

const ffmpegColor = (hex) => `0x${hex.replace('#', '')}`;
/** libass colours are &HAABBGGRR. */
const assColor = (hex) => {
    const [r, g, b] = hex.replace('#', '').match(/../g);
    return `&H00${b}${g}${r}`.toUpperCase();
};
const filterPath = (p) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");

function main() {
    const args = process.argv.slice(2);
    const videoDir = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
    const withCaptions = !args.includes('--no-captions') && existsSync(join(videoDir, 'cues.json'));
    const name = basename(videoDir);
    const out = join(videoDir, 'out');
    const config = loadConfig(videoDir);
    const recording = JSON.parse(readFileSync(join(out, 'marks.json'), 'utf8'));
    const { cuts, removedBefore } = timeline(recording);

    const select = cuts.length ? `not(${cuts.map((cut) => `between(t\\,${cut.from.toFixed(3)}\\,${cut.to.toFixed(3)})`).join('+')})` : '1';
    const filters = [`select='${select}'`, 'setpts=N/FRAME_RATE/TB'];
    let srtPath = null;
    let count = 0;
    if (withCaptions) {
        const cues = JSON.parse(readFileSync(join(videoDir, 'cues.json'), 'utf8'));
        const built = captions(recording, cues, config);
        count = built.count;
        srtPath = join(out, `${name}.${config.lang}.srt`);
        writeFileSync(srtPath, built.srt);
        const style = [`FontName=${config.fontName}`, 'FontSize=15', `PrimaryColour=${assColor(config.brand.text)}`, 'BorderStyle=1', 'Outline=0', 'Shadow=0',
            'Alignment=2', 'MarginV=6', 'Encoding=-1'].join(',');
        filters.push(`pad=1280:${720 + BAND}:0:0:color=${ffmpegColor(config.brand.background)}`);
        filters.push(`subtitles=${filterPath(srtPath)}:fontsdir=${filterPath(dirname(config.fontFile))}:force_style='${style}'`);
    }
    const video = join(out, `${name}.mp4`);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(out, 'screen.mp4'), '-vf', filters.join(','),
        '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', video], { stdio: 'inherit' });

    // Frame 0 is what every app shows as the thumbnail; the poster is the same
    // frame as a file, for <video poster> on a website or a custom thumbnail upload.
    const poster = join(out, `${name}.poster.png`);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', video, '-frames:v', '1', poster]);
    const [r, g, b] = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', video, '-frames:v', '1', '-vf', 'crop=1280:720:0:0,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 });
    if (r > 200 && g < 60 && b > 200) {
        throw new Error('frame 0 is magenta: the take set no mark after the crop measurement');
    }

    const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' }));
    const size = statSync(video).size;
    console.log(`${name}.mp4: ${duration.toFixed(1)} s, ${(size / 1048576).toFixed(1)} MB; ${count} cues; ${cuts.length} cuts, ${removedBefore(1e9).toFixed(1)} s removed`);
    if (size > GITHUB_FREE_LIMIT) {
        console.log('over 10 MB: GitHub refuses it as an attachment in free-plan repositories');
    }
    console.log([video, srtPath, poster].filter(Boolean).join('\n'));
}

if (realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
    main();
}
