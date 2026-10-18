// A clip: one feature for a release note or a page, 10 to 40 s.
// Cover, the page, the action, the result. Record with:
//     <kit>/run.sh demo-videos/<name>/script.mjs
const { record } = await import(`${process.env.DEMO_KIT}/recorder.mjs`);

await record(import.meta.url, async (r) => {
    const page = r.page;

    // Frame 0 and the thumbnail: video.json's cover, fully drawn.
    await r.cover();

    await r.go('/settings');
    r.mark('open');
    // A cue needs 2.5 s on screen after its 0.3 s lead; hold past that.
    await r.hold(3200);

    r.mark('toggle');
    await r.clickOn(page.getByRole('switch', { name: 'Dark mode' }));
    r.verify('the page turned dark', (await page.locator('html').getAttribute('data-theme')) === 'dark');
    await r.hold(3500);
    r.mark('end');
});
