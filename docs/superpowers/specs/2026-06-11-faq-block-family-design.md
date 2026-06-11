# FAQ Block Family — Design Spec

**Date:** 2026-06-11
**Branch:** `feat/faq-accordion`
**Figma:** https://www.figma.com/design/S24LUZJXfkwzStG51eEZSr/Eazy-365?node-id=99-1423 (node `99:1423`)

## Goal

A FAQ component with the same mechanics as the native Horizon accordion
(`blocks/accordion.liquid` + `blocks/_accordion-row.liquid`) but styled per the
Easy365 Figma design, with individual color controllers in the Theme Editor.

## Visual reference (from Figma)

- Each question is a **standalone card**: border `#d9d4cb` (1px solid), radius
  `22px`, padding `24px` inline / `16px` block, `20px` gap between cards.
- Question row: number prefix (`1.`) in accent color `#ff4c24` (small mono-style
  type, letter-spacing 1.44px), question title 24px medium (`-0.24px` tracking,
  line-height 1.15), and a **36px circular expand button** on the right.
- Expand button: collapsed = `+` icon, surface bg `#f7f7f7`, border `#d9d4cb`;
  expanded = `×` (the `+` rotated 45°), accent bg `#ff4c24`, strong border `#000100`.
- Answer: 19px regular, secondary color `#8a847a`, line-height 1.45, revealed
  below the question with 12px top padding.

## Architecture (3 new files, zero native files edited)

### 1. `blocks/faq.liquid` — public parent block

Mirror of native `accordion.liquid`, restyled:

- Renders children via `{% content_for 'blocks' %}`, accepts only `_faq-row`.
- Cards separated by configurable `gap` (range, default 20px); each row carries
  its own border + radius (no dividers).
- **Automatic numbering** via CSS counter — reordering in the editor renumbers
  automatically. Checkbox `show_numbers` (default true) toggles it.
- **Individual color pickers** (empty default = inherit from color scheme via
  CSS custom property fallbacks): accent (number + expanded button bg), card
  border, card background, question text, answer text, button background,
  button icon.
- Reuses native controls: `type_preset` for question typography, `border_radius`
  (default 22), padding via `spacing-style`, **Mobile checkbox** +
  `mobile-spacing` snippet for mobile-only padding overrides.
- Colors applied as scoped CSS custom properties on the block root
  (`--faq-accent`, `--faq-card-border`, …) consumed by row styles.

### 2. `blocks/_faq-row.liquid` — private child block

Mirror of `_accordion-row.liquid`:

- `<details class="details">/<summary>` rendered through
  `{% render 'accordion-custom-component' %}` — native animation, keyboard
  support, and open-by-default behavior for free. No new JS.
- Settings: `heading` (question text), `open_by_default` (checkbox).
- Answer content = `{% content_for 'blocks' %}` accepting `@theme`/`@app`
  (native `text` blocks carry the copy).
- The **+/× circular button** is pure CSS: two pseudo-element bars; on
  `details[open]` the icon rotates 45° (→ ×) and the button bg switches to the
  accent color. Honors `prefers-reduced-motion`.
- Touch target: summary row is the click target (full width, ≥44px height).

### 3. `sections/faq.liquid` — section-on-base

- `{% capture children %}{% content_for 'blocks' %}{% endcapture %}
  {% render 'section', section: section, children: children %}` — inherits all
  base section chrome (scheme, width, padding, radius…).
- Schema replicates the base section settings (the snippet's contract).
- Preset "FAQ": heading `text` block + `faq` block with 5 `_faq-row` children
  using the Figma example copy.

## SEO & Accessibility

- **Microdata** `FAQPage` / `Question` / `acceptedAnswer` inline on the rows
  (JSON-LD is not viable: the parent block cannot read child block settings).
  `itemscope itemtype="https://schema.org/FAQPage"` on the parent,
  `Question`/`name`/`acceptedAnswer`/`text` itemprops on each row.
- `<details>/<summary>` is natively accessible (keyboard, screen readers).
- Decorative +/× icon is CSS-only (no img/alt needed); summary text labels the
  control.
- Color contrast responsibility stays with the merchant's picks; defaults meet
  AA.

## Mobile-first

- ≤749px: reduced card padding and smaller question font; optional merchant
  overrides via the Mobile checkbox (`custom_mobile_padding` + `mobile-spacing`).

## Constraints / standards

- All labels via `t:` keys where the store uses them; all values from settings.
- Range settings respect the ≤101 steps rule.
- Brand-neutral naming: `faq`, `_faq-row` (functional, no store name).
- `shopify theme check` must pass; presets required; LiquidDoc headers.

## Out of scope

- No JS beyond the native `accordion-custom.js` (already loaded by the engine).
- No richtext answer setting (answers compose from native text blocks).
- No exclusive-open behavior (multiple rows can be open, like native accordion).
