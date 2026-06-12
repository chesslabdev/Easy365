import { Component } from '@theme/component';
import { requestIdleCallback } from '@theme/utilities';

/**
 * Polls for the global Swiper constructor loaded via the CDN `defer` script in
 * `layout/theme.liquid`. Module scripts can evaluate before the deferred classic
 * script on slow connections, so we cannot assume `window.Swiper` exists yet.
 *
 * @returns {Promise<typeof window.Swiper>}
 */
function whenSwiperReady() {
  if (window.Swiper) return Promise.resolve(window.Swiper);

  return new Promise((resolve) => {
    const poll = () => {
      if (window.Swiper) {
        resolve(window.Swiper);
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}

/**
 * Host for the `rk-carousel` snippet. Reads its configuration from data attributes,
 * initializes Swiper inside `requestIdleCallback`, and tears it down on disconnect.
 *
 * Layouts:
 * - `normal`   — standard multi-item carousel
 * - `centered` — centered slides; the active one is emphasized via CSS
 * - `linear`   — free mode (no snap); with `data-autoplay > 0` it becomes a
 *                continuous marquee-like scroll
 *
 * @extends Component<{ viewport: HTMLElement; prevArrow?: HTMLButtonElement; nextArrow?: HTMLButtonElement; dots?: HTMLElement }>
 */
class RkCarousel extends Component {
  requiredRefs = ['viewport'];

  /** @type {import('swiper').Swiper | null} */
  #swiper = null;

  /** @type {AbortController | null} */
  #listeners = null;

  connectedCallback() {
    super.connectedCallback();
    this.#listeners = new AbortController();
    requestIdleCallback(() => this.#init());
  }

  updatedCallback() {
    // Section Rendering API re-render: the DOM was replaced, rebuild the instance.
    this.#destroy();
    this.#init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#listeners?.abort();
    this.#listeners = null;
    this.#destroy();
  }

  async #init() {
    if (this.#swiper || !this.isConnected) return;

    const Swiper = await whenSwiperReady();
    if (!this.isConnected || this.#swiper) return;

    this.#swiper = new Swiper(this.refs.viewport, this.#buildConfig());
    this.classList.add('rk-carousel--ready');

    if (window.Shopify?.designMode) this.#bindEditorEvents();
  }

  get #layout() {
    return this.dataset.layout || 'normal';
  }

  get #autoplaySeconds() {
    return Number(this.dataset.autoplay) || 0;
  }

  /** Linear layout + autoplay = continuous marquee-like scroll. */
  get #continuous() {
    return this.#layout === 'linear' && this.#autoplaySeconds > 0;
  }

  /**
   * Layouts that need loop to work at all loop by default:
   * - centered: without loop the first (active) card sits against the left edge
   *   and the space before it stays empty;
   * - continuous (linear + autoplay): the marquee would dead-end on the last slide.
   * Loop rearranges slide elements in the DOM, which breaks the Theme Editor's
   * block mapping — so it stays storefront-only either way.
   */
  get #loopWanted() {
    const wanted = this.#layout === 'centered' || this.#continuous || this.hasAttribute('data-loop');
    return wanted && !window.Shopify?.designMode;
  }

  #destroy() {
    this.#swiper?.destroy(true, false);
    this.#swiper = null;
    this.classList.remove('rk-carousel--ready');
  }

  #buildConfig() {
    const layout = this.#layout;
    const centered = layout === 'centered';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const autoplaySeconds = this.#autoplaySeconds;
    const continuous = this.#continuous;
    const count = this.refs.viewport.querySelectorAll('.swiper-slide').length;

    // Swiper's native loop requirement: slides >= slidesPerView + slidesPerGroup
    // (+1 when centeredSlides) — below that it silently disables loop. With our
    // slidesPerGroup of 1, clamp slidesPerView to the largest loopable value when
    // loop is wanted; if not even 1-per-view fits, fall back to `rewind` (the
    // documented native alternative — must not be combined with `loop`).
    const maxLoopableItems = count - 1 - (centered ? 1 : 0);
    const loop = this.#loopWanted && maxLoopableItems >= 1;

    const itemsFor = (value, fallback) => {
      const items = Number(value) || fallback;
      return loop ? Math.min(items, maxLoopableItems) : items;
    };

    /** @type {Record<string, unknown>} */
    const config = {
      slidesPerView: itemsFor(this.dataset.mobileItems, 1.2),
      spaceBetween: Number(this.dataset.gap) || 16,
      speed: continuous ? autoplaySeconds * 1000 : Number(this.dataset.speed) || 600,
      loop,
      rewind: this.#loopWanted && !loop,
      grabCursor: true,
      a11y: this.#buildA11y(),
      // `slidesPerView` is breakpoint-safe; `loop` is not (it must stay global).
      breakpoints: {
        750: { slidesPerView: itemsFor(this.dataset.tabletItems, 2) },
        990: { slidesPerView: itemsFor(this.dataset.desktopItems, 4) },
      },
    };

    if (centered) {
      config.centeredSlides = true;
      config.slideToClickedSlide = true;

      if (!loop) {
        // No-loop fallback (Theme Editor / too few slides): start in the middle so
        // the active card isn't pinned to the left edge with empty space before it.
        config.initialSlide = Math.floor((count - 1) / 2);
      }
    }

    if (layout === 'linear') {
      config.freeMode = { enabled: true, momentum: !continuous };
    }

    if (autoplaySeconds > 0 && !reducedMotion && !window.Shopify?.designMode) {
      config.autoplay = continuous
        ? { delay: 0, disableOnInteraction: false }
        : { delay: autoplaySeconds * 1000, disableOnInteraction: false, pauseOnMouseEnter: true };
    }

    if (this.refs.prevArrow && this.refs.nextArrow) {
      config.navigation = {
        prevEl: this.refs.prevArrow,
        nextEl: this.refs.nextArrow,
        addIcons: false, // the snippet ships its own SVG arrows
      };
    }

    if (this.refs.dots) {
      config.pagination = {
        el: this.refs.dots,
        clickable: true,
        hideOnClick: false, // default true would toggle the dots on container click
      };
    }

    return config;
  }

  /**
   * The a11y module overwrites the arrows' `aria-label` and labels each slide with
   * its English defaults, so the theme's translated strings (provided by the snippet
   * as data attributes) must be forwarded here.
   */
  #buildA11y() {
    /** @type {Record<string, unknown>} */
    const a11y = { enabled: true };

    if (this.dataset.labelPrev) a11y.prevSlideMessage = this.dataset.labelPrev;
    if (this.dataset.labelNext) a11y.nextSlideMessage = this.dataset.labelNext;
    if (this.dataset.labelSlide) a11y.slideLabelMessage = this.dataset.labelSlide;

    return a11y;
  }

  /** Theme Editor: bring the selected slide block into view. */
  #bindEditorEvents() {
    document.addEventListener(
      'shopify:block:select',
      (event) => {
        const slide = /** @type {Element} */ (event.target)?.closest?.('.swiper-slide');
        if (!slide || !this.contains(slide) || !this.#swiper) return;

        const index = [...slide.parentElement.children].indexOf(slide);
        if (index >= 0) this.#swiper.slideTo(index);
      },
      { signal: this.#listeners?.signal }
    );
  }
}

if (!customElements.get('rk-carousel')) customElements.define('rk-carousel', RkCarousel);
