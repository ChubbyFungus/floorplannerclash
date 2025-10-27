import {
  parsePlacementCommand,
  type ParseResult,
  type ParsedCommand,
} from '../lib/nlp/DeterministicParser';
import type { RoomType, SceneItem, ItemType, RoomDimensions } from '../types';
import type { OpeningPattern, DoorStyle } from '../components/Cabinet';
import { inchesToSceneUnits } from '../lib/units';
import type { GlbCatalogItem } from '../../catalogData';

type Vector3 = { x: number; y: number; z: number };

type FunctionCall =
  | {
      name: 'addItem';
      args: {
        type: ItemType;
        position: Vector3;
        rotation: Vector3;
        scale: Vector3;
        catalogId?: string;
        widthInches?: number;
        heightInches?: number;
        depthInches?: number;
        openingPattern?: OpeningPattern;
        doorStyle?: DoorStyle;
        category?: string;
      };
    }
  | { name: 'moveItem'; args: { id: number; newPosition: Vector3 } }
  | { name: 'removeItem'; args: { id: number } }
  | { name: 'updateItem'; args: { id: number; properties: Record<string, unknown> } }
  | { name: 'setRoomDimensions'; args: { width?: number; depth?: number } };

const MODEL_ID_TO_ITEM: Partial<Record<string, ItemType>> = {
  fridge_frenchdoor: 'fridge',
  fridge: 'fridge',
  range: 'range',
  stove: 'range',
  cooktop: 'range',
  microwave: 'microwave_wall',
  microwave_wall: 'microwave_wall',
  dishwasher: 'dishwasher',
  dishwasher_ss: 'dishwasher',
  sink_undermount: 'sink',
  sink_base_double_door_false_drawer: 'sink',
  vent_hood: 'vent_hood',
  hood_modern: 'vent_hood',
  base_double_door_two_drawer_24d: 'base_cabinet',
  base_three_drawer_24d: 'base_cabinet',
  base_single_door_24d: 'base_cabinet',
  base_super_susan: 'corner_cabinet_lower',
  wall_double_door_shelves: 'upper_cabinet',
  wall_diagonal_corner_glass: 'corner_cabinet_upper',
  wall_ref_double_door: 'upper_cabinet',
  utility_cabinet_double_door_24d: 'pantryTall',
  utility_cabinet_single_door_24d: 'pantryTall',
  utility_cabinet_24d: 'pantryTall',
  toilet: 'toilet',
  bathtub: 'bathtub',
};

const NAME_KEYWORDS: Array<{ match: RegExp; type: ItemType }> = [
  { match: /fridge|refrigerator|freezer/, type: 'fridge' },
  { match: /range|stove|cooktop|oven/, type: 'range' },
  { match: /sink/, type: 'sink' },
  { match: /dishwasher|dw/, type: 'dishwasher' },
  { match: /hood|vent/, type: 'vent_hood' },
  { match: /microwave/, type: 'microwave_wall' },
  { match: /upper\s+corner/, type: 'corner_cabinet_upper' },
  { match: /corner\s+upper/, type: 'corner_cabinet_upper' },
  { match: /diagonal\s*corner|easy[-\s]*reach/, type: 'corner_cabinet_upper' },
  { match: /corner\s+cabinet/, type: 'corner_cabinet_lower' },
  { match: /corner\s+susan|lazy\s*susan/, type: 'corner_cabinet_lower' },
  { match: /super\s*susan|blind\s*corner/, type: 'corner_cabinet_lower' },
  { match: /upper\s*cabinet|wall\s*cabinet/, type: 'upper_cabinet' },
  { match: /pantry|utility/, type: 'pantryTall' },
  { match: /island/, type: 'kitchen_island' },
  { match: /cabinet/, type: 'base_cabinet' },
  { match: /toilet|wc/, type: 'toilet' },
  { match: /bathtub|tub/, type: 'bathtub' },
];

const DEFAULT_SCALE: Vector3 = { x: 1, y: 1, z: 1 };
const DEFAULT_ROTATION: Vector3 = { x: 0, y: 0, z: 0 };
const DEFAULT_FLOOR_OFFSET = 0;
const RELATIVE_OFFSET = 1.4;

interface WallPlacement {
  position: Vector3;
  rotationY: number;
}

