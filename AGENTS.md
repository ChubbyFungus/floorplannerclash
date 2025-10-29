# Agent Guidelines for AI 3D Floor Plan Generator

## Commands
- **Build**: `npm run build` (root) or `npm run --prefix frontend build`
- **Dev server**: `npm run dev` (root) or `npm run --prefix frontend dev`
- **Lint**: `npm run --prefix frontend lint`
- **Type check**: `npm run typecheck` (root) or `npm run --prefix frontend type-check`
- **Unit tests**: `npm run test` (Jest, root)
- **Single test**: `npm run test -- --testNamePattern="test name"` or `npm run test path/to/test.test.ts`
- **E2E tests**: `npm run e2e` (Playwright, root) or `npm run --prefix frontend test:e2e`

## Code Style
- **Formatting**: Prettier with single quotes, trailing commas (ES5), 100 char width, 2-space tabs
- **Imports**: React imports first, then third-party, then local (relative paths with `./` or `../`)
- **Naming**: PascalCase for components/classes, camelCase for variables/functions, UPPER_SNAKE_CASE for constants
- **Types**: Strong TypeScript typing required; use interfaces for complex objects; avoid `any`
- **Error handling**: Use try/catch with specific error types; throw descriptive Error objects
- **Comments**: No comments unless complex logic; prefer self-documenting code

## Cursor Rules
- **Quality Assurance**: Include test cases for typical/edge cases; verify changes meet requirements; document solutions
- **Scoped Edits**: Avoid sweeping changes; confirm large edits; focus on one issue/feature at a time
- **Structured Workflow**: Analyze requirements; break into phases; provide detailed plans; write modular code; summarize progress