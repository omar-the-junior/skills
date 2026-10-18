# Skills

Agent skills by Omar Masoud, in the open [Agent Skills](https://agentskills.io) format: each skill is a folder under `skills/` with a `SKILL.md` and the scripts it runs. Any agent that reads Agent Skills can use them (Claude Code, Codex, Cursor, Gemini CLI and others).

| Skill | What it does |
|---|---|
| [demo-video](skills/demo-video/SKILL.md) | Records a scripted screen video of a website or web app: a short clip of one feature for a release, or a chaptered walkthrough. Real browser, drawn pointer, zooms, cover, chapter cards, burned-in captions (right-to-left included), checked frame by frame. |

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

### While the repository is private

All three ways work for anyone added as a collaborator on GitHub, once git on their machine can clone the repository without asking for a password. The simplest setup:

```bash
gh auth login        # GitHub CLI, signed in as the invited account
gh auth setup-git    # lets plain git use that sign-in
git ls-remote https://github.com/omar-the-junior/skills.git    # prints a line when access works
```

An SSH key loaded in `ssh-agent` works too. The installers run git without prompts, so a credential that would have to be typed in fails. For skills.sh, exporting `GITHUB_TOKEN` also works; Claude Code ignores that variable unless a credential helper (such as `gh`'s) reads it.

Anyone not added gets "repository not found". Once the repository is public, none of this is needed.

## demo-video requirements

Linux, with:

- Xvfb, `xvfb-run` and `xauth`
- ffmpeg built with x11grab and libass (distro packages are)
- Node 20+ (Debian and Ubuntu apt packages are older; use nodejs.org or a version manager)
- Playwright's Chromium, installed in the folder that holds your videos: `npm i -D playwright && npx playwright install chromium` (on Debian, Ubuntu and their derivatives, `install --with-deps chromium` also adds the system libraries Chromium needs)
- ImageMagick, for the contact sheets
- xdotool, only if a video has to accept a browser permission prompt

`skills/demo-video/scripts/doctor.sh` checks all of them and prints the install command for your distro. macOS and Windows are not supported: capture relies on an X11 virtual display.

## License

MIT, see [LICENSE](LICENSE). The bundled Cairo font is under the SIL Open Font License, see `skills/demo-video/assets/fonts/OFL.txt`.
