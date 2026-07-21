// Shared auto-advance for the site's carousels (LogoWall, TestimonialCarousel,
// ReviewCarousel, PhotoCarousel, FeatureShowcase). The original's Splide
// instances auto-toggle on a timer (`interval: 5000, pauseOnHover: true`); this
// reproduces that without pulling Splide into a hand-over site.
//
// Usage inside a component's <script>:
//   const player = autoplay(root, () => go(index + 1));
//   // after any MANUAL move, call player.reset() so the next auto-tick is a
//   // full interval away rather than firing right on top of the user's click.
//
// Respects prefers-reduced-motion (no timer at all), and pauses while the
// pointer is over the carousel or keyboard focus is inside it.

interface Player {
  reset(): void;
  stop(): void;
}

export function autoplay(root: HTMLElement, advance: () => void, interval = 5000): Player {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { reset() {}, stop() {} };
  }

  let timer: number | undefined;
  const stop = () => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  const reset = () => {
    stop();
    timer = window.setInterval(advance, interval);
  };

  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', reset);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', reset);
  // Don't advance a carousel the user can't see.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else reset();
  });

  reset();
  return { reset, stop };
}
