import { SceneItem, RoomDimensions } from '../../types';
import { SceneDimensions, getItemSceneDimensions, scaleDimensions } from '../items/dimensions';
import { getLayoutLayer, getSpacingRule, shouldShareBetweenLayers, getSpacingCategory } from './spacingRules';
import { inchesToSceneUnits } from '../units';

const isSpacingSolverDebugEnabled = process.env.NODE_ENV !== 'production';
const debugSpacingSolver = (label: string, payload: Record<string, unknown>) => {
  if (!isSpacingSolverDebugEnabled) return;
  let formatted: unknown = payload;
  try {
    formatted = JSON.stringify(payload, null, 2);
  } catch {
    // keep payload as-is if serialization fails
  }
  console.debug(
    `[spacing-solver][apps/frontend/src/lib/layout/spacingSolver.ts] ${label}`,
    formatted
  );
};

const summarizeVector = (value: [number, number, number]) =>
  value.map((entry) => Number(entry.toFixed(4))) as [number, number, number];

const summarizeEntry = (entry: WallRunEntry) => ({
  id: entry.id,
  type: entry.type,
  wall: entry.wall,
  axis: entry.axis,
  center: Number(entry.center.toFixed(4)),
  axisSize: Number(entry.axisSize.toFixed(4)),
  halfExtent: Number(entry.halfExtent.toFixed(4)),
  otherAxisPosition: Number(entry.otherAxisPosition.toFixed(4)),
  basePosition: summarizeVector(entry.basePosition),
  layer: entry.layer,
});

const summarizeAdjustment = (adjustment: SpacingAdjustment) => ({
  id: adjustment.id,
  position: summarizeVector(adjustment.position),
});

export interface ItemMetrics extends SceneDimensions {}

export type ItemMetricsMap = Map<number, ItemMetrics>;

export interface SpacingAdjustment {
  id: number;
  position: [number, number, number];
}

type WallId = 'left' | 'right' | 'front' | 'back';

interface WallBinding {
  wall: WallId;
  axis: 'x' | 'z';
}

interface WallRunEntry {
  id: number;
  type: SceneItem['type'];
  axis: 'x' | 'z';
  wall: WallId;
  center: number;
  axisSize: number;
  halfExtent: number;
  otherAxisPosition: number;
  basePosition: [number, number, number];
  layer: ReturnType<typeof getLayoutLayer>;
}

const AXIS_INDEX: Record<'x' | 'z', 0 | 2> = { x: 0, z: 2 };
const QUARTER_TURN = Math.PI / 2;
const WALL_TOLERANCE = 0.5; // ~12 inches
const SNAP_TOLERANCE = inchesToSceneUnits(2);
const EPSILON = 1e-4;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeQuarterTurns = (radians: number): number => {
  const turns = Math.round(radians / QUARTER_TURN);
  const normalized = ((turns % 4) + 4) % 4;
  return normalized;
};

const getOrientedDimensions = (dims: SceneDimensions, quarterTurns: number): SceneDimensions => {
  const isSwapped = quarterTurns % 2 !== 0;
  return isSwapped
    ? { width: dims.depth, depth: dims.width, height: dims.height }
    : dims;
};

const resolveMetrics = (
  item: SceneItem,
  metricsById: ItemMetricsMap | undefined
): SceneDimensions => {
  const metric = metricsById?.get(item.id);
  if (metric) return metric;
  const baseDimensions = getItemSceneDimensions(item.type);
  return scaleDimensions(baseDimensions, item.scale);
};

const detectWall = (
  position: [number, number, number],
  dims: SceneDimensions,
  room: RoomDimensions
): WallBinding | null => {
  const halfWidth = room.width / 2;
  const halfDepth = room.depth / 2;

  const minX = position[0] - dims.width / 2;
  const maxX = position[0] + dims.width / 2;
  const minZ = position[2] - dims.depth / 2;
  const maxZ = position[2] + dims.depth / 2;

  const distances: Array<{ wall: WallId; axis: 'x' | 'z'; delta: number }> = [
    { wall: 'left', axis: 'z', delta: Math.abs(minX - -halfWidth) },
    { wall: 'right', axis: 'z', delta: Math.abs(maxX - halfWidth) },
    { wall: 'back', axis: 'x', delta: Math.abs(minZ - -halfDepth) },
    { wall: 'front', axis: 'x', delta: Math.abs(maxZ - halfDepth) },
  ];

  const closest = distances.reduce((prev, current) =>
    current.delta < prev.delta ? current : prev
  );

  if (closest.delta > WALL_TOLERANCE) return null;

  return { wall: closest.wall, axis: closest.axis };
};

