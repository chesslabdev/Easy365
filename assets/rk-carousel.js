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

    if (this.#loopEnabled) this.#ensureLoopableSlides();

    this.#swiper = new Swiper(this.refs.viewport, this.#buildConfig());
    this.classList.add('rk-carousel--ready');

    if (window.Shopify?.designMode) this.#bindEditorEvents();
  }

  get #layout() {
    return this.dataset.layout || 'normal';
  }

  /**
   * Centered layout loops by default — without loop the first (active) card sits
   * against the left edge and the space before it stays empty. Loop reorders slide
   * elements in the DOM, which breaks the Theme Editor's block mapping — so it
   * stays storefront-only either way.
   */
  get #loopEnabled() {
    const wanted = this.#layout === 'centered' || this.hasAttribute('data-loop');
    return wanted && !window.Shopify?.designMode;
  }

  get #maxItemsPerView() {
    return Math.max(
      Number(this.dataset.mobileItems) || 1.2,
      Number(this.dataset.tabletItems) || 2,
      Number(this.dataset.desktopItems) || 4
    );
  }

  /**
   * Swiper silently disables loop when there aren't enough slides
   * (≈ slidesPerView + centered offset). Storefront-only, top the wrapper up by
   * cloning the original slides until the loop requirement is comfortably met.
   */
  #ensureLoopableSlides() {
    const wrapper = this.refs.viewport.querySelector('.swiper-wrapper');
    if (!wrapper) return;

    const originals = [...wrapper.children];
    if (originals.length < 2) return;

    const needed = Math.ceil(this.#maxItemsPerView) * 2;
    let index = 0;
    while (wrapper.children.length < needed) {
      wrapper.append(originals[index % originals.length].cloneNode(true));
      index += 1;
    }
  }

  #destroy() {
    this.#swiper?.destroy(true, false);
    this.#swiper = null;
    this.classList.remove('rk-carousel--ready');
  }

  #buildConfig() {
    const layout = this.#layout;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const autoplaySeconds = Number(this.dataset.autoplay) || 0;
    const continuous = layout === 'linear' && autoplaySeconds > 0;

    /** @type {Record<string, unknown>} */
    const config = {
      slidesPerView: Number(this.dataset.mobileItems) || 1.2,
      spaceBetween: Number(this.dataset.gap) || 16,
      speed: continuous ? autoplaySeconds * 1000 : Number(this.dataset.speed) || 600,
      loop: this.#loopEnabled,
      grabCursor: true,
      a11y: { enabled: true },
      breakpoints: {
        750: { slidesPerView: Number(this.dataset.tabletItems) || 2 },
        990: { slidesPerView: Number(this.dataset.desktopItems) || 4 },
      },
    };

    if (layout === 'centered') {
      config.centeredSlides = true;
      config.slideToClickedSlide = true;

      if (!this.#loopEnabled) {
        // No-loop fallback (Theme Editor): start in the middle so the active card
        // isn't pinned to the left edge with empty space before it.
        const count = this.refs.viewport.querySelectorAll('.swiper-slide').length;
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
      config.navigation = { prevEl: this.refs.prevArrow, nextEl: this.refs.nextArrow };
    }

    if (this.refs.dots) {
      config.pagination = { el: this.refs.dots, clickable: true };
    }

    return config;
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
