# Rulebooks Documentation

## Overview

The rulebook system externalizes deterministic, machine-readable rules for room planning and placement validation. Rules are separated from LLM reasoning to ensure consistent enforcement of hard constraints (NKBA, ADA, Universal Design) while allowing style preferences to bias question generation and defaults.

## Rule Hierarchy

Rules are organized in a hierarchical structure within `rules/rulebook.master.json`:

### 1. Globals
- **ADA Standards**: Universal wheelchair access footprints (30x48in clear floor, 60in turning diameter)
- **Defaults**: Standard dimensions (36in counter height, 4in toe kick, etc.)

### 2. Room-Specific Rules
- **Hard Rules**: Engine-enforced constraints that cannot be violated
  - Kitchen: Aisles, work triangle, island clearances, appliance landings, dishwasher proximity
  - Bath: Front clearances, toilet centerline, shower dimensions
- **Placement Rules**: Preferences for optimal appliance positioning
  - Sink between/adjacent to cooktop/refrigerator
  - Dishwasher adjacent to sink with hinge clearance
  - Refrigerator door swing clearance

### 3. Style Preferences
- **Modern**: Slab/flat-panel doors, integrated/edge pulls, panel-ready appliances
- **Traditional**: Raised/recessed panels, bar/knob pulls, crown molding
- **Transitional**: Mixed preferences with balanced options

### 4. SKU Expansions
- Appliance-specific clearances and door swings from `catalog/skuSpecs.json`
- Overrides room rules with manufacturer requirements

## Engine Functions

### `mergeRules(roomType, style, skuRefs?)`
Compiles effective rules by merging:
1. Room hard rules
2. Style placement preferences
3. SKU-specific clearances
4. ADA overlays (if flagged)

Returns `EffectiveRules` object for validation.

### `placementValidator(spec, effectiveRules)`
Validates placement specifications against compiled rules:
- Checks SKU existence in catalog
- Applies room-specific validation logic
- Returns `{ ok | alt, reason }` with deterministic alternatives

## Validation Examples

### Kitchen Dishwasher
```typescript
const rules = mergeRules("kitchen", "modern", ["gen-dishwasher-24"]);
const result = placementValidator({
  sku: "gen-dishwasher-24",
  position: { x: 0, y: 0, z: 0 },
  adjacent: ["sink"] // Valid
});
// Returns: { ok: true, reason: "Placement valid" }
```

### Invalid Refrigerator Placement
```typescript
const result = placementValidator({
  sku: "gen-fridge-36-french",
  position: { x: 0, y: 0, z: 0 },
  adjacent: [] // Missing clearances
});
// Returns: { ok: false, alt: {...}, reason: "Refrigerator door requires 30in front clearance" }
```

## Citations and Sources

- **NKBA**: National Kitchen & Bath Association planning guidelines
- **ADA/ANSI**: Americans with Disabilities Act accessibility standards
- **Manufacturer Specs**: Appliance installation manuals (GE, Bosch, etc.)
- **Universal Design**: Inclusive design principles for aging in place

## SKU Expansion Process

1. Load base rules from `rulebook.master.json`
2. For each SKU in `skuRefs`:
   - Find matching entry in `catalog/skuSpecs.json`
   - Add appliance-specific clearances (side, top, back)
   - Include door swing/opening depths
3. Merge SKU overrides with room rules
4. Apply during placement validation

## Integration Points

- **LLM Context**: `compileEffectiveRules()` produces tiny JSON/XML subsets for model prompts
- **Engine Validation**: `placementValidator()` enforces hard rules deterministically
- **Style Bias**: Preferences influence question generation but don't override hard rules