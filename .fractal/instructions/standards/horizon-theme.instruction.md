# Horizon Theme Engineering Standards (Easy365)

> **Single source of truth** for every agent that writes code in this repository.
> This is a **Shopify Online Store 2.0** theme based on **Horizon**. All new work must
> respect these rules so that the theme stays fast, upgrade-safe, and fully editable
> from the Theme Editor. When in doubt, read the native theme code first and **extend
> it — never fork it**.

---

## 0. Prime Directives

1. **Performance first.** Every kilobyte and every millisecond is a feature. A change
   that lowers PageSpeed / Core Web Vitals is a regression, even if it "works".
2. **Never edit native Horizon files in place.** Wrap, decorate, or compose around them.
   Editing native code creates merge conflicts on theme updates and silent bugs.
3. **Everything must be editable in the Theme Editor.** New UI = a block or a section
   setting, not a hardcoded value. The merchant should never need code.
4. **Compose with blocks.** Build "block chains" so any layout is rearrangeable by drag
   and drop in the editor.
5. **SEO and accessibility are non-negotiable** on every component (see §7).

---

## 1. Where things live (rendering map)

| Layer | Folder | Rendered | Cost model |
|-------|--------|----------|-----------|
| Layout | `layout/theme.liquid` | Once per page, server-side | Touch with extreme care — global blast radius |
| Section | `sections/*.liquid` | Server-side, per placement | Streamed; can be lazy via Section Rendering API |
| Section group | `sections/*-group.json` | Server-side | Header/footer composition |
| Block (private) | `blocks/_name.liquid` | Server-side, nested in sections | Underscore prefix = private (not exposed standalone) |
| Block (public) | `blocks/name.liquid` | Server-side | Selectable directly by merchants |
| Snippet | `snippets/*.liquid` | Server-side, inlined at render | Reuse unit; **`{% render %}` is sandboxed**, prefer it over `{% include %}` |
| Template | `templates/*.json` | Maps sections → a page | The composition entry point |
| Web Component | `assets/*.js` (ESM) | Client-side, on hydration | Register in `snippets/scripts.liquid` import map |
| Styles | `{% stylesheet %}` tag / `assets/*.css` | Scoped per section/block | Avoid global CSS; scope it |

**Know where your code runs before you write it.** Liquid runs once on the server.
JS runs on every client device — the slowest phone is your target. Push work to the
server (Liquid) whenever the result is the same for all users.

---

## 2. Web Components — the default for new JS

All new interactive JS extends the theme's base `Component` class from `@theme/component`
(`assets/component.js`). **Do not write bespoke `class extends HTMLElement` unless you
have a documented reason** (e.g. you need to expose refs to a parent, like
`accordion-custom.js`).

### Contract
- **Refs** — annotate DOM with `ref="name"` (or `ref="name[]"` for arrays). Access via
  `this.refs.name`. Declare hard requirements in `requiredRefs = ['...']`.
- **Declarative events** — bind in the markup with `on:click="methodName"`,
  `on:input="..."`, `on:submit="..."` etc. The base class delegates the event to the
  closest `Component`. No manual `addEventListener` for these.
- **Lifecycle** — `connectedCallback` (call `super`), `updatedCallback` (after Section
  Rendering API re-render), `disconnectedCallback` (clean up). The base wires a
  `MutationObserver` for refs inside `requestIdleCallback` already.
- **Idle work** — defer non-critical setup with `requestIdleCallback` from
  `@theme/utilities`. Use `AbortController` + `{ signal }` for any manual listeners so
  they auto-clean on disconnect.

### Registration (mandatory)
Every new module must be added to the import map in **`snippets/scripts.liquid`**:
```liquid
"@theme/my-feature": "{{ 'my-feature.js' | asset_url }}",
```
Then import with the bare specifier: `import { Component } from '@theme/component';`.
Use `type="module"` — it is deferred by default. **Never** add render-blocking scripts.

### Skeleton
```js
import { Component } from '@theme/component';
import { requestIdleCallback } from '@theme/utilities';

/** @extends Component<{ trigger: HTMLElement; panel: HTMLElement }> */
class MyFeature extends Component {
  requiredRefs = ['trigger', 'panel'];

  connectedCallback() {
    super.connectedCallback();
    requestIdleCallback(() => this.#enhance());
  }

  // bound via on:click="toggle" in Liquid
  toggle = () => { this.refs.panel.hidden = !this.refs.panel.hidden; };

  #enhance() { /* non-critical progressive enhancement */ }
}
if (!customElements.get('my-feature')) customElements.define('my-feature', MyFeature);
```

---

## 3. Liquid `capture` / `content_for` — the Decorator pattern

The way to **reuse native Horizon output without editing it** is to capture it and wrap
the captured string. This is our core Decorator/Adapter technique.

```liquid
{%- comment -%} Decorate native block output without touching the original {%- endcomment -%}
{% capture children %}
  {% content_for 'blocks' %}
{% endcapture %}

<div class="my-wrapper" {{ block.shopify_attributes }}>
  {{ children }}  {%- comment -%} native output, now wrapped/enhanced {%- endcomment -%}
</div>
```

Rules:
- Use `{% capture %}` to buffer native section/block/snippet output, then add behavior
  (wrappers, schema.org, lazy hooks, web-component hosts) around it.
- Pass data into reused snippets explicitly (`{% render 'snippet', settings: x %}`) —
  `render` is sandboxed and side-effect free, which keeps reuse predictable.
