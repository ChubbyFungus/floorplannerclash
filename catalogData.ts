// Catalog integrated with root skuSpecs.json
// This provides GLB model paths and catalog resolution for the root SKU system

import skuSpecs from './catalog/skuSpecs.json';

export type GlbCatalogItem = {
  id: string
  name: string
  category: string
  modelPath?: string
  thumbnail?: string
  scale?: number
  // Optional standard dimensions (inches)
  width_in?: number
  height_in?: number
  depth_in?: number
}

// Convert skuSpecs to GLB catalog format
export const GLB_CATALOG: GlbCatalogItem[] = (skuSpecs as any[]).map(spec => ({
  id: spec.sku,
  name: spec.sku.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  category: spec.category,
  modelPath: spec.modelPath,
  width_in: spec.dims?.w,
  height_in: spec.dims?.h,
  depth_in: spec.dims?.d,
  scale: spec.scale
}))

// Legacy catalog items for cabinets (procedural TSX components)
const LEGACY_CABINET_CATALOG: GlbCatalogItem[] = [
  // Base cabinets (procedural)
  { id: 'base_double_door_two_drawer_24d', name: 'Base Cabinet Double Door Two Drawer 24D', category: 'cabinet', width_in: 24, height_in: 34.5, depth_in: 24 },
  { id: 'base_single_door_24d',            name: 'Base Cabinet Single Door 24D',           category: 'cabinet', width_in: 18, height_in: 34.5, depth_in: 24 },
  { id: 'base_three_drawer_24d',           name: 'Base Cabinet Three Drawer 24D',           category: 'cabinet', width_in: 24, height_in: 34.5, depth_in: 24 },
  { id: 'base_wastebasket_24d',            name: 'Base Cabinet Wastebasket 24D',            category: 'cabinet' },
  { id: 'base_super_susan',                 name: 'Base Cabinet Super Susan',                category: 'cabinet', width_in: 35.5865, height_in: 34.5, depth_in: 35.7369 },

  // Sink base + sinks
  { id: 'sink_base_double_door_false_drawer', name: 'Sink Base Cabinet Double Door False Drawer', category: 'cabinet', width_in: 33, height_in: 34.5, depth_in: 24 },

  // Tall cabinets
  { id: 'utility_cabinet_24d', name: 'Utility Cabinet 24D', category: 'cabinet' },
  { id: 'utility_cabinet_12d', name: 'Utility Cabinet 12D', category: 'cabinet' },
  { id: 'oven_cabinet_24d',    name: 'Oven Cabinet 24D',    category: 'cabinet' },

  // Wall (upper) cabinets
  { id: 'wall_double_door_shelves',           name: 'Wall Cabinet Double Door Shelves',      category: 'cabinet', width_in: 30, height_in: 30, depth_in: 12 },
  { id: 'wall_diagonal_corner_glass',         name: 'Wall Diagonal Corner Door Glass',       category: 'cabinet', width_in: 24, height_in: 36, depth_in: 24 },
  { id: 'wall_ref_double_door',               name: 'Wall Refrigerator Double Door',         category: 'cabinet' },
  { id: 'wall_ref_two_butt_door',             name: 'Wall Refrigerator Two Butt Door',       category: 'cabinet' },
  { id: 'wall_cabinet_18h_12d',               name: 'Wall Cabinet 18 High 12 Deep',          category: 'cabinet' },
  { id: 'wall_cabinet_21h_12d',               name: 'Wall Cabinet 21 High 12 Deep',          category: 'cabinet' },
  { id: 'wall_cabinet_easy_reach_12d',        name: 'Wall Cabinet Easy Reach 12 Deep',       category: 'cabinet' },
  { id: 'wall_cabinet_single_door_shelves',   name: 'Wall Cabinet Single Door Shelves',      category: 'cabinet' },
  { id: 'wall_cabinet_doors_prepped_glass',   name: 'Wall Cabinet Doors Prepped for Glass',  category: 'cabinet' },
  { id: 'casework-base-run', name: 'Casework Base Run', category: 'cabinet', width_in: 30, height_in: 34.5, depth_in: 24 },
  { id: 'casework-wall-run', name: 'Casework Wall Run', category: 'cabinet', width_in: 30, height_in: 30, depth_in: 12 },
]

// Combined catalog
const FULL_CATALOG = [...GLB_CATALOG, ...LEGACY_CABINET_CATALOG]

