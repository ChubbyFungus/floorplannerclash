# AGENTS.md

## What you are building
A stateful Room system with a strict 4-layer architecture. Three.js is an implementation detail behind `ViewerPort`.

## Absolute rules (Deletion-First + SSOT)
- Add nothing without removing or migrating the legacy path in the **same change**.
- If a shim is unavoidable: annotate with `DEBT:KILLDATE=YYYY-MM-DD` (≤30 days).
- **Docs SSOT lives only in `/docs/**`**. App docs under `apps/*/docs/reference/**` are generated only.
- Update `/docs/migration/deletion-map.md` whenever code moves or is replaced.

## Frontend boundaries
- No `three` imports outside `apps/frontend/src/infra/three-viewer/**`.
- UI never imports `apps/frontend/src/domain/**` directly—use ports.
- All viewer I/O goes through `apps/frontend/src/app/ports/ViewerPort.ts`.

## Paths of truth
- Domain schema: `apps/frontend/schemas/room-state.schema.json`
- Architecture docs: `/docs/architecture/**`
- Reference docs: `apps/*/docs/reference/**` (generated)

## Commands
- Install: `pnpm i`
- Frontend dev: `pnpm --filter @wgkb/frontend dev`
- Backend dev: `pnpm --filter @wgkb/backend dev`
- Tests: `pnpm test`

## How to use me in Cursor
- In chat, include **@Cursor Rules** to apply the rules context.
- Prefer **Agent mode** for refactors; it can run tests and edit multiple files.
