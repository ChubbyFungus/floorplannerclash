import { describe, expect, it } from 'vitest';
import { computeSpacingAdjustments, ItemMetrics } from '../spacingSolver';
import { getSpacingRule } from '../spacingRules';
import type { SceneItem, RoomDimensions } from '../../../types';

const room: RoomDimensions = { width: 10, depth: 6 };
const baseMetrics: ItemMetrics = { width: 1, depth: 1, height: 1 };
const fridgeMetrics: ItemMetrics = { width: 1.5, depth: 1.1, height: 2.2 };
const sinkMetrics: ItemMetrics = { width: 1.2, depth: 1, height: 1.1 };
const upperMetrics: ItemMetrics = { width: 1, depth: 0.6, height: 0.9 };

const baseWallZ = -room.depth / 2 + baseMetrics.depth / 2;
const upperWallZ = -room.depth / 2 + upperMetrics.depth / 2;

const createItem = (
  id: number,
  type: SceneItem['type'],
  position: [number, number, number]
): SceneItem => ({
  id,
  type,
  position,
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});

const positionsAlmostEqual = (a: [number, number, number], b: [number, number, number]) =>
  a.every((value, idx) => Math.abs(value - b[idx]) < 1e-6);

describe('computeSpacingAdjustments', () => {
  it('aligns base cabinets edge-to-edge without leaving a gap', () => {
    const items: SceneItem[] = [
      createItem(1, 'base_cabinet', [-1, 0, baseWallZ]),
      createItem(2, 'base_cabinet', [0, 0, baseWallZ]),
      createItem(3, 'base_cabinet', [1, 0, baseWallZ]),
    ];

    const metrics = new Map<number, ItemMetrics>([
      [1, baseMetrics],
      [2, baseMetrics],
      [3, baseMetrics],
    ]);

    const proposedPosition: [number, number, number] = [-0.05, 0, baseWallZ];

    const adjustments = computeSpacingAdjustments({
      movedItemId: 2,
      proposedPosition,
      items,
      metricsById: metrics,
      roomDimensions: room,
    });

    const movedAdjustment = adjustments.find((update) => update.id === 2);
    expect(movedAdjustment).toBeTruthy();
    expect(adjustments.find((update) => update.id === 3)).toBeUndefined();

    const previousEnd = items[0].position[0] + baseMetrics.width / 2;
    const expectedCenter = previousEnd + baseMetrics.width / 2;
    expect(movedAdjustment && Math.abs(movedAdjustment.position[0] - expectedCenter) < 1e-6).toBe(true);
  });

  it('maintains fridge to base cabinet clearance when snapping against an existing run', () => {
    const fridgeZ = -room.depth / 2 + fridgeMetrics.depth / 2;
    const items: SceneItem[] = [
      createItem(10, 'base_cabinet', [0, 0, baseWallZ]),
      createItem(11, 'fridge', [2, 0, fridgeZ]),
    ];

    const metrics = new Map<number, ItemMetrics>([
      [10, baseMetrics],
      [11, fridgeMetrics],
    ]);

    const proposedPosition: [number, number, number] = [0.6, 0, fridgeZ];

    const adjustments = computeSpacingAdjustments({
      movedItemId: 11,
      proposedPosition,
      items,
      metricsById: metrics,
      roomDimensions: room,
    });

    const fridgeAdjustment = adjustments.find((update) => update.id === 11);
    expect(fridgeAdjustment).toBeTruthy();

    const rule = getSpacingRule('fridge', 'base_cabinet');
    const baseEnd = items[0].position[0] + baseMetrics.width / 2;
    const expectedStart = baseEnd + rule.minSceneUnits;
    const expectedCenter = expectedStart + fridgeMetrics.width / 2;

    expect(
      fridgeAdjustment?.position &&
        Math.abs(fridgeAdjustment.position[0] - expectedCenter) < 1e-6
    ).toBe(true);

    expect(positionsAlmostEqual(fridgeAdjustment!.position, [expectedCenter, 0, fridgeZ])).toBe(true);
  });

  it('shares spacing between uppers and fridges so fillers are respected', () => {
    const fridgeWallZ = -room.depth / 2 + fridgeMetrics.depth / 2;
    const items: SceneItem[] = [
      createItem(40, 'fridge', [0, 0, fridgeWallZ]),
      createItem(41, 'upper_cabinet', [0.2, 2.3, upperWallZ]),
    ];

    const metrics = new Map<number, ItemMetrics>([
      [40, fridgeMetrics],
      [41, upperMetrics],
    ]);

    const proposedPosition: [number, number, number] = [0.1, 2.3, upperWallZ];

    const adjustments = computeSpacingAdjustments({
      movedItemId: 41,
      proposedPosition,
      items,
      metricsById: metrics,
      roomDimensions: room,
    });

    expect(adjustments.some((update) => update.id === 40)).toBe(false);
    const upperAdjustment = adjustments.find((update) => update.id === 41);
    expect(upperAdjustment).toBeTruthy();

    const rule = getSpacingRule('upper_cabinet', 'fridge');
    const fridgeEnd = items[0].position[0] + fridgeMetrics.width / 2;
    const expectedStart = fridgeEnd + rule.minSceneUnits;
    const expectedCenter = expectedStart + upperMetrics.width / 2;
    expect(Math.abs(upperAdjustment!.position[0] - expectedCenter)).toBeLessThan(1e-6);
  });

  it('applies reveal between base cabinet and sink base cabinet', () => {
    const items: SceneItem[] = [
      createItem(31, 'base_cabinet', [0, 0, baseWallZ]),
      createItem(32, 'sink', [0.9, 0, baseWallZ]),
    ];

    const metrics = new Map<number, ItemMetrics>([
      [31, baseMetrics],
      [32, sinkMetrics],
    ]);

    const proposedPosition: [number, number, number] = [0.4, 0, baseWallZ];

    const adjustments = computeSpacingAdjustments({
      movedItemId: 32,
      proposedPosition,
      items,
      metricsById: metrics,
      roomDimensions: room,
    });

    const sinkAdjustment = adjustments.find((update) => update.id === 32);
    expect(sinkAdjustment).toBeTruthy();

    const rule = getSpacingRule('base_cabinet', 'sink');
    const baseEnd = items[0].position[0] + baseMetrics.width / 2;
    const expectedStart = baseEnd + rule.minSceneUnits;
    const expectedCenter = expectedStart + sinkMetrics.width / 2;
    expect(Math.abs(sinkAdjustment!.position[0] - expectedCenter)).toBeLessThan(1e-6);
  });
});
