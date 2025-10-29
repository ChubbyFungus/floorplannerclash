import { parseUtterance } from '../nlp/parse';
import { buildScene, SceneWarning } from '../services/scene/sceneBuilder';
import { Frame } from '../types';

describe('Deterministic parser', () => {
  it('extracts core frame fields from structured input', () => {
    const input = [
      'Room: kitchen.',
      'Style: modern.',
      'Dimensions: 12 feet by 10 feet.',
      'Layout: L-shaped.',
      'We need a french door refrigerator with stainless steel finish.',
      'Add a slide-in range and a farmhouse sink.',
    ].join(' ');

    const result = parseUtterance(input);

    expect(result.framePatch.roomType).toBe('kitchen');
    expect(result.framePatch.style).toBe('modern');
    expect(result.framePatch.layout).toBe('L-shaped');
    expect(result.framePatch.dimensions?.width).toBeCloseTo(12, 2);
    expect(result.framePatch.dimensions?.depth).toBeCloseTo(10, 2);
    expect(result.framePatch.appliances?.refrigerator?.type).toBe('french-door');
    expect(result.framePatch.appliances?.refrigerator?.finish).toBe('stainless-steel');
    expect(result.framePatch.appliances?.sink?.type).toBe('farmhouse');
  });

  it('parses countertop and cabinet directives', () => {
    const input = 'Cabinet style: shaker navy. Countertop material: quartz with white color.';
    const result = parseUtterance(input);

    expect(result.framePatch.cabinets?.style).toBe('shaker');
    expect(result.framePatch.cabinets?.color).toBe('navy');
    expect(result.framePatch.countertops?.material).toBe('quartz');
    expect(result.framePatch.countertops?.color).toBe('white');
  });
});

describe('Scene builder', () => {
  const baseFrame = (): Frame => ({
    roomType: 'kitchen',
    style: 'modern',
    dimensions: { width: 12, depth: 10 },
    layout: 'L-shaped',
    floorMaterial: 'concrete',
    appliances: {
      refrigerator: { type: 'french-door', finish: 'stainless-steel' },
      oven: { type: 'slide-in-range', finish: 'stainless-steel' },
      sink: { type: 'single-basin', finish: 'stainless-steel' },
    },
    cabinets: { style: 'flat-panel', color: 'white' },
    countertops: { material: 'quartz', color: 'white' },
  });

  const warningCodes = (warnings: SceneWarning[]): string[] => warnings.map(w => w.code);

  it('builds a valid scene with deterministic placements', () => {
    const result = buildScene(baseFrame());

    expect(result.scene.objects.length).toBeGreaterThanOrEqual(4);
    const fridge = result.scene.objects.find(obj => obj.metadata?.key === 'refrigerator');
    expect(fridge?.sku).toBe('gen-fridge-36-french');
    const range = result.scene.objects.find(obj => obj.metadata?.key === 'range');
    expect(range?.position.y).toBeCloseTo((range?.dimensions?.height ?? 0) / 2, 1);

    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    expect(result.validation.sceneValid).toBe(true);
  });

  it('flags NKBA aisle warnings when the room is too narrow', () => {
    const frame = baseFrame();
    frame.dimensions = { width: 12, depth: 7 }; // 84" depth -> 34" aisle

    const result = buildScene(frame);
    expect(warningCodes(result.warnings)).toContain('NKBA_AISLE_WIDTH');
  });

  it('emits ADA clearance warnings when requested', () => {
    const frame = baseFrame();
    frame.dimensions = { width: 10, depth: 8 }; // 46" aisle

    const result = buildScene(frame, { requireAdaClearances: true });
    expect(warningCodes(result.warnings)).toContain('ADA_CLEARANCE');
  });
});
