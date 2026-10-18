# Verifying the frames

Every check is done by looking at images, never by trusting that the script passed. `sheets.mjs` writes the contact sheets to `out/sheets/`; read each one.

1. **Frame 0** (`1-frame0.png`, full size). The finished cover, or the fully drawn first page of a clip: no magenta, no black, no half-risen card. It is the thumbnail in every chat app, file manager and video player.
2. **One frame per caption** (`2-cues-*.png`, at 75% of each caption's time). The caption matches what is on screen, the zoom is on the part the caption names, and the pointer is where the caption says to look.
3. **Every cut** (`3-cuts.png`, just before and after each join). The frame after the join shows the drawn destination page: no login form, no half-loaded page, no skeleton.
4. **Every navigation** (`4-timeline-*.png`, a frame every 0.5 s). The pointer travels to the link, ripples on it, and the next page follows. A page that appears with no pointer travel is a missing `navigate`.
5. **Cards** (`5-cards.png`). Each card is fully drawn, numbered in order, with no pointer on it.
6. **Browser chrome** (the timeline sheets). Top-right and bottom-left corners on every frame: no translate bar, no link-preview URL, no tab strip, no scrollbar.
7. **Smoothness**, on one typing or zoom stretch: `scripts/frame-gaps.sh <video-dir>/out/<name>.mp4 START END` from the skill folder. Expect close to 30 changed frames a second while typing, and no freeze over 0.2 s the script did not hold on purpose.
8. **Length, size and format**, from `finish.mjs`'s output: 1280x830 with captions (1280x720 without), 30 fps. A clip for GitHub stays under 10 MB, the attachment limit in free-plan repositories.

A defect is fixed in the script or the kit, then the whole take is re-recorded and these checks run again.