const computeAxisBounds = (center: number, halfExtent: number) => ({
  start: center - halfExtent,
  end: center + halfExtent,
});

const getAxisLimits = (axis: 'x' | 'z', axisSize: number, room: RoomDimensions) => {
  if (axis === 'x') {
    const halfRoom = room.width / 2;
    return {
      min: -halfRoom + axisSize / 2,
      max: halfRoom - axisSize / 2,
    };
  }
  const halfRoom = room.depth / 2;
  return {
    min: -halfRoom + axisSize / 2,
    max: halfRoom - axisSize / 2,
  };
};

const prepareRunEntry = (
  item: SceneItem,
  position: [number, number, number],
  metricsById: ItemMetricsMap | undefined,
  room: RoomDimensions
): WallRunEntry | null => {
  const dims = resolveMetrics(item, metricsById);
  const quarterTurns = normalizeQuarterTurns(item.rotation[1]);
  const oriented = getOrientedDimensions(dims, quarterTurns);
  const binding = detectWall(position, oriented, room);
  if (!binding) {
    debugSpacingSolver('prepare-entry.unbound', {
      itemId: item.id,
      itemType: item.type,
      position: summarizeVector(position),
      quarterTurns,
    });
    return null;
  }

  const axisIndex = AXIS_INDEX[binding.axis];
  const axisSize = binding.axis === 'x' ? oriented.width : oriented.depth;
  const halfExtent = axisSize / 2;

  const entry: WallRunEntry = {
    id: item.id,
    type: item.type,
    axis: binding.axis,
    wall: binding.wall,
    center: position[axisIndex],
    axisSize,
    halfExtent,
    otherAxisPosition: binding.axis === 'x' ? position[2] : position[0],
    basePosition: [...position],
    layer: getLayoutLayer(item.type),
  };
  debugSpacingSolver('prepare-entry.bound', summarizeEntry(entry));
  return entry;
};

const sortRunEntries = (entries: WallRunEntry[]) =>
  [...entries].sort((a, b) => a.center - b.center);

const applyDeltaToFollowing = (
  entries: WallRunEntry[],
  startIndex: number,
  delta: number
) => {
  for (let i = startIndex; i < entries.length; i += 1) {
    entries[i].center += delta;
  }
};

const collectAdjustments = (
  entries: WallRunEntry[],
  axis: 'x' | 'z',
  room: RoomDimensions
): SpacingAdjustment[] => {
  const adjustments: SpacingAdjustment[] = [];
  const axisIndex = AXIS_INDEX[axis];

  for (const entry of entries) {
    const { min, max } = getAxisLimits(axis, entry.axisSize, room);
    const clampedCenter = clamp(entry.center, min, max);
    if (Math.abs(clampedCenter - entry.center) > EPSILON) {
      entry.center = clampedCenter;
    }

    if (Math.abs(entry.center - entry.basePosition[axisIndex]) <= EPSILON) continue;
    const updated = [...entry.basePosition] as [number, number, number];
    updated[axisIndex] = entry.center;
    adjustments.push({ id: entry.id, position: updated });
  }

  return adjustments;
};

