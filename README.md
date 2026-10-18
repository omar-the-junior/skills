# Skills

Agent skills by Omar Masoud, in the [Agent Skills](https://agentskills.io) format: each skill is a folder under `skills/` with a `SKILL.md` and the scripts it runs.

| Skill | What it does |
|---|---|
| [demo-video](skills/demo-video/SKILL.md) | Records a scripted screen video of a website or web app: a short clip of one feature for a release, or a chaptered walkthrough. Real browser, drawn pointer, zooms, cover, chapter cards, burned-in captions (right-to-left included), checked frame by frame. |

## Install

### Claude Code plugin

```bash
claude plugin marketplace add omar-the-junior/skills
claude plugin install omar-skills@omar-the-junior
```

Invoke it by asking for a demo video, or with `/omar-skills:demo-video`.

### Other agents, via skills.sh

```bash
npx skills add omar-the-junior/skills --skill demo-video
```

### By hand

Copy or symlink `skills/demo-video` into `~/.claude/skills/` (all projects) or `.claude/skills/` (one project).

## demo-video requirements

Linux, with:

- Xvfb, `xvfb-run` and `xauth`
- ffmpeg built with x11grab and libass (distro packages are)
- Node 18+ and Playwright's Chromium, installed in the folder that holds your videos: `npm i -D playwright && npx playwright install chromium`
- ImageMagick, for the contact sheets
- xdotool, only if a video has to accept a browser permission prompt

`skills/demo-video/scripts/doctor.sh` checks all of them and prints the install command for your distro. macOS and Windows are not supported: capture relies on an X11 virtual display.

## License

MIT, see [LICENSE](LICENSE). The bundled Cairo font is under the SIL Open Font License, see `skills/demo-video/assets/fonts/OFL.txt`.
