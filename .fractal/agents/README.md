# Easy365 — Shopify Horizon Squad

Agents that build **performant, well-architected code for the Easy365 Shopify theme
(Horizon)**, optimized for PageSpeed / Core Web Vitals and full Theme-Editor editability.

All of them obey one shared playbook:
**`.fractal/instructions/standards/horizon-theme.instruction.md`** (read it first).

| Agent | Role | Owns |
|-------|------|------|
| **Atlas** | Architect & Orchestrator | Patterns (SOLID/Decorator/Adapter), rendering & lazy strategy, performance budget, block-chain design, delegation & final review |
| **Vulcan** | Theme Engineer | Web components (`Component`), blocks/snippets, Liquid `capture`/`content_for` decorators, import-map registration |
| **Helios** | QA & Performance | Core Web Vitals measurement (`web-perf`), `theme check`, regression & Definition-of-Done gating |
| **Iris** | UI/UX, A11y & SEO | Usable editor-friendly UI, semantic markup, image alts, JSON-LD, focus, WCAG AA |
| **Pinax** | Templates & Pages | `templates/*.json`, section groups, presets, page assembly & review |
| **Mira** | Figma → Code | Figma MCP → Horizon blocks/components with design tokens mapped to theme systems |

## Core principles (every agent)
1. Performance first — a CWV regression is a regression.
2. Never edit native Horizon files in place — decorate/compose around them.
3. Reuse a native section engine — base `section` for static sections, the slideshow
   engine (`_slide`) for slides; compose content from `group` + `text` + `button` and
   parent/private block families.
4. Everything editable from the Theme Editor (blocks + settings + presets); border-radius
   always customizable.
5. Global, brand-neutral naming — no store name in files, block types, classes, or elements.
6. Web components extend `@theme/component`; load shared modules via the import map or
   section-scoped `<script type="module">`.
7. SEO + accessibility on every component, no exceptions.

This repo is a Shopify **Horizon** theme only — the prior SaaS-boilerplate agents, skills,
and instructions have been removed.
