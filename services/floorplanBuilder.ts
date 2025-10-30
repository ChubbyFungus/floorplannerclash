import { Vector3 } from 'three';
import type { Floorplan, FloorplanObject, ObjectType, RoomState, Frame } from '../types';
import { buildScene, Scene } from './scene/sceneBuilder';
import skuSpecs from '../catalog/skuSpecs.json';

// This file is being refactored. The logic to build a `Frame` from a string prompt is being removed.
// The builder will now accept a `RoomState` object directly.

export interface BuildFloorplanOptions {
  requireAdaClearances?: boolean;
}

export const buildFloorplanFromState = async (
  roomState: RoomState,
  options: BuildFloorplanOptions = {}
): Promise<Floorplan> => {
  console.log('Building floorplan from roomState:', roomState);

  // Step 1: Convert the new RoomState into the legacy Frame format that buildScene expects.
  // This is a temporary bridge during refactoring.
  const frame: Frame = {
    roomType: roomState.params.roomType as Frame['roomType'],
    style: roomState.params.style as Frame['style'],
    layout: roomState.params.layout as Frame['layout'],
    dimensions: {
      width: roomState.room.widthIn / 12,
      depth: roomState.room.depthIn / 12,
    },
    appliances: roomState.params.appliances as Frame['appliances'],
    cabinets: roomState.params.cabinets as Frame['cabinets'],
    countertops: roomState.params.countertops as Frame['countertops'],
    floorMaterial: roomState.params.floorMaterial as string,
  };

  // Step 2: Call the scene builder with the converted frame.
  console.time('buildScene');
  const { scene, warnings } = buildScene(frame, {
    requireAdaClearances: options.requireAdaClearances ?? false,
  });
  console.timeEnd('buildScene');

  if (warnings.length > 0) {
    console.warn('Deterministic builder warnings:', warnings);
  }

  // Step 3: Convert the generated scene into the Floorplan format for the UI.
  console.time('convertSceneToFloorplan');
  const result = convertSceneToFloorplan(scene, frame, roomState);
  console.timeEnd('convertSceneToFloorplan');

  return result;
};

// ... The rest of the file contains the `convertSceneToFloorplan` and its helpers.
// This logic is still needed to convert the output of the scene builder to the format the UI expects.

const COUNTER_DEPTH_IN = 25;
const COUNTER_HEIGHT_IN = 36;
const WALL_CABINET_HEIGHT_IN = 42;
const WALL_CABINET_DEPTH_IN = 14;
const WALL_CABINET_ELEVATION_IN = COUNTER_HEIGHT_IN + WALL_CABINET_HEIGHT_IN / 2 + 18;

const CABINET_COLOR_MAP: Record<string, string> = {
  white: '#f5f5f5',
  gray: '#6b7280',
  'dark-gray': '#374151',
  black: '#1f2937',
  wood: '#b0814a',
  'light-wood': '#d6b98f',
  'dark-wood': '#724b2b',
  cream: '#f0ead6',
  navy: '#1e3a8a',
};

const COUNTERTOP_COLOR_MAP: Record<string, string> = {
  quartz: '#f2f4f5',
  concrete: '#9ca3af',
  'stainless-steel': '#d1d5db',
  granite: '#b3a089',
  'black-granite': '#2f2a2a',
  marble: '#ede9e6',
  'white-marble': '#ede9e6',
  'butcher-block': '#c49a6c',
};

const SKU_TYPE_MAP: Record<string, ObjectType> = {
  'gen-fridge-36-french': 'refrigerator',
  'gen-dishwasher-24': 'dishwasher',
  'gen-range-30-gas': 'oven',
  'fixture-sink-undermount-33': 'sink',
  'fixture-vanity-48': 'vanity',
  'fixture-toilet-elongated': 'toilet',
  'fixture-tub-60': 'bathtub',
  'fixture-shower-neo': 'shower',
  'casework-base-run': 'cabinet_base',
  'casework-wall-run': 'cabinet_wall',
  'island-standard': 'island',
};

const KEY_TYPE_MAP: Record<string, ObjectType> = {
  refrigerator: 'refrigerator',
  dishwasher: 'dishwasher',
  range: 'oven',
  oven: 'oven',
  sink: 'sink',
  vanity: 'vanity',
  toilet: 'toilet',
  bathtub: 'bathtub',
  shower: 'shower',
  cooktop: 'cooktop',
  island: 'island',
};

