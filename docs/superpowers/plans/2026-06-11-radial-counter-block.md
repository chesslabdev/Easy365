# Radial Counter Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a merchant-editable `radial-counter` block — an animated count-up number inside a circular SVG progress ring that fills `value ÷ max` when scrolled into view.

**Architecture:** A public Liquid block (`blocks/radial-counter.liquid`) renders the pill + SVG ring + centered text using native chrome snippets (`color-schemes`, `border-override`, `spacing-style`, `mobile-spacing`), server-rendering the **final** state for no-JS/reduced-motion correctness. A section-scoped ESM web component (`assets/radial-counter.js`, extends `Component`) resets to 0 and animates number + arc in one `requestAnimationFrame` loop, triggered once by `IntersectionObserver`.

**Tech Stack:** Shopify Horizon (Liquid + Online Store 2.0 blocks), `@theme/component` base class, `@theme/utilities` (`requestIdleCallback`, `prefersReducedMotion`), SVG `stroke-dasharray`/`stroke-dashoffset`. Verification gate: `shopify theme check` + Theme Editor visual check (no Liquid unit-test runner exists in this repo).

**Spec:** `docs/superpowers/specs/2026-06-11-radial-counter-block-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `assets/radial-counter.js` (create) | `<radial-counter>` web component: IntersectionObserver trigger + rAF count-up of number and ring arc; reduced-motion no-op. |
| `blocks/radial-counter.liquid` (create) | Public block: pill container (chrome snippets) + SVG ring + centered number/label; schema (settings, presets, mobile); section-scoped module load; LiquidDoc. |

Two files, each one responsibility. No native Horizon files are edited.

---

### Task 1: Web component — `assets/radial-counter.js`

**Files:**
- Create: `assets/radial-counter.js`

- [ ] **Step 1: Create the component file**

Create `assets/radial-counter.js` with exactly this content:

```js
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
```

- [ ] **Step 2: Verify the module parses (syntax gate)**

Run: `node --check assets/radial-counter.js`
Expected: no output, exit code 0 (clean parse). The bare-specifier imports (`@theme/...`) resolve at runtime via the theme import map, not via Node — `--check` only validates syntax, which is what we want here.

- [ ] **Step 3: Commit**

```bash
git add assets/radial-counter.js
git commit -m "feat(radial-counter): count-up web component with scroll trigger

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Block markup + stylesheet — `blocks/radial-counter.liquid`

**Files:**
- Create: `blocks/radial-counter.liquid`

This task writes the Liquid body and the `{% stylesheet %}`. The `{% schema %}` is added in Task 3 (same file) so the block won't appear in the editor until Task 3 — that is expected.

- [ ] **Step 1: Write the LiquidDoc header, server-side math, and markup**

Create `blocks/radial-counter.liquid` with this content (schema appended in Task 3):

