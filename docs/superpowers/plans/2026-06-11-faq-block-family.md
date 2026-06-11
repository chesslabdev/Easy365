# FAQ Block Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FAQ component with native Horizon accordion mechanics, styled per the Easy365 Figma (node `99:1423`), with individual color controllers in the Theme Editor.

**Architecture:** Decorator over the native accordion engine — a public parent block (`faq`) that styles via scoped CSS custom properties, a private child (`_faq-row`) that renders `<details>/<summary>` through the native `accordion-custom-component` snippet (animation/keyboard/JS for free), and a section-on-base (`sections/faq.liquid`) that delegates all chrome to `{% render 'section' %}` — same pattern as `sections/rk-carousel.liquid`. Zero native files edited, zero new JS.

**Tech Stack:** Shopify Liquid (Horizon theme), CSS only (counters, pseudo-element +/× icon), microdata FAQPage for SEO.

**Spec:** `docs/superpowers/specs/2026-06-11-faq-block-family-design.md`

**Branch:** `feat/faq-accordion` (already created)

---

## Context the engineer needs

- **Native engine reused:** `snippets/accordion-custom-component.liquid` wraps children in `<accordion-custom>` (JS in `assets/accordion-custom.js`, already loaded by the theme). It expects a `<details class="details">` child with `<summary>` and `.details-content`; it animates open/close, handles keyboard, and `open_by_default_on_*` params. We never edit it.
- **Native styling hooks:** `.details-content` open/close animation comes from the snippet's stylesheet. The CSS vars `--animation-speed`, `--animation-easing`, `--minimum-touch-target`, `--color-border`, `--color-foreground`, `--color-primary` are theme globals.
- **Section-on-base pattern:** copy `sections/rk-carousel.liquid` — capture a static `group` header + `{% content_for 'blocks' %}`, delegate to `{% render 'section' %}`, replicate the base section schema settings.
- **Mobile spacing convention:** `snippets/mobile-spacing.liquid` — checkbox `custom_mobile_padding` reveals `padding-*-mobile` ranges; the styled element carries `spacing-style mobile-spacing-{{ id }}`.
- **Schema labels:** use `t:` keys for settings that exist natively (see `blocks/accordion.liquid`, `sections/rk-carousel.liquid`); Portuguese literals for custom ones (project convention, e.g. "Espaçamento separado no mobile").
- **Range rule:** `(max − min) / step ≤ 101` — the server rejects more and theme check does NOT catch it.
- **Verification:** `shopify theme check` from the repo root after each file. There is no unit-test runner for Liquid; visual verification happens in the Theme Editor at the end.

### Figma design tokens (defaults)

| Token | Value |
|---|---|
| Card border | 1px solid `#d9d4cb` (fallback: scheme `--color-border`) |
| Card radius | 22px |
| Card padding | 24px inline / 16px block |
| Gap between cards | 20px |
| Number prefix | 12px, letter-spacing 1.44px, accent `#ff4c24` |
| Question | 24px medium, line-height 1.15 (via theme `type_preset`) |
| Answer | 19px regular, `#8a847a` (fallback: 65% foreground), 12px top padding |
| Toggle button | 36px circle; closed: `#f7f7f7` bg + `#d9d4cb` border, `+` icon; open: accent bg + `#000100` border, `×` icon |

All colors ship as **empty-default color pickers** — empty = inherit from the color scheme via CSS fallback chains. The accent fallback is `var(--color-primary)`.

---

### Task 1: Private child block `blocks/_faq-row.liquid`

**Files:**
- Create: `blocks/_faq-row.liquid`

- [ ] **Step 1: Write the file**