// Catalog resolution functions
export function resolveCatalogForObject(params: { name?: string; id?: string; catalogId?: string; type?: string; objectType?: string }): { id: string; name: string; category: string; modelPath?: string; width_in?: number; height_in?: number; depth_in?: number; scale?: number } | null {
  const { name, id, catalogId, type, objectType } = params;

  // Try different lookup strategies
  let item = null;

  // Direct ID lookup
  if (id) {
    item = FULL_CATALOG.find(item => item.id === id);
  }

  // Catalog ID lookup
  if (!item && catalogId) {
    item = FULL_CATALOG.find(item => item.id === catalogId);
  }

  // Name lookup (case insensitive)
  if (!item && name) {
    item = FULL_CATALOG.find(item =>
      item.name.toLowerCase().includes(name.toLowerCase()) ||
      item.id.toLowerCase().includes(name.toLowerCase())
    );
  }

  // Type/ObjectType lookup
  if (!item && (type || objectType)) {
    const searchType = type || objectType;

    // First try to map the type to a specific catalog ID
    const mappedId = TYPE_TO_ID.get(searchType);
    if (mappedId) {
      item = FULL_CATALOG.find(item => item.id === mappedId);
    }

    // If not found by mapped ID, try category-based lookup
    if (!item) {
      item = FULL_CATALOG.find(item => item.category === searchType);
    }
  }

  return item ? {
    id: item.id,
    name: item.name,
    category: item.category,
    modelPath: item.modelPath,
    width_in: item.width_in,
    height_in: item.height_in,
    depth_in: item.depth_in,
    scale: item.scale
  } : null;
}

export function resolveWizardKey(input: string, category: string, widthIn?: number): { id: string; name: string } | null {
  const normalized = input.toLowerCase();

  // For base cabinets, find the closest match by width
  if (category === 'base') {
    const baseItems = FULL_CATALOG.filter(item => item.category === 'cabinet' && item.id.includes('base'));

    if (widthIn) {
      // Find item with closest width
      let closest = baseItems[0];
      let minDiff = Math.abs((closest?.width_in || 24) - widthIn);

      for (const item of baseItems) {
        const diff = Math.abs((item.width_in || 24) - widthIn);
        if (diff < minDiff) {
          minDiff = diff;
          closest = item;
        }
      }
      return closest ? { id: closest.id, name: closest.name } : null;
    } else {
      // Return default base cabinet
      return baseItems.length > 0 ? { id: baseItems[0].id, name: baseItems[0].name } : null;
    }
  }

  // For upper cabinets
  if (category === 'upper') {
    const upperItems = FULL_CATALOG.filter(item => item.category === 'cabinet' && item.id.includes('wall'));
    return upperItems.length > 0 ? { id: upperItems[0].id, name: upperItems[0].name } : null;
  }

  // For tall cabinets
  if (category === 'tall') {
    const tallItems = FULL_CATALOG.filter(item => item.category === 'cabinet' && (item.id.includes('utility') || item.id.includes('oven')));
    return tallItems.length > 0 ? { id: tallItems[0].id, name: tallItems[0].name } : null;
  }

  return null;
}

// Type mappings
export const TYPE_TO_ID = new Map([
  ['base', 'base_double_door_two_drawer_24d'],
  ['base_cabinet', 'base_double_door_two_drawer_24d'],
  ['upper', 'wall_double_door_shelves'],
  ['upper_cabinet', 'wall_double_door_shelves'],
  ['tall', 'utility_cabinet_24d'],
  ['pantry', 'utility_cabinet_24d'],
  ['corner', 'base_super_susan'],
  ['corner_cabinet_lower', 'base_super_susan'],
  ['corner_cabinet_upper', 'wall_diagonal_corner_glass'],
  ['fridge', 'gen-fridge-36-french'],
  ['refrigerator', 'gen-fridge-36-french'],
  ['range', 'gen-range-30-gas'],
  ['stove', 'gen-range-30-gas'],
  ['oven', 'gen-range-30-gas'],
  ['dishwasher', 'gen-dishwasher-24'],
  ['sink', 'fixture-sink-undermount-33'],
  ['vent_hood', 'vent-hood-36'],
  ['hood', 'vent-hood-36'],
  ['microwave', 'microwave-24'],
  ['microwave_wall', 'microwave-24'],
  ['toilet', 'toilet'],
  ['bathtub', 'bathtub'],
  ['kitchen_island', 'kitchen_island'],
])
