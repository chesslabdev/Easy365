import { Component } from '@theme/component';
import { requestIdleCallback, prefersReducedMotion } from '@theme/utilities';

/**
 * `<eazy-hero>` — progressive enhancement host for the Eazy365 hero section.
 *
 * This component does NOT own the background video loading — that is delegated to the
 * native `<video-background-component>` rendered by the `background-media` snippet, which
 * lazily swaps `data-video-source` → `src`. This component only adds non-critical
 * enhancements on top, so the hero is fully functional with JS disabled:
 *
 *  1. Idle entrance reveal (skipped when the user prefers reduced motion).
 *  2. Pauses the background `<video>` when the hero scrolls out of view and resumes it
 *     when it returns — saving CPU and battery without touching the native component.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} [content] - The content wrapper, used for the entrance reveal.
 *
 * @extends Component<Refs>
 */
class EazyHero extends Component {
  /** @type {IntersectionObserver | undefined} */
  #visibilityObserver;

  connectedCallback() {
    super.connectedCallback();

    // Defer every enhancement to idle time: none of it is needed for first paint.
    requestIdleCallback(() => {
      this.#reveal();
      this.#observeVisibility();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#visibilityObserver?.disconnect();
  }

  /**
   * Adds the `ready` state that drives the CSS entrance transition.
   * Honors `prefers-reduced-motion` — reduced-motion users get the final state instantly.
   */
  #reveal() {
    if (prefersReducedMotion()) {
      this.dataset.ready = 'instant';
      return;
    }
    this.dataset.ready = 'true';
  }

  /**
   * Pauses/resumes the background video based on viewport visibility to avoid burning
   * CPU on an offscreen autoplaying video.
   */
  #observeVisibility() {
    const video = this.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) return;

    this.#visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // play() can reject if interrupted; ignore — the video is muted/decorative.
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { rootMargin: '200px' }
    );

    this.#visibilityObserver.observe(this);
  }
}

if (!customElements.get('eazy-hero')) {
  customElements.define('eazy-hero', EazyHero);
}
