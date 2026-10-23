# Lessons

One line per lesson: the date, what went wrong, and where the rule now lives. Newest first. The rule itself lives in that place, not here.

- 2026-10-23 · A sign-in cut before the cover overlapped the lead-in cut, and both were subtracted, so every caption ran about 4 s early. → finish.mjs `timeline` (merges overlapping cuts), capture.md "Accounts and real data".
- 2026-10-23 · A staging take spent most of its session on identical 401s: the wrong one of two admin accounts, then a dotenv value sent with its quotes. → login.mjs (`accounts` in demo.config.json, `readSecret`), preflight.mjs via run.sh, SKILL.md step 6 (ask which account the person uses).
- 2026-10-23 · Locators were found by failed takes and hand-written probe scripts, about 15 browser runs. → probe.mjs, SKILL.md step 5 ("Probe before writing").
- 2026-10-23 · A text locator with `.last()` pointed at a filter chip, not the status badge with the same label. → SKILL.md step 5 (one-match locators, from the probe).
- 2026-10-23 · Chapter cards held 6 to 10 s while the next page loaded behind them on camera. → recorder.mjs `chapter(n, { open })` (load cut behind the card), captions.md.
- 2026-10-23 · The previous caption showed on a rising chapter card. → recorder.mjs `showCard` (`quiet-before-<key>`), captions.md.
- 2026-10-23 · A caption described a source file too small to read at 1280x720. → SKILL.md step 5, verify.md 2.
- 2026-10-23 · A read-only staging take guarded writes with a hand-written request watcher. → recorder.mjs `readOnly()` (blocks writes, fails the take), SKILL.md steps 3 and 5.

- 2026-10-21 · The account card from step 5, called as written there (two arguments), crashed the take: `showCard` had no default hold. → recorder.mjs (`showCard` holds 3.4 s by default, as a chapter card does).
- 2026-10-20 · Reviewer and supervisor steps alternated across cut logins, and the viewer could not tell a supervisor account took the supervisor's steps. → SKILL.md step 5 (an account card before every login cut, and captions name the account).
- 2026-10-20 · A walkthrough was about to be filmed on seed data with no source PDFs, so every PDF panel would have said "failed to load". → SKILL.md step 3 (every panel shown must load; generate sample files).
- 2026-10-20 · A decision moved the page to the next entry while its caption still described the decision. → script practice: reopen the decided item so the result shows under its caption (f21-recheck `showDecided`).
- 2026-10-20 · A per-Concept free-preview tick was shown on one Concept only, so the viewer could not tell it was a choice made per Concept. → SKILL.md step 3 (show a per-item setting with its contrast).
- 2026-10-19 · On a zoomed Arabic hint the pointer waited at the left end of the line, where the text ends, not where it starts. → recorder.mjs `zoomOn` (`text: true` aims at the right edge when `rtl`).
- 2026-10-19 · doctor.sh told a new videos folder to install the latest Playwright, which downloaded a second Chromium build (about 680 MB) while the project's own Playwright and its build were already on disk. → playwright.mjs (reuses a Playwright whose build is cached; `playwrightFrom`), doctor.sh (prints the pinned version), SKILL.md step 1.
- 2026-10-18 · Every delivered video opened on about 0.9 s of magenta (the crop-measurement page), then black, so chat apps showed a pink thumbnail. → recorder.mjs (lead-in cut to the first mark, `cover()`, cards marked once drawn), finish.mjs (refuses a magenta frame 0), verify.md 1.
- 2026-10-16 · Caption lines starting with an English word laid out left to right even with `Encoding=-1`. → captions.md "Right-to-left captions" (U+200F on every line, in finish.mjs).
- 2026-10-16 · An Arabic waw joined to "Upload" jumbled the whole caption line. → captions.md "Right-to-left captions".
- 2026-10-16 · Scrolling with the wheel over a full-width image showed its URL in the corner. → capture.md "Keeping the frame clean" (`wheel` in recorder.mjs).
- 2026-10-16 · Zooming a control floated the site's sticky header mid-page, zooming an admin page scaled its fixed sidebar, and a floating chat button covered a price near the bottom corner. → SKILL.md step 5 (zoom limits); centre such rows before pointing at them.
- 2026-10-16 · Zooming a three-card row clipped the outer cards. → SKILL.md step 5 (zoom limits).
- 2026-10-16 · Captions ran on over the next page (a login cut, a dashboard) until the next mark. → captions.md "Caption text" (quiet marks).
- 2026-10-15 · The video jumped to pages with no pointer going there, so the viewer could not tell how it got there. → SKILL.md "Visible path", verify.md 4.
- 2026-10-15 · A login form flashed for about 0.3 s after each login cut, because cuts ended before the next page was drawn. → captions.md "Cuts" (`endCut` in recorder.mjs), verify.md 3.
- 2026-10-15 · Chromium's translate bar appeared on pages in another language and after a third-party checkout. → capture.md "Keeping the frame clean".
- 2026-10-15 · A link-preview URL showed in the bottom corner whenever the real mouse hovered a link. → capture.md "Keeping the frame clean".
- 2026-10-15 · A persistent browser profile silently dropped every page click. → capture.md "Display and browser".
- 2026-10-15 · Chromium opened on the real Wayland desktop (black video), then at 2x scale from `GDK_SCALE`. → capture.md "Display and browser".
- 2026-10-15 · Playwright's recorder dropped frames and the recording looked bad. → capture.md (Xvfb + x11grab).
- 2026-10-15 · The video showed fixes made along the way (a closed checkout, a reopen, a refund flag) that a user never acts on, which buried the feature. → SKILL.md step 3.
- 2026-10-14 · A local stand-in replaced the third-party checkout; the real one in test mode is what the viewer needs to see. → SKILL.md "Real".
- 2026-10-14 · Arabic captions mixing numbers or Latin text rendered left to right. → captions.md "Right-to-left captions".
