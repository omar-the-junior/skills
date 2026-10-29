# Skills

Agent skills by Omar Masoud, in the open [Agent Skills](https://agentskills.io) format: each skill is a folder under `skills/` with a `SKILL.md` and the scripts it runs. Any agent that reads Agent Skills can use them (Claude Code, Codex, Cursor, Gemini CLI and others).

| Skill | What it does |
|---|---|
| [demo-video](skills/demo-video/SKILL.md) | Records a scripted screen video of a website or web app: a short clip of one feature for a release, or a chaptered walkthrough. Real browser, drawn pointer, zooms, cover, chapter cards, burned-in captions (right-to-left included), checked frame by frame. |

### Forked from Matt Pocock

Thirteen skills come from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT, see `upstream/mattpocock/LICENSE`). Four are changed for work tracked in an ISA (Ideal State Artifact, the spec format of [LifeOS](https://github.com/danielmiessler/LifeOS)):

- `code-review` reads the ISA as its spec and sends the two halves of the review to the `spec-reviewer` and `standards-reviewer` agents in `agents/`.
- `retro` gives every finding a home: a repo check, `CODING_STANDARDS.md`, a pointer, the ISA, or the agent system's own rules.
- `improve-codebase-architecture` and `wait-what` use the ISA's glossary and decisions.

The other nine are his, unchanged: `codebase-design`, `diagnosing-bugs`, `handoff`, `pr`, `prototype`, `tdd`, `to-questionnaire`, `wizard`, `writing-for-agents`. Branch `upstream/matt` holds his copies at the commit in `upstream/mattpocock/UPSTREAM.json`; `bin/upstream-matt` shows what he changed since then and what we changed, and `git merge upstream/matt` brings his changes in.

## Install

Pick one. All three get the same skill.

### Any agent, with skills.sh

```bash
npx skills add omar-the-junior/skills --skill demo-video
```

It asks which agents to install for. Add `-g` to install for your user instead of the current project.

### Claude Code, as a plugin

```bash
claude plugin marketplace add omar-the-junior/skills
claude plugin install omar-skills@omar-the-junior
```

Ask for a demo video, or run `/omar-skills:demo-video`. Update with `claude plugin update omar-skills@omar-the-junior`, or turn on auto-update for the marketplace under Marketplaces in `/plugin`.

### By hand

```bash
git clone https://github.com/omar-the-junior/skills.git ~/skills
ln -s ~/skills/skills/demo-video ~/.claude/skills/demo-video    # Claude Code
ln -s ~/skills/skills/demo-video ~/.agents/skills/demo-video    # agents that read ~/.agents/skills
```

`git pull` in the clone updates it.

## demo-video requirements

Linux, with:

- Xvfb, `xvfb-run` and `xauth`
- ffmpeg built with x11grab and libass (distro packages are)
- Node 20+ (Debian and Ubuntu apt packages are older; use nodejs.org or a version manager)
- Playwright with its Chromium. Any Playwright already on the machine with its browser downloaded is reused (the project's own, one beside the videos folder, or one in Playwright's cache registry), so most projects install nothing; otherwise doctor.sh prints the install line, pinned to a version whose browser is already cached when there is one
- ImageMagick, for the contact sheets
- xdotool, only if a video has to accept a browser permission prompt

`skills/demo-video/scripts/doctor.sh` checks all of them and prints the install command for your distro. macOS and Windows are not supported: capture relies on an X11 virtual display.

## License

MIT, see [LICENSE](LICENSE). The bundled Cairo font is under the SIL Open Font License, see `skills/demo-video/assets/fonts/OFL.txt`.
