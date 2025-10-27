# Migration Update Document: Frontend → Base App Integration

**Objective:** Transform the base app from Gemini-dependent to a fully local, privacy-focused application with structured design capture, deterministic parsing, and professional-grade 3D rendering.

**Coder AI Instructions:**
- Work step-by-step from this document only.
- After each step: mark as DONE, explain what was changed, and how it was validated. Then proceed to the next step.
- Do not proceed to the next step until the current one is marked DONE with validation.
- Use the provided todo list as reference but execute through this document's structure.
- All changes must maintain backward compatibility with existing Canvas3D renderer.

---

## 1. Repo Prep and Safety

**Goal:** Ensure safe development environment with version control and CI protection.

**Steps:**
1. Create a new git branch: `git checkout -b feature/frontend-integration`
2. Tag current state: `git tag v1.0-pre-integration`
3. Verify CI passes on main branch before proceeding
4. Set up local development environment with Ollama running Qwen 2.5 7B
5. Create backup of current state.json and verify app loads

**Validation:** Branch created, CI green, app runs locally.

---

## 2. State/Schema Setup

**Goal:** Implement frame/slot JSON system with AJV validation.

**Steps:**
1. Create `schema/floorplan.schema.json` with base structure and `if/then/else` conditionals for style-specific requirements
2. Install AJV: `npm install ajv ajv-formats`
3. Create `src/state/frame.ts` with frame JSON management functions (apply, validate, listMissing)
4. Update `src/types.ts` to include frame JSON interfaces
5. Create unit tests for schema validation with different styles

**Validation:** Schema validates sample frame JSON, AJV throws errors for invalid data, tests pass.

---

## 3. Rulebooks

**Goal:** Set up data catalogs for SKUs and finishes.

**Steps:**
1. Create `src/catalog/skuSpecs.json` with exact dimensions and clearances for appliance models
2. Create `src/catalog/finishes.json` mapping finish enums to KTX2 paths and glTF variants
3. Create `src/lib/nkba.ts` with compliance checking functions for aisles (42"/48") and clearances
4. Add TypeScript interfaces for catalog data in `src/types/catalog.ts`

**Validation:** JSON files parse correctly, NKBA functions return expected warnings/errors for test cases.

---

## 4. LLM Client Swap

**Goal:** Replace Gemini with local Ollama service for conversation guidance.

**Steps:**
1. Create `src/services/ollamaService.ts` with OpenAI-compatible API calls to localhost:11434/v1
2. Implement next-question selection logic based on frame completion status
3. Update `src/services/geminiService.ts` imports to use new service (maintain interface compatibility)
4. Add error handling for Ollama unavailability with fallback to basic prompts

**Validation:** Service responds to test prompts, maintains conversation state, handles API errors gracefully.

---

## 5. Parser + Scene-Builder Wiring

**Goal:** Integrate deterministic parser and scene building pipeline.

**Steps:**
1. Create `src/nlp/` directory with `lexicon.ts`, `measure.ts`, `parse.ts` (copy and adapt from frontend)
2. Create `src/services/scene/sceneBuilder.ts` to convert placement specs + SKU dims to scene JSON
3. Wire parser output to fill frame JSON slots
4. Integrate NKBA checks in scene builder before final JSON output
5. Update conversation flow to route placement commands through parser

**Validation:** Test commands like "put fridge on wall 1 left" correctly fill frame JSON, scene builder produces valid scene JSON with NKBA compliance.

---

## 6. Renderer Registry Swap (TSX Cabinets + GLB)

**Goal:** Implement component routing and enhanced rendering.

**Steps:**
1. Create `src/render/registry.ts` for routing cabinet_* to TSX, others to GLB
2. Create `src/components/cabinets/` with parametric TSX components (BaseCabinet, WallCabinet, etc.)
3. Create `src/components/glb/` with GLB loading components using `useGLTF` and variant support
4. Update `src/components/Canvas3D.tsx` to use registry for component selection
5. Implement finish switching via `KHR_materials_variants` in GLB components

**Validation:** Cabinets render parametrically, GLB models load with correct finishes, no console errors.

---

## 7. Asset Loaders (KTX2/Draco)

**Goal:** Set up high-performance 3D asset loading.

**Steps:**
1. Create `src/loaders/threeLoaders.ts` with GLTFLoader + DRACO + KTX2 initialization
2. Copy GLB files from `frontend/public/models/Appliances/` and `frontend/public/models/Sinks/` to `public/models/`
3. Add KTX2 texture files to `public/textures/` (generate or placeholder)
4. Update Vite config to handle GLB/GLTF loading
5. Implement `useGLTF.preload()` for hot assets in registry

**Validation:** GLB files load without errors, textures display correctly, performance improved vs baseline.

---

## 8. App-to-App Merge (Folders, Deps, Env)

**Goal:** Integrate frontend components and dependencies.

**Steps:**
1. Merge necessary dependencies from frontend package.json (three.js loaders, AJV, etc.)
2. Update `.env.local` with Ollama configuration
3. Copy static style images to `public/style-images/`
4. Update import paths for moved components
5. Resolve any TypeScript path mapping conflicts

**Validation:** App builds successfully, no missing dependencies, environment variables load correctly.

---

## 9. Tests (Schema, Parser, Renderer, E2E)

**Goal:** Comprehensive testing of all new components.

**Steps:**
1. Test schema validation with style-conditional requirements using AJV
2. Test dialog completion workflows by style with frame validation
3. Test parser/sceneBuilder deterministic JSON output with NKBA checks
4. Test renderer finish switching via `KHR_materials_variants` on appliances
5. Test KTX2 texture loading performance with `useGLTF.preload()`
6. Run E2E tests for complete design workflow

**Validation:** All tests pass, coverage meets requirements, E2E scenarios complete successfully.

---

## 10. High-Level Docs Generation

**Goal:** Update documentation for new architecture.

**Steps:**
1. Update `README.md` with new architecture overview
2. Create `docs/ARCHITECTURE.md` explaining frame JSON, parser/LLM hybrid, renderer registry
3. Document NKBA compliance features
4. Update API documentation for new services

**Validation:** Docs build successfully, links work, architecture clearly explained.

---

## 11. Sign-Off Checklist

**Goal:** Final validation before merge.

**Steps:**
1. Run full test suite
2. Performance benchmark vs baseline
3. Manual testing of complete design workflow
4. Code review checklist completion
5. Update CHANGELOG.md with migration details

**Validation:** All items checked, PR created with comprehensive description.

---

**Final Step:** After completing all sections, create PR and request review. The migration is complete when the PR is merged and deployed successfully.