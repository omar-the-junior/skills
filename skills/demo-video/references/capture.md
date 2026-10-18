# Capture

What `recorder.mjs` and `run.sh` do, and the reason behind each choice. Read it when a take misbehaves, and before changing the kit, so a fix does not undo one of these.

## Display and browser

- **Xvfb + ffmpeg `x11grab` at 30 fps.** Playwright's own `recordVideo` (a CDP screencast) changed only about 13 frames a second while typing and froze for up to 0.5 s; x11grab on the same scene changes every frame, longest freeze 0.07 s.
- **`run.sh` starts the display** with `xvfb-run -a` (a free display number) at 1280x900, taller than the 720 px video so the tab bar sits above the filmed area. Any Linux desktop works, Wayland included: Xvfb is a separate display.
- **The browser is headed on that display.** The recorder drops `WAYLAND_DISPLAY`, `GDK_SCALE`, `OZONE_PLATFORM`, `ELECTRON_OZONE_PLATFORM_HINT` and `DBUS_SESSION_BUS_ADDRESS` from its environment and passes `--ozone-platform=x11 --force-device-scale-factor=1`. With them, Chromium opened on the real desktop (a black video) or at 2x scale.
- **`chromium.launch()` + `newContext()`.** A persistent context (`launchPersistentContext`) stopped page clicks from arriving at all.
- **Viewport 1280x724**: the window frame hides the page's bottom 2 px, so the top 720 are filmed.
- **A desktop Chrome user agent** with the real version: some third-party checkouts answer 403 to `HeadlessChrome`.

## Cropping and the first frame

The page's first screen row is found by painting the page magenta and grabbing one column; the browser's `outerHeight - innerHeight` is off by 2 px. ffmpeg then films `1280x720` from that row with `-draw_mouse 0`, and is stopped by writing `q` to its stdin so the file is finalized.

The magenta page is on screen when ffmpeg starts. `finish()` cuts everything before the first mark, so the measurement never reaches the video, and `finish.mjs` refuses a video whose frame 0 is magenta. Animated chapter cards are marked only once they have risen, so no cue or video opens on a half-drawn card.

The video starts about 0.1 s after ffmpeg is spawned; `marks.json` records that as `offset` and the captions shift by it.

## Keeping the frame clean

- **Translate bar.** Chromium offers to translate any page whose language differs from its own, and `--disable-features=Translate` no longer hides it. An init script marks every page `translate="no"` with `<meta name="google" content="notranslate">` on `DOMContentLoaded` (there is no `<html>` earlier).
- **Link-preview URL.** A headed browser shows a link's URL in the bottom corner while the real mouse is over it. The drawn pointer moves by script (`window.__demoPointerTo`), and after every real click the real mouse leaves the page. `wheel` scrolls with the mouse in the left margin, off every link: over a full-width image link it showed the image's URL.
- **Pointer.** Drawn by an init script (`position: fixed`, `pointer-events: none`, top z-index) with a ripple on `mousedown` in the brand accent; hidden on cards.
- **Browser permission bubbles** ("Allow", "Save changes") are browser UI, not page DOM. `acceptBrowserPrompt()` finds the filled button by colour and clicks it with xdotool, only inside `offCamera`.

## When a take fails

The recorder saves `out/error.png` (the screen at the failure) and still finalizes `screen.mp4`, so the take up to the failure can be watched.
