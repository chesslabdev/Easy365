import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Animated circular progress counter.
 *
 * Counts a number from 0 → `data-target` while filling an SVG ring arc from
 * 0 → `target/max` (or 100% when `data-max` is absent), once the host scrolls
 * into view. The block server-renders the FINAL state, so no-JS and
 * reduced-motion users see the correct value with no animation.
 *
 * Exported so other hosts with the same contract (refs `value`/`arc`,
 * `data-target`/`data-max`/`data-duration`) can reuse the exact same animation
 * by registering it under a different tag — e.g. `<dose-meter>` (see
 * `assets/dose-meter.js`). Keeps a single source of truth for the count-up/arc
 * sync logic instead of forking it.
 *
 * @extends Component<{ value: HTMLElement; arc: SVGCircleElement }>
 */
export class RadialCounter extends Component {
  requiredRefs = ['value', 'arc'];

  /** @type {IntersectionObserver | undefined} */
  #observer;
  #hasRun = false;

  connectedCallback() {
    super.connectedCallback();

    // Reduced motion: leave the server-rendered final state untouched.
    if (prefersReducedMotion()) return;

    const { value, arc } = this.refs;
    this.circumference = 2 * Math.PI * arc.r.baseVal.value;
    this.target = parseFloat(this.dataset.target) || 0;
    const max = parseFloat(this.dataset.max);
    this.fill = max > 0 ? Math.min(this.target / max, 1) : 1;
    this.duration = parseInt(this.dataset.duration, 10) || 1500;

    // Reset to the empty state so the count-up is actually visible (the server
    // renders the FINAL value for no-JS/reduced-motion users).
    value.textContent = '0';
    arc.style.strokeDashoffset = `${this.circumference}`;

    this.#observe();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  #observe() {
    // Fallback: if IntersectionObserver is unavailable, animate right away so
    // the counter never gets stuck on the reset (0) state.
    if (typeof IntersectionObserver === 'undefined') {
      this.#run();
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) this.#run();
        }
      },
      // Trigger as soon as any sliver scrolls into view. Observing `this` works
      // now that the host is `display: block` (a real box) — under the previous
      // `display: contents` the host had no box and never intersected.
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    );
    this.#observer.observe(this);
  }

  #run() {
    if (this.#hasRun) return;
    this.#hasRun = true;
    this.#observer?.disconnect();
    this.#animate();
  }

  #animate() {
    const { value, arc } = this.refs;
    let startTime;
    const tick = (now) => {
      startTime ??= now;
      const t = Math.min((now - startTime) / this.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      value.textContent = `${Math.round(eased * this.target)}`;
      arc.style.strokeDashoffset = `${this.circumference * (1 - this.fill * eased)}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

if (!customElements.get('radial-counter')) {
  customElements.define('radial-counter', RadialCounter);
}