```liquid
{%- doc -%}
  Radial Counter — public block.

  An animated circular progress counter: a number counts up from 0 to `value`
  while the SVG arc fills `value ÷ max` (or 100% when `max` is empty), triggered
  once when the block scrolls into view (see `assets/radial-counter.js`).

  The FINAL state is rendered server-side so no-JS and reduced-motion users see
  the correct number + arc; the web component resets to 0 and animates only when
  it intersects the viewport.

  Chrome is composed from native snippets (color-schemes, border-override,
  spacing-style, mobile-spacing) — no native files are edited.
{%- enddoc -%}

{%- liquid
  assign bs = block.settings
  assign d = bs.diameter
  assign sw = bs.stroke_width
  assign center = d | times: 1.0 | divided_by: 2.0
  assign radius = d | minus: sw | times: 1.0 | divided_by: 2.0
  assign circ = radius | times: 6.28318530718

  if bs.max > 0
    assign fill = bs.value | times: 1.0 | divided_by: bs.max
    if fill > 1
      assign fill = 1
    endif
  else
    assign fill = 1
  endif
  assign dash = circ | times: fill
  assign offset_final = circ | minus: dash

  assign aria = bs.value | append: ''
  if bs.unit_label != blank
    assign aria = aria | append: ' ' | append: bs.unit_label
  endif
-%}

<radial-counter
  class="radial-counter"
  data-target="{{ bs.value }}"
  {% if bs.max > 0 %}data-max="{{ bs.max }}"{% endif %}
  data-duration="{{ bs.duration_ms }}"
  {{ block.shopify_attributes }}
>
  <div
    class="radial-counter__pill spacing-style{% if bs.custom_mobile_padding %} mobile-spacing-{{ block.id }}{% endif %}{% if bs.inherit_color_scheme == false %} color-{{ bs.color_scheme }}{% endif %}"
    style="
      {% render 'border-override', settings: bs %}
      {% render 'spacing-style', settings: bs %}
      --rc-diameter: {{ d }}px;
      --rc-diameter-mobile: {{ bs.diameter_mobile | default: d }}px;
      --rc-track: {% if bs.track_color != blank %}{{ bs.track_color }}{% else %}rgb(var(--color-foreground-rgb) / 0.18){% endif %};
      --rc-progress: {% if bs.progress_color != blank %}{{ bs.progress_color }}{% else %}rgb(var(--color-primary)){% endif %};
      --rc-value-size: {{ bs.value_font_size }}px;
      --rc-label-size: {{ bs.label_font_size }}px;
    "
    role="img"
    aria-label="{{ aria | escape }}"
  >
    <svg class="radial-counter__ring" viewBox="0 0 {{ d }} {{ d }}" aria-hidden="true" focusable="false">
      <circle class="radial-counter__track" cx="{{ center }}" cy="{{ center }}" r="{{ radius }}" fill="none" stroke-width="{{ sw }}"></circle>
      <circle
        class="radial-counter__arc"
        ref="arc"
        cx="{{ center }}"
        cy="{{ center }}"
        r="{{ radius }}"
        fill="none"
        stroke-width="{{ sw }}"
        stroke-linecap="round"
        transform="rotate(-90 {{ center }} {{ center }})"
        style="stroke-dasharray: {{ circ }}; stroke-dashoffset: {{ offset_final }};"
      ></circle>
    </svg>
    <span class="radial-counter__content">
      <span class="radial-counter__value" ref="value">{{ bs.value }}</span>
      {%- if bs.unit_label != blank -%}
        <span class="radial-counter__label">{{ bs.unit_label }}</span>
      {%- endif -%}
    </span>
  </div>
</radial-counter>

{% render 'mobile-spacing', settings: bs, id: block.id %}

<script src="{{ 'radial-counter.js' | asset_url }}" type="module" fetchpriority="low"></script>
```

- [ ] **Step 2: Append the `{% stylesheet %}` block**

Add this immediately after the closing `</script>` line, before where the schema will go:

```liquid
{% stylesheet %}
  .radial-counter {
    display: contents;
  }

  .radial-counter__pill {
    position: relative;
    display: inline-grid;
    place-items: center;
    box-sizing: border-box;
    background: var(--color-background);
    color: var(--color-foreground);
    border: var(--border-width, 0) var(--border-style, solid) var(--border-color, transparent);
    border-radius: var(--border-radius, 999px);
    box-shadow: 0 2px 6px rgb(0 0 0 / 6%), 0 1px 2px rgb(0 0 0 / 4%);
  }

  /* SVG and the text overlay share one grid cell so they stack centered */
  .radial-counter__ring,
  .radial-counter__content {
    grid-area: 1 / 1;
  }

  .radial-counter__ring {
    display: block;
    width: var(--rc-diameter);
    height: var(--rc-diameter);
  }

  .radial-counter__track {
    stroke: var(--rc-track);
  }

  .radial-counter__arc {
    stroke: var(--rc-progress);
  }

  .radial-counter__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1;
    text-align: center;
    pointer-events: none;
  }

  .radial-counter__value {
    font-size: var(--rc-value-size);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .radial-counter__label {
    margin-top: 0.3em;
    font-size: var(--rc-label-size);
    letter-spacing: 0.08em;
  }

  @media screen and (max-width: 749px) {
    .radial-counter__ring {
      width: var(--rc-diameter-mobile);
      height: var(--rc-diameter-mobile);
    }
  }
{% endstylesheet %}
```

- [ ] **Step 3: Commit (schema still pending — block not yet selectable)**

