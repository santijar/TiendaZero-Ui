# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## This repository

**TiendaZero-Ui**: the storefront frontend of TiendaZero, a multi-tenant white-label e-commerce
platform (Regate is the first tenant). The backend is a separate repo, TiendaZero-Api
(https://github.com/santijar/TiendaZero-Api). Implementation follows `docs/plan.md`
(milestones 0–6). **Milestone 0 (scaffold + CI) is done.** Only a placeholder home route exists.

- Vue 3 + Vite + TypeScript + Vue Router + Pinia. Vitest + @vue/test-utils for tests.
  oxlint + ESLint + Prettier (no semicolons, single quotes, 100 cols).
- The dev server proxies `/api` to `http://localhost:5043` (the Api's `http` launch profile),
  so run the Api locally alongside `npm run dev`.
- `design/` is excluded from oxlint and ESLint (`.oxlintrc.json`, `eslint.config.ts`). It's
  reference material, not app code.

Commands (what CI in `.github/workflows/ci.yml` runs):

```
npm run lint:check && npm run format:check && npm run type-check && npm test && npm run build-only
```

`npm run lint` and `npm run format` are the auto-fixing variants.

## Shared docs and design

`docs/plan.md` and `design/` (the Claude Design handoff bundle + `Regate Images/`) are
**copied identically into both TiendaZero-Api and TiendaZero-Ui**. When you change either, make
the same change in the other repo so they don't drift.

The design source is a **handoff bundle** exported from Claude Design (claude.ai/design):
`Regate Shop mobile prototype-handoff.zip`, already extracted into
`design/regate-shop-mobile-prototype/`. Its content is static prototype HTML/CSS/JS meant to
be read and reimplemented, not run through a toolchain.

**Read `design/regate-shop-mobile-prototype/README.md` first.** It contains the authoritative
instructions for how a coding agent should treat this bundle. The key points:

- The primary design to implement is `design/regate-shop-mobile-prototype/project/Regate Shop Web.dc.html`
  — read it in full, top to bottom, then follow its imports (the design-system stylesheet/bundle,
  `image-slot.js`, `support.js`) before implementing anything.
- The `.dc.html` files are **prototypes, not production code**. The job is to recreate them
  **pixel-perfectly** in whatever stack fits the real target codebase (React, Vue, native,
  etc.) — match the visual output, do not port the prototype's internal markup/structure
  unless it happens to fit.
- Don't render these files in a browser or take screenshots unless explicitly asked — all
  layout/color/sizing information is already explicit in the HTML/CSS source.
- If anything about scope or behavior is ambiguous, ask the user before implementing — this
  bundle is a starting point, not a finished spec.
- The target stack is fixed in `docs/plan.md`: TiendaZero-Api (.NET) + TiendaZero-Ui (Vue), two separate repos.

## Bundle structure

```
design/regate-shop-mobile-prototype/
  README.md                        # handoff instructions (read first)
  project/
    Regate Shop.dc.html            # mobile prototype (390x844 iPhone frame)
    Regate Shop Web.dc.html        # desktop/responsive web prototype — the primary design
    Regate Shop Web-print.dc.html  # auto-generated static multi-page export of the Web
                                    #   prototype for printing/review — mirrors it 1:1,
                                    #   do not hand-edit
    _ds/nocturne-*/                # "Nocturne" design system: styles.css (all design
                                    #   tokens — colors, type, spacing, radii, shadows as
                                    #   CSS variables), _ds_bundle.js, readme.md (usage
                                    #   rules), component/foundation reference pages
    support.js, image-slot.js,     # Claude Design prototyping runtime: implements the
      doc-page.js                  #   <x-dc>, <sc-if>, <sc-for>, <image-slot> custom
                                    #   elements and {{ mustache }} bindings used by the
                                    #   .dc.html files. This is tooling infrastructure for
                                    #   the prototype, not application logic to port.
    assets/                        # campaign photography referenced by the prototypes
    uploads/                       # user-supplied reference images filled into image slots
    .image-slots.state.json,       # tool-generated state, not meant for manual editing
      .thumbnail
```

## Domain context

"Regate" is a Spanish-language sporting-goods e-commerce storefront. Product categories
seen in the prototype: Camisetas, Shorts, Abrigo, Accesorios, spanning fútbol, running,
básquet, training, and estadio lines. Screens covered: home/catalog with promo carousel,
category filter + sort, product grid, product detail (gallery, size picker, add to cart),
and a cart.

The visual language is the **Nocturne** design system (see
`design/regate-shop-mobile-prototype/project/_ds/nocturne-*/readme.md` for full rules): a dark, desaturated UI
(`--color-bg` `#161826`, text `#e9e9ed`) with a single blurple accent (`#9184d9`) used only
as outlines/lines/glows — never a solid fill — plus Inter type, 8px radii, and OKLCH tonal
ramps (100–900) per color role. Outlined (not filled) primary buttons, flush-left headings,
and photographs wrapped in `.lighten` (`mix-blend-mode: lighten`) so dark photo backgrounds
disappear into the page are the system's signature traits. When reimplementing, carry over
these token values/relationships rather than inventing new ones.
