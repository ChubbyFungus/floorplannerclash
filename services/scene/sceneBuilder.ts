import Ajv from 'ajv';
import sceneSchema from '../../schema/scene.schema.json';
import {RoomState, Frame } from '../../types';
import {
  mergeRules,
  placementValidator,
  PlacementSpec,
  EffectiveRules,
  evaluateRuleCompliance,
} from '../../src/lib/rulesEngine';
import skuSpecs from '../../catalog/skuSpecs.json';

const COUNTER_DEPTH_IN = 25;
const COUNTER_HEIGHT_IN = 36;
const DEFAULT_ROOM_HEIGHT_IN = 108;
const ADA_CLEAR_FLOOR_MIN = 60;
const CORNER_BUFFER_IN = 18;
const DISHWASHER_OFFSET_IN = 30;
const MIN_APPLIANCE_GAP_IN = 24;
const MIN_COUNTER_SEGMENT_IN = 36;
const ISLAND_MIN_WIDTH_IN = 60;
const ISLAND_MIN_DEPTH_IN = 36;
const ISLAND_CLEARANCE_IN = 42;
const WALL_CABINET_HEIGHT_IN = 42;
const WALL_CABINET_DEPTH_IN = 14;
const WALL_CABINET_ELEVATION_IN = COUNTER_HEIGHT_IN + 18;

const knownSkus = new Set((skuSpecs as any[]).map(spec => spec.sku));
knownSkus.add('casework-base-run');
knownSkus.add('casework-wall-run');
knownSkus.add('island-standard');

const ajv = new Ajv({ allErrors: true, strict: false });
const validateScene = ajv.compile(sceneSchema);

export type Wall = 'north' | 'south' | 'east' | 'west';
export type Style = 'modern' | 'traditional' | 'transitional';

interface DimensionsInches {
  width: number;
  depth: number;
  height: number;
}

interface SceneBuilderOptions {
  roomHeightIn?: number;
  requireAdaClearances?: boolean;
}

export interface SceneObject {
  sku: string;
  type: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  metadata?: Record<string, any>;
}

export interface Scene {
  room: {
    type: string;
    style: Style;
    width: number;
    depth: number;
    height: number;
    units: string;
  };
  objects: SceneObject[];
}

export interface SceneWarning {
  message: string;
  severity: 'low' | 'medium' | 'high';
  objectIds?: string[];
  code?: string;
}

export interface SceneBuildResult {
  scene: Scene;
  warnings: SceneWarning[];
  validation: { frameValid: boolean; sceneValid: boolean; errors: string[] };
}

interface WallRun {
  wall: Wall;
  start: number;
  end: number;
}

export function buildScene(frame: Frame, options: SceneBuilderOptions = {}): SceneBuildResult {
  const widthIn = frame.dimensions.width * 12;
  const depthIn = frame.dimensions.depth * 12;
  const heightIn = options.roomHeightIn ?? (frame.dimensions.height ? frame.dimensions.height * 12 : DEFAULT_ROOM_HEIGHT_IN);
  const dims: DimensionsInches = { width: widthIn, depth: depthIn, height: heightIn };

  const roomType = (frame.roomType as 'kitchen' | 'bathroom') || 'kitchen';
  const style = (frame.style as Style) || 'modern';

  const { objects, warnings: geometryWarnings } =
    roomType === 'bathroom'
      ? buildBathroomObjects(frame, dims)
      : buildKitchenObjects(frame, dims, options);

  const skuRefs = objects.filter(obj => knownSkus.has(obj.sku)).map(obj => obj.sku);
  const effectiveRules = mergeRules(roomType, style, skuRefs);

  const ruleWarnings = evaluateRuleCompliance(objects, effectiveRules, dims);
  const allWarnings: SceneWarning[] = [...geometryWarnings, ...ruleWarnings];

  const scene: Scene = {
    room: {
      type: roomType,
      style,
      width: widthIn,
      depth: depthIn,
      height: heightIn,
      units: 'in',
    },
    objects,
  };

  const sceneValid = validateScene(scene);
  if (!sceneValid) {
    const errors = (validateScene.errors ?? []).map(formatAjvError);
    throw new Error(`Scene validation failed: ${errors.join('; ')}`);
  }

  return {
    scene,
    warnings: allWarnings,
    validation: { frameValid: true, sceneValid, errors: [] },
  };
}

function formatAjvError(error: any): string {
  return `${error.instancePath} ${error.message}`;
}

function buildBathroomObjects(
  frame: Frame,
  dims: DimensionsInches
): { objects: SceneObject[]; warnings: SceneWarning[] } {
  // Placeholder for bathroom object building logic
  return { objects: [], warnings: [] };
}

