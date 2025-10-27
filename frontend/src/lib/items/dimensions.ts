import { resolveCatalogForObject } from '../../../catalogData';
import { ItemType } from '../../types';
import { inchesToSceneUnits } from '../units';

export type SceneDimensions = { width: number; depth: number; height: number };

export const ITEM_DIMENSION_FALLBACKS_INCHES: Partial<
  Record<ItemType, { width: number; depth: number; height: number }>
> = {
  base_cabinet: { width: 24, depth: 24, height: 34.5 },
  upper_cabinet: { width: 30, depth: 12, height: 30 },
  kitchen_island: { width: 60, depth: 36, height: 36 },
  sink: { width: 30, depth: 22, height: 8 },
  toilet: { width: 18, depth: 28, height: 28 },
  bathtub: { width: 32, depth: 60, height: 20 },
  fridge: { width: 36, depth: 30, height: 70 },
  range: { width: 30, depth: 28, height: 36 },
  vent_hood: { width: 36, depth: 24, height: 12 },
  dishwasher: { width: 24, depth: 24, height: 34 },
  corner_cabinet_lower: { width: 35.5865, depth: 35.7369, height: 34.5 },
  corner_cabinet_upper: { width: 24, depth: 24, height: 36 },
  microwave_wall: { width: 30, depth: 18, height: 18 },
};

type CatalogResolver = (value: ItemType) => ReturnType<typeof resolveCatalogForObject> | null;

const resolveById: CatalogResolver = (value) => resolveCatalogForObject({ id: value }) || null;
const resolveByName: CatalogResolver = (value) => resolveCatalogForObject({ name: value }) || null;
const resolveByType: CatalogResolver = (value) => resolveCatalogForObject({ type: value }) || null;

const catalogLookupOrder: CatalogResolver[] = [resolveById, resolveByName, resolveByType];

export function resolveCatalogItem(type: ItemType) {
  for (const resolver of catalogLookupOrder) {
    const item = resolver(type);
    if (item) return item;
  }
  return null;
}

export function getItemSceneDimensions(type: ItemType): SceneDimensions {
  const catalogItem = resolveCatalogItem(type);
  const fallback = ITEM_DIMENSION_FALLBACKS_INCHES[type];

  const width =
    (typeof catalogItem?.width_in === 'number' ? inchesToSceneUnits(catalogItem.width_in) : undefined) ??
    (fallback ? inchesToSceneUnits(fallback.width) : 1);
  const depth =
    (typeof catalogItem?.depth_in === 'number' ? inchesToSceneUnits(catalogItem.depth_in) : undefined) ??
    (fallback ? inchesToSceneUnits(fallback.depth) : 1);
  const height =
    (typeof catalogItem?.height_in === 'number' ? inchesToSceneUnits(catalogItem.height_in) : undefined) ??
    (fallback ? inchesToSceneUnits(fallback.height) : 1);

  return { width, depth, height };
}

export function scaleDimensions(dimensions: SceneDimensions, scale: [number, number, number]): SceneDimensions {
  return {
    width: dimensions.width * (scale[0] ?? 1),
    depth: dimensions.depth * (scale[2] ?? 1),
    height: dimensions.height * (scale[1] ?? 1),
  };
}