```liquid
{%- doc -%}
  FAQ row — private child of the `faq` parent block.

  Renders one question/answer pair as <details>/<summary> through the native
  `accordion-custom-component` snippet (animation, keyboard and open-by-default
  behavior come from the native engine — no custom JS).

  Visual tokens (--faq-*) are set by the parent `faq` block; every value falls
  back to color-scheme variables so the row inherits the scheme when the
  merchant leaves a color picker empty.

  SEO: microdata Question/acceptedAnswer (the parent emits FAQPage).
{%- enddoc -%}

{% assign block_settings = block.settings %}

{% capture faq_row_children %}
  <details
    class="details faq-row"
    itemscope
    itemprop="mainEntity"
    itemtype="https://schema.org/Question"
    {% if block_settings.open_by_default %}
      open
    {% endif %}
    {{ block.shopify_attributes }}
  >
    <summary class="details__header faq-row__summary">
      <span class="faq-row__number" aria-hidden="true"></span>
      <span class="faq-row__question" itemprop="name">{{ block_settings.heading }}</span>
      <span class="faq-row__toggle" aria-hidden="true"></span>
    </summary>

    <div
      class="details-content faq-row__answer"
      itemscope
      itemprop="acceptedAnswer"
      itemtype="https://schema.org/Answer"
    >
      <div class="faq-row__answer-content" itemprop="text">
        {% content_for 'blocks' %}
      </div>
    </div>
  </details>
{% endcapture %}

{% render 'accordion-custom-component',
  children: faq_row_children,
  open_by_default_on_desktop: block_settings.open_by_default,
  open_by_default_on_mobile: block_settings.open_by_default
%}

{% stylesheet %}
  .faq > accordion-custom {
    counter-increment: faq-row;
    width: 100%;
  }

  .faq-row {
    background: var(--faq-card-bg, transparent);
    border: var(--faq-card-border-width, 1px) solid var(--faq-card-border, var(--color-border));
    border-radius: var(--faq-card-radius, 22px);
    padding: var(--faq-card-padding-block, 16px) var(--faq-card-padding-inline, 24px);
  }

  .faq-row__summary {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    cursor: pointer;
    list-style: none;
    min-height: var(--minimum-touch-target);
    color: var(--faq-question-color, var(--color-foreground));
  }

  .faq-row__summary::-webkit-details-marker {
    display: none;
  }

  @media screen and (min-width: 750px) {
    .faq-row__summary {
      gap: 24px;
    }
  }

  .faq-row__number {
    color: var(--faq-accent, var(--color-primary));
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.44px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .faq-row__number::before {
    content: counter(faq-row) '.';
  }

  .faq--no-numbers .faq-row__number {
    display: none;
  }

  .faq-row__question {
    flex: 1 0 0;
    min-width: 0;
    line-height: 1.15;
  }

  .faq-row__toggle {
    position: relative;
    flex-shrink: 0;
    inline-size: 36px;
    block-size: 36px;
    border-radius: 50%;
    background: var(--faq-toggle-bg, color-mix(in srgb, var(--color-foreground) 4%, transparent));
    border: 1px solid var(--faq-card-border, var(--color-border));
    transition: background-color var(--animation-speed) var(--animation-easing),
      border-color var(--animation-speed) var(--animation-easing),
      transform var(--animation-speed) var(--animation-easing);
  }

  .faq-row__toggle::before,
  .faq-row__toggle::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    inline-size: 12px;
    block-size: 1.5px;
    border-radius: 1px;
    background: var(--faq-toggle-icon, currentColor);
    translate: -50% -50%;
    transition: background-color var(--animation-speed) var(--animation-easing);
  }

  .faq-row__toggle::after {
    rotate: 90deg;
  }

  .faq-row[open] > .faq-row__summary .faq-row__toggle {
    background: var(--faq-accent, var(--color-primary));
    border-color: var(--faq-toggle-border-open, var(--color-foreground));
    transform: rotate(45deg);
  }

  .faq-row[open] > .faq-row__summary .faq-row__toggle::before,
  .faq-row[open] > .faq-row__summary .faq-row__toggle::after {
    background: var(--faq-toggle-icon-open, var(--color-foreground));
  }

  .faq-row__answer {
    color: var(--faq-answer-color, color-mix(in srgb, var(--color-foreground) 65%, transparent));
  }

  .faq-row[open] .faq-row__answer {
    padding-block-start: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .faq-row__toggle,
    .faq-row__toggle::before,
    .faq-row__toggle::after {
      transition: none;
    }
  }
{% endstylesheet %}

{% schema %}
{
  "name": "Pergunta (FAQ)",
  "tag": null,
  "blocks": [
    {
      "type": "@theme"
    },
    {
      "type": "@app"
    }
  ],
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "t:settings.heading",
      "default": "Pergunta frequente"
    },
    {
      "type": "checkbox",
      "id": "open_by_default",
      "label": "t:settings.open_row_by_default",
      "default": false
    }
  ],
  "presets": [
    {
      "name": "Pergunta (FAQ)",
      "settings": {
        "heading": "Pergunta frequente"
      },
      "blocks": {
        "text-1": {
          "type": "text",
          "settings": {
            "text": "<p>Escreva aqui a resposta para a pergunta.</p>",
            "width": "100%"
          }
        }
      },
      "block_order": ["text-1"]
    }
  ]
}
{% endschema %}
```

