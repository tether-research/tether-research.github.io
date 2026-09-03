import { initToc } from './toc.js';
import { createVideoAutoplay } from './video-autoplay.js';
import { initVideoControls } from './video-controls.js';
import { initClipZoom } from './clip-zoom.js';

// Wait for load (not just DOMContentLoaded): the `ready` class gates the CSS
// transitions so the initial paint snaps in instead of animating from zero, and
// the TOC's first measurement wants final font/viewport metrics.
//
// HLS attachment for the trailer and timelapse is not here -- it lives inline in
// <head> so it can start the moment hls.js lands, which is well before `load`.
window.addEventListener('load', () => {
    document.body.classList.add('ready');

    initToc();

    // Wrap the trailer, timelapse and correction clips with the custom hover
    // controls (timeline + play/pause). Runs before the autoplay observer below,
    // which reads the `data-user-paused` flag those controls set.
    initVideoControls();

    // Click any gallery clip to enlarge it in place.
    initClipZoom();

    createVideoAutoplay().observe();
});
