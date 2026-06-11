import { Component } from '@theme/component';
import { requestIdleCallback, prefersReducedMotion } from '@theme/utilities';

/**
 * Animated circular progress counter.
 *
 * Counts a number from 0 → `data-target` while filling an SVG ring arc from
 * 0 → `target/max` (or 100% when `data-max` is absent), once the host scrolls
 * into view. The block server-renders the FINAL state, so no-JS and
 * reduced-motion users see the correct value with no animation.
 *
 * @extends Component<{ value: HTMLElement; arc: SVGCircleElement }>
 */
class RadialCounter extends Component {
  requiredRefs = ['value', 'arc'];

  /** @type {IntersectionObserver | undefined} */
  #observer;
  #hasRun = false;

  connectedCallback() {
    super.connectedCallback();

    // Reduced motion: leave the server-rendered final state untouched.
    if (prefersReducedMotion()) return;

    const { arc } = this.refs;
    this.circumference = 2 * Math.PI * arc.r.baseVal.value;
    this.target = parseFloat(this.dataset.target) || 0;
    const max = parseFloat(this.dataset.max);
    this.fill = max > 0 ? Math.min(this.target / max, 1) : 1;
    this.duration = parseInt(this.dataset.duration, 10) || 1500;

    requestIdleCallback(() => this.#observe());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  #observe() {
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.#hasRun) {
            this.#hasRun = true;
            this.#observer?.disconnect();
            this.#animate();
          }
        }
      },
      { threshold: 0.4 }
    );
    this.#observer.observe(this);
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