**Notes for the engineer:**
- The `.details-content` open/close animation (height/opacity, `padding-block` collapse when closed) is native — do NOT re-add it. The `padding-block-start: 12px` on `.faq-row[open] .faq-row__answer` participates in the native `padding-block` transition automatically.
- `counter-increment` lives on `accordion-custom` (the row's real DOM root inside the parent); the parent block sets `counter-reset: faq-row`.
- The toggle is decorative (`aria-hidden`): the whole `<summary>` is the accessible control.

- [ ] **Step 2: Run theme check**

Run: `shopify theme check`
Expected: no NEW offenses for `blocks/_faq-row.liquid` (pre-existing offenses in other files may exist; only the new file matters).

- [ ] **Step 3: Commit**

```bash
git add blocks/_faq-row.liquid
git commit -m "feat(faq): private _faq-row block on the native accordion engine"
```

---

### Task 2: Public parent block `blocks/faq.liquid`

**Files:**
- Create: `blocks/faq.liquid`

- [ ] **Step 1: Write the file**

```liquid
{%- doc -%}
  FAQ — public parent block (Easy365 styled accordion).

  Same mechanics as the native `accordion` block, restyled per the Easy365
  design: separated cards with their own border/radius, automatic CSS-counter
  numbering, and a circular +/× toggle. Accepts only `_faq-row` children.

  Every color ships as an EMPTY-default picker: empty = inherit from the color
  scheme (the CSS fallback chains live in `_faq-row`). Values are exposed as
  scoped --faq-* custom properties consumed by the rows.

  SEO: emits microdata FAQPage (rows emit Question/acceptedAnswer).
{%- enddoc -%}

{% assign block_settings = block.settings %}

<div
  class="faq spacing-style{% if block_settings.custom_mobile_padding %} mobile-spacing-{{ block.id }}{% endif %}{% unless block_settings.show_numbers %} faq--no-numbers{% endunless %}{% if block_settings.inherit_color_scheme == false %} color-{{ block_settings.color_scheme }}{% endif %}"
  style="
    --faq-gap: {{ block_settings.gap }}px;
    --faq-card-radius: {{ block_settings.border_radius }}px;
    --faq-card-border-width: {{ block_settings.card_border_width }}px;
    --faq-card-padding-inline: {{ block_settings.card_padding_inline }}px;
    --faq-card-padding-block: {{ block_settings.card_padding_block }}px;
    {% if block_settings.color_accent != blank %}--faq-accent: {{ block_settings.color_accent }};{% endif %}
    {% if block_settings.color_card_border != blank %}--faq-card-border: {{ block_settings.color_card_border }};{% endif %}
    {% if block_settings.color_card_bg != blank %}--faq-card-bg: {{ block_settings.color_card_bg }};{% endif %}
    {% if block_settings.color_question != blank %}--faq-question-color: {{ block_settings.color_question }};{% endif %}
    {% if block_settings.color_answer != blank %}--faq-answer-color: {{ block_settings.color_answer }};{% endif %}
    {% if block_settings.color_toggle_bg != blank %}--faq-toggle-bg: {{ block_settings.color_toggle_bg }};{% endif %}
    {% if block_settings.color_toggle_icon != blank %}--faq-toggle-icon: {{ block_settings.color_toggle_icon }};{% endif %}
    {% if block_settings.color_toggle_icon_open != blank %}--faq-toggle-icon-open: {{ block_settings.color_toggle_icon_open }};{% endif %}
    --summary-font-family: var(--font-{{ block_settings.type_preset }}--family);
    --summary-font-style: var(--font-{{ block_settings.type_preset }}--style);
    --summary-font-weight: var(--font-{{ block_settings.type_preset }}--weight);
    --summary-font-size: var(--font-{{ block_settings.type_preset }}--size);
    --summary-font-line-height: var(--font-{{ block_settings.type_preset }}--line-height);
    --summary-font-case: var(--font-{{ block_settings.type_preset }}--case);
    {% render 'spacing-style', settings: block_settings %}
  "
  itemscope
  itemtype="https://schema.org/FAQPage"
  {{ block.shopify_attributes }}
>
  {% content_for 'blocks' %}
</div>

{% render 'mobile-spacing', settings: block_settings, id: block.id %}

{% stylesheet %}
  .faq {
    display: flex;
    flex-direction: column;
    gap: var(--faq-gap, 20px);
    flex: 1;
    width: 100%;
    counter-reset: faq-row;
  }

  /* mirror of the native `.accordion .details__header` typography hook */
  .faq .faq-row__summary {
    font-family: var(--summary-font-family);
    font-style: var(--summary-font-style);
    font-weight: var(--summary-font-weight);
    font-size: var(--summary-font-size);
    line-height: var(--summary-font-line-height);
    text-transform: var(--summary-font-case);
  }
{% endstylesheet %}

{% schema %}
{
  "name": "FAQ",
  "tag": null,
  "blocks": [
    {
      "type": "_faq-row"
    }
  ],
  "settings": [
    {
      "type": "checkbox",
      "id": "show_numbers",
      "label": "Mostrar numeração",
      "default": true
    },
    {
      "type": "select",
      "id": "type_preset",
      "label": "t:settings.heading_preset",
      "options": [
        { "value": "", "label": "t:options.default" },
        { "value": "paragraph", "label": "t:options.paragraph" },
        { "value": "h1", "label": "t:options.h1" },
        { "value": "h2", "label": "t:options.h2" },
        { "value": "h3", "label": "t:options.h3" },
        { "value": "h4", "label": "t:options.h4" },
        { "value": "h5", "label": "t:options.h5" },
        { "value": "h6", "label": "t:options.h6" }
      ],
      "default": "h5",
      "info": "t:info.edit_presets_in_theme_settings"
    },
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
      "type": "header",
      "content": "Cores"
    },
    {
      "type": "paragraph",
      "content": "Deixe um campo vazio para herdar do esquema de cores."
    },
    {
      "type": "color",
      "id": "color_accent",
      "label": "Destaque (número + botão aberto)"
    },
    {
      "type": "color",
      "id": "color_card_border",
      "label": "Borda do card"
    },
    {
      "type": "color",
      "id": "color_card_bg",
      "label": "Fundo do card",
      "alpha": true
    },
    {
      "type": "color",
      "id": "color_question",
      "label": "Texto da pergunta"
    },
    {
      "type": "color",
      "id": "color_answer",
      "label": "Texto da resposta"
    },
    {
      "type": "color",
      "id": "color_toggle_bg",
      "label": "Fundo do botão",
      "alpha": true
    },
    {
      "type": "color",
      "id": "color_toggle_icon",
      "label": "Ícone do botão"
    },
    {
      "type": "color",
      "id": "color_toggle_icon_open",
      "label": "Ícone do botão (aberto)"
    },
    {
      "type": "header",
      "content": "Cards"
    },
    {
      "type": "range",
      "id": "gap",
      "label": "t:settings.gap",
      "min": 0,
      "max": 60,
      "step": 2,
      "unit": "px",
      "default": 20
    },
    {
      "type": "range",
      "id": "border_radius",
      "label": "t:settings.border_radius",
      "min": 0,
      "max": 50,
      "step": 1,
      "unit": "px",
      "default": 22
    },
    {
      "type": "range",
      "id": "card_border_width",
      "label": "t:settings.thickness",
      "min": 0,
      "max": 10,
      "step": 0.5,
      "unit": "px",
      "default": 1
    },
    {
      "type": "range",
      "id": "card_padding_inline",
      "label": "Padding horizontal do card",
      "min": 0,
      "max": 60,
      "step": 2,
      "unit": "px",
      "default": 24
    },
    {
      "type": "range",
      "id": "card_padding_block",
      "label": "Padding vertical do card",
      "min": 0,
      "max": 60,
      "step": 2,
      "unit": "px",
      "default": 16
    },
    {
      "type": "header",
      "content": "t:content.padding"
    },
    {
      "type": "range",
      "id": "padding-block-start",
      "label": "t:settings.top",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "default": 0
    },
    {
      "type": "range",
      "id": "padding-block-end",
      "label": "t:settings.bottom",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "default": 0
    },
    {
      "type": "range",
      "id": "padding-inline-start",
      "label": "t:settings.left",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "default": 0
    },
    {
      "type": "range",
      "id": "padding-inline-end",
      "label": "t:settings.right",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "default": 0
    },
    {
      "type": "header",
      "content": "Mobile"
    },
    {
      "type": "checkbox",
      "id": "custom_mobile_padding",
      "label": "Espaçamento separado no mobile",
      "default": false
    },
    {
      "type": "range",
      "id": "padding-block-start-mobile",
      "label": "Superior (mobile)",
      "min": 0,
      "max": 100,
      "step": 2,
      "unit": "px",
      "default": 0,
      "visible_if": "{{ block.settings.custom_mobile_padding }}"
    },
    {
      "type": "range",
      "id": "padding-block-end-mobile",
      "label": "Inferior (mobile)",
      "min": 0,
      "max": 100,
      "step": 2,
      "unit": "px",
      "default": 0,
      "visible_if": "{{ block.settings.custom_mobile_padding }}"
    },
    {
      "type": "range",
      "id": "padding-inline-start-mobile",
      "label": "Esquerda (mobile)",
      "min": 0,
      "max": 100,
      "step": 2,
      "unit": "px",
      "default": 0,
      "visible_if": "{{ block.settings.custom_mobile_padding }}"
    },
    {
      "type": "range",
      "id": "padding-inline-end-mobile",
      "label": "Direita (mobile)",
      "min": 0,
      "max": 100,
      "step": 2,
      "unit": "px",
      "default": 0,
      "visible_if": "{{ block.settings.custom_mobile_padding }}"
    }
  ],
  "presets": [
    {
      "name": "FAQ",
      "category": "t:categories.layout",
      "blocks": {
        "row-1": {
          "type": "_faq-row",
          "settings": {
            "heading": "Como tomar?",
            "open_by_default": true
          },
          "blocks": {
            "text-1": {
              "type": "text",
              "settings": {
                "text": "<p>Misture 2g (um aperto firme) em 200ml de água ou na sua bebida favorita após o treino ou antes de dormir.</p>",
                "width": "100%"
              }
            }
          },
          "block_order": ["text-1"]
        },
        "row-2": {
          "type": "_faq-row",
          "settings": {
            "heading": "Qual a melhor hora para tomar?"
          },
          "blocks": {
            "text-1": {
              "type": "text",
              "settings": {
                "text": "<p>Recomendamos 30 a 60 minutos antes de dormir, ou imediatamente após o treino noturno.</p>",
                "width": "100%"
              }
            }
          },
          "block_order": ["text-1"]
        },
        "row-3": {
          "type": "_faq-row",
          "settings": {
            "heading": "Posso tomar todos os dias?"
          },
          "blocks": {
            "text-1": {
              "type": "text",
              "settings": {
                "text": "<p>Sim — a fórmula foi pensada para uso diário, todos os 365 dias do ano.</p>",
                "width": "100%"
              }
            }
          },
          "block_order": ["text-1"]
        }
      },
      "block_order": ["row-1", "row-2", "row-3"]
    }
  ]
}
{% endschema %}
```

**Notes for the engineer:**
- Color pickers have NO `default` on purpose: empty value → the `!= blank` guard skips the var → the CSS fallback chain in `_faq-row` resolves to scheme variables.
- `--summary-font-*` mirrors the native accordion's typography-preset technique (`blocks/accordion.liquid:7-12`); when `type_preset` is `""` the vars resolve to nothing and the header inherits body typography — same behavior as native.
- The microdata `FAQPage` lives here (parent) because rows can't know about each other; each row contributes `mainEntity` Questions.
- `padding-*` ranges are 0–100 step 1 (100 steps ≤ 101 — OK); `padding-*-mobile` use step 2 to stay aligned with the project's rk-carousel convention.

- [ ] **Step 2: Run theme check**

Run: `shopify theme check`
Expected: no NEW offenses for `blocks/faq.liquid`.

- [ ] **Step 3: Commit**

```bash
git add blocks/faq.liquid
git commit -m "feat(faq): public faq parent block with color controllers and auto numbering"
```

---

### Task 3: Section `sections/faq.liquid` (section-on-base + preset)

**Files:**
- Create: `sections/faq.liquid`

- [ ] **Step 1: Write the file**

```liquid
{%- comment -%}
  FAQ section — DECORATOR over the base section engine (§3/§5 of the standards).

  Same composition pattern as sections/rk-carousel.liquid:
  - A STATIC `group` header pinned at the top (merchant edits content, can't
    remove/reorder it).
  - Below, `{% content_for 'blocks' %}` renders the body: the `faq` parent
    block (with `_faq-row` children) plus any extra blocks.
  - Everything is delegated to `{% render 'section' %}`, so color scheme,
    width/height, background media, overlay, border + radius, padding and the
    layout panel come from the native engine — no chrome hand-rolled.
  - Mobile: `custom_mobile_padding` emits a scoped ≤749px rule targeting the
    engine's own `.section-content-wrapper.spacing-style` element.
{%- endcomment -%}

{% capture children %}
  <div class="faq-section__header">
    {% content_for 'block', type: 'group', id: 'static-header' %}
  </div>
  {% content_for 'blocks' %}
{% endcapture %}

{% render 'section', section: section, children: children %}

{%- if section.settings.custom_mobile_padding -%}
  {%- style -%}
    @media screen and (max-width: 749px) {
      #shopify-section-{{ section.id }} .section-content-wrapper.spacing-style {
        padding-block: {{ section.settings['padding-block-start-mobile'] | default: 0 }}px {{ section.settings['padding-block-end-mobile'] | default: 0 }}px;
      }
    }
  {%- endstyle -%}
{%- endif -%}

{% stylesheet %}
  .faq-section__header {
    width: 100%;
  }

  /* the faq block root is the `.faq` div (its schema uses tag: null, so no extra wrapper) */
  .section-content-wrapper > .faq {
    width: 100%;
    min-width: 0;
  }
{% endstylesheet %}

{% schema %}
{
  "name": "FAQ",
  "tag": "section",
  "class": "section-wrapper",
  "disabled_on": { "groups": ["header", "footer"] },
  "blocks": [
    { "type": "faq" },
    { "type": "group" },
    { "type": "text" },
    { "type": "button" }
  ],
  "settings": [
    { "type": "header", "content": "t:content.layout" },
    {
      "type": "select",
      "id": "content_direction",
      "label": "t:settings.direction",
      "options": [
        { "value": "column", "label": "t:options.vertical" },
        { "value": "row", "label": "t:options.horizontal" }
      ],
      "default": "column"
    },
    {
      "type": "checkbox",
      "id": "vertical_on_mobile",
      "label": "t:settings.vertical_on_mobile",
      "default": true,
      "visible_if": "{{ section.settings.content_direction == 'row' }}"
    },
    {
      "type": "select",
      "id": "horizontal_alignment",
      "label": "t:settings.alignment",
      "options": [
        { "value": "flex-start", "label": "t:options.left" },
        { "value": "center", "label": "t:options.center" },
        { "value": "flex-end", "label": "t:options.right" },
        { "value": "space-between", "label": "t:options.space_between" }
      ],
      "default": "flex-start",
      "visible_if": "{{ section.settings.content_direction == 'row' }}"
    },
    {
      "type": "select",
      "id": "vertical_alignment",
      "label": "t:settings.position",
      "options": [
        { "value": "flex-start", "label": "t:options.top" },
        { "value": "center", "label": "t:options.center" },
        { "value": "flex-end", "label": "t:options.bottom" }
      ],
      "default": "center",
      "visible_if": "{{ section.settings.content_direction == 'row' }}"
    },
    {
      "type": "select",
      "id": "horizontal_alignment_flex_direction_column",
      "label": "t:settings.alignment",
      "options": [
        { "value": "flex-start", "label": "t:options.left" },
        { "value": "center", "label": "t:options.center" },
        { "value": "flex-end", "label": "t:options.right" }
      ],
      "default": "center",
      "visible_if": "{{ section.settings.content_direction != 'row' }}"
    },
    {
      "type": "select",
      "id": "vertical_alignment_flex_direction_column",
      "label": "t:settings.position",
      "options": [
        { "value": "flex-start", "label": "t:options.top" },
        { "value": "center", "label": "t:options.center" },
        { "value": "flex-end", "label": "t:options.bottom" },
        { "value": "space-between", "label": "t:options.space_between" }
      ],
      "default": "center",
      "visible_if": "{{ section.settings.content_direction == 'column' }}"
    },
    { "type": "range", "id": "gap", "label": "t:settings.gap", "min": 0, "max": 100, "step": 2, "unit": "px", "default": 40 },
    { "type": "header", "content": "t:content.size" },
    {
      "type": "select",
      "id": "section_width",
      "label": "t:settings.width",
      "options": [
        { "value": "page-width", "label": "t:options.page" },
        { "value": "full-width", "label": "t:options.full" }
      ],
      "default": "page-width"
    },
    {
      "type": "select",
      "id": "section_height",
      "label": "t:settings.height",
      "options": [
        { "value": "", "label": "t:options.auto" },
        { "value": "small", "label": "t:options.small" },
        { "value": "medium", "label": "t:options.medium" },
        { "value": "large", "label": "t:options.large" },
        { "value": "full-screen", "label": "t:options.full_screen" },
        { "value": "custom", "label": "t:options.custom" }
      ],
      "default": ""
    },
    {
      "type": "range",
      "id": "section_height_custom",
      "label": "t:settings.custom_height",
      "min": 0,
      "max": 100,
      "step": 1,
      "default": 50,
      "unit": "%",
      "visible_if": "{{ section.settings.section_height == 'custom' }}"
    },
    { "type": "header", "content": "t:content.appearance" },
    { "type": "color_scheme", "id": "color_scheme", "label": "t:settings.color_scheme", "default": "scheme-1" },
    {
      "type": "select",
      "id": "background_media",
      "label": "t:settings.background_media",
      "options": [
        { "value": "none", "label": "t:options.none" },
        { "value": "image", "label": "t:options.image" },
        { "value": "video", "label": "t:options.video" }
      ],
      "default": "none"
    },
    {
      "type": "video",
      "id": "video",
      "label": "t:settings.video",
      "visible_if": "{{ section.settings.background_media == 'video' }}"
    },
    {
      "type": "select",
      "id": "video_position",
      "label": "t:settings.video_position",
      "options": [
        { "value": "cover", "label": "t:options.cover" },
        { "value": "contain", "label": "t:options.contain" }
      ],
      "default": "cover",
      "visible_if": "{{ section.settings.background_media == 'video' }}"
    },
    {
      "type": "image_picker",
      "id": "background_image",
      "label": "t:settings.image",
      "visible_if": "{{ section.settings.background_media == 'image' }}"
    },
    {
      "type": "select",
      "id": "background_image_position",
      "label": "t:settings.image_position",
      "options": [
        { "value": "cover", "label": "t:options.cover" },
        { "value": "fit", "label": "t:options.fit" }
      ],
      "default": "cover",
      "visible_if": "{{ section.settings.background_media == 'image' }}"
    },
    {
      "type": "select",
      "id": "border",
      "label": "t:settings.borders",
      "options": [
        { "value": "none", "label": "t:options.none" },
        { "value": "solid", "label": "t:options.solid" }
      ],
      "default": "none"
    },
    {
      "type": "range",
      "id": "border_width",
      "label": "t:settings.border_width",
      "min": 0,
      "max": 10,
      "step": 0.5,
      "unit": "px",
      "default": 1,
      "visible_if": "{{ section.settings.border != 'none' }}"
    },
    {
      "type": "range",
      "id": "border_opacity",
      "label": "t:settings.border_opacity",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "%",
      "default": 100,
      "visible_if": "{{ section.settings.border != 'none' }}"
    },
    { "type": "range", "id": "border_radius", "label": "t:settings.border_radius", "min": 0, "max": 100, "step": 1, "unit": "px", "default": 0 },
    { "type": "checkbox", "id": "toggle_overlay", "label": "t:settings.background_overlay" },
    {
      "type": "color",
      "id": "overlay_color",
      "label": "t:settings.overlay_color",
      "alpha": true,
      "default": "#00000026",
      "visible_if": "{{ section.settings.toggle_overlay }}"
    },
    {
      "type": "select",
      "id": "overlay_style",
      "label": "t:settings.overlay_style",
      "options": [
        { "value": "solid", "label": "t:options.solid" },
        { "value": "gradient", "label": "t:options.gradient" }
      ],
      "default": "solid",
      "visible_if": "{{ section.settings.toggle_overlay }}"
    },
    {
      "type": "select",
      "id": "gradient_direction",
      "label": "t:settings.gradient_direction",
      "options": [
        { "value": "to top", "label": "t:options.up" },
        { "value": "to bottom", "label": "t:options.down" }
      ],
      "default": "to top",
      "visible_if": "{{ section.settings.toggle_overlay and section.settings.overlay_style == 'gradient' }}"
    },
    { "type": "header", "content": "t:content.padding" },
    { "type": "range", "id": "padding-block-start", "label": "t:settings.top", "min": 0, "max": 120, "step": 2, "unit": "px", "default": 64 },
    { "type": "range", "id": "padding-block-end", "label": "t:settings.bottom", "min": 0, "max": 120, "step": 2, "unit": "px", "default": 64 },
    { "type": "header", "content": "Mobile" },
    { "type": "checkbox", "id": "custom_mobile_padding", "label": "Espaçamento separado no mobile", "default": false },
    { "type": "range", "id": "padding-block-start-mobile", "label": "Superior (mobile)", "min": 0, "max": 120, "step": 2, "unit": "px", "default": 40, "visible_if": "{{ section.settings.custom_mobile_padding }}" },
    { "type": "range", "id": "padding-block-end-mobile", "label": "Inferior (mobile)", "min": 0, "max": 120, "step": 2, "unit": "px", "default": 40, "visible_if": "{{ section.settings.custom_mobile_padding }}" }
  ],
  "presets": [
    {
      "name": "FAQ",
      "category": "t:categories.storytelling",
      "settings": {
        "content_direction": "column",
        "horizontal_alignment_flex_direction_column": "center",
        "vertical_alignment_flex_direction_column": "center",
        "gap": 40,
        "section_width": "page-width",
        "color_scheme": "scheme-1",
        "padding-block-start": 64,
        "padding-block-end": 64
      },
      "blocks": {
        "static-header": {
          "type": "group",
          "static": true,
          "name": "Cabeçalho fixo",
          "settings": {
            "content_direction": "column",
            "horizontal_alignment_flex_direction_column": "center",
            "vertical_alignment_flex_direction_column": "center",
            "gap": 8,
            "width": "fill",
            "inherit_color_scheme": true,
            "padding-block-start": 0,
            "padding-block-end": 0,
            "padding-inline-start": 0,
            "padding-inline-end": 0
          },
          "blocks": {
            "heading": {
              "type": "text",
              "settings": {
                "text": "<h2>Perguntas frequentes</h2>",
                "type_preset": "h2",
                "width": "100%",
                "alignment": "center"
              }
            }
          },
          "block_order": ["heading"]
        },
        "faq": {
          "type": "faq",
          "settings": {
            "show_numbers": true,
            "type_preset": "h5",
            "gap": 20,
            "border_radius": 22,
            "card_padding_inline": 24,
            "card_padding_block": 16
          },
          "blocks": {
            "row-1": {
              "type": "_faq-row",
              "settings": { "heading": "Como tomar?", "open_by_default": true },
              "blocks": {
                "text-1": {
                  "type": "text",
                  "settings": {
                    "text": "<p>Misture 2g (um aperto firme) em 200ml de água ou na sua bebida favorita após o treino ou antes de dormir. Um squeeze rende 25 doses — mais ou menos um mês de ritual diário.</p>",
                    "width": "100%"
                  }
                }
              },
              "block_order": ["text-1"]
            },
            "row-2": {
              "type": "_faq-row",
              "settings": { "heading": "Qual a melhor hora para tomar?" },
              "blocks": {
                "text-1": {
                  "type": "text",
                  "settings": {
                    "text": "<p>Recomendamos 30 a 60 minutos antes de dormir, ou imediatamente após o treino noturno. O Magnésio Bisglicinato age na recuperação muscular e na qualidade do sono profundo.</p>",
                    "width": "100%"
                  }
                }
              },
              "block_order": ["text-1"]
            },
            "row-3": {
              "type": "_faq-row",
              "settings": { "heading": "Posso tomar todos os dias?" },
              "blocks": {
                "text-1": {
                  "type": "text",
                  "settings": {
                    "text": "<p>Sim — é exatamente para isso. A fórmula foi pensada para uso diário, todos os 365 dias do ano. A dose padrão (2g/dia) está dentro da recomendação para adultos saudáveis.</p>",
                    "width": "100%"
                  }
                }
              },
              "block_order": ["text-1"]
            },
            "row-4": {
              "type": "_faq-row",
              "settings": { "heading": "Qual é o sabor?" },
              "blocks": {
                "text-1": {
                  "type": "text",
                  "settings": {
                    "text": "<p>Tropic Bloom — um mix de frutas amarelas (maracujá, cupuaçu, maçã, banana, manga, pêssego) com perfume cítrico e fundo doce. Adoçado naturalmente com Stevia.</p>",
                    "width": "100%"
                  }
                }
              },
              "block_order": ["text-1"]
            },
            "row-5": {
              "type": "_faq-row",
              "settings": { "heading": "Quanto tempo dura a entrega?" },
              "blocks": {
                "text-1": {
                  "type": "text",
                  "settings": {
                    "text": "<p>Envio em 24h úteis a partir de São Paulo. Capital: 1-2 dias. Demais regiões: 3-7 dias úteis. Frete grátis para pedidos acima de R$ 120.</p>",
                    "width": "100%"
                  }
                }
              },
              "block_order": ["text-1"]
            }
          },
          "block_order": ["row-1", "row-2", "row-3", "row-4", "row-5"]
        }
      },
      "block_order": ["faq"]
    }
  ]
}
{% endschema %}
```

**Notes for the engineer:**
- The schema body (layout/size/appearance/padding settings) is the base section snippet's contract — copied verbatim from `sections/rk-carousel.liquid:62-286`. Do not trim settings: `{% render 'section' %}` reads all of them.
- `category: "t:categories.storytelling"` puts the preset alongside content sections in the editor picker.

- [ ] **Step 2: Run theme check**

Run: `shopify theme check`
Expected: no NEW offenses for `sections/faq.liquid`.

- [ ] **Step 3: Commit**

```bash
git add sections/faq.liquid
git commit -m "feat(faq): FAQ section on the base section engine with full preset"
```

---

### Task 4: Verification (Definition of Done gate)

**Files:** none (verification only)

- [ ] **Step 1: Full theme check**

Run: `shopify theme check`
Expected: zero offenses in the 3 new files. Fix anything reported and amend the relevant commit.

- [ ] **Step 2: Manual Theme Editor verification (requires dev store)**

Run: `shopify theme dev` and open the Theme Editor preview.

Checklist (mobile 360–390px FIRST, then desktop):
- Add the "FAQ" section to a page → preset renders: heading + 5 numbered cards, first row open.
- Click a closed row → smooth height animation, `+` rotates to `×`, button bg turns accent.
- Reorder rows in the editor → numbers renumber automatically.
- Toggle "Mostrar numeração" off → numbers disappear, layout stays aligned.
- Set each color picker → only the targeted element changes; clear it → scheme color returns.
- Change section color scheme with pickers empty → cards/text follow the scheme.
- Keyboard: Tab reaches each summary, Enter/Space toggles, focus ring visible.
- `prefers-reduced-motion`: emulate in DevTools → no toggle transition.
- View source → one `itemtype="https://schema.org/FAQPage"` with nested `Question`/`acceptedAnswer`. Validate with https://validator.schema.org/ if convenient.
- No CLS: cards have fixed closed height; opening pushes content (expected accordion behavior).

- [ ] **Step 3: Definition of Done sweep**

Confirm every item in §9 of `horizon-theme.instruction.md`: no native file edited, native engines reused, brand-neutral names (`faq`, `_faq-row`), radius/padding/colors customizable, mobile checkbox present, presets present, no new JS, LiquidDoc headers on both blocks.

- [ ] **Step 4: Final commit (if fixes were needed) and push**

```bash
git push -u origin feat/faq-accordion
```
