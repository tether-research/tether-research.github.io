// Autoplay videos when visible, pause when off-screen. Videos with a
// `data-src` source are lazy-loaded on first view; the trailer and timelapse
// carry a real `src` (the latter fed by hls.js) so they stream on demand.
//
// Returns { observe(root) } -- call observe() to register every <video> under
// `root` (defaults to the whole document) with the shared observer.
//
// There is no cap on concurrent playback: browsers hand out only a handful of
// hardware decoders, but the page has 18 videos and the 81-clip trajectory wall
// is a single precomposited mosaic, so few enough decode at once. A future
// figure that stacks many clips in one viewport would want a budget again.

export function createVideoAutoplay() {
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const v = entry.target;
            if (!entry.isIntersecting) {
                v.pause();
                return;
            }
            const source = v.querySelector('source[data-src]');
            if (source) {
                source.src = source.dataset.src;
                source.removeAttribute('data-src');
                v.load();
            }
            // Don't resume a clip the viewer paused via the custom controls.
            if (v.dataset.userPaused == null) v.play().catch(() => {});
        });
    // threshold 0 (any visible sliver counts): the task grid's clips are short
    // enough that a higher threshold could leave a row unloaded/paused while it is
    // plainly on screen.
    }, { threshold: 0 });

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
