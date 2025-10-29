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

## Phase 0: Program Guardrails - DONE

**Change Log:**
- Verified git branch `feature/frontend-integration` creation and baseline tagging
- Pinned dependency versions in package.json (Node 18.17.0, npm 9.5.0, Three.js 0.180.0, etc.)
- Added CI scripts for typecheck, unit, and e2e testing
- Committed changes and created `v1.0-pre-integration` tag
- Verified app builds successfully and boots locally with baseline 3D scene

**Validation Note:**
- Git branch created successfully and properly tracked
- App builds without errors using `npm run build`
- Dev server starts correctly with `npm run dev` and renders baseline 3D floor planner scene
- All dependencies pinned to specific versions for reproducibility
- CI scripts added and ready for automated testing

The development environment is now properly established with safe version control practices and baseline functionality confirmed. All guardrails are in place for the migration work.

---

## Phase 1: Shared Contract - Frame + Scene - DONE

**Change Log:**
- Created `schema/floorplan.schema.json` with comprehensive AJV validation using `if/then/else` conditionals for style-specific requirements
- Implemented `src/state/frame.ts` with `apply()`, `validateWithAjv()`, and `listMissingOrLowConfidence()` methods
- Added AJV dependency and TypeScript interfaces for Frame JSON structure
- Preserved existing Scene JSON contract (`{ room, objects[] }`) for renderer compatibility

**Validation Note:**
- Schema validates all 6 combinations (kitchen/bath × modern/traditional/transitional)
- Style-conditional requirements properly enforced (e.g., modern requires panel-ready appliances, traditional allows crown molding)
- Invalid frames fail fast with descriptive error messages
- Frame structure supports incremental filling during conversation turns
- AJV tests pass for all valid/invalid scenarios

The Frame JSON system is now ready to drive the dialog logic with proper validation. Scene JSON preserved for renderer compatibility.

---

## Phase 1 — Shared Contract: Frame + Scene</search>
</search_and_replace>

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

## Phase 2: Rulebooks (Hard Rules + Style Preferences) - DONE

**Change Log:**
- Created `src/lib/rulesEngine.ts` with `mergeRules()` and `placementValidator()` functions
- Integrated with existing `rules/compileEffectiveRules.ts` for LLM context compilation
- Added comprehensive rule validation for NKBA, ADA, and Universal Design requirements
- Created `/docs/RULEBOOKS.md` documenting rule hierarchy, citations, and SKU expansion

**Validation Note:**
- Engine functions properly compile rules from rulebook.master.json
- placementValidator returns deterministic alternatives with clear cause text (e.g., "Dishwasher must be adjacent to sink - move 12in left")
- NKBA compliance checks implemented for aisles (42"/48"), clearances, and work triangles
- compileEffectiveRules produces correct JSON/XML subsets for LLM context
- All rule validations pass with appropriate error messages and suggestions

The rule engine is now ready to enforce deterministic placement rules while allowing the LLM to focus only on conversational guidance.

---

## Phase 2 - Rulebooks (Hard Rules + Style Preferences)</search>
</search_and_replace>

### Outcomes
Deterministic, machine-readable rules externalized; LLM only reasons.

### Files
- `/rules/rulebook.master.json`  
- `/catalog/skuSpecs.json`  
- `/rules/compileEffectiveRules.ts`  
- `/docs/RULEBOOKS.md`

### Engine Logic
- `mergeRules(roomType, style, skuRefs)`  effectiveRules  
- `placementValidator(spec, effectiveRules)`  `{ ok | alt, reason }`

### DoD
? NKBA, ADA, Universal Design rules compiled  
? `placementValidator()` returns deterministic alternatives + cause text  
? `compileEffectiveRules()` successfully produces JSON and XML subsets  

---



## Phase 2 — Rulebooks (Hard Rules + Style Preferences)</search>
</search_and_replace>

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

## Phase 3: LLM Swap (Local, Reasoning-Only) - DONE

**Change Log:**
- Confirmed the legacy Gemini integration is removed from the base `services` layer and replaced by the Ollama client in `services/llm/ollamaClient.ts`
- Implemented rule-aware reasoning helpers in `services/llm/reasoner.ts`, restricting the model to `selectNextQuestion()` and `paraphraseToCNL()` while keeping object placement deterministic
- Updated tooling (`tsconfig.json`, `jest.config.js`) so JSON rulebooks load under Jest and the Ollama client runs with offline-friendly, single-call constraints (temperature ≤ 0.3, context ≤ 8k tokens)

**Validation Note:**
- Ran `npm test` to exercise the reasoning flow; each turn issues exactly one chat completion, gracefully falls back when Ollama is offline, and never returns placement calls
- Observed the fallback question selector shrink `frameManager.listMissingOrLowConfidence()` after applying parsed updates during the tests
- Confirmed `createChatCompletion()` clamps temperature, enforces the 8k token limit, and aborts quickly when the local endpoint is unreachable

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

## Phase 4: Deterministic Parser → Scene Builder - DONE

**Change Log:**
- Introduced `nlp/lexicon.ts`, `nlp/measure.ts`, and `nlp/parse.ts` to canonicalize user vocabulary, parse imperial measurements, and emit deterministic frame patches; `services/llm/reasoner.ts` now consumes these updates before consulting the LLM.
- Added `services/scene/sceneBuilder.ts` with companion `schema/scene.schema.json` to produce AJV-validated Scene JSON while applying NKBA work-triangle/aisle math and optional ADA clearances; aligned `src/lib/rulesEngine.ts` with bathroom rulebook keys for downstream validation.
- Extended the reasoning loop to emit final scenes plus structured warnings when the frame is complete and covered the new pipeline with `tests/parser-scene.test.ts`.

**Validation Note:**
- `npm test` exercises the deterministic parser, scene builder, and existing suites, confirming structured field extraction, AJV-valid Scene JSON output, and NKBA/ADA warning emission for out-of-spec layouts.

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






