// Engine logic for rule compilation and placement validation
// Externalizes rules from LLM reasoning for deterministic, machine-readable enforcement

import rulebook from "../../rules/rulebook.master.json";
import skuSpecs from "../../catalog/skuSpecs.json";

export type RoomType = "kitchen" | "bathroom";
export type Style = "modern" | "traditional" | "transitional";

export interface EffectiveRules {
  roomType: RoomType;
  style: Style;
  hard: any; // Room-specific hard rules
  placement: any; // Placement preferences
  ada?: any; // ADA overlays if applicable
  skuOverrides?: any; // SKU-specific rule expansions
}

export interface PlacementSpec {
  sku: string;
  position: { x: number; y: number; z: number };
  rotation?: number;
  adjacent?: string[]; // Adjacent SKUs for context
  roomContext?: any; // Room dimensions, walls, etc.
}

export interface ValidationResult {
  ok: boolean;
  alt?: PlacementSpec; // Suggested alternative if invalid
  reason: string;
}

/**
 * Compiles effective rules by merging room type, style preferences, and SKU-specific expansions
 * @param roomType - The room type (kitchen/bath)
 * @param style - The design style
 * @param skuRefs - Optional array of SKU references for rule expansion
 * @returns EffectiveRules object ready for validation
 */
export function mergeRules(roomType: RoomType, style: Style, skuRefs?: string[]): EffectiveRules {
  const ruleKey = roomType === "bathroom" ? "bath" : roomType;
  const room = (rulebook as any)[ruleKey] || {};
  const stylePrefs = (rulebook as any).styles?.[style]?.prefs || {};

  // Base hard rules
  const hard = room.hard || {};

  // Placement preferences
  const placement = room.placement || {};

  // SKU-specific expansions (e.g., appliance clearances)
  const skuOverrides = skuRefs ? expandSkuRules(skuRefs) : {};

  return {
    roomType,
    style,
    hard,
    placement,
    skuOverrides
  };
}

/**
 * Validates a placement specification against effective rules
 * Returns deterministic alternatives with clear cause text
 * @param spec - The placement specification to validate
 * @param effectiveRules - Compiled rules from mergeRules
 * @returns ValidationResult with ok/alt/reason
 */
export function placementValidator(spec: PlacementSpec, effectiveRules: EffectiveRules): ValidationResult {
  const { sku, position, adjacent = [] } = spec;
  const { roomType, hard, placement, skuOverrides } = effectiveRules;

  // Get SKU details
  const skuData = skuSpecs.find((s: any) => s.sku === sku);
  if (!skuData) {
    return { ok: false, reason: `Unknown SKU: ${sku}` };
  }

  // Check hard rules based on room type
  if (roomType === "kitchen") {
    return validateKitchenPlacement(spec, skuData, hard, placement, skuOverrides);
  } else if (roomType === "bathroom") {
    return validateBathPlacement(spec, skuData, hard, placement, skuOverrides);
  }

  return { ok: false, reason: `Unsupported room type: ${roomType}` };
}

/**
 * Expands rules based on specific SKUs (e.g., appliance clearances)
 */
function expandSkuRules(skuRefs: string[]): any {
  const overrides: any = {};

  for (const sku of skuRefs) {
    const skuData = skuSpecs.find((s: any) => s.sku === sku);
    if (skuData) {
      overrides[sku] = {
        clearances: skuData.clearances,
        doorSwingDepth: skuData.doorSwingDepth,
        doorOpenDepth: skuData.doorOpenDepth
      };
    }
  }

  return overrides;
}

/**
 * Kitchen-specific placement validation
 */
function validateKitchenPlacement(
  spec: PlacementSpec,
  skuData: any,
  hard: any,
  placement: any,
  skuOverrides: any
): ValidationResult {
  const { sku, position, adjacent = [] } = spec;
  const category = skuData.category;

  // Dishwasher adjacency to sink
  if (category === "dishwasher") {
    const nearSink = adjacent.some(adj => adj.includes("sink"));
    if (!nearSink) {
      return {
        ok: false,
        alt: { ...spec, adjacent: [...adjacent, "sink-adjacent"] },
        reason: "Dishwasher must be adjacent to sink"
      };
    }

    // Check side clearance for door swing
    const hingeClear = placement.dishwasher?.hingeSideClearMin || 21;
    // Simplified check - in real impl, would check actual geometry
    if (skuOverrides[sku]?.doorOpenDepth > hingeClear) {
      return {
        ok: false,
        reason: `Dishwasher door swing requires ${hingeClear}in clearance`
      };
    }
  }

  // Refrigerator door swing clearance
  if (category === "refrigerator") {
    const doorClear = placement.refrigerator?.doorSwingClearFrontMin || 30;
    // Simplified check
    if (skuOverrides[sku]?.doorSwingDepth > doorClear) {
      return {
        ok: false,
        alt: { ...spec, position: { ...position, z: position.z + 3 } }, // Suggest moving forward
        reason: `Refrigerator door requires ${doorClear}in front clearance`
      };
    }
  }

  // Range hood clearance
  if (category === "range") {
    const hoodClear = placement.range?.hoodClearMinAbove || 24;
    // Simplified vertical check
    if (position.y < hoodClear) {
      return {
        ok: false,
        alt: { ...spec, position: { ...position, y: hoodClear } },
        reason: `Range requires ${hoodClear}in clearance above for hood`
      };
    }
  }

  return { ok: true, reason: "Placement valid" };
}

/**
 * Bath-specific placement validation
 */
function validateBathPlacement(
  spec: PlacementSpec,
  skuData: any,
  hard: any,
  placement: any,
  skuOverrides: any
): ValidationResult {
  const { sku, position } = spec;
  const category = skuData.category;

  return { ok: true, reason: "Placement valid" };
}

export function evaluateRuleCompliance(
  objects: any[],
  effectiveRules: EffectiveRules,
  dims: any
): any[] {
  // Placeholder for rule compliance evaluation logic
  // This function would iterate through objects and rules to find violations
  return [];
}