function resolveCornerCabinetType(
  name?: string | null,
  modelId?: string | null
): ItemType | null {
  const normalizedName = name?.toLowerCase() ?? '';
  const normalizedModel = modelId?.toLowerCase() ?? '';
  const haystack = `${normalizedName} ${normalizedModel}`.trim();

  if (!/(corner|susan|easy[-\s]*reach|lazy\s*susan|blind\s*corner)/.test(haystack)) {
    return null;
  }

  if (/super\s*susan|lazy\s*susan|blind\s*corner/.test(haystack)) {
    return 'corner_cabinet_lower';
  }

  if (/easy[-\s]*reach/.test(haystack)) {
    return 'corner_cabinet_upper';
  }

  if (/diagonal/.test(haystack)) {
    return 'corner_cabinet_upper';
  }

  const mentionsUpper = /upper|wall/.test(haystack);
  const mentionsBase = /base/.test(haystack);
  if (mentionsUpper && !mentionsBase) {
    return 'corner_cabinet_upper';
  }
  if (mentionsBase && !mentionsUpper) {
    return 'corner_cabinet_lower';
  }

  return mentionsUpper ? 'corner_cabinet_upper' : 'corner_cabinet_lower';   
}

function resolveItemTypeFromName(name?: string | null): ItemType | null { 
  if (!name) return null;
  const normalized = name.toLowerCase();
  for (const keyword of NAME_KEYWORDS) {
    if (keyword.match.test(normalized)) return keyword.type;
  }
  return null;
}

function resolveItemType(command: ParsedCommand): ItemType | null {
  const modelId = command.item?.modelId?.toLowerCase() ?? '';
  if (modelId && MODEL_ID_TO_ITEM[modelId]) return MODEL_ID_TO_ITEM[modelId] ?? null;

  const cornerType = resolveCornerCabinetType(command.item?.name, command.item?.modelId);
  if (cornerType) return cornerType;

  const byName = resolveItemTypeFromName(command.item?.name);
  if (byName) return byName;

  const byCategory = command.item?.category;
  if (byCategory === 'cabinet') {
    const normalizedName = command.item?.name?.toLowerCase() ?? '';
    const cornerFallback = resolveCornerCabinetType(command.item?.name, command.item?.modelId);
    if (cornerFallback) return cornerFallback;
    if (
      /pantry|utility|tall/.test(normalizedName) ||
      modelId.includes('utility_cabinet') ||
      modelId.includes('pantry')
    ) {
      return 'pantryTall';
    }
    return 'base_cabinet';
  }
  if (byCategory === 'appliance')
    return resolveItemTypeFromName(command.item?.name ?? command.item?.modelId) ?? 'base_cabinet';
  if (byCategory === 'fixture') return 'sink';

  return null;
}

function classifyWall(rawWall?: string | null): 'left' | 'right' | 'front' | 'back' | null {
  if (!rawWall) return null;
  const value = rawWall.toLowerCase();
  if (/left|w1|west/.test(value)) return 'left';
  if (/right|w3|east/.test(value)) return 'right';
  if (/north|back|w2/.test(value)) return 'back';
  if (/south|front|w4/.test(value)) return 'front';
  return null;
}

function resolveAbsoluteOffset(
  wallSide: 'left' | 'right' | 'front' | 'back',
  roomDimensions: RoomDimensions,
  absolute?: string | null
): number {
  if (!absolute) return 0;
  const normalized = absolute.toLowerCase();
  const halfWidth = roomDimensions.width / 2;
  const halfDepth = roomDimensions.depth / 2;

  const computeRange = (halfExtent: number) => {
    const margin = Math.min(1, halfExtent);
    const range = Math.max(halfExtent - margin, 0);
    return { min: -range, max: range };
  };

  if (wallSide === 'left' || wallSide === 'right') {
    const { min, max } = computeRange(halfDepth);
    if (/left|start|begin|back/.test(normalized)) return min;
    if (/right|end|finish|front/.test(normalized)) return max;
    if (/center|middle/.test(normalized)) return 0;
  } else {
    const { min, max } = computeRange(halfWidth);
    if (/left|start|west/.test(normalized)) return min;
    if (/right|end|east/.test(normalized)) return max;
    if (/center|middle/.test(normalized)) return 0;
  }
  return 0;
}

function resolveWallPlacement(
  command: ParsedCommand,
  roomDimensions: RoomDimensions
): { position: Vector3; rotation: Vector3 } | null {
  const wallSide = classifyWall(command.position?.wall);
  if (!wallSide) return null;

  const halfWidth = roomDimensions.width / 2;
  const halfDepth = roomDimensions.depth / 2;
  const insetX = Math.min(0.5, halfWidth);
  const insetZ = Math.min(0.5, halfDepth);

  const basePosition: Record<'left' | 'right' | 'front' | 'back', WallPlacement> = {
    left: { position: { x: -halfWidth + insetX, y: DEFAULT_FLOOR_OFFSET, z: 0 }, rotationY: Math.PI / 2 },
    right: { position: { x: halfWidth - insetX, y: DEFAULT_FLOOR_OFFSET, z: 0 }, rotationY: -Math.PI / 2 },
    back: { position: { x: 0, y: DEFAULT_FLOOR_OFFSET, z: -halfDepth + insetZ }, rotationY: 0 },
    front: { position: { x: 0, y: DEFAULT_FLOOR_OFFSET, z: halfDepth - insetZ }, rotationY: Math.PI },
  };

  const preset = basePosition[wallSide];
  const position: Vector3 = { ...preset.position };
  const rotation: Vector3 = { ...DEFAULT_ROTATION, y: preset.rotationY };

  const offset = resolveAbsoluteOffset(wallSide, roomDimensions, command.position?.absolutePosition);
  if (wallSide === 'left' || wallSide === 'right') {
    position.z = offset;
  } else {
    position.x = offset;
  }

  return { position, rotation };
}

function findReferenceItem(reference: string | undefined, items: SceneItem[]): SceneItem | null {
  if (!reference) return null;
  const referenceType = resolveItemTypeFromName(reference);
  if (!referenceType) return null;
  const matching = items.filter(item => item.type === referenceType);
  if (!matching.length) return null;
  return matching[matching.length - 1];
}

function offsetFromReference(
  reference: SceneItem,
  relation: ParsedCommand['position']['relativePosition']
): Vector3 {
  const [x, y, z] = reference.position;
  switch (relation) {
    case 'left':
      return { x: x - RELATIVE_OFFSET, y, z };
    case 'right':
      return { x: x + RELATIVE_OFFSET, y, z };
    case 'above':
      return { x, y: y + RELATIVE_OFFSET, z };
    case 'below':
      return { x, y: Math.max(DEFAULT_FLOOR_OFFSET, y - RELATIVE_OFFSET), z };
    default:
      return { x: x + RELATIVE_OFFSET, y, z };
  }
}

function positionFromSelected(selected: [number, number, number] | null): Vector3 | null {
  if (!selected) return null;
  return { x: selected[0], y: selected[1], z: selected[2] };
}

function fallbackGridPlacement(existing: SceneItem[], roomDimensions: RoomDimensions): Vector3 {
  const index = existing.length;
  const columns = 4;
  const spacing = 2.2;
  const row = Math.floor(index / columns);
  const col = index % columns;
  const baseX = -3 + col * spacing;
  const baseZ = -3 + row * spacing;
  const halfWidth = roomDimensions.width / 2;
  const halfDepth = roomDimensions.depth / 2;
  const clampToRange = (value: number, halfExtent: number) => {
    const margin = Math.min(1, halfExtent);
    const min = -halfExtent + margin;
    const max = halfExtent - margin;
    if (min > max) return 0;
    return Math.min(max, Math.max(min, value));
  };
  return {
    x: clampToRange(baseX, halfWidth),
    y: DEFAULT_FLOOR_OFFSET,
    z: clampToRange(baseZ, halfDepth),
  };
}

