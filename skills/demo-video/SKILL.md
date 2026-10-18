---
name: demo-video
description: Record a scripted screen video of a website or web app, either a short clip of one feature for a release or page, or a chaptered walkthrough, with a drawn pointer, zooms, a cover, chapter cards and burned-in captions. Use when making, re-recording or fixing a demo, feature clip or walkthrough video, and when someone gives feedback on one (the feedback becomes a lesson in this skill).
license: MIT
compatibility: Linux with Xvfb, ffmpeg (x11grab and libass), Node 20+, Playwright Chromium and ImageMagick.
---

# Demo video

A demo video is a Playwright script driving the **real** site in a real browser on a virtual display, filmed, cut, captioned and checked frame by frame before anyone sees it. Four leading words carry most of the rules:

- **Real**: every frame is a page of the running site, or a third party's own page (a checkout in test mode). The script adds only presentation aids: the cover, chapter cards, a drawn pointer with click ripples, zooms and cuts.
- **Visible path**: the viewer can repeat every step. Each move between pages is a pointer click on the real link, button or row, and each input is clicked before it is typed into.
- **Clean frame**: nothing on screen belongs to the recording machine (browser chrome, popups, link previews, a half-loaded page, a login form left over from a cut).
- **Cover**: frame 0 is a finished picture, because frame 0 is the thumbnail every app shows. The video starts at the script's first mark.

Paths in this file are relative to this skill's folder; run the scripts by their full path from the folder that holds the videos. The kit is in `scripts/`. Each file's header says what it does and how to call it; `recorder.mjs` documents every helper the script uses.

## Steps

1. **Check the machine.** In the folder that will hold the videos (usually `demo-videos/` in the project), run `scripts/doctor.sh`. Installing system packages needs sudo, so hand the printed install lines to the person.
   Done when it prints `ready`.

2. **Read [`references/lessons.md`](references/lessons.md).** Done when each lesson is applied in this video's plan or named as not applying.

3. **Scope the story.** Pick the shape:
   - a **clip**: one feature, 10 to 40 s, for a release note, a changelog or a page on the site. Cover, the page, the action, the result.
   - a **walkthrough**: a whole flow in 3 to 6 chapters, one idea each.

   List the claims the video must show and map each to one on-screen moment. Show the feature as a user meets it: fixes made along the way that a user never acts on (a warning, a recovery path, an edge case) stay out; the tests carry them. Data is seeded fake accounts only.
   Done when each claim maps to one moment, and the person has agreed the list when the scope was theirs to set.

4. **Set up the video folder.** Copy `templates/demo.config.json` into the videos folder once (base URL, caption language and direction, brand colours, font) and `templates/clip/` or `templates/walkthrough/` to `demo-videos/<name>/`. Fill `video.json`: the cover's title and line, the chapters, and what is shown and left out.
   Done when the cover text says what the video shows in a few words.

5. **Write the script** in `<name>/script.mjs`, through the recorder's helpers: `cover`, `chapter`, `go` (the first page and a chapter's resume only), `navigate`, `clickOn`, `typeInto`, `upload`, `scrollTo`, `wheel`, `zoomOn`/`unzoom`, `offCamera` for logins and seeding, `mark` for every caption. Rules the helpers cannot enforce:
   - Zoom only on something narrower than about two thirds of the screen, and only while no fixed sidebar or sticky header is on screen: the zoom scales the whole page, so a fixed layer floats over it and a full-width row loses its ends. Walk the pointer across those instead.
   - Every claim a caption makes that the server must make true (a saved price, a refused request) is checked with `r.verify` at that moment.
   - Caption text lives in `cues.json` keyed by mark; hold at least 3.2 s after a mark so its caption gets 2.5 s on screen.

   Done when the script has no `page.goto` on camera outside `go`, and every claim has a `verify` or a visible on-screen proof.

6. **Capture.** Reset the seeded data, then `scripts/run.sh demo-videos/<name>/script.mjs`. [`references/capture.md`](references/capture.md) explains what the recorder does and why, for when a take misbehaves.
   Done when the run exits 0 with every check passing.

7. **Finish.** `node scripts/finish.mjs demo-videos/<name>` cuts, captions, burns and writes the poster; caption rules are in [`references/captions.md`](references/captions.md).
   When the person names where the video goes and that place caps file size (a GitHub attachment, a CMS upload), add `--max-mb <n>`: it then fails over the cap.
   Done when it prints the length, size and cue count, with the cue count matching `cues.json`.

8. **Verify the frames** with `node scripts/sheets.mjs demo-videos/<name>`, then every check in [`references/verify.md`](references/verify.md). Look at the images: a passing script proves nothing about what the viewer sees.
   Done when every check has been looked at, and each defect is fixed by a new take, never by editing the video around it.

9. **Hand off.** `node scripts/review-sheet.mjs demo-videos/<name>` writes `out/<name>.review.md`: length, what is shown and left out, every caption, the checks the take proved. The person approves the cover, card and caption text before the video goes to anyone else. Deliver `<name>.mp4`, its `.srt` and `<name>.poster.png`.
   Done when the review sheet matches the final video and the person has it.

## Lessons

[`references/lessons.md`](references/lessons.md) is this skill's memory. When someone gives feedback on a video ("you didn't use the cursor there", "it opens on a pink frame"), or verification finds a defect:

1. Fix it in the video first.
2. Put the rule where it acts: a step above, a reference file, or the kit itself when code can enforce it. Edit an existing rule when the lesson sharpens it; add one only for a new case.
3. Add a dated one-line entry to `lessons.md` naming what went wrong and where the rule now lives.
