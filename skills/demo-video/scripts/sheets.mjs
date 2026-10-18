// Contact sheets for references/verify.md, made from the delivered video:
// frame 0 (check 1), one frame per cue at 75% of its time (check 2), the frames
// around every cut (check 3), each chapter card (check 5), and a frame every
// 0.5 s (checks 4 and 6).
// usage: node sheets.mjs <video-dir>    writes out/sheets/*.png
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { timeline } from './finish.mjs';

const videoDir = resolve(process.argv[2] ?? '.');
const name = basename(videoDir);
const out = join(videoDir, 'out');
const video = join(out, `${name}.mp4`);
const dir = join(out, 'sheets');
mkdirSync(dir, { recursive: true });

const frame = (t, file, width = 640) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', t.toFixed(2), '-i', video, '-frames:v', '1', '-vf', `scale=${width}:-1`, file]);
// ImageMagick 7 runs `magick montage`; 6 (Debian and Ubuntu up to 24.04) has only `montage`.
const montageCmd = (() => {
    try {
        execFileSync('magick', ['-version'], { stdio: 'ignore' });
        return ['magick', 'montage'];
    } catch {
        return ['montage'];
    }
})();
const montage = (files, sheet, tile = '3x') =>
    execFileSync(montageCmd[0], [...montageCmd.slice(1), ...files, '-tile', tile, '-geometry', '+3+3', join(dir, `${sheet}.png`)]);
const seconds = (s) => {
    const [h, m, rest] = s.replace(',', '.').split(':').map(Number);
    return h * 3600 + m * 60 + rest;
};

// 1. Frame 0, full size: the thumbnail.
frame(0, join(dir, '1-frame0.png'), 1280);

// 2. One frame per cue.
const srt = readdirSync(out).find((f) => f.startsWith(`${name}.`) && f.endsWith('.srt'));
const cueFiles = srt
    ? readFileSync(join(out, srt), 'utf8').trim().split(/\n\n+/).map((block, i) => {
          const [a, b] = block.split('\n')[1].split(' --> ').map(seconds);
          const file = join(dir, `cue-${String(i + 1).padStart(2, '0')}.png`);
          frame(a + 0.75 * (b - a), file);
          return file;
      })
    : [];
for (let i = 0; i < cueFiles.length; i += 6) {
    montage(cueFiles.slice(i, i + 6), `2-cues-${i / 6 + 1}`);
}

// 3 and 5. Around every cut, and each chapter card, in final-video time.
const recording = JSON.parse(readFileSync(join(out, 'marks.json'), 'utf8'));
const { cuts, final } = timeline(recording);
const cutFiles = [];
cuts.forEach((cut, i) => {
    const at = final(cut.to + (recording.offset ?? 0.1));
    if (at <= 0) {
        return; // the lead-in cut: frame 0 is check 1
    }
    for (const [k, dt] of [[0, -0.2], [1, 0.03], [2, 0.2], [3, 0.5]]) {
        const file = join(dir, `cut-${i}-${k}.png`);
        frame(Math.max(0, at + dt), file);
        cutFiles.push(file);
    }
});
if (cutFiles.length) {
    montage(cutFiles, '3-cuts', '4x');
}
const cardFiles = recording.marks.filter((m) => m.key.startsWith('chapter-')).map((m, i) => {
    const file = join(dir, `card-${i + 1}.png`);
    frame(final(m.at) + 1.5, file);
    return file;
});
if (cardFiles.length) {
    montage(cardFiles, '5-cards', '2x');
}

// 4 and 6. Every 0.5 s, in sheets of 24.
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' }));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', video, '-vf', 'fps=2,scale=320:-1', join(dir, 't-%04d.png')]);
const all = Array.from({ length: Math.floor(duration * 2) }, (_, i) => join(dir, `t-${String(i + 1).padStart(4, '0')}.png`)).filter((f) => existsSync(f));
for (let i = 0; i < all.length; i += 24) {
    montage(all.slice(i, i + 24), `4-timeline-${String(i / 24 + 1).padStart(2, '0')}`, '6x');
}
console.log(`${dir}: frame 0, ${cueFiles.length} cue frames, ${cutFiles.length / 4} cuts, ${cardFiles.length} cards, ${all.length} timeline frames; ${duration.toFixed(1)} s`);