function createAddItemCall(
  command: ParsedCommand,
  items: SceneItem[],
  selectedPosition: [number, number, number] | null,
  roomDimensions: RoomDimensions
): FunctionCall | null {
  const type = resolveItemType(command);
  if (!type) return null;

  let rotation: Vector3 = { ...DEFAULT_ROTATION };
  let position = positionFromSelected(selectedPosition);

  console.debug('[geminiService] resolveItemType', {
    resolvedType: type,
    modelId: command.item?.modelId,
    name: command.item?.name,
    category: command.item?.category,
  });

  if (!position && command.position?.relativeTo) {
    const referenceItem = findReferenceItem(command.position.relativeTo, items);
    if (referenceItem) {
      rotation = { ...rotation };
      position = offsetFromReference(referenceItem, command.position.relativePosition);
    }
  }

  if (!position) {
    const wallPlacement = resolveWallPlacement(command, roomDimensions);
    if (wallPlacement) {
      position = wallPlacement.position;
      rotation = wallPlacement.rotation;
    }
  }

  if (!position) {
    position = fallbackGridPlacement(items, roomDimensions);
  }

  const rawCatalog = command.item?.raw as (Partial<GlbCatalogItem> & {
    widthIn?: number;
    inferred?: { width: number; depth: number; height: number };
  }) | undefined;

  const rawWidth =
    command.item?.raw && typeof (command.item.raw as { widthIn?: unknown }).widthIn === 'number'
      ? (command.item.raw as { widthIn: number }).widthIn
      : undefined;
  const widthInches =
    command.item?.dimensions?.width ??
    rawCatalog?.width_in ??
    rawCatalog?.inferred?.width ??
    rawWidth;
  const depthInches =
    command.item?.dimensions?.depth ??
    rawCatalog?.depth_in ??
    rawCatalog?.inferred?.depth;
  const heightInches =
    command.item?.dimensions?.height ??
    rawCatalog?.height_in ??
    rawCatalog?.inferred?.height;

  let catalogId: string | undefined = rawCatalog?.id ?? command.item?.modelId ?? undefined;
  if (type === 'base_cabinet' && !catalogId) {
    if (typeof widthInches === 'number') {
      catalogId = widthInches < 24 ? 'base_single_door_24d' : 'base_double_door_two_drawer_24d';
    } else if (!catalogId) {
      catalogId = 'base_double_door_two_drawer_24d';
    }
  }

  return {
    name: 'addItem',
    args: {
      type,
      position,
      rotation,
      scale: DEFAULT_SCALE,
      catalogId,
      widthInches,
      heightInches,
      depthInches,
      openingPattern: command.item?.openingPattern as OpeningPattern | undefined,
      doorStyle: command.item?.doorStyle as DoorStyle | undefined,
      category: command.item?.category,
    },
  };
}

function convertCommandsToFunctionCalls(
  parseResult: ParseResult,
  items: SceneItem[],
  selectedPosition: [number, number, number] | null,
  roomDimensions: RoomDimensions
): FunctionCall[] {
  const calls: FunctionCall[] = [];
  for (const command of parseResult.commands) {
    const isRoomStructure =
      command.structure?.type === 'room' ||
      command.item?.category === 'room' ||
      command.item?.modelId?.toLowerCase() === 'room';

    if (isRoomStructure) {
      const widthInches =
        command.structure?.widthInches ?? command.item?.dimensions?.width ?? null;
      const depthInches =
        command.structure?.depthInches ?? command.item?.dimensions?.depth ?? null;

      if (widthInches !== null || depthInches !== null) {
        calls.push({
          name: 'setRoomDimensions',
          args: {
            width: widthInches !== null ? inchesToSceneUnits(widthInches) : undefined,
            depth: depthInches !== null ? inchesToSceneUnits(depthInches) : undefined,
          },
        });
      }
      continue;
    }

    if (command.type === 'ADD_ITEM' || command.type === 'ADD_OBJECT') {
      const addCall = createAddItemCall(command, items, selectedPosition, roomDimensions);
      if (addCall) calls.push(addCall);
    }
  }
  return calls;
}

export const processCommand = async (
  command: string,
  _roomType: RoomType,
  items: SceneItem[],
  selectedPosition: [number, number, number] | null,
  roomDimensions: RoomDimensions
): Promise<FunctionCall[]> => {
  const trimmed = command.trim();
  if (!trimmed) return [];

  const parseResult = parsePlacementCommand(trimmed);
  if (!parseResult.commands.length) {
    return [];
  }

  return convertCommandsToFunctionCalls(parseResult, items, selectedPosition, roomDimensions);
};

export type { FunctionCall };
