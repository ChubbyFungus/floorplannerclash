# RenovAIte — MIGRATION_UPDATE.md  
**Objective:** Merge the Frontend System into the Base App, remove Gemini, and implement a fully local, deterministic, rule-driven architecture with high visual fidelity and AI reasoning.

**Execution Mode (Mandatory):**  
- Follow this document **step by step only.**  
- After each step:  
  1. Mark it **DONE**  
  2. Add a **Change Log paragraph** describing edits  
  3. Add a **Validation Note** explaining how the result was verified  
- Do **not** continue until validation is complete.  
- Work directly in this document as the single source of truth.  

---

## Phase 0 — Program Guardrails

### Outcomes
Safe branching, reproducible builds, and immutable step tracking.

### Steps
- Create branch `feature/frontend-integration`  
- Tag baseline: `git tag v1.0-pre-integration`  
- Enable CI checks (typecheck, unit, E2E)  
- Add this file as `/docs/MIGRATION_UPDATE.md`  
- Pin Node, PNPM/NPM, and Three.js versions in `package.json`

### DoD
✅ CI green on `main`  
✅ App boots locally and reproduces baseline render

---

## Phase 1 — Shared Contract: Frame + Scene

### Outcomes
Unified `Frame` JSON driving dialog logic; `Scene` JSON preserved for render pipeline.

### Steps
- Create `schema/floorplan.schema.json`  
  - Use **if/then/else** or **oneOf** keyed by `{ roomType, style }`  
  - Validate each turn with **AJV**
- Implement `src/state/frame.ts` with:
  - `apply(fills)`
  - `validateWithAjv()`
  - `listMissingOrLowConfidence()`
- Preserve renderer contract: `Scene = { room, objects[] }`
- Add AJV tests for `{kitchen|bath} × {modern|traditional}` conditionals

### DoD
✅ Invalid frames fail fast  
✅ Valid frames pass all style/room combos  
✅ Frame → Scene linkage confirmed via AJV validation

---

## Phase 2 — Rulebooks (Hard Rules + Style Preferences)

### Outcomes
Deterministic, machine-readable rules externalized; LLM only reasons.

### Files
- `/rules/rulebook.master.json`  
- `/catalog/skuSpecs.json`  
- `/rules/compileEffectiveRules.ts`  
- `/docs/RULEBOOKS.md`

### Engine Logic
- `mergeRules(roomType, style, skuRefs)` → effectiveRules  
- `placementValidator(spec, effectiveRules)` → `{ ok | alt, reason }`

### DoD
✅ NKBA, ADA, Universal Design rules compiled  
✅ `placementValidator()` returns deterministic alternatives + cause text  
✅ `compileEffectiveRules()` successfully produces JSON and XML subsets  

---

## Phase 3 — LLM Swap (Local, Reasoning-Only)

### Outcomes
Local LLM (Ollama + Qwen 2.5 7B) handles conversational flow only.

### Steps
- Remove `services/geminiService.ts`  
- Add `services/llm/ollamaClient.ts` (OpenAI API-compatible, `/v1/chat/completions`)  
- Add `services/llm/reasoner.ts`:
  - `selectNextQuestion(frameMin, missing[], effectiveRules, styleHints)`  
  - `paraphraseToCNL(text)` (optional for parser fallback)
- Keep temperature ≤ 0.3 and context ≤ 8k  

### DoD
✅ One LLM call per turn  
✅ Questions materially reduce `missing[]` fields  
✅ No object placement performed by LLM  

---

## Phase 4 — Deterministic Parser → Scene Builder

### Outcomes
Parser fills Frame slots; Scene Builder emits final renderable JSON instantly.

### Steps
- Extend parser modules:
  - `/nlp/lexicon.ts`, `/nlp/measure.ts`, `/nlp/parse.ts`
- Add `/services/scene/sceneBuilder.ts`:
  - Converts parser output → Scene JSON
  - Integrates Rulebook & NKBA checks
  - Validates Scene JSON with AJV before render

### DoD
✅ Parser generates valid Scene JSON  
✅ NKBA/ADA violations trigger structured alternatives + warnings  
✅ Scene renders instantly (no async LLM placement)

---

## Phase 5 — Renderer Registry + Assets


### Outcomes