function buildKitchenObjects(
  frame: Frame,
  dims: DimensionsInches,
  options: SceneBuilderOptions
): { objects: SceneObject[]; warnings: SceneWarning[] } {
  const layout = (frame.layout as string) || inferLayoutFromDimensions(dims);
  const layoutObjects = planKitchenLayout(frame, dims, layout);
  return {
    objects: layoutObjects,
    warnings: evaluateKitchenGeometry(layoutObjects, dims, layout, options.requireAdaClearances ?? false),
  };
}

function evaluateKitchenGeometry(
  objects: SceneObject[],
  dims: DimensionsInches,
  layout: string,
  requireAdaClearances: boolean
): SceneWarning[] {
  const warnings: SceneWarning[] = [];
  const appliancePositions = new Map<string, { x: number; z: number }>();
  objects.forEach(obj => {
    if (obj.type === 'appliance') {
      appliancePositions.set(obj.metadata?.key, obj.position);
    }
  });

  // Check for appliance proximity
  const appliancePairs: [string, string, number][] = [
    ['refrigerator', 'range', 72],
    ['sink', 'range', 48],
    ['sink', 'refrigerator', 48],
  ];

  for (const [keyA, keyB, minDistance] of appliancePairs) {
    const posA = appliancePositions.get(keyA);
    const posB = appliancePositions.get(keyB);
    if (posA && posB) {
      const distance = Math.sqrt(Math.pow(posA.x - posB.x, 2) + Math.pow(posA.z - posB.z, 2));
      if (distance < minDistance) {
        warnings.push({
          message: `Appliance proximity warning: ${keyA} and ${keyB} are too close.`,
          severity: 'medium',
        });
      }
    }
  }

  // Check NKBA aisle width requirements
  // Calculate aisle width: room depth minus counter depths on both sides
  const aisleWidth = dims.depth - (COUNTER_DEPTH_IN * 2);
  const minAisleWidth = 36; // NKBA minimum walkway width

  if (aisleWidth < minAisleWidth) {
    warnings.push({
      message: `Aisle width of ${aisleWidth.toFixed(1)} inches is below NKBA minimum of ${minAisleWidth} inches for safe maneuvering.`,
      severity: 'high',
      code: 'NKBA_AISLE_WIDTH',
    });
  }

  if (requireAdaClearances) {
    // ADA clearance check: ensure adequate aisle width for wheelchair access
    const adaMinAisleWidth = 60; // ADA minimum aisle width for wheelchair turning

    // Check aisle width for ADA compliance (60" diameter turning circle)
    if (aisleWidth < adaMinAisleWidth) {
      warnings.push({
        message: `Aisle width of ${aisleWidth.toFixed(1)} inches does not meet ADA minimum requirement of ${adaMinAisleWidth} inches for wheelchair access and turning.`,
        severity: 'high',
        code: 'ADA_CLEARANCE',
      });
    }
  }

  // Check for island clearance
  const island = objects.find(obj => obj.sku === 'island-standard');
  if (island) {
    // This is a very simplified check against the south wall casework.
    const southCaseworkFrontZ = dims.depth / 2 - COUNTER_DEPTH_IN;
    const islandEdgeZ = island.position.z + island.dimensions.depth / 2;
    const clearance = southCaseworkFrontZ - islandEdgeZ;

    if (clearance < ISLAND_CLEARANCE_IN) {
        warnings.push({
          message: `Island clearance to south wall is insufficient. Minimum ${ISLAND_CLEARANCE_IN} inches required. Found ${clearance.toFixed(1)} inches.`,
          severity: 'high',
        });
    }
  }

  return warnings;
}


