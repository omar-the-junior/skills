// A walkthrough: a whole flow in 3 to 6 chapters, each opened by a card.
// Record with:
//     <kit>/run.sh demo-videos/<name>/script.mjs
const { record } = await import(`${process.env.DEMO_KIT}/recorder.mjs`);

await record(import.meta.url, async (r) => {
    const page = r.page;

    // Signing in is time the viewer gains nothing from: it is cut. The account
    // is named in demo.config.json, and run.sh tries it before filming.
    await r.login('student');
    await r.cover();
    // The chapter's first page loads behind its card.
    await r.chapter(1, { open: '/courses' });
    r.mark('catalogue');
    await r.hold(3000);

    r.mark('course');
    await r.navigate(page.getByRole('link', { name: 'Intro to SQL' }), /\/courses\/intro-to-sql/);
    await r.zoomOn(page.getByText('What you will learn'), 1.6);
    await r.hold(3500);
    await r.unzoom();
    // The next cue is on another chapter; end this one here.
    r.mark('quiet-course');

    await r.chapter(2);
    r.mark('checkout');
    await r.clickOn(page.getByRole('button', { name: 'Buy' }));
    await page.waitForURL(/\/checkout/);
    await r.typeInto(page.getByLabel('Card number'), '4242 4242 4242 4242');
    await r.hold(2000);
    await r.navigate(page.getByRole('button', { name: 'Pay' }), /\/lessons\/1/);
    r.mark('paid');
    r.verify('the lesson page opened', await page.getByRole('heading', { name: 'Lesson 1' }).isVisible());
    await r.hold(3500);
    r.mark('end');
});
