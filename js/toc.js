// Sticky table-of-contents with scroll-spy. The TOC tracks down the page until
// it hits a minimum top offset, then pins; the link for the section currently
// under the top edge is highlighted.
//
// Performance note: this runs on every scroll event on a page carrying 18
// <video> elements, so the update is written to be layout-free. Two rules keep
// it that way:
//   1. Section positions are measured once (and on resize) into `tops`, in
//      document space. Reading getBoundingClientRect() per scroll tick instead
//      would force a synchronous layout of the whole document on every event.
//   2. The work is coalesced into one requestAnimationFrame callback, so the
//      burst of events a trackpad fires between frames costs a single update.
export function initToc() {
    const toc = document.querySelector('.toc');
    if (!toc) return;
    const sections = [...document.querySelectorAll('section[id]')];
    if (!sections.length) return;
    const offset = 40;
    const tocMinTop = 64;
    const trailer = document.getElementById('trailer');

    // Resolve each section's link once; querySelector per tick is pure waste.
    // Sections with no TOC entry (citation) map to undefined, which correctly
    // leaves no link highlighted while it's current.
    const linkFor = new Map(sections.map(s =>
        [s, document.querySelector('.toc a[href="#' + s.id + '"]')]));

    let tocInitialTop = 320;
    let tops = [];

    // Measure in document space so the scroll handler only has to subtract
    // scrollY. Called on load and on resize -- the only times these move.
    function measure() {
        const y = window.scrollY;
        tocInitialTop = trailer
            ? trailer.getBoundingClientRect().top + y + tocMinTop
            : 320;
        tops = sections.map(s => s.getBoundingClientRect().top + y);
    }

    let lastTop = null, lastActive = null, queued = false;

    function render() {
        queued = false;
        const scrollY = window.scrollY;

        // Once the TOC has pinned at tocMinTop this value stops changing, so the
        // guard skips the style write (and its layout invalidation) entirely for
        // most of the page.
        const top = Math.max(tocMinTop, tocInitialTop - scrollY);
        if (top !== lastTop) {
            toc.style.top = top + 'px';
            lastTop = top;
        }

        // Last section whose top has passed the offset line.
        let current = sections[0];
        for (let i = 0; i < sections.length; i++) {
            if (tops[i] - scrollY <= offset) current = sections[i];
        }
        if (current !== lastActive) {
            linkFor.get(lastActive)?.classList.remove('active');
            linkFor.get(current)?.classList.add('active');
            lastActive = current;
        }
    }

    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(render);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => { measure(); schedule(); });
    measure();
    render();
}
