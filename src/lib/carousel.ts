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

interface PagedCarouselOptions {
  /** Selector, relative to root, for the flex track whose children are slides. */
  track: string;
  /** Selector for the dots container (dots are generated per page). */
  dots?: string;
  /** Selectors for the prev / next arrows. */
  prev?: string;
  next?: string;
  /** perView is 3 at/above this viewport width, 1 below (the Splide breakpoint). */
  breakpoint: number;
  /** Autoplay interval; omit for the shared 5s default. */
  interval?: number;
  /** className applied to each generated dot button. */
  dotClass: string;
}

/**
 * The lightweight translateX carousel shared by PhotoCarousel and
 * ReviewCarousel — a px-pitch track (so the flex gap is counted), looping
 * arrows, per-page dots rebuilt on the perView breakpoint, and autoplay. Both
 * replace Splide; they differ only in the options above, so the engine lives
 * here once. Markup stays in each component (hence the selectors are passed in).
 */
export function pagedCarousel(root: HTMLElement, opts: PagedCarouselOptions): void {
  const track = root.querySelector<HTMLElement>(opts.track);
  if (!track) return;
  const dotsWrap = opts.dots ? root.querySelector<HTMLElement>(opts.dots) : null;

  const slides = Array.from(track.children) as HTMLElement[];
  const count = slides.length;
  if (count === 0) return;

  const prev = opts.prev ? root.querySelector<HTMLButtonElement>(opts.prev) : null;
  const next = opts.next ? root.querySelector<HTMLButtonElement>(opts.next) : null;

  const perView = () => (window.innerWidth >= opts.breakpoint ? 3 : 1);
  const maxIndex = () => Math.max(0, count - perView());
  // Pixel pitch (slide width + flex gap) — read live so resize works.
  const pitch = () =>
    count > 1
      ? slides[1].getBoundingClientRect().left - slides[0].getBoundingClientRect().left
      : slides[0].getBoundingClientRect().width;

  let index = 0;
  let dots: HTMLButtonElement[] = [];

  const buildDots = () => {
    if (!dotsWrap) return;
    const pv = perView();
    const pages = Math.ceil(count / pv);
    dotsWrap.replaceChildren();
    dots = [];
    for (let p = 0; p < pages; p++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Ga naar ${p + 1}`);
      dot.className = opts.dotClass;
      dot.addEventListener('click', () => {
        index = Math.min(p * pv, maxIndex());
        render();
        player.reset();
      });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    }
  };

  const render = () => {
    index = Math.min(index, maxIndex());
    track.style.transform = `translateX(-${index * pitch()}px)`;
    const page = Math.floor(index / perView());
    dots.forEach((d, i) => (i === page ? d.setAttribute('data-active', '') : d.removeAttribute('data-active')));
  };

  // type:loop — the arrows wrap and are never disabled.
  const go = (delta: number) => {
    const span = maxIndex() + 1;
    index = (index + delta + span) % span;
    render();
  };

  const player = autoplay(root, () => go(1), opts.interval);
  prev?.addEventListener('click', () => { go(-1); player.reset(); });
  next?.addEventListener('click', () => { go(1); player.reset(); });

  let lastPv = perView();
  buildDots();
  render();
  window.addEventListener('resize', () => {
    if (perView() !== lastPv) { lastPv = perView(); index = 0; buildDots(); }
    render();
  });
}
