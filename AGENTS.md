# AGENTS.md: TiendaZero-Ui

Storefront and store admin of TiendaZero, a multi-tenant white-label e-commerce platform (Regate is the first store). Vue 3 + Vite +
TypeScript + Vue Router + Pinia; Vitest + @vue/test-utils. The backend is a separate repo, **TiendaZero-Api** (`../api/`); the two repos are
independent: run git inside this one, never at the workspace level.

Read `docs/README.md` first. The reference for each area is in `docs/architecture/`; read the file for the area you are changing **before**
you change it. `docs/plan.md` is the plan.

## Commands

Needs **Node 24** (Node 26 breaks the tests). In a shell: `eval "$(fnm env --shell bash)"; fnm use 24`.

```
npm run lint:check && npm run format:check && npm run type-check && npm test && npm run build-only    # what CI runs
npm run lint        # auto-fix lint        npm run format     # auto-fix formatting
npx vitest run src/__tests__/some.spec.ts   # one file while iterating
```

- Dev: start the Api (`../api`, port 5043), then `npm run dev` and open **`http://regate.localhost:5173`**. The tenant is chosen by the
  Host, so plain `localhost` belongs to no store. The platform admin's tool is at `http://platform.localhost:5173`.
- There is no Python here. Use Node for one-off scripts.

## Definition of done

1. Lint, format check, type-check, the **whole** test suite and the build pass, and you saw them pass.
2. The matching file in `docs/architecture/` is updated, if behavior changed.
3. A screen or flow changed: say plainly that it was verified by tests and **not** in a browser, unless you did look at it.
4. Report faithfully: what ran, what failed, what you did not verify.

## Rules

- **Nothing is store-specific.** No "Regate" text, photos, hours or links in the code: everything a store shows comes from the Api (theme,
  promos, pickup, checkout options). A new store must look and read as its own.
- **The Api decides.** Authorization, validation and prices live in the Api. The Ui shows the Api's Spanish messages (`ApiError`,
  `error.problem.errors`) next to the field they belong to and never reimplements a rule. A form that has an Api-side validation uses
  `novalidate`, so the browser's own tooltip does not replace the message.
- **Contract with the Api.** The types in `src/api/*.ts` mirror the Api's DTOs. When the Api changes a shape, change the client, the
  fake Api (`src/__tests__/fakeApi.ts`) and the tests together.
- **Design system (Nocturne).** `src/assets/nocturne.css` is a verbatim copy of the bundle's file: re-copy, never edit. Do not invent tokens.
  The Ui does no color math: the Api resolves the theme. `design/` is reference material; do not render it or take screenshots of it unless
  asked (its README explains).
- **Session.** The access token lives only in memory; the refresh cookie is httpOnly. Never put a token or a secret in `localStorage`, the URL
  or a `VITE_*` variable (those are public).
- **Language.** User-facing text is Spanish with voseo ("Ingresá", "Guardá"); code, identifiers and comments are English, and comments say *why*.
- Prettier: no semicolons, single quotes, 100 columns; oxlint + ESLint. Run `npm run format` before finishing.
- Do not add features, abstractions or error handling the task did not ask for.

## Tests

- Vitest + @vue/test-utils. Tests stub `fetch` with an in-memory Api (`src/__tests__/fakeApi.ts`: `stubApi()`).
- Build a **fresh router per mounted app**: `createAppRouter(createMemoryHistory())`. Preload lazily-routed views in `beforeAll`
  (`flushPromises` does not wait for a first dynamic import). Unmount mounted apps in `afterEach`.
- A page with more than one `<form>` needs selectors that say which (an `aria-label`), not `find('form')`.
- The tests' TypeScript target has no `Array.prototype.at`: use `slice(-1)[0]`. The lint rule wants type parameters on `vi.fn`.
- Prove a new test can fail: break the behavior on purpose and watch it go red, then restore.

## Git

One branch per topic, named `feat/...`, `fix/...`, `chore/...`. Commit messages explain the why. The owner merges into `main`; do not push to
`main` unless asked. Never force-push, never skip hooks.

## Shared files (identical in both repos)

`docs/plan.md` and `design/` are copied identically into the Api repo. Change one, change both. Open work is tracked in `TODO.md` at the
workspace root (outside the repos): keep it current when something is done or found.

## Agents

Two project subagents live in `.claude/agents/`. Use them for a feature that has both parts:

- **`code-writer`**: writes the production code (components, stores, API clients, docs). It does not write tests.
- **`test-writer`**: writes the tests. It does not change production code; a failing test that shows a bug is reported back, not "fixed".

Typical flow: `code-writer` implements and lists the behaviors to cover; `test-writer` writes those tests against the finished code; you run the
full checks. Do small tasks yourself: delegating has a cost.
