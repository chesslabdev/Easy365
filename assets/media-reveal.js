import { Component } from '@theme/component';
import { requestIdleCallback, prefersReducedMotion } from '@theme/utilities';

/**
 * Inject the reveal styles once, globally. Uses `display: contents` so the element adds
 * behavior without creating a box — it never disturbs the layout of the section it wraps.
 * The reveal animates ONLY the section content (`.section-content-wrapper`), never the
 * background/poster, so the LCP element is unaffected.
 */
const STYLE_ID = 'media-reveal-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    media-reveal { display: contents; }
    media-reveal[data-reveal='armed'] .section-content-wrapper {
      opacity: 0;
      transform: translateY(12px);
    }
    media-reveal[data-reveal='in'] .section-content-wrapper {
      opacity: 1;
      transform: none;
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    @media (prefers-reduced-motion: reduce) {
      media-reveal[data-reveal] .section-content-wrapper {
        opacity: 1 !important;
        transform: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * `<media-reveal>` — a generic, brand-neutral enhancement wrapper for any section built on
 * the base section engine. Two non-critical enhancements, both safe with JS disabled:
 *
 *  1. Reveal: fades/raises the section content on the next frame (not idle, to avoid
 *     delaying interactivity), skipped under `prefers-reduced-motion`.
 *  2. Pauses descendant `<video>` elements while offscreen (IntersectionObserver),
 *     resuming when they return — saving CPU/battery.
 *
 * @extends Component
 */
class MediaReveal extends Component {
  /** @type {IntersectionObserver | undefined} */
  #videoObserver;

  connectedCallback() {
    super.connectedCallback();
    this.#armReveal();
    requestIdleCallback(() => this.#observeVideos());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#videoObserver?.disconnect();
  }

  #armReveal() {
    if (prefersReducedMotion()) return;

    this.dataset.reveal = 'armed';
    // Reveal on the next frame — content is visible within ~1 frame, so LCP is not delayed.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.dataset.reveal = 'in';
    }));
  }

  #observeVideos() {
    const videos = this.querySelectorAll('video');
    if (videos.length === 0) return;

    this.#videoObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = /** @type {HTMLVideoElement} */ (entry.target);
          if (entry.isIntersecting) {
            video.play?.().catch(() => {});
          } else {
            video.pause?.();
          }
        }
      },
      { rootMargin: '200px' }
    );

    for (const video of videos) this.#videoObserver.observe(video);
  }
}

if (!customElements.get('media-reveal')) {
  customElements.define('media-reveal', MediaReveal);
}
