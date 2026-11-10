# Theming and the design system

How a store's branding reaches the page, the Nocturne design tokens and what to do when they change.

- Theming (Milestone 3, slice 2, plan §3). `GET /api/theme` (`src/api/theme.ts`) returns a store's branding already
  resolved: `cssVariables` (plain values), logo, wordmark, monogram, favicon, footer name and social links. The
  Ui does no color math. `stores/theme.ts` loads it; `lib/applyTheme.ts` sets the variables on `<html>` (they
  override Nocturne's defaults in `nocturne.css`, which stays verbatim), `data-theme-mode`, `color-scheme`, the tab
  title and the favicon. `main.ts` awaits it (max 2 s) before mounting, so a store never flashes in another's look;
  `App.vue` retries if that failed, and a failed theme leaves Nocturne's defaults. The platform preview calls
  `load()` whenever another store is picked and `reset()` when signed out. `AppHeader` draws the logo as a
  background (size, margin, filter and blend from the theme; with no blend set, a Dark store's logo uses
  `lighten`, a Light store's `normal`), else the wordmark, with the monogram badge when there is neither;
  `AppFooter` shows `© year footerLegalName` and the first social link.
  Tests: `theme.spec.ts`; `fakeApi.ts` has `REGATE_THEME`/`INDIANS_THEME` and `api.theme.current`.

- Nocturne tokens/classes live in `src/assets/nocturne.css`, a verbatim copy of the bundle's
  `styles.css`. Re-copy it rather than editing it.

- **Changing Nocturne's tokens** (docs/plan.md §3 risk: two palettes to keep in sync). A new or retuned token needs a
  decision for each ground, then: (1) `src/assets/nocturne.css` stays a verbatim copy of the bundle's file, so
  re-copy it; (2) if it is chromatic or ground-dependent (bg, surface, text, divider, neutral steps, shadows,
  accent), add it to both `ThemeRamp.Dark` and `ThemeRamp.Light` in the Api (a test fails if their keys differ) and
  keep the light neutrals on the dark ramp's lightness scale; (3) if it is structural (font, space, radius,
  component class), leave it fixed for every tenant and in neither palette; (4) if the contrast check should
  cover a new pairing, add it to `CHECKS` in `src/lib/contrast.ts`; (5) update both copies of `docs/plan.md`.

- `design/` is excluded from oxlint and ESLint (`.oxlintrc.json`, `eslint.config.ts`). It's
  reference material, not app code.