const DEFAULT_DIMENSIONS: Record<ObjectType, { width: number; height: number; depth: number }> = {
  cabinet_base: { width: 3, height: 3, depth: 2 },
  cabinet_wall: { width: 3, height: 2, depth: 1 },
  refrigerator: { width: 3, height: 6, depth: 3 },
  oven: { width: 2.5, height: 3.5, depth: 2.5 },
  sink: { width: 2.5, height: 1.5, depth: 2 },
  island: { width: 4, height: 3, depth: 3 },
  toilet: { width: 2, height: 2.5, depth: 2.5 },
  shower: { width: 3, height: 7, depth: 3 },
  vanity: { width: 4, height: 3, depth: 2 },
  window: { width: 4, height: 3, depth: 0.3 },
  bathtub: { width: 5.5, height: 2.2, depth: 2.5 },
  opening: { width: 3, height: 7, depth: 0.2 },
  vent_hood: { width: 2.5, height: 2.5, depth: 1.5 },
  dishwasher: { width: 2, height: 3, depth: 2.1 },
  cooktop: { width: 2.5, height: 0.5, depth: 2 },
};

const MATERIAL_PRESET: Partial<Record<ObjectType, string>> = {
  refrigerator: 'stainless_steel',
  dishwasher: 'stainless_steel',
  oven: 'stainless_steel',
  sink: 'stainless_steel',
  vanity: 'white_laminate',
  island: 'light_wood',
  toilet: 'white_porcelain',
  bathtub: 'white_porcelain',
  shower: 'white_porcelain',
  cooktop: 'black_glass',
};

