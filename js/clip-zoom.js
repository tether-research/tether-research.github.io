// Click a gallery clip to enlarge it in place; it shrinks back as soon as the
// pointer leaves it, or when it's clicked again. Only one clip is expanded at a
// time.
//
// Lifted from Do as I Do, where this lives inside the paged gallery engine. The
// galleries here are static markup with no paging, so the behaviour is pulled
// out into its own module and mounted over every .gallery on the page.
//
// The enlarged clip is moved into a .clip-zoom wrapper under <body>, pinned
// `position: absolute` at its current document position, and `.is-zoomed` scales
// the wrapper up from its centre. On Do as I Do the lift escapes the gallery
// viewport's overflow:hidden and the track's transform; neither exists here, but
// the lift is still load-bearing for a different reason: .gallery carries
// `contain: layout paint`, and paint containment clips descendants to the grid's
// own box, so a clip scaled at the edge would be shaved off. Under <body> it is
// free of that. `absolute` (not `fixed`) anchors it to the document, so it
// scrolls with the page. A same-size filler holds its grid slot so the page
// doesn't reflow, and on collapse the clip drops back into that slot.

export function initClipZoom(root = document) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let expanded = null;       // the enlarged <video>, or null
    let expandedWrap = null;   // its .clip-zoom wrapper
    let spacer = null;         // filler holding the clip's grid slot

    // Tear down the zoom: drop the clip back into its grid slot, discard the
    // wrapper and the filler. Runs only after the shrink has finished, so the
    // swap is invisible -- the clip is already back at scale 1, sitting over its
    // slot.
    function restore(vid, wrap, sp) {
        vid.style.removeProperty('object-fit');
        if (sp) {
            sp.parentNode.insertBefore(vid, sp);   // clip back into its grid slot
            sp.remove();
        }
        wrap.remove();
    }

    function collapse() {
        if (!expanded) return;
        const vid = expanded;
        const wrap = expandedWrap;
        const sp = spacer;
        expanded = null;
        expandedWrap = null;
        spacer = null;
        wrap.removeEventListener('mouseleave', collapse);
        wrap.removeEventListener('click', collapse);
        // Play the shrink: ease the wrapper's scale back to 1 while it stays
        // pinned and lifted. Only once that transition ends do we slot the clip
        // back into the grid -- so the shrink animates instead of snapping.
        // Reduced motion skips straight to restore.
        if (reduceMotion) { restore(vid, wrap, sp); return; }
        wrap.style.transform = 'scale(1)';
        wrap.addEventListener('transitionend', function onEnd(e) {
            if (e.propertyName !== 'transform') return;
            wrap.removeEventListener('transitionend', onEnd);
            restore(vid, wrap, sp);
        });
    }

    function expand(vid, gallery) {
        collapse();
        const rect = vid.getBoundingClientRect();
        // object-fit can come from a gallery-scoped rule that won't match once
        // the clip moves under <body>; pin the resolved value inline so it
        // survives. Nothing sets it today, but a per-gallery override is exactly
        // the kind of rule this file can't see coming.
        const objectFit = getComputedStyle(vid).objectFit;
        // Hold the clip's grid slot with a same-size filler so lifting it out
        // doesn't reflow the page.
        spacer = document.createElement('div');
        spacer.className = 'gallery-pad';
        vid.parentNode.insertBefore(spacer, vid);
        // Lift the clip into a wrapper under <body>. The wrapper carries the
        // position, rounding and scale; the clip just fills it. Rounding on the
        // wrapper (not the composited <video>) stays uniform on every clip.
        expandedWrap = document.createElement('div');
        expandedWrap.className = 'clip-zoom';
        expandedWrap.style.top = `${rect.top + window.scrollY}px`;
        expandedWrap.style.left = `${rect.left + window.scrollX}px`;
        expandedWrap.style.width = `${rect.width}px`;
        expandedWrap.style.height = `${rect.height}px`;
        // How far this gallery's clips blow up, read off the grid so each one can
        // set its own (see --zoom in style.css). Do as I Do has a single cell size
        // and hard-codes scale(2); the 9-wide grid here starts from ~76px cells,
        // where 2x would barely count as expanded.
        const zoom = getComputedStyle(gallery).getPropertyValue('--zoom').trim();
        if (zoom) expandedWrap.style.setProperty('--zoom', zoom);
        document.body.appendChild(expandedWrap);
        expandedWrap.appendChild(vid);
        vid.style.objectFit = objectFit;
        void expandedWrap.offsetWidth;   // flush the base box so the scale-up transitions
        expandedWrap.classList.add('is-zoomed');
        expandedWrap.addEventListener('mouseleave', collapse, { once: true });
        expandedWrap.addEventListener('click', collapse, { once: true });
        expanded = vid;
    }

    root.addEventListener('click', (e) => {
        // Only grid clips reach here; an already-expanded clip lives under
        // <body>, so `.closest('.gallery')` is null for it and it falls out --
        // the wrapper's own click/mouseleave listeners drive its collapse.
        const vid = e.target.closest('video');
        if (!vid || vid === expanded) return;
        const gallery = vid.closest('.gallery');
        if (!gallery) return;
        // Skip clips that haven't decoded a frame yet (still showing the gray
        // placeholder) -- there's nothing to enlarge until the video paints.
        if (vid.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        expand(vid, gallery);
    });

    // The clip scrolls with the page, so scrolling slides it past a stationary
    // pointer -- which fires no mouseleave. Track the pointer and, on scroll,
    // collapse only once the moved clip no longer sits under it (mirroring what a
    // mouseleave would do); if the pointer stays within the clip, it stays open.
    let pointerX = 0, pointerY = 0;
    window.addEventListener('mousemove', (e) => {
        pointerX = e.clientX;
        pointerY = e.clientY;
    }, { passive: true });
    window.addEventListener('scroll', () => {
        if (!expandedWrap) return;
        const r = expandedWrap.getBoundingClientRect();   // viewport box, incl. the scale
        if (pointerX < r.left || pointerX > r.right || pointerY < r.top || pointerY > r.bottom) {
            collapse();
        }
    }, { passive: true });
}