```bash
git add blocks/radial-counter.liquid
git commit -m "feat(radial-counter): block markup, SVG ring, scoped styles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Block schema (settings, mobile, presets)

**Files:**
- Modify: `blocks/radial-counter.liquid` (append `{% schema %}` after `{% endstylesheet %}`)

- [ ] **Step 1: Append the schema**

Add this at the end of `blocks/radial-counter.liquid`:

```liquid
{% schema %}
{
  "name": "Radial counter",
  "tag": null,
  "settings": [
    { "type": "header", "content": "Conteúdo" },
    {
      "type": "number",
      "id": "value",
      "label": "Valor (conta até)",
      "default": 2
    },
    {
      "type": "number",
      "id": "max",
      "label": "Meta (preenche o anel)",
      "info": "Deixe vazio para o anel preencher 100%."
    },
    {
      "type": "text",
      "id": "unit_label",
      "label": "Rótulo (unidade)",
      "default": "doses"
    },

    { "type": "header", "content": "Aparência" },
    {
      "type": "checkbox",
      "id": "inherit_color_scheme",
      "label": "t:settings.inherit_color_scheme",
      "default": true
    },
    {
      "type": "color_scheme",
      "id": "color_scheme",
      "label": "t:settings.color_scheme",
      "default": "scheme-1",
      "visible_if": "{{ block.settings.inherit_color_scheme == false }}"
    },
    {
      "type": "paragraph",
      "content": "Deixe uma cor vazia para herdar do esquema de cores."
    },
    {
      "type": "color",
      "id": "track_color",
      "label": "Cor da trilha do anel"
    },
    {
      "type": "color",
      "id": "progress_color",
      "label": "Cor do progresso"
    },
    {
      "type": "range",
      "id": "value_font_size",
      "label": "Tamanho do número",
      "min": 12, "max": 96, "step": 1, "unit": "px",
      "default": 24
    },
    {
      "type": "range",
      "id": "label_font_size",
      "label": "Tamanho do rótulo",
      "min": 8, "max": 40, "step": 1, "unit": "px",
      "default": 11
    },

    { "type": "header", "content": "Anel" },
    {
      "type": "range",
      "id": "diameter",
      "label": "Diâmetro",
      "min": 60, "max": 320, "step": 4, "unit": "px",
      "default": 130
    },
    {
      "type": "range",
      "id": "stroke_width",
      "label": "Espessura do anel",
      "min": 2, "max": 24, "step": 1, "unit": "px",
      "default": 10
    },
    {
      "type": "range",
      "id": "duration_ms",
      "label": "Duração da animação",
      "min": 400, "max": 4000, "step": 100, "unit": "ms",
      "default": 1500
    },

    { "type": "header", "content": "Borda" },
    {
      "type": "select",
      "id": "border",
      "label": "t:settings.style",
      "options": [
        { "value": "none", "label": "t:options.none" },
        { "value": "solid", "label": "t:options.solid" },
        { "value": "dashed", "label": "t:options.dashed" },
        { "value": "dotted", "label": "t:options.dotted" }
      ],
      "default": "none"
    },
    {
      "type": "range",
      "id": "border_width",
      "label": "t:settings.thickness",
      "min": 0, "max": 12, "step": 1, "unit": "px",
      "default": 0
    },
    {
      "type": "range",
      "id": "border_opacity",
      "label": "t:settings.opacity",
      "min": 0, "max": 100, "step": 1, "unit": "%",
      "default": 100
    },
    {
      "type": "range",
      "id": "border_radius",
      "label": "t:settings.border_radius",
      "min": 0, "max": 200, "step": 2, "unit": "px",
      "default": 200
    },

    { "type": "header", "content": "t:content.padding" },
    { "type": "range", "id": "padding-block-start", "label": "t:settings.top", "min": 0, "max": 100, "step": 1, "unit": "px", "default": 0 },
    { "type": "range", "id": "padding-block-end", "label": "t:settings.bottom", "min": 0, "max": 100, "step": 1, "unit": "px", "default": 0 },
    { "type": "range", "id": "padding-inline-start", "label": "t:settings.left", "min": 0, "max": 100, "step": 1, "unit": "px", "default": 0 },
    { "type": "range", "id": "padding-inline-end", "label": "t:settings.right", "min": 0, "max": 100, "step": 1, "unit": "px", "default": 0 },

    { "type": "header", "content": "Mobile" },
    {
      "type": "checkbox",
      "id": "custom_mobile_size",
      "label": "Diâmetro separado no mobile",
      "default": false
    },
    {
      "type": "range",
      "id": "diameter_mobile",
      "label": "Diâmetro (mobile)",
      "min": 60, "max": 320, "step": 4, "unit": "px",
      "default": 110,
      "visible_if": "{{ block.settings.custom_mobile_size }}"
    },
    {
      "type": "checkbox",
      "id": "custom_mobile_padding",
      "label": "Espaçamento separado no mobile",
      "default": false
    },
    { "type": "range", "id": "padding-block-start-mobile", "label": "Superior (mobile)", "min": 0, "max": 100, "step": 2, "unit": "px", "default": 0, "visible_if": "{{ block.settings.custom_mobile_padding }}" },
    { "type": "range", "id": "padding-block-end-mobile", "label": "Inferior (mobile)", "min": 0, "max": 100, "step": 2, "unit": "px", "default": 0, "visible_if": "{{ block.settings.custom_mobile_padding }}" },
    { "type": "range", "id": "padding-inline-start-mobile", "label": "Esquerda (mobile)", "min": 0, "max": 100, "step": 2, "unit": "px", "default": 0, "visible_if": "{{ block.settings.custom_mobile_padding }}" },
    { "type": "range", "id": "padding-inline-end-mobile", "label": "Direita (mobile)", "min": 0, "max": 100, "step": 2, "unit": "px", "default": 0, "visible_if": "{{ block.settings.custom_mobile_padding }}" }
  ],
  "presets": [
    {
      "name": "Radial counter",
      "settings": {
        "value": 2,
        "max": 8,
        "unit_label": "doses",
        "inherit_color_scheme": false,
        "color_scheme": "scheme-1",
        "diameter": 130,
        "stroke_width": 10,
        "value_font_size": 24,
        "label_font_size": 11,
        "duration_ms": 1500,
        "border_radius": 200
      }
    }
  ]
}
{% endschema %}
```

- [ ] **Step 2: Verify the `value ÷ max` range-step rule**

Confirm by inspection that every `range` satisfies `(max − min) / step ≤ 101`:
- `value_font_size` 84, `label_font_size` 32, `diameter` 65, `stroke_width` 22,
  `duration_ms` 36, `border_width` 12, `border_opacity` 100, `border_radius` 100,
  paddings 100, mobile paddings 50, `diameter_mobile` 65. All ≤ 101. ✓

Expected: no value exceeds 101 (the server rejects more and `theme check` does NOT catch it).

- [ ] **Step 3: Run theme check**

Run: `shopify theme check blocks/radial-counter.liquid assets/radial-counter.js`
Expected: no errors. (Warnings about missing `t:` translation keys that don't exist in the repo's locale files are acceptable if those keys are reused from native blocks; resolve any error-level findings before continuing.)

- [ ] **Step 4: Commit**

```bash
git add blocks/radial-counter.liquid
git commit -m "feat(radial-counter): schema, settings, mobile controls, preset

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Editor + behavior verification

