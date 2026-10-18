// Writes the hand-off review sheet beside the video: length, what is shown and
// left out (video.json `shown`, `leftOut`), every cue with its time and, when
// cues.<lang>.json exists, its translation; the mixed-direction cues of a
// right-to-left video; and the checks the take proved.
// usage: node review-sheet.mjs <video-dir> [translation-lang]    writes out/<name>.review.md
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { loadConfig } from './config.mjs';

const videoDir = resolve(process.argv[2] ?? '.');
const tlang = process.argv[3] ?? 'en';
const name = basename(videoDir);
const out = join(videoDir, 'out');
const config = loadConfig(videoDir);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const video = existsSync(join(videoDir, 'video.json')) ? read(join(videoDir, 'video.json')) : {};
const cues = existsSync(join(videoDir, 'cues.json')) ? read(join(videoDir, 'cues.json')) : {};
const translated = tlang !== config.lang && existsSync(join(videoDir, `cues.${tlang}.json`)) ? read(join(videoDir, `cues.${tlang}.json`)) : null;
const keys = read(join(out, 'marks.json')).marks.map((m) => m.key).filter((k) => cues[k]);
const srtPath = join(out, `${name}.${config.lang}.srt`);
const times = existsSync(srtPath)
    ? readFileSync(srtPath, 'utf8').trim().split(/\n\n+/).map((b) => b.split('\n')[1].replace(/,\d+/g, '').replace(/^00:/, '').replace(' --> 00:', ' → '))
    : [];
const checks = existsSync(join(out, 'checks.json')) ? read(join(out, 'checks.json')) : [];
const mp4 = join(out, `${name}.mp4`);
const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', mp4], { encoding: 'utf8' });
const { format, streams } = JSON.parse(probe);
const cell = (s = '') => s.replace(/\n/g, '<br>').replace(/\|/g, '\\|');
const mixed = config.rtl ? keys.filter((k) => /[A-Za-z0-9]/.test(cues[k])) : [];

const md = `# ${video.title ?? name} (${name}.mp4)

Length ${Number(format.duration).toFixed(1)} s · ${streams[0].width}x${streams[0].height} · 30 fps · no sound${keys.length ? ` · captions burned in, same text in \`${basename(srtPath)}\`` : ''} · thumbnail \`${name}.poster.png\`.

**Shown:** ${video.shown ?? '(add `shown` to video.json)'}

**Left out:** ${video.leftOut ?? '(add `leftOut` to video.json)'}

**Waiting for approval:** the cover, chapter card and caption text below.
${keys.length ? `
## Captions

| # | Time | Caption |${translated ? ` ${tlang} |` : ''}
|---|------|---------|${translated ? '----|' : ''}
${keys.map((k, i) => `| ${i + 1} | ${times[i] ?? ''} | ${cell(cues[k])} |${translated ? ` ${cell(translated[k])} |` : ''}`).join('\n')}
` : ''}${mixed.length ? `
## Mixed-direction captions

Captions holding Latin words or numbers (${mixed.length} of ${keys.length}): ${mixed.map((k) => keys.indexOf(k) + 1).join(', ')}. Check their word order on the contact sheets.
` : ''}
## What the take proved

${checks.length ? checks.map((c) => `- ${c.ok ? 'PASS' : 'FAIL'}: ${c.name}`).join('\n') : '- (no verify() checks in this script)'}
`;
writeFileSync(join(out, `${name}.review.md`), md);
console.log(`${join(out, `${name}.review.md`)}: ${keys.length} captions, ${checks.length} checks`);
