# Radial Counter Block — Design Spec

**Date:** 2026-06-11
**Branch:** `feat/faq-accordion` (will branch to `feat/radial-counter` for implementation)
**Figma:** https://www.figma.com/design/S24LUZJXfkwzStG51eEZSr/Eazy-365?node-id=88-505 (node `88:505`, "Animacao Circulo")

## Goal

A merchant-editable **circular progress counter** block: an animated count-up
number sitting inside a circular progress ring. When the block scrolls into view,
the number eases from `0` to a target value while the ring's arc fills
proportionally (`value ÷ max`). Matches the Easy365 Figma design — a number + unit
label centered on a colored pill with a white track ring and an accent progress arc.

## Visual reference (from Figma)

- Container = a **pill/circle**: background `accent-secondary` (`#1a388d`),
  `border-radius` 999px (pill), soft drop shadow
  (`0 2px 6px rgba(0,0,0,.06)`, `0 1px 2px rgba(0,0,0,.04)`).
- A `130×130` **ring**: white track + an **`accent-primary` (`#ff4c24`)** progress
  arc starting at the top (12 o'clock), ~25% filled in the reference state.
- Centered text: a large **number** ("2") and a smaller **unit label** ("doses")
  beneath it. (Figma uses "Bitcount Prop Single"; per decision we use the **theme
  font** for performance/consistency.)
- The Figma "Start" button state is **dropped** — the animation is scroll-triggered,
  not click-triggered.

## Decisions locked in brainstorming

| Question | Decision |
|----------|----------|
| Behavior | **Count-up animated stat** — number eases `0 → value`, ring fills in lockstep. |
| Quantity | **Single block** (one circle). Merchant adds several side-by-side if desired. |
| Trigger | **On scroll into view** (`IntersectionObserver`, once). No Start button. |
| Number font | **Theme font** (no extra font request). |
| Ring fill | **`value ÷ max`** (goal-relative). `max` empty/≤0 ⇒ ring = 100%. |
| Extra fields | **Unit label only** (no prefix/suffix, no decimals, no separate title). |
| Ring colors | **Standalone color settings**, defaulting to accent (progress) / on-accent (track). |

## Architecture (2 new files, zero native files edited)

### 1. `blocks/radial-counter.liquid` — public block

- **Public** (no underscore) → selectable anywhere `@theme` is accepted, including
  inside the native `group` block.
- Container reuses native chrome snippets:
  - **`color-schemes`** for the pill background + text color (default scheme paints
    the `accent-secondary`-style surface).
  - **`border-override`** for border + **`border_radius`** (default pill `999px`).
  - **`spacing-style`** for padding + **`mobile-spacing`** snippet for the
    `custom_mobile_padding` override (`@media (max-width:749px)`).
  - Emits `{{ block.shopify_attributes }}`.
- Inside the container, **bespoke SVG markup is justified** (no native circular-
  progress primitive exists):
  - `<svg viewBox="0 0 100 100">` with two `<circle>`s — a **track** and a
    **progress** circle (rotated −90° so the arc starts at top, `stroke-linecap:
    round`). Fill driven by `stroke-dasharray` (circumference) + `stroke-dashoffset`.
  - Centered overlay: number (`ref="value"`) + unit label as **real text**
    (theme font), sizes from settings.
- Hosts the `<radial-counter>` custom element (`display: contents` wrapper so it
  adds behavior without changing layout), with `ref="value"` and
  `data-target` / `data-max` / `data-duration` attributes read by the JS.
- **Section-scoped module load**: `<script src="{{ 'radial-counter.js' | asset_url }}"
  type="module" fetchpriority="low"></script>` inside the block — only downloads on
  pages that use the block; the browser dedupes the module across multiple instances.
- All copy/colors/sizes come from `block.settings`. Labels localized with `t:` keys.

### 2. `assets/radial-counter.js` — `<radial-counter>` web component

- Extends the theme base **`Component`** from `@theme/component`; imports
  `requestIdleCallback` from `@theme/utilities`.
- `requiredRefs = ['value']` (the progress circle is found via `ref="arc"`).
- **Lifecycle:** `connectedCallback` (calls `super`) sets the initial state
  (number `0`, arc at full `dashoffset` = empty) and, inside `requestIdleCallback`,
  wires a single `IntersectionObserver` (threshold ~0.4) via `AbortController`'d
  setup. On first intersection it runs the animation once and disconnects the
  observer. `disconnectedCallback` aborts/cleans up.
- **Animation:** one `requestAnimationFrame` loop over `duration_ms` with an
  ease-out curve; each frame updates both the displayed integer
  (`Math.round(progress * value)`) and the arc `stroke-dashoffset`
  (`circumference * (1 − fillFraction * progress)`), where
  `fillFraction = max > 0 ? clamp(value/max, 0, 1) : 1`.
- **`prefers-reduced-motion`:** skip the loop; paint final number + final arc
  immediately.
- Registered guarded: `if (!customElements.get('radial-counter')) customElements.define(...)`.
- JSDoc `@extends Component<{...}>` header.

## Merchant settings (schema)

| Setting | Type | Notes |
|---------|------|-------|
| `value` | `number` | Count target (e.g. `2`). |
| `max` | `number` | Goal/denominator for ring fill. Empty/≤0 ⇒ ring = 100%. |
| `unit_label` | `text` | Centered label under the number (e.g. "doses"). t: key. |
| `diameter` | `range` px | Default `130`. e.g. `60–320 step 4` (65 steps ≤ 101 ✓). |
| `custom_mobile_size` | `checkbox` | Reveals `diameter_mobile` range (`visible_if`). |
| `diameter_mobile` | `range` px | Applied under `@media (max-width:749px)`. |
| `stroke_width` | `range` px | Default ~`10`. `2–24 step 1` (22 ✓). |
| `track_color` | `color` | Ring track. Default on-accent/white. |
| `progress_color` | `color` | Ring arc. Default accent (`#ff4c24`). |
| `color_scheme` | `color_scheme` | Pill background + text. |
| `value_font_size` | `range` px | Number size. |
| `label_font_size` | `range` px | Unit-label size. |
| `duration_ms` | `range` ms | Default `1500`. `400–4000 step 100` (36 ✓). |
| `border_radius` | `range` px | Default pill (`999`, or a high max). |
| padding L/T/R/B | `range` | Via `spacing-style`. |
| `custom_mobile_padding` | `checkbox` | Reveals mobile padding ranges (`mobile-spacing`). |

- **`presets`** block so it appears in the Theme Editor ready to drop in
  (preset name brand-neutral, e.g. "Radial counter").

## Accessibility & SEO

- Container gets `role="img"` + `aria-label` composed from value + unit
  (e.g. "2 doses"); decorative SVG marked `aria-hidden="true"`.
- Number and label are **real text** (theme font) — readable/SEO-safe.
- Color contrast handled by the chosen `color_scheme`; ring colors default to AA-safe
  accent/on-accent.
- `prefers-reduced-motion` respected (no count animation).

## Performance

- Single small ESM module, deferred, section-scoped (not in the global import map) —
  zero cost on pages without the block.
- No layout shift: SVG + text occupy fixed `diameter`; space reserved before paint.
- Animation is `requestAnimationFrame` on `stroke-dashoffset` + `textContent` only
  (no layout thrash); observer disconnects after first run.
- Hydration work deferred to `requestIdleCallback`.

## Definition of Done

- [ ] No native Horizon file edited; chrome composed via `color-schemes`,
      `border-override`, `spacing-style`, `mobile-spacing`.
- [ ] Brand-neutral names (`radial-counter`, `<radial-counter>`).
- [ ] Border-radius, padding, colors, sizes all merchant-customizable; preset present.
- [ ] Mobile verified ≤749px; `custom_mobile_padding` (+ optional `custom_mobile_size`).
- [ ] JS extends `Component`, module-loaded section-scoped; observer + rAF cleaned up.
- [ ] LCP-safe (deferred, no CLS); `prefers-reduced-motion` honored.
- [ ] `role="img"` + `aria-label`; SVG `aria-hidden`; real text for number/label.
- [ ] Labels localized with `t:` keys; values from settings.
- [ ] `shopify theme check` passes; web-perf shows no CWV regression.
- [ ] LiquidDoc `{%- doc -%}` header on the block; JSDoc on the component.
