// Catalog mapped directly to public '/models' assets.
// This replaces any ad-hoc names with the exact filenames under apps/frontend/public/models.

export type GlbCatalogItem = {
  id: string
  name: string
  category: string
  modelPath: string
  thumbnail?: string
  scale?: number
  // Optional standard dimensions (inches)
  width_in?: number
  height_in?: number
  depth_in?: number
}

export const GLB_CATALOG: GlbCatalogItem[] = [
  // Appliances
  { id: 'fridge_frenchdoor', name: 'Refrigerator 36in French Door', category: 'appliance', modelPath: '/models/Appliances/Refrigerator_36in_SubZero_36in_RefrigeratorFrenchDoor_BI-36UFD-S-PH_3ds_Stainless_ProHandle_scaled_final.glb', width_in: 36, height_in: 70, depth_in: 30 },
  { id: 'range',             name: 'Range 30in',                      category: 'appliance', modelPath: '/models/Appliances/Range_30in_Wolf_30in_Range_GR304_3ds_scaled_final.glb', width_in: 30, height_in: 36, depth_in: 28 },
  { id: 'range_36',          name: 'Range 36in',                      category: 'appliance', modelPath: '/models/Appliances/Range_36in_Wolf_36in_Range_GR366_3ds_scaled_final.glb', width_in: 36, height_in: 36, depth_in: 28 },
  { id: 'dishwasher',        name: 'Dishwasher',                      category: 'appliance', modelPath: '/models/Appliances/Dishwasher.glb', width_in: 24, height_in: 34, depth_in: 24 },
  { id: 'vent_hood',         name: 'Hood Vent 36in',                  category: 'appliance', modelPath: '/models/Appliances/Hoodvent_36in.glb' },
  { id: 'microwave',         name: 'Microwave 24in',                  category: 'appliance', modelPath: '/models/Appliances/Microwave_24in.glb' },
  { id: 'microwave_drawer',  name: 'Microwave Drawer 30in',           category: 'appliance', modelPath: '/models/Appliances/MicrowaveDrawer_Wolf_30in_MicrowaveDrawer_MDD30PM-S-PH_Stainless_ProHandle_scaled_final.glb' },
  { id: 'cooktop_gas_30',    name: 'Cooktop Gas 30in',                category: 'appliance', modelPath: '/models/Appliances/CooktopGas_30in_Wolf_30in_CooktopGas_CG304P-S_3ds_Stainless_scaled_final.glb' },
  { id: 'wall_oven_single',  name: 'Wall Oven Single 30in',           category: 'appliance', modelPath: '/models/Appliances/WallOvenSingle_30in_Appliance_30in_Appliance_CSO30PM-S-PH_3ds_Stainless_ProHandle_scaled_final.glb' },
  { id: 'wall_oven_double',  name: 'Wall Oven Double 30in',           category: 'appliance', modelPath: '/models/Appliances/WallOvenDouble_30in_Wolf_30in_WallOvenDouble_DO30PM-S-PH_3ds_Stainless_ProHandle_scaled_final.glb' },
  { id: 'wine_fridge_24',    name: 'Wine Fridge 24in Undercounter',   category: 'appliance', modelPath: '/models/Appliances/Wine_24in_UnderCounter_SubZero_24in_Refrigeration_424G-S-PH-LH_3ds_Stainless_ProHandle_LH_scaled_final.glb' },

  // Base cabinets
  { id: 'base_double_door_two_drawer_24d', name: 'Base Cabinet Double Door Two Drawer 24D', category: 'cabinet', modelPath: '/models/Cabinets/Base_Cabinets/Base-Cabinet-Double-Door-Two-Drawer-24-Deep.std.glb', width_in: 24, height_in: 34.5, depth_in: 24 },
  { id: 'base_single_door_24d',            name: 'Base Cabinet Single Door 24D',           category: 'cabinet', modelPath: '/models/Cabinets/Base_Cabinets/Base-Cabinet-Single-Door-One-Drawer-24-Deep (1).std.glb', width_in: 18, height_in: 34.5, depth_in: 24 },
  { id: 'base_three_drawer_24d',           name: 'Base Cabinet Three Drawer 24D',           category: 'cabinet', modelPath: '/models/Cabinets/Base_Cabinets/Universal-Design-Base-Cabinet-Three-Drawer-24-Deep.std.glb', width_in: 24, height_in: 34.5, depth_in: 24 },
  { id: 'base_wastebasket_24d',            name: 'Base Cabinet Wastebasket 24D',            category: 'cabinet', modelPath: '/models/Cabinets/Base_Cabinets/Base-Cabinet-Wastebasket-24-Deep.std.glb' },
  { id: 'base_super_susan',                 name: 'Base Cabinet Super Susan',                category: 'cabinet', modelPath: '/models/Cabinets/Base_Cabinets/Base-Cabinet-Super-Susan.std.glb' },

  // Sink base + sinks
  { id: 'sink_base_double_door_false_drawer', name: 'Sink Base Cabinet Double Door False Drawer', category: 'cabinet', modelPath: '/models/Cabinets/Sink_Cabinets/Sink-Base-Cabinet-Double-Door-False-Drawer.std.glb', width_in: 33, height_in: 34.5, depth_in: 24 },
  { id: 'sink_undermount',                   name: 'Sink Undermount',                         category: 'fixture', modelPath: '/models/Sinks/Sink-Undermount-Kitchen-KOHLER-Buckley-K-28901.std.glb', width_in: 30, height_in: 8, depth_in: 22 },
  { id: 'sink_farmhouse',                    name: 'Sink Farmhouse',                          category: 'fixture', modelPath: '/models/Sinks/Sanitary_Basins-Sinks_Abi_Belfast-Farmhouse.std.glb', width_in: 33, height_in: 10, depth_in: 22 },

  // Tall cabinets
  { id: 'utility_cabinet_24d', name: 'Utility Cabinet 24D', category: 'cabinet', modelPath: '/models/Cabinets/Tall_Cabinets/Utility-Cabinet-24-Deep.std.glb' },
  { id: 'utility_cabinet_12d', name: 'Utility Cabinet 12D', category: 'cabinet', modelPath: '/models/Cabinets/Tall_Cabinets/Utility-Cabinet-12-Deep.std.glb' },
  { id: 'oven_cabinet_24d',    name: 'Oven Cabinet 24D',    category: 'cabinet', modelPath: '/models/Cabinets/Tall_Cabinets/Oven-Cabinet-24-Deep.std.glb' },

  // Wall (upper) cabinets
  { id: 'wall_double_door_shelves',           name: 'Wall Cabinet Double Door Shelves',      category: 'cabinet', modelPath: '/models/Cabinets/Wall_Cabinets/WHP-Wall-Cabinet-Double-Door-Shelves.std.glb', width_in: 30, height_in: 30, depth_in: 12 },
  { id: 'wall_diagonal_corner_glass',         name: 'Wall Diagonal Corner Door Glass',       category: 'cabinet', modelPath: '/models/Cabinets/Wall_Cabinets/WHP-Wall-Diagonal-Corner-Door-Prepped-Glass.std.glb' },
  { id: 'wall_ref_double_door',               name: 'Wall Refrigerator Double Door',         category: 'cabinet', modelPath: '/models/Cabinets/Wall_Cabinets/WHP-Wall-Refrigerator-Double-Door.std.glb' },
  { id: 'wall_ref_two_butt_door',             name: 'Wall Refrigerator Two Butt Door',       category: 'cabinet', modelPath: '/models/Cabinets/Wall_Cabinets/WHP-Wall-Refrigerator-Two-Butt-Door.std.glb' },
  { id: 'wall_cabinet_18h_12d',               name: 'Wall Cabinet 18 High 12 Deep',          category: 'cabinet', modelPath: '/models/Cabinets/Wall_Cabinets/Wall-Cabinet-18-High-12-Deep.std.glb' },
  { id: 'wall_cabinet_21h_12d',               name: 'Wall Cabinet 21 High 12 Deep',          category: 'cabinet', modelPath: '/models/Cabinets/Wall_Cabinets/Wall-Cabinet-21-High-12-Deep.std.glb' },
  { id: 'wall_cabinet_easy_reach_12d',        name: 'Wall Cabinet Easy Reach 12 Deep',       category: 'cabinet', modelPath: '/models/Cabinets/Wall_Cabinets/Wall-Cabinet-Easy-Reach-12-Deep.std.glb' },
  { id: 'wall_cabinet_single_door_shelves',   name: 'Wall Cabinet Single Door Shelves',      category: 'cabinet', modelPath: '/models/Cabinets/Wall_Cabinets/Wall-Cabinet-Single-Door-with-Shelves.std.glb' },
  { id: 'wall_cabinet_doors_prepped_glass',   name: 'Wall Cabinet Doors Prepped for Glass',  category: 'cabinet', modelPath: '/models/Cabinets/Wall_Cabinets/Wall-Cabinet-with-Doors-Prepped-for-Glass.std.glb' },

  // Shelves / Misc
  { id: 'floating_shelves_aksel', name: 'Aksel Wood Floating Shelves', category: 'shelf', modelPath: '/models/Shelves/Aksel-Wood-Floating-Shelves.std.glb' },
]