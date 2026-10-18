# Cuts, cards and captions

## Cuts

A cut removes time the viewer gains nothing from: logins, seeding, waits for a background job, a rebuild. `offCamera(fn)` runs `fn` inside a cut; `beginCut()`/`endCut(from)` cut a stretch by hand.

- `endCut` waits for `networkidle` plus 0.7 s before ending, so the next page is **drawn**. Ending earlier let the previous page (a login form) flash for 0.2 to 0.4 s.
- After a login cut the video opens on the page that account lands on, and the pointer clicks on from there.
- Everything before the first mark is cut too: the video starts at the cover, or at the first mark of a clip with no cover.

## Cover and chapter cards

Cards are full-screen pages in the brand colours from `demo.config.json`, served in a tab of their own so the page underneath keeps its state.

- `cover()` shows `video.json`'s cover with no animation: frame 0, the thumbnail. A clip may skip it, and then frame 0 is the page at the first mark, so mark only once that page is fully drawn.
- `chapter(n)` shows "Part n of total" (the `labels.part` text), the chapter title and one line, for about 4.2 s.
- Card text is new copy, so the person approves it like the captions.

## Caption text

- Captions live in `cues.json` keyed by mark. A caption lasts until the next mark.
- When the page changes before the next caption (a navigation, a cut, a chapter card), put a `quiet-<name>` mark right before it: the caption ends there and no text shows. Without one, a caption runs on over a page it does not describe.
- Plain language, at most two short lines, the same terms the UI uses, at least 2.5 s on screen. `finish.mjs` refuses a shorter one; hold longer or drop the caption.
- `finish.mjs` burns captions into a 110 px band under the page, so they never cover the UI, and writes the same text as `<name>.<lang>.srt`. `--no-captions` skips both and keeps the video at 1280x720.

## Right-to-left captions

With `"rtl": true` in `demo.config.json` (Arabic, Hebrew, Persian, Urdu):

- Every caption line opens with U+200F (right-to-left mark), and libass runs with `Encoding=-1`. Without both, a line holding numbers or Latin words, or one that **starts** with a Latin word, is laid out left to right.
- Never glue a joining prefix letter to a Latin word (Arabic waw before "Upload"): the line renders jumbled. Repeat the joining word as its own word instead.
- The review sheet lists every caption mixing scripts; check their word order on the contact sheets.

## Fonts

With no `font.file`, the bundled Cairo (Latin and Arabic, SIL OFL) is used on the cards and in the captions. A custom `font.file` (relative to `demo.config.json`) needs `font.name` set to the font's family name, or libass falls back to another font.
