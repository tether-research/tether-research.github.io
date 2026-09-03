// Custom hover-reveal controls for the hand-picked "watchable" videos (the
// trailer, the play timelapse and the spontaneous-correction clip). We
// deliberately avoid the native
// `controls` chrome: instead each opted-in <video> is wrapped in a
// `.video-player` box that overlays a scrub timeline (bottom) with a play/pause
// button in the bottom-left corner. The bar fades in on hover.
//
// These videos still autoplay/pause via the shared IntersectionObserver in
// video-autoplay.js. A manual pause sets `data-user-paused` on the video so the
// observer won't resume it when the clip scrolls back into view; pressing play
// clears the flag.

// Lucide `play` / `pause` (ISC). Their outlines are closed shapes, so they read
// as solid glyphs under `.vc-play svg { fill: currentColor }` -- a filled control
// stays legible at 22px over video, where Lucide's usual stroke would not.
const PLAY_ICON = '<svg class="vc-icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>';
const PAUSE_ICON = '<svg class="vc-icon-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/></svg>';

function attach(video) {
    // Wrap the video so the control bar has a positioning context sized exactly
    // to the clip. The wrapper inherits the centered 95% width the bare <video>
    // used to have (see .video-player in style.css); the video fills it.
    const wrap = document.createElement('div');
    wrap.className = 'video-player';
    video.parentNode.insertBefore(wrap, video);
    wrap.appendChild(video);

    const controls = document.createElement('div');
    controls.className = 'vc-controls';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'vc-play';
    playBtn.setAttribute('aria-label', 'Play/pause');
    playBtn.innerHTML = PLAY_ICON + PAUSE_ICON;

    const timeline = document.createElement('div');
    timeline.className = 'vc-timeline';
    const progress = document.createElement('div');
    progress.className = 'vc-progress';
    timeline.appendChild(progress);

    controls.appendChild(playBtn);
    controls.appendChild(timeline);
    wrap.appendChild(controls);

    // --- play / pause ---
    function toggle() {
        if (video.paused) {
            delete video.dataset.userPaused;
            video.play().catch(() => {});
        } else {
            video.dataset.userPaused = '1';
            video.pause();
        }
    }
    playBtn.addEventListener('click', toggle);
    video.addEventListener('click', toggle);
    video.addEventListener('play', () => playBtn.classList.add('is-playing'));
    video.addEventListener('pause', () => playBtn.classList.remove('is-playing'));
    if (!video.paused) playBtn.classList.add('is-playing');

    // --- timeline ---
    let dragging = false;

    function setProgress() {
        const d = video.duration;
        progress.style.width = (d ? (video.currentTime / d) * 100 : 0) + '%';
    }
    function seekTo(clientX) {
        const r = timeline.getBoundingClientRect();
        const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        if (video.duration) {
            video.currentTime = frac * video.duration;
            setProgress();
        }
    }

    timeline.addEventListener('pointerdown', (e) => {
        dragging = true;
        wrap.classList.add('vc-scrubbing');   // keep the bar visible if the pointer slips off mid-drag
        timeline.setPointerCapture(e.pointerId);
        seekTo(e.clientX);
        e.preventDefault();
    });
    timeline.addEventListener('pointermove', (e) => {
        if (dragging) seekTo(e.clientX);
    });
    const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        wrap.classList.remove('vc-scrubbing');
        if (timeline.hasPointerCapture(e.pointerId)) timeline.releasePointerCapture(e.pointerId);
    };
    timeline.addEventListener('pointerup', endDrag);
    timeline.addEventListener('pointercancel', endDrag);

    video.addEventListener('timeupdate', () => { if (!dragging) setProgress(); });
    video.addEventListener('loadedmetadata', setProgress);
    setProgress();
}

// Wrap every video marked with `data-controls` (or `.controllable`) in the
// custom player. Safe to call once on load, before the autoplay observer runs.
export function initVideoControls(root = document) {
    root.querySelectorAll('video[data-controls]').forEach(attach);
}