function convertSceneToFloorplan(scene: Scene, frame: Frame, roomState: RoomState): Floorplan {
  console.log('convertSceneToFloorplan - received scene:', scene);
  const inchToFeet = (value: number) => Number((value / 12).toFixed(3));

  type Wall = 'north' | 'south' | 'east' | 'west';

  const roomWidthFeet = inchToFeet(scene.room.width);
  const roomDepthFeet = inchToFeet(scene.room.depth);
  const roomDimsIn = { width: scene.room.width, depth: scene.room.depth };

  const blockingTypes = new Set<ObjectType>(['refrigerator', 'oven', 'dishwasher', 'window', 'opening']);
  const blockingByWall: Record<Wall, Array<{ start: number; end: number }>> = {
    north: [],
    south: [],
    east: [],
    west: [],
  };

  // Add openings from RoomState to blockers
  roomState.room.openings.forEach(opening => {
      const wall = opening.wallId as Wall; // Assuming wallId matches Wall type
      if (blockingByWall[wall]) {
          const center = opening.x;
          const halfWidth = opening.widthIn / 2;
          blockingByWall[wall].push({ start: center - halfWidth, end: center + halfWidth });
      }
  });

  const baseRuns: any[] = [];
  const wallRuns: any[] = [];
  const floorplanObjects: FloorplanObject[] = [];

  const rotationForWall = (wall?: Wall) => {
    switch (wall) {
      case 'north':
        return 0;
      case 'south':
        return Math.PI;
      case 'east':
        return -Math.PI / 2;
      case 'west':
        return Math.PI / 2;
      default:
        return 0;
    }
  };

  const alongCoordinate = (position: { x: number; z: number }, wall: Wall): number => {
    const halfWidth = roomDimsIn.width / 2;
    const halfDepth = roomDimsIn.depth / 2;
    switch (wall) {
      case 'north':
      case 'south':
        return position.x + halfWidth;
      case 'east':
      case 'west':
        return position.z + halfDepth;
    }
  };

  const alongLengthForObject = (obj: any, wall: Wall): number | null => {
    if (typeof obj.metadata?.spanInches === 'number') {
      return obj.metadata.spanInches;
    }
    if (!obj.dimensions) return null;
    if (wall === 'north' || wall === 'south') {
      return obj.dimensions.width ?? null;
    }
    return obj.dimensions.depth ?? null;
  };

  const wallLength = (wall: Wall) =>
    wall === 'north' || wall === 'south' ? roomDimsIn.width : roomDimsIn.depth;

  const spanForObject = (obj: any, wall: Wall): { start: number; end: number } | null => {
    const length = alongLengthForObject(obj, wall);
    if (!length) return null;
    const center = alongCoordinate(obj.position, wall);
    const half = length / 2;
    const start = Math.max(0, center - half);
    const end = Math.min(wallLength(wall), center + half);
    if (end <= start) {
      return null;
    }
    return { start, end };
  };

  const toFeetVector = (position: { x: number; y: number; z: number }) =>
    new Vector3(inchToFeet(position.x), inchToFeet(position.y), inchToFeet(position.z));

  const convertNonRunObject = (obj: any, fallbackId: string): FloorplanObject => {
    const objectType = inferObjectType(obj.sku, obj.metadata?.key);
    const dims = obj.dimensions
      ? {
          width: inchToFeet(obj.dimensions.width),
          height: inchToFeet(obj.dimensions.height),
          depth: inchToFeet(obj.dimensions.depth),
        }
      : inferDimensions(obj.sku, objectType);

    const wall = obj.metadata?.wall as Wall | undefined;
    const rotationY = rotationForWall(wall);

    const floorplanObject: FloorplanObject = {
      id: obj.metadata?.key || fallbackId,
      type: objectType,
      position: toFeetVector(obj.position),
      rotation: new Vector3(0, rotationY, 0),
      dimensions: dims,
      color: inferColor(objectType),
      material: MATERIAL_PRESET[objectType] || 'white_laminate',
    };

    if (objectType === 'island') {
      if (typeof obj.metadata?.countertopMaterial === 'string') {
        const topKey = obj.metadata.countertopMaterial;
        floorplanObject.countertopMaterial = topKey;
        floorplanObject.countertopColor = COUNTERTOP_COLOR_MAP[topKey] ?? '#f5f5f5';
      }
      if (typeof obj.metadata?.cabinetColor === 'string') {
        floorplanObject.color =
          CABINET_COLOR_MAP[obj.metadata.cabinetColor] ?? floorplanObject.color;
      }
      floorplanObject.dimensions.width = floorplanObject.dimensions.width || 5;
      floorplanObject.dimensions.depth = floorplanObject.dimensions.depth || 3;
      floorplanObject.dimensions.height =
        floorplanObject.dimensions.height || inchToFeet(COUNTER_HEIGHT_IN);
    }

    return floorplanObject;
  };

  scene.objects.forEach((obj, index) => {
    if (obj.sku === 'casework-base-run') {
      baseRuns.push(obj);
      return;
    }
    if (obj.sku === 'casework-wall-run') {
      wallRuns.push(obj);
      return;
    }

    const floorplanObject = convertNonRunObject(obj, `${obj.sku}-${index}`);
    floorplanObjects.push(floorplanObject);

    const wall = obj.metadata?.wall as Wall | undefined;
    if (wall) {
      const objectType = floorplanObject.type;
      if (blockingTypes.has(objectType)) {
        const span = spanForObject(obj, wall);
        if (span) {
          blockingByWall[wall].push(span);
        }
      }
    }
  });

  const CABINET_SEGMENT_BUFFER_IN = 1;
  const CABINET_MIN_SEGMENT_IN = 6;

  const clampValue = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const positionFromAlong = (
    wall: Wall,
    alongCenter: number,
    elevationInches: number,
    depthInches: number
  ) => {
    const halfWidth = roomDimsIn.width / 2;
    const halfDepth = roomDimsIn.depth / 2;
    switch (wall) {
      case 'south':
        return new Vector3(
          inchToFeet(-halfWidth + alongCenter),
          inchToFeet(elevationInches),
          inchToFeet(halfDepth - depthInches / 2)
        );
      case 'north':
        return new Vector3(
          inchToFeet(-halfWidth + alongCenter),
          inchToFeet(elevationInches),
          inchToFeet(-halfDepth + depthInches / 2)
        );
      case 'west':
        return new Vector3(
          inchToFeet(-halfWidth + depthInches / 2),
          inchToFeet(elevationInches),
          inchToFeet(-halfDepth + alongCenter)
        );
      case 'east':
      default:
        return new Vector3(
          inchToFeet(halfWidth - depthInches / 2),
          inchToFeet(elevationInches),
          inchToFeet(-halfDepth + alongCenter)
        );
    }
  };

  const createCabinetSegment = (
    run: any,
    wall: Wall,
    segment: { start: number; end: number },
    mount: 'base' | 'wall',
    segmentIndex: number
  ) => {
    const span = segment.end - segment.start;
    if (span < CABINET_MIN_SEGMENT_IN) {
      return;
    }

    const depthInches = mount === 'base' ? COUNTER_DEPTH_IN : WALL_CABINET_DEPTH_IN;
    const heightInches = mount === 'base' ? COUNTER_HEIGHT_IN : WALL_CABINET_HEIGHT_IN;
    const elevationInches = mount === 'base' ? COUNTER_HEIGHT_IN / 2 : WALL_CABINET_ELEVATION_IN;

    const centerAlong = segment.start + span / 2;
    const position = positionFromAlong(wall, centerAlong, elevationInches, depthInches);
    const rotationY = rotationForWall(wall);

    const styleKey = typeof run.metadata?.cabinetStyle === 'string'
      ? `cabinet_${run.metadata?.cabinetStyle.replace(/-/g, '_')}`
      : 'white_laminate';
    const colorKey = run.metadata?.cabinetColor;
    const color = colorKey && CABINET_COLOR_MAP[colorKey] ? CABINET_COLOR_MAP[colorKey] : '#ffffff';

    const dimensions =
      wall === 'north' || wall === 'south'
        ? {
            width: inchToFeet(span),
            depth: inchToFeet(depthInches),
            height: inchToFeet(heightInches),
          }
        : {
            width: inchToFeet(depthInches),
            depth: inchToFeet(span),
            height: inchToFeet(heightInches),
          };

    const floorplanObject: FloorplanObject = {
      id: `${run.metadata?.key ?? `${mount}-run-${wall}`}-${segmentIndex}`,
      type: mount === 'base' ? 'cabinet_base' : 'cabinet_wall',
      position,
      rotation: new Vector3(0, rotationY, 0),
      dimensions,
      material: styleKey,
      color,
    };

    if (mount === 'base') {
      const topKey = run.metadata?.countertopMaterial as string | undefined;
      if (topKey) {
        floorplanObject.countertopMaterial = topKey;
        floorplanObject.countertopColor = COUNTERTOP_COLOR_MAP[topKey] ?? '#f5f5f5';
      }
    }

    floorplanObjects.push(floorplanObject);
  };

  const subtractSegment = (
    segment: { start: number; end: number },
    blocker: { start: number; end: number },
    wall: Wall
  ) => {
    const wallLen = wallLength(wall);
    const bufferedStart = clampValue(blocker.start - CABINET_SEGMENT_BUFFER_IN, 0, wallLen);
    const bufferedEnd = clampValue(blocker.end + CABINET_SEGMENT_BUFFER_IN, 0, wallLen);

    if (bufferedEnd <= segment.start || bufferedStart >= segment.end) {
      return [segment];
    }

    const segments: Array<{ start: number; end: number }> = [];
    if (bufferedStart > segment.start) {
      segments.push({ start: segment.start, end: Math.max(bufferedStart, segment.start) });
    }
    if (bufferedEnd < segment.end) {
      segments.push({ start: Math.min(bufferedEnd, segment.end), end: segment.end });
    }
    return segments.length > 0 ? segments : [];
  };

  const splitByBlockers = (
    baseSpan: { start: number; end: number },
    wall: Wall
  ): Array<{ start: number; end: number }> => {
    return blockingByWall[wall].reduce<Array<{ start: number; end: number }>>(
      (segments, blocker) => {
        const next: Array<{ start: number; end: number }> = [];
        segments.forEach(segment => {
          next.push(...subtractSegment(segment, blocker, wall));
        });
        return next;
      },
      [baseSpan]
    );
  };

  const processRuns = (runs: any[], mount: 'base' | 'wall') => {
    runs.forEach(run => {
      const wall = run.metadata?.wall as Wall | undefined;
      if (!wall) {
        floorplanObjects.push(convertNonRunObject(run, `${run.sku}-fallback`));
        return;
      }

      const span = spanForObject(run, wall);
      if (!span) {
        floorplanObjects.push(convertNonRunObject(run, `${run.sku}-fallback`));
        return;
      }

      const segments = splitByBlockers(span, wall);
      if (segments.length === 0) {
        // If everything was blocked, keep a tiny fallback so cabinets still render
        floorplanObjects.push(convertNonRunObject(run, `${run.sku}-fallback`));
        return;
      }

      segments.forEach((segment, index) => {
        createCabinetSegment(run, wall, segment, mount, index);
      });
    });
  };

  processRuns(baseRuns, 'base');
  processRuns(wallRuns, 'wall');

  return {
    room: {
      type: (frame.roomType ?? scene.room.type) as Floorplan['room']['type'],
      dimensions: {
        width: roomWidthFeet,
        depth: roomDepthFeet,
      },
      floorMaterial: frame.floorMaterial || 'light_wood_plank',
    },
    objects: floorplanObjects,
  };
}