function planKitchenLayout(frame: Frame, dims: DimensionsInches, layout: string): SceneObject[] {
  const objects: SceneObject[] = [];
  const runs = new Map<Wall, WallRun>();

  const ensureRun = (wall: Wall): WallRun => {
    if (runs.has(wall)) return runs.get(wall)!;
    const length = getWallLength(wall, dims);
    const start = CORNER_BUFFER_IN;
    const end = length - CORNER_BUFFER_IN;
    const run = { wall, start, end };
    runs.set(wall, run);
    return run;
  };

  function getWallLength(wall: Wall, dims: DimensionsInches): number {
    switch (wall) {
      case 'north':
      case 'south':
        return dims.width;
      case 'east':
      case 'west':
        return dims.depth;
    }
  }

  const baseWallsByLayout: Record<string, Wall[]> = {
    'straight': ['south'],
    'galley': ['south', 'north'],
    'U-shaped': ['south', 'west', 'east'],
    'L-shaped': ['south', 'west'],
  };
  (baseWallsByLayout[layout] ?? baseWallsByLayout['L-shaped']).forEach(ensureRun);

  const addAppliance = (sku: string, key: string, wall: Wall, proposedOffset: number, metadata: Record<string, any> = {}) => {
    const run = ensureRun(wall);
    const offset = clamp(proposedOffset, run.start + MIN_APPLIANCE_GAP_IN, run.end - MIN_APPLIANCE_GAP_IN);
    addWallObject(sku, 'appliance', key, key, wall, offset, { metadata });
    return offset;
  };

  function addWallObject(sku: string, type: string, id: string, key: string, wall: Wall, offset: number, options: { metadata?: Record<string, any> } = {}) {
    const position = positionOnWall(dims, wall, offset, 0).position;
    const dimensions = { width: 0, height: 0, depth: 0 }; // Placeholder, actual dimensions would come from skuSpecs
    objects.push({
      sku,
      type,
      position,
      dimensions,
      metadata: { ...options.metadata, wall, key },
    });
  }

  function positionOnWall(dims: DimensionsInches, wall: Wall, alongWallInches: number, fromWallInches: number) {
    const halfWidth = dims.width / 2;
    const halfDepth = dims.depth / 2;
    let x = 0;
    let z = 0;
    let rotation = 0;

    switch (wall) {
      case 'north':
        x = -halfWidth + alongWallInches;
        z = -halfDepth + fromWallInches;
        rotation = Math.PI;
        break;
      case 'south':
        x = -halfWidth + alongWallInches;
        z = halfDepth - fromWallInches;
        rotation = 0;
        break;
      case 'east':
        x = halfWidth - fromWallInches;
        z = -halfDepth + alongWallInches;
        rotation = -Math.PI / 2;
        break;
      case 'west':
        x = -halfWidth + fromWallInches;
        z = -halfDepth + alongWallInches;
        rotation = Math.PI / 2;
        break;
    }
    return { position: { x, y: 0, z }, rotation };
  }
  
  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }

  // ... (addWallObject, addFixture logic remains the same) ...

  // Appliance placement logic now reads from frame.appliances
  const appliances = frame.appliances as any || {};
  const southRun = runs.get('south');
  const westRun = runs.get('west');

  if (southRun) {
    const sinkOffset = (southRun.start + southRun.end) / 2;
    addAppliance('fixture-sink-undermount-33', 'sink', 'south', sinkOffset);
    addAppliance('gen-dishwasher-24', 'dishwasher', 'south', sinkOffset + DISHWASHER_OFFSET_IN, { adjacent: ['sink'] });
  }
  if (westRun) {
    addAppliance('gen-fridge-36-french', 'refrigerator', 'west', westRun.start + 30, { finish: appliances.refrigerator?.finish });
    addAppliance('gen-range-30-gas', 'range', 'west', westRun.end - 48, { finish: appliances.oven?.finish });
  }

  // Cabinet runs logic now reads from frame.cabinets
  const cabinets = frame.cabinets as any || {};
  const countertops = frame.countertops as any || {};
  runs.forEach((run, wall) => {
    const span = run.end - run.start;
    const centerOffset = run.start + span / 2;
    objects.push({
      sku: 'casework-base-run',
      type: 'casework',
      position: positionOnWall(dims, wall, centerOffset, COUNTER_HEIGHT_IN / 2).position,
      dimensions: { width: span, height: COUNTER_HEIGHT_IN, depth: COUNTER_DEPTH_IN },
      metadata: { key: `cabinet-base-${wall}`, wall, spanInches: span, cabinetColor: cabinets.color, cabinetStyle: cabinets.style, countertopMaterial: countertops.material, mount: 'base' },
    });
    objects.push({
      sku: 'casework-wall-run',
      type: 'casework',
      position: positionOnWall(dims, wall, centerOffset, WALL_CABINET_ELEVATION_IN).position,
      dimensions: { width: span, height: WALL_CABINET_HEIGHT_IN, depth: WALL_CABINET_DEPTH_IN },
      metadata: { key: `cabinet-wall-${wall}`, wall, spanInches: span, cabinetColor: cabinets.color, cabinetStyle: cabinets.style, mount: 'wall' },
    });
  });

  // Island logic remains similar
  // ...

  return objects;
}

function inferLayoutFromDimensions(dims: DimensionsInches): string {
  const { width, depth } = dims;
  const shorterSide = Math.min(width, depth);

  if (shorterSide < 120) { // less than 10ft
    return 'straight';
  }
  if (shorterSide < 156) { // less than 13ft
    return 'galley';
  }
  // If there's enough space for a U-shape with clearances
  if (width >= 192 && depth >= 192) { // 16ft
    return 'U-shaped';
  }
  return 'L-shaped';
}