- Prefer **adapting** a native snippet (`card-gallery`, `group`, `button`, `image`,
  `color-schemes`, `spacing-style`, `size-style`, `border-override`) over re-implementing it.

---

## 4. Blocks & block chains — full editability

- **Private blocks** are prefixed with `_` (e.g. `_card.liquid`) and are only available
  as children of the sections/blocks that declare them. Use these for internal pieces.
- **Public blocks** (no underscore) are merchant-selectable anywhere allowed.
- Accept children with `{% content_for 'blocks' %}` so blocks nest into chains.
- Always emit `{{ block.shopify_attributes }}` on the block root for editor selection.
- Read settings from `block.settings`; never hardcode copy, colors, spacing, or links.
- Provide a `{% schema %}` with sensible `settings`, `blocks` (accepted children), and
  **`presets`** so the block appears in the editor's "Add block" menu with a good default.
- Reuse the shared style snippets via settings: `spacing-style`, `size-style`,
  `border-override`, `color-schemes` — do not invent parallel spacing/color systems.
- Localize every label with translation keys (`"label": "t:..."`) — add keys to `locales/`.

---

## 5. Templates & sections — page composition

- Pages are composed in `templates/*.json` (e.g. `product.json`, `collection.json`,
  `index.json`) by referencing sections and their block order/settings.
- Keep templates declarative: order sections for above-the-fold priority first.
- For shared chrome use section groups (`header-group.json`, `footer-group.json`).
- New page type → add a JSON template + the sections it needs; validate block types
  referenced actually exist and `presets` are present.

---

## 6. Performance budget & techniques

**Above the fold (LCP critical):**
- The LCP image (hero/first product image) uses `fetchpriority="high"`, `loading="eager"`,
  explicit `width`/`height`, responsive `srcset` via the `image_url`/`image_tag` filters,
  and a correct `sizes`. Never lazy-load the LCP element.
- Inline only the critical CSS the first viewport needs; defer the rest.

**Below the fold:**
- All offscreen images `loading="lazy"` + `decoding="async"` with explicit dimensions
  (prevents CLS).
- Defer non-critical sections with the Section Rendering API / `requestIdleCallback`.
- Hydrate web components lazily; do expensive setup inside `requestIdleCallback` or on
  first interaction (`pointerenter`, `focus`), not on `connectedCallback` directly.

**Always:**
- JS is ESM `type="module"` (deferred). No jQuery, no render-blocking `<script>`.
- Reserve space for every async/media element to keep **CLS ≈ 0**.
- Preconnect/preload only what the first paint truly needs.
- Prefer CSS over JS for animation and state; prefer Liquid over JS for static data.
- No layout-thrashing loops; batch DOM reads/writes; honor `prefers-reduced-motion`.
- Subset/preload fonts via the `fonts` snippet; `font-display: swap`.

**Targets:** LCP < 2.5s, INP < 200ms, CLS < 0.1, Lighthouse mobile ≥ 90.

---

## 7. SEO & Accessibility (every component)

- **Images:** meaningful `alt` (from `image.alt` / settings, never the filename);
  decorative images get `alt=""`. Always set `width`/`height`.
- **Headings:** one logical `<h1>` per page; never skip levels for styling — use classes.
- **Semantics:** real landmarks (`<header> <nav> <main> <footer> <section> <article>`),
  `<button>` for actions, `<a>` for navigation. Label icon-only controls (`aria-label`).
- **Structured data:** emit JSON-LD where relevant (Product, BreadcrumbList, Article,
  Organization) — capture and enhance native theme output rather than duplicating it.
- **Keyboard & focus:** everything operable by keyboard; visible focus; correct
  `aria-expanded`/`aria-controls` on disclosure widgets; respect `prefers-reduced-motion`.
- **Color contrast** ≥ WCAG AA via the theme's `color-schemes`.

---

## 8. Tooling & skills to use

- **`shopify-liquid` / `shopify-liquid-themes`** — authoritative Liquid, schema,
  LiquidDoc, translation-key, and section/block patterns. Use before writing `.liquid`.
- **`shopify-custom-data`** — Metafields & Metaobjects for any custom/structured data.
- **`web-perf`** — measure CWV (LCP/INP/CLS) with Chrome DevTools MCP; use to prove a
  change helped, not just to "look right".
- **`frontend-design`** — for distinctive, production-grade UI.
- **Figma MCP + `figma-use` / `figma-generate-design` / `figma-code-connect`** — for
  design → Horizon component translation.
- **`shopify-dev`** — fallback for any other Shopify API question.

---

## 9. Definition of Done (quality gate)

A change ships only when ALL are true:
- [ ] No native Horizon file edited in place (decorated/composed instead).
- [ ] New JS extends `Component` and is registered in `snippets/scripts.liquid`.
- [ ] New UI is a block/section setting and appears + works in the Theme Editor with a preset.
- [ ] LCP element is eager + prioritized; everything offscreen is lazy; CLS reserved.
- [ ] All images have correct `alt` + dimensions; headings/landmarks valid; JSON-LD where relevant.
- [ ] Labels localized with `t:` keys; values come from settings, nothing hardcoded.
- [ ] `shopify theme check` passes; web-perf shows no CWV regression.
- [ ] LiquidDoc (`{%- doc -%}`) headers on snippets; JSDoc on web components.
