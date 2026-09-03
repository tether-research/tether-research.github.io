// Autoplay videos when visible, pause when off-screen. Videos with a
// `data-src` source are lazy-loaded on first view; the trailer and timelapse
// carry a real `src` (the latter fed by hls.js) so they stream on demand.
//
// Returns { observe(root) } -- call observe() to register every <video> under
// `root` (defaults to the whole document) with the shared observer.

// Hard cap on how many clips may decode at once. Browsers hand out only a
// handful of hardware decoders and fall back to software past that, so an
// uncapped page can peg the CPU and make every interaction -- scrolling included
// -- go rubbery.
//
// Back to Do as I Do's 24 now that the generated-trajectory wall is a single
// precomposited mosaic rather than 81 elements. With 18 videos on the page this
// no longer binds in practice; it is a safety net against a future figure that
// stacks many clips in one viewport, not a live constraint.
const MAX_PLAYING = 24;

export function createVideoAutoplay() {
    // Every video currently intersecting the viewport, with the geometry needed
    // to rank it. The geometry is recorded in *document* space from the observer
    // entry's own boundingClientRect -- a rect the browser has already computed.
    // Calling getBoundingClientRect() ourselves here would force a synchronous
    // layout of the whole document on every scroll frame.
    const visible = new Map();   // video -> { docTop, height }

    // A video is a candidate only if it is actually rendered and the viewer
    // hasn't manually paused it via the custom controls.
    const eligible = v => v.dataset.userPaused == null && v.offsetParent !== null;

    // Play the MAX_PLAYING candidates nearest the viewport centre, pause the
    // rest. Ranking by distance to centre means anything the budget drops is at
    // the far edge of the screen, where a held frame reads as "not there yet"
    // rather than as a broken clip.
    let queued = false;

    function apply() {
        queued = false;
        const scrollY = window.scrollY;
        const mid = window.innerHeight / 2;

        const ranked = [];
        for (const [v, g] of visible) {
            if (!eligible(v)) continue;
            const centre = g.docTop - scrollY + g.height / 2;
            ranked.push([Math.abs(centre - mid), v]);
        }
        ranked.sort((a, b) => a[0] - b[0]);

        const keep = new Set();
        for (let i = 0; i < ranked.length && i < MAX_PLAYING; i++) keep.add(ranked[i][1]);

        // Read v.paused rather than tracking our own play-set: the custom
        // controls pause videos behind our back, and this keeps the two views in
        // sync without bookkeeping.
        for (const v of visible.keys()) {
            if (keep.has(v)) { if (v.paused) v.play().catch(() => {}); }
            else if (!v.paused) v.pause();
        }
    }

    // Coalesce observer callbacks and scroll events into one pass per frame.
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(apply);
    }

    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const v = entry.target;
            if (entry.isIntersecting) {
                const source = v.querySelector('source[data-src]');
                if (source) {
                    source.src = source.dataset.src;
                    source.removeAttribute('data-src');
                    v.load();
                }
                const r = entry.boundingClientRect;
                visible.set(v, { docTop: r.top + window.scrollY, height: r.height });
            } else {
                visible.delete(v);
                v.pause();
            }
        });
        schedule();
    // threshold 0 (any visible sliver counts): the task grid's clips are short
    // enough that a higher threshold could leave a row unloaded/paused while it is
    // plainly on screen. The budget above, not the threshold, is what bounds
    // concurrent decoding.
    }, { threshold: 0 });

    // Re-rank as the page scrolls: the visible set barely changes mid-gallery,
    // but which clips sit nearest the centre does. apply() touches no layout, so
    // this is a sort of a few dozen entries per frame.
    window.addEventListener('scroll', schedule, { passive: true });

    // Once a clip paints its first frame, drop the gray placeholder so the page
    // background (not gray) shows through any letterbox bars. `loadeddata` fires
    // at readyState >= HAVE_CURRENT_DATA; videos already past that when observed
    // get the class immediately.
    const markLoaded = v => v.classList.add('loaded');
    const observe = (root = document) =>
        root.querySelectorAll('video').forEach(v => {
            videoObserver.observe(v);
            if (v.readyState >= 2) markLoaded(v);
            else v.addEventListener('loadeddata', () => markLoaded(v), { once: true });
        });

    return { observe };
}
