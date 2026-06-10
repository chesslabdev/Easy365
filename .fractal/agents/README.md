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
3. Everything editable from the Theme Editor (blocks + settings + presets).
4. Web components extend `@theme/component`; register modules in `snippets/scripts.liquid`.
5. SEO + accessibility on every component, no exceptions.

> The legacy SaaS-boilerplate agents (Neo, Clara, Aurora, Elara, Lia, Veda) are unrelated
> to this Shopify theme and are kept only for reference.