export const computeSpacingAdjustments = ({
  movedItemId,
  proposedPosition,
  items,
  metricsById,
  roomDimensions,
}: {
  movedItemId: number;
  proposedPosition: [number, number, number];
  items: SceneItem[];
  metricsById?: ItemMetricsMap;
  roomDimensions: RoomDimensions;
}): SpacingAdjustment[] => {
  debugSpacingSolver('input', {
    movedItemId,
    proposedPosition: summarizeVector(proposedPosition),
    totalItems: items.length,
  });
  const movedItem = items.find((item) => item.id === movedItemId);
  if (!movedItem) {
    debugSpacingSolver('no-moved-item', { movedItemId });
    return [];
  }

  const movedCategory = getSpacingCategory(movedItem.type);
  debugSpacingSolver('moved-item', { movedItemId, movedItemType: movedItem.type, category: movedCategory });
  if (movedCategory === 'base_corner' || movedCategory === 'upper_corner') {
    debugSpacingSolver('skip-for-corner', { movedItemId, category: movedCategory });
    return [];
  }

  const movedEntry = prepareRunEntry(movedItem, proposedPosition, metricsById, roomDimensions);
  const ensureMovedAdjustment = (adjustments: SpacingAdjustment[]) => {
    const hasMoved = adjustments.some((update) => update.id === movedItemId);
    if (!hasMoved) {
      adjustments.push({ id: movedItemId, position: proposedPosition });
    }
    return adjustments;
  };

  if (!movedEntry) {
    debugSpacingSolver('no-run-entry', {
      movedItemId,
      reason: 'no-wall-binding',
      fallbackPosition: summarizeVector(proposedPosition),
    });
    return [{ id: movedItemId, position: proposedPosition }];
  }

  const entries: WallRunEntry[] = [];

  entries.push(movedEntry);

  for (const item of items) {
    if (item.id === movedItemId) continue;
    const entry = prepareRunEntry(item, item.position, metricsById, roomDimensions);
    if (!entry) continue;
    if (entry.wall !== movedEntry.wall || entry.axis !== movedEntry.axis) continue;
    if (
      entry.layer !== movedEntry.layer &&
      !shouldShareBetweenLayers(entry.type, movedEntry.type)
    ) {
      continue;
    }
    entries.push(entry);
  }

  debugSpacingSolver('entries.ready', {
    wall: movedEntry.wall,
    axis: movedEntry.axis,
    entryCount: entries.length,
  });

  if (entries.length === 1) {
    const axisIndex = AXIS_INDEX[movedEntry.axis];
    const updated = [...movedEntry.basePosition] as [number, number, number];
    updated[axisIndex] = movedEntry.center;
    if (Math.abs(updated[axisIndex] - movedEntry.basePosition[axisIndex]) <= EPSILON) {
      const passthrough = ensureMovedAdjustment([]);
      debugSpacingSolver('result', { adjustmentCount: passthrough.length });
      return passthrough;
    }
    const singleAdjustments = ensureMovedAdjustment([{ id: movedEntry.id, position: updated }]);
    debugSpacingSolver('result', {
      adjustmentCount: singleAdjustments.length,
      adjustments: singleAdjustments.map(summarizeAdjustment),
    });
    return singleAdjustments;
  }

  const sortedEntries = sortRunEntries(entries);
  const index = sortedEntries.findIndex((entry) => entry.id === movedItemId);

  // Ensure gap with previous
  if (index > 0) {
    const previous = sortedEntries[index - 1];
    const current = sortedEntries[index];
    const rule = getSpacingRule(previous.type, current.type);
    const previousBounds = computeAxisBounds(previous.center, previous.halfExtent);
    const currentBounds = computeAxisBounds(current.center, current.halfExtent);
    const requiredStart = previousBounds.end + rule.minSceneUnits;
    const gap = currentBounds.start - previousBounds.end;

    if (gap > 0 && gap < SNAP_TOLERANCE) {
      current.center -= gap - rule.minSceneUnits;
    } else if (currentBounds.start < requiredStart) {
      const delta = requiredStart - currentBounds.start;
      current.center += delta;
    }
  }

  // Ensure gap with next and push downstream if needed
  if (index < sortedEntries.length - 1) {
    const current = sortedEntries[index];
    for (let nextIndex = index + 1; nextIndex < sortedEntries.length; nextIndex += 1) {
      const next = sortedEntries[nextIndex];
      const rule = getSpacingRule(current.type, next.type);
      const currentBounds = computeAxisBounds(current.center, current.halfExtent);
      const nextBounds = computeAxisBounds(next.center, next.halfExtent);
      const requiredStart = currentBounds.end + rule.minSceneUnits;
      if (nextBounds.start < requiredStart) {
        const delta = requiredStart - nextBounds.start;
        applyDeltaToFollowing(sortedEntries, nextIndex, delta);
      }
      currentBounds.end = computeAxisBounds(current.center, current.halfExtent).end;
    }
  }

  const finalAdjustments = ensureMovedAdjustment(
    collectAdjustments(sortedEntries, movedEntry.axis, roomDimensions)
  );
  debugSpacingSolver('result', {
    adjustmentCount: finalAdjustments.length,
    adjustments: finalAdjustments.map(summarizeAdjustment),
  });
  return finalAdjustments;
};