TSX for cabinets; JSX-wrapped GLB components for appliances and fixtures; all support runtime finish variants, SKU sizing, and editable materials while maintaining GLB caching efficiency.

### Steps

-Registry Routing
    -Create /render/registry.ts:
        -cabinet_* → parametric TSX components
        -Other objects → GLTFJSX components that internally load their .glb files via useGLTF
-Generate JSX Components from GLBs
    -For every appliance or fixture that may need finish or dimension changes:
    npx gltfjsx public/models/<model>.glb --transform --types --keepnames
    -This produces Model.tsx + a transformed GLB.
    -Move Model.tsx to src/components/glb/ and commit both artifacts.
    -Inside the generated component:
        -Keep the useGLTF('/public/models/<model>.glb') call.
        -Add material or variant switching logic as needed.
-Finishes + Variants
    -Store finish options inside GLBs with KHR_materials_variants.
    -Add helper in /render/variantSwitcher.ts to swap active variant or material map at runtime.
-Texture Pipeline
    -Serve KTX2 compressed textures for all finishes.
    -Initialize KTX2Loader + DRACOLoader once in /loaders/threeLoaders.ts.
    -Link KTX2 files under /public/textures/.
-Performance + Preload
    -Preload hot models with useGLTF.preload('/public/models/<model>.glb').
    -Verify GLB and KTX2 assets load asynchronously without blocking UI.

### DoD

✅ Cabinets resize via width/height/depth props
✅ All JSX-converted models expose node/material access for finish and SKU customization
✅ Appliances and fixtures switch finishes at runtime through KHR_materials_variants
✅ KTX2 textures load and reduce VRAM usage
✅ Renderer maintains baseline FPS and identical scene output

---

## Phase 6 — App-to-App Merge

### Outcomes
Frontend merged into Base App; unified structure and deps.

### Steps
- Consolidate into:
  ```
  nlp/
  services/
  render/
  loaders/
  rules/
  catalog/
  schema/
  state/
  ```
- Merge deps in `package.json`  
- Update `.env.local` with `LLM_ENDPOINT=http://localhost:11434/v1`  
- Move assets:
  - GLBs → `/public/models/`
  - KTX2 → `/public/textures/`
  - Style previews → `/public/style-images/`
- Keep `Canvas3D` API intact

### DoD
✅ App builds from root  
✅ No broken imports  
✅ Identical baseline scene  

---

## Phase 7 — Test Matrix + Quality Gates

### Outcomes
Full verification of schemas, parsers, and rendering.

### Tests
- **Schema/AJV:** Validate all {roomType, style} combos  
- **Dialog Loop:** Verify turns-to-completion  
- **Parser/Scene:** Deterministic outputs match gold corpus  
- **Renderer:** KTX2 + variants load without hitch  
- **E2E:** Full kitchen/bath workflows

### DoD
✅ All tests green  
✅ No regressions  
✅ Perf ≥ baseline  

---

## Phase 8 — Documentation + Handover

### Outcomes
Comprehensive documentation and audit-ready state.

### Artifacts
- `/docs/ARCHITECTURE.md` — Frame/Scene loop + LLM/Parser roles  
- `/docs/RENDERING.md` — Registry, TSX/GLB variants, KTX2/Draco stack  
- `/docs/RULEBOOKS.md` — Rule hierarchy, citations, SKU expansion  
- `/docs/DEVELOPER_GUIDE.md` — local setup, testing, profiling  
- `/CHANGELOG.md` — migration summary

### DoD
✅ All docs render correctly in repo  
✅ Links verified  
✅ Review sign-off by Integration Lead  

---

## RACI
| Role | Responsibility |
|------|----------------|
| **Accountable** | Integration Lead |
| **Responsible** | Coder AI executing `MIGRATION_UPDATE.md` |
| **Consulted** | Standards Owner (NKBA/ADA), Rendering Lead |
| **Informed** | Product, QA |

---

## Risks + Mitigation

| Risk | Mitigation |
|------|-------------|
| **LLM drift** | Frame JSON + Rulebooks enforce deterministic contract |
| **Asset bloat** | Use KTX2 compression + JSX only for editable models |
| **Schema creep** | Centralized AJV validation in CI |

---

**End of MIGRATION_UPDATE.md**