**Files:** none (verification only)

- [ ] **Step 1: Push to a development theme**

Run: `shopify theme dev` (or `shopify theme push --development`)
Expected: theme uploads with no Liquid errors; a preview URL is printed.

- [ ] **Step 2: Verify in the Theme Editor (desktop)**

In the editor, add the **Radial counter** block to any section (e.g. inside a `group`). Confirm:
- The block appears in the "Add block" list with the preset values (number `2`, label `doses`, ring ~25% filled = 2/8).
- Scrolling the block into view animates the number `0 → 2` and the arc `0 → 25%` once, over ~1.5s.
- Changing `value`, `max`, `unit_label`, `diameter`, `stroke_width`, `track_color`, `progress_color`, `duration_ms`, and `border_radius` all update the render live.

Expected: all settings are editable and the animation triggers on scroll-in.

- [ ] **Step 3: Verify mobile + reduced motion**

- Resize preview to ≤749px (or DevTools 390px): enable `custom_mobile_size` → ring uses `diameter_mobile`; enable `custom_mobile_padding` → mobile paddings apply.
- In OS/DevTools, enable "reduce motion" and reload: the block shows the **final** number and arc immediately, with no count animation.

Expected: mobile overrides apply only ≤749px; reduced-motion shows the final state with no animation.

- [ ] **Step 4: Verify accessibility**

Inspect the rendered `.radial-counter__pill`: it has `role="img"` and `aria-label="2 doses"`; the `<svg>` has `aria-hidden="true"`; the number and label are real text nodes.

Expected: a screen reader announces "2 doses" once, not the decorative SVG.

- [ ] **Step 5: (Optional) CWV spot-check with web-perf**

Use the `web-perf` skill against a page containing the block to confirm no CLS from the ring (space is reserved by the fixed SVG size) and that `radial-counter.js` only loads on pages with the block.

Expected: CLS ≈ 0; module not requested on pages without the block.

- [ ] **Step 6: Final confirmation**

No commit needed (verification only). If any step fails, return to the relevant task and fix before considering the feature done.

---

## Notes for the implementer

- **Do not edit any native Horizon file.** All four chrome snippets are rendered, never modified.
- The block server-renders the **final** state on purpose. The JS only resets to 0 at the first animation frame on intersection — so there is no flash for users scrolling the block into view, and no-JS/reduced-motion users keep the correct value.
- `circ`, `offset_final`, `center`, `radius` are computed in Liquid with `| times: 1.0` to force float division (Liquid does integer division on two integers).
- The custom element uses `display: contents`, so it adds behavior without affecting layout (the pill is the layout box).
