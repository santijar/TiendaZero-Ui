# TiendaZero-Ui: documentation

`AGENTS.md` (repo root) holds the rules an agent or a contributor follows on every change. This folder holds the reference: how things
work and why. Read the file for the area you are about to change before changing it.

| File | What it covers |
|---|---|
| `plan.md` | The product and architecture plan, milestones 0 to 6. **Identical copy in the Api repo.** |
| `architecture/storefront.md` | Shopper screens and state: catalog, cart, session, checkout, orders, the home carousel. |
| `architecture/admin-screens.md` | The store admin screens (orders, products, branding, payments, pickup, promotions, domains) and the platform admin's tool. |
| `architecture/theming-and-design.md` | How a store's branding reaches the page, the Nocturne tokens and how to change them. |
| `architecture/development.md` | Stack, dev server, and how tests fake the Api. |
| `architecture/design-handoff.md` | The Claude Design handoff bundle in `design/` and the files copied between the two repos. |
| `architecture/deploying.md` | The Cloudflare Worker that serves the storefront and proxies `/api`, and deploy on merge. |

## Where the project stands

- The storefront and the whole store admin are built and merged, against the Api in the sibling repo (`../api/`).
- Per-store content is built: pickup point, transfer details, home carousel and the reply address for emails.
- Milestone 6 (deploy): the Worker and its tests are merged and were checked locally. **Nothing is deployed, and deployment is on hold**
  until a paying client covers the cost of a domain. The open list lives in `TODO.md` at the workspace root (outside this repo).

## Keeping this folder true

When a change alters behavior described here, update the file in the same pull request. A stale line is worse than none: agents act on it.
