# Application Refactoring Plan

This document outlines the step-by-step plan to refactor the AI Floorplanner application to conform to the specifications in `SYSTEM_SPECS.md`. Each task will be marked as complete as it is finished.

---

### Phase 1: Schema & State Refactoring

*Goal: Update the core data structures of the application to use the new, robust `RoomState` schema.* 

- [x] **Step 1.1: Update `types.ts`:** Replace the existing interfaces with the new canonical schemas (`StyleTemplate`, `RoomState`, `Opening`, `Item`) as defined in Artifact #1.
- [x] **Step 1.2: Update `App.tsx` State:** Refactor the central state management in `App.tsx` to use a single `RoomState` object instead of multiple disconnected state variables (`floorplan`, `styleState`, etc.).
- [x] **Step 1.3: Update Q&A Flow:** Modify the Q&A logic (`askNextQuestion`, etc.) to populate the `params` field of the new `RoomState` object, using the `styles/*.json` templates for questions and constraints.

---

### Phase 2: Command & Event Handler Refactoring

*Goal: Decouple UI events from direct state manipulation by implementing a deterministic command processing pattern.* 

- [x] **Step 2.1: Implement Command Set:** Add the `Cmd` type definitions from Artifact #2 to `types.ts`.
- [x] **Step 2.2: Refactor UI Event Handlers:** Update the event handlers in `App.tsx` and its child components (`handleChoiceMade`, `handleObjectChange`, etc.) so they no longer modify state directly, but instead dispatch commands (e.g., `{ t:'set_param', ... }`, `{ t:'move_item', ... }`).
- [x] **Step 2.3: Create Command Processor:** Implement a central, deterministic function that takes the current `RoomState` and a `Cmd`, and returns the new `RoomState`.

---

### Phase 3: Builder & Rules Engine Refactoring

*Goal: Align the deterministic geometry generation engine with the new `RoomState` schema and formal specifications.*

- [x] **Step 3.1: Update Builder Input:** Refactor `floorplanBuilder.ts` and `sceneBuilder.ts` to accept the new `RoomState` object as their primary input, removing the legacy `Frame` object.
- [x] **Step 3.2: Verify Placement Algorithm:** Ensure the placement logic in `sceneBuilder.ts` strictly follows the steps, order, and proactive clearance rules documented in **Artifact #4** and **Artifact #8**.
- [x] **Step 3.3: Verify Rules Engine:** Ensure the `rulesEngine.ts` correctly applies all hard rules listed in **Artifact #3** and that the `placementValidator` is used correctly by the builder.

---

### Phase 4: Finalizing Artifacts & Features

*Goal: Implement the remaining features and policies to complete the certification.* 

- [x] **Step 4.1: Implement Openings Model:** Enhance the placement algorithm to respect the forbidden zones and swing collision rules for openings as defined in **Artifact #7**.
- [x] **Step 4.2: Implement Export Contract:** Create a new service that takes a final `RoomState` and exports it to a GLB/GLTF file according to the specification in **Artifact #11**.
- [ ] **Step 4.3: Implement Telemetry:** Implement the logging mechanism defined in **Artifact #12** to record the specified fields after each generation.