function inferObjectType(sku: string, key?: string): ObjectType {
  if (key && KEY_TYPE_MAP[key]) {
    return KEY_TYPE_MAP[key];
  }
  if (SKU_TYPE_MAP[sku]) {
    return SKU_TYPE_MAP[sku];
  }
  return 'cabinet_base';
}

function inferDimensions(sku: string, objectType: ObjectType) {
  const spec = (skuSpecs as any[]).find(item => item.sku === sku);
  if (spec?.dims) {
    return {
      width: Number((spec.dims.w / 12).toFixed(3)),
      height: Number((spec.dims.h / 12).toFixed(3)),
      depth: Number((spec.dims.d / 12).toFixed(3)),
    };
  }

  return DEFAULT_DIMENSIONS[objectType] || { width: 3, height: 3, depth: 2 };
}

function inferColor(objectType: ObjectType): string {
  switch (objectType) {
    case 'refrigerator':
    case 'dishwasher':
    case 'oven':
      return '#d1d5db';
    case 'sink':
    case 'cooktop':
      return '#9ca3af';
    case 'island':
      return '#a16207';
    case 'vanity':
      return '#e5e7eb';
    case 'toilet':
    case 'bathtub':
    case 'shower':
      return '#f8fafc';
    default:
      return '#ffffff';
  }
}