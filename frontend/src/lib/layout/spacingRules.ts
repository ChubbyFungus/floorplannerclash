import { ItemType } from '../../types';
import { inchesToSceneUnits } from '../units';

export type SpacingCategory =
  | 'base'
  | 'base_corner'
  | 'tall'
  | 'upper'
  | 'upper_corner'
  | 'island'
  | 'fridge'
  | 'range'
  | 'dishwasher'
  | 'vent_hood'
  | 'microwave'
  | 'sink'
  | 'generic';

export type LayoutLayer = 'base' | 'upper' | 'island';

export interface SpacingRule {
  minSceneUnits: number;
  note?: string;
}

const ITEM_TYPE_TO_CATEGORY: Record<ItemType, SpacingCategory> = {
  base_cabinet: 'base',
  pantryTall: 'tall',
  upper_cabinet: 'upper',
  kitchen_island: 'island',
  sink: 'sink',
  toilet: 'generic',
  bathtub: 'generic',
  fridge: 'fridge',
  range: 'range',
  vent_hood: 'vent_hood',
  dishwasher: 'dishwasher',
  corner_cabinet_upper: 'upper_corner',
  corner_cabinet_lower: 'base_corner',
  microwave_wall: 'microwave',
};

const ITEM_TYPE_TO_LAYER: Record<ItemType, LayoutLayer> = {
  base_cabinet: 'base',
  pantryTall: 'base',
  corner_cabinet_lower: 'base',
  sink: 'base',
  dishwasher: 'base',
  fridge: 'base',
  range: 'base',
  toilet: 'base',
  bathtub: 'base',
  kitchen_island: 'island',
  upper_cabinet: 'upper',
  corner_cabinet_upper: 'upper',
  microwave_wall: 'upper',
  vent_hood: 'upper',
};

const ruleKey = (...categories: SpacingCategory[]) => categories.sort().join('|');

const CATEGORY_PAIR_RULES = new Map<string, SpacingRule>([
  [ruleKey('base', 'base'), { minSceneUnits: inchesToSceneUnits(1 / 32), note: 'Maintain 1/32" reveal between base cabinets' }],
  [ruleKey('base', 'base_corner'), { minSceneUnits: inchesToSceneUnits(0.75) }],
  [ruleKey('base_corner', 'base_corner'), { minSceneUnits: inchesToSceneUnits(0.75) }],
  [ruleKey('base', 'tall'), { minSceneUnits: inchesToSceneUnits(0.75) }],
  [ruleKey('base', 'fridge'), { minSceneUnits: inchesToSceneUnits(1.5) }],
  [ruleKey('base', 'range'), { minSceneUnits: inchesToSceneUnits(2) }],
  [ruleKey('base', 'dishwasher'), { minSceneUnits: inchesToSceneUnits(0.5) }],
  [ruleKey('base', 'sink'), { minSceneUnits: 0 }],
  [ruleKey('base_corner', 'fridge'), { minSceneUnits: inchesToSceneUnits(1.5) }],
  [ruleKey('base_corner', 'range'), { minSceneUnits: inchesToSceneUnits(2) }],
  [ruleKey('dishwasher', 'fridge'), { minSceneUnits: inchesToSceneUnits(1) }],
  [ruleKey('dishwasher', 'range'), { minSceneUnits: inchesToSceneUnits(1) }],
  [ruleKey('fridge', 'range'), { minSceneUnits: inchesToSceneUnits(2) }],
  [ruleKey('fridge', 'fridge'), { minSceneUnits: inchesToSceneUnits(1) }],
  [ruleKey('range', 'range'), { minSceneUnits: inchesToSceneUnits(1) }],
  [ruleKey('upper', 'upper'), { minSceneUnits: inchesToSceneUnits(0.5) }],
  [ruleKey('upper', 'upper_corner'), { minSceneUnits: inchesToSceneUnits(0.75) }],
  [ruleKey('upper_corner', 'upper_corner'), { minSceneUnits: inchesToSceneUnits(0.75) }],
  [ruleKey('upper', 'microwave'), { minSceneUnits: inchesToSceneUnits(0.5) }],
  [ruleKey('upper', 'vent_hood'), { minSceneUnits: inchesToSceneUnits(2) }],
  [ruleKey('vent_hood', 'microwave'), { minSceneUnits: inchesToSceneUnits(1) }],
  [ruleKey('island', 'island'), { minSceneUnits: inchesToSceneUnits(36) }],
  [ruleKey('island', 'base'), { minSceneUnits: inchesToSceneUnits(42) }],
  [ruleKey('upper', 'fridge'), { minSceneUnits: inchesToSceneUnits(1.5) }],
]);

const DEFAULT_RULE: SpacingRule = { minSceneUnits: inchesToSceneUnits(0.25) };
const DEFAULT_LAYER: LayoutLayer = 'base';
const CROSS_LAYER_CATEGORIES: ReadonlySet<SpacingCategory> = new Set([
  'fridge',
  'tall',
]);

export function getSpacingCategory(type: ItemType): SpacingCategory {
  return ITEM_TYPE_TO_CATEGORY[type] ?? 'generic';
}

export function getSpacingRuleForCategories(a: SpacingCategory, b: SpacingCategory): SpacingRule {
  return CATEGORY_PAIR_RULES.get(ruleKey(a, b)) ?? DEFAULT_RULE;
}

export function getSpacingRule(typeA: ItemType, typeB: ItemType): SpacingRule {
  return getSpacingRuleForCategories(getSpacingCategory(typeA), getSpacingCategory(typeB));
}

export function getLayoutLayer(type: ItemType): LayoutLayer {
  return ITEM_TYPE_TO_LAYER[type] ?? DEFAULT_LAYER;
}

export function shouldShareBetweenLayers(typeA: ItemType, typeB: ItemType): boolean {
  const categoryA = getSpacingCategory(typeA);
  const categoryB = getSpacingCategory(typeB);
  return CROSS_LAYER_CATEGORIES.has(categoryA) || CROSS_LAYER_CATEGORIES.has(categoryB);
}
