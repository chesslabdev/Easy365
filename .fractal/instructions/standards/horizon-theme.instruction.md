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
3. **Build on the base section.** Every section must reuse the base section engine
   (`{% render 'section' %}`, see §5) so color scheme, width/height, background media,
   overlay, **border-radius**, padding, gap and alignment come for free and stay
   consistent. Do not hand-roll section chrome.
4. **Everything must be editable in the Theme Editor.** New UI = a block or a section
   setting, not a hardcoded value. Border-radius, padding, color and spacing are ALWAYS
   customizable. The merchant should never need code.
5. **Compose with blocks, not markup.** Build content from native `group` + `text` +
   `button` blocks and parent/private block families (§4) — not bespoke HTML. Wrap
   content groups in a `group` block so every cluster has its own radius/padding/color.
6. **Name globally.** Components are reusable across stores — never bake a store or brand
   name into a file, block type, class, or custom element (§4a).
7. **SEO and accessibility are non-negotiable** on every component (see §7).

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

## 4. Blocks & block chains — composition over markup

The theme is **block-first**. Build UI by composing blocks, mirroring the native patterns
(`accordion.liquid` + `_accordion-row.liquid`, `group.liquid`). Reach for bespoke HTML only
for pieces that have no native/composable equivalent.

**Block kinds**
- **Public blocks** (no underscore, e.g. `group.liquid`, `card.liquid`) are merchant-
  selectable wherever `@theme` is accepted — including *inside* the native `group`. Make a
  block public when it should be reusable across many parents.
- **Private blocks** (`_` prefix, e.g. `_accordion-row.liquid`) are only available to the
  parent that lists them in its schema `blocks`. Use for tightly-coupled children.

**The parent + private-child family** (the pattern to copy for any custom component):
- A **parent** public block (group-like) carries the layout/appearance controls and accepts
  its children via `{% content_for 'blocks' %}` — e.g. `accordion` → `_accordion-row`.
- Each **private child** renders one item and may itself accept `@theme` children, so text
  lives in native `text` blocks. Everything stays orderable and editable.
- A child that must also be insertable inside the native `group` (which only accepts
  `@theme`/`@app`/`_divider`) **must be public** — private blocks can't be added to parents
  that don't list them. Choose public vs private by where the block needs to go.

**The `group` block is the content container.** Wrap text/CTA clusters in a `group` block
(`group.liquid`) — it gives each cluster its own color scheme, background, border + radius,
padding, width/height and alignment. Headings/paragraphs = native `text` blocks inside it.

**Rules for every block**
- Accept children with `{% content_for 'blocks' %}`; emit `{{ block.shopify_attributes }}`.
- Read values from `block.settings` — never hardcode copy, colors, spacing, links.
- Reuse shared style snippets via settings: `spacing-style`, `size-style`,
  `border-override` (border + **radius**), `color-schemes`. Always expose a `border_radius`
  range. Never invent parallel spacing/color systems.
- Ship a `{% schema %}` with `settings`, accepted `blocks`, and **`presets`**.
- Localize labels with `t:` keys where the store uses them.

### 4a. Global, brand-neutral naming

Components are skills reused across many stores. **Never** put a store/brand name in a file
name, block `type`, CSS class, custom-element tag, or asset. Name by *function*:
- ✅ `cinematic-hero.liquid`, `badge-row.liquid`, `_badge.liquid`, `<media-reveal>`, `.blend-text__layer`
- ❌ `eazy-hero.liquid`, `_eazy-hero-pill.liquid`, `<eazy-hero>`, `.eazy-hero__pill`

Brand-specific values (copy, colors, media) belong in **settings/presets**, not in names.

---

## 5. Sections — always built on the base section engine

`sections/section.liquid` is the **base section**: a thin wrapper that captures its blocks
and delegates to the `section` snippet, which renders ALL section chrome (background media,
overlay, color scheme, width/height, border + **radius**, padding, layout panel /
direction / alignment / gap). Most "sections" in Horizon (rich text, FAQ, multicolumn,
icons-with-text…) are **just presets of this base** — they have no `.liquid` of their own.

**Decision order for a new section:**
1. **Preset first.** If the design is achievable by composing existing blocks, ship it as a
   *preset*. Presets live in a section's schema, so to avoid editing native
   `section.liquid`, put your preset in your **own** section file that reuses the base.
2. **Section-on-base.** When you need custom JS/structure (e.g. a web-component wrapper),
   create a global section file that still renders through the base engine:
   ```liquid
   {% capture children %}{% content_for 'blocks' %}{% endcapture %}
   <media-reveal>{% render 'section', section: section, children: children %}</media-reveal>
   {%- comment -%} replicate the base section settings in this schema — the snippet's contract {%- endcomment -%}
   ```
   Wrap with a custom element using `display: contents` so it adds behavior without changing
   layout. This inherits every base control (including border-radius) for free.
3. **Never** edit native `section.liquid` to add a preset, and never re-implement section
   chrome by hand.

**Slideshows are their own engine.** When a section needs slides/carousel, reuse the native
slideshow engine instead of the base section: render `{% render 'slideshow', slides: slides,
slide_count: ..., controls: ..., autoplay: ... %}` (`snippets/slideshow.liquid` → the
`slideshow-component` with scroller, `slideshow-arrows`, `slideshow-controls`, autoplay,
infinite) and accept the native **`_slide`** block as the slide chain. Each `_slide` already
provides per-slide background **image or video** (poster + LCP-aware `loading`/`fetchpriority`
on the first slide), overlay, color scheme, layout/alignment and padding, and accepts
`@theme` content blocks — so your global blocks compose inside every slide. Don't reinvent
slide markup, autoplay, or arrows. (Corner-radius stays customizable via the slideshow's
`corner_radius`.)

Page composition: `templates/*.json` reference sections + block order/settings; order
sections above-the-fold first; shared chrome via section groups. Validate referenced block
types exist and `presets` are present.

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
- [ ] Section renders through the base `section` engine (`{% render 'section' %}`); chrome not hand-rolled.
- [ ] Content composed from `group` + `text` + `button` / parent-private block families — not bespoke markup.
- [ ] Names are brand-neutral & functional (no store name in files, types, classes, or custom elements).
- [ ] Border-radius, padding, color scheme & spacing are all merchant-customizable.
- [ ] New JS extends `Component`, registered/loaded as a module (section-scoped where it only runs there).
- [ ] New UI is a block/section setting and appears + works in the Theme Editor with a preset.
- [ ] LCP element is eager + prioritized; everything offscreen is lazy; CLS reserved.
- [ ] All images have correct `alt` + dimensions; headings/landmarks valid; JSON-LD where relevant.
- [ ] Labels localized with `t:` keys where used; values come from settings, nothing hardcoded.
- [ ] `shopify theme check` passes; web-perf shows no CWV regression.
- [ ] LiquidDoc (`{%- doc -%}`) headers on snippets/blocks; JSDoc on web components.
