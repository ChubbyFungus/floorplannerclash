import React, { Suspense, useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SceneItem, SelectedPosition, Backsplash, SurfaceType, RoomDimensions, ItemType } from '../types';
import Room from './models/Room';
import SelectionMarker from './SelectionMarker';
import BacksplashMesh from './Backsplash';
import { textureLibrary } from './textures/textureLibrary';
import {
  BaseSingleDoor,
  BaseDoubleDoor,
  BaseThreeDrawer,
  BaseDrawerOverDoors,
  SinkBase,
  WallSingleDoor,
  WallDoubleDoor,
  PantrySingleDoor,
  PantryDoubleDoor,
  OvenTall,
  BlindCornerBase,
  BlindCornerWall,
} from './Cabinet';
import type { CabinetProps } from './Cabinet';

const CORNER_ITEM_TYPES: ItemType[] = ['corner_cabinet_lower', 'corner_cabinet_upper'];
const cornerItemTypeSet = new Set<ItemType>(CORNER_ITEM_TYPES);
const isCornerItemType = (type: ItemType): boolean => cornerItemTypeSet.has(type);
const isThreeCanvasDebugEnabled = process.env.NODE_ENV !== 'production';
const debugThreeCanvas = (label: string, payload: Record<string, unknown>) => {
  if (!isThreeCanvasDebugEnabled) return;
  let formatted: unknown = payload;
  try {
    formatted = JSON.stringify(payload, null, 2);
  } catch {
    // fall back to raw payload
  }
  console.debug(`[three-canvas][apps/frontend/src/components/ThreeCanvas.tsx] ${label}`, formatted);
};


const CABINET_COMPONENTS: Partial<Record<string, React.FC<any>>> = {
  base_cabinet: BaseDoubleDoor,
  upper_cabinet: WallDoubleDoor,
  pantryTall: PantryDoubleDoor,
  base_single_door: BaseSingleDoor,
  base_double_door: BaseDoubleDoor,
  base_three_drawer: BaseThreeDrawer,
  base_drawer_over_doors: BaseDrawerOverDoors,
  sink_base: SinkBase,
  wall_single_door: WallSingleDoor,
  wall_double_door: WallDoubleDoor,
  pantry_single_door: PantrySingleDoor,
  pantry_double_door: PantryDoubleDoor,
  oven_tall: OvenTall,
  corner_cabinet_lower: BlindCornerBase,
  corner_cabinet_upper: BlindCornerWall,
};

type CatalogComponentEntry = {
  component: React.FC<any>;
  props?: Partial<Omit<CabinetProps, 'width' | 'height' | 'depth'>>;
};

const CATALOG_COMPONENTS: Record<string, CatalogComponentEntry> = {
  base_double_door_two_drawer_24d: { component: BaseDrawerOverDoors },
  base_single_door_24d: { component: BaseSingleDoor },
  base_three_drawer_24d: { component: BaseThreeDrawer },
  base_wastebasket_24d: { component: BaseSingleDoor },
  base_super_susan: { component: BlindCornerBase },
  sink_base_double_door_false_drawer: { component: SinkBase },
  utility_cabinet_24d: { component: PantryDoubleDoor },
  utility_cabinet_12d: { component: PantrySingleDoor },
  oven_cabinet_24d: { component: OvenTall },
  wall_double_door_shelves: { component: WallDoubleDoor },
  wall_diagonal_corner_glass: { component: BlindCornerWall, props: { doorStyle: 'glass' } },
  wall_ref_double_door: { component: WallDoubleDoor },
  wall_ref_two_butt_door: { component: WallDoubleDoor },
  wall_cabinet_18h_12d: { component: WallDoubleDoor },
  wall_cabinet_21h_12d: { component: WallDoubleDoor },
  wall_cabinet_easy_reach_12d: { component: BlindCornerWall },
  wall_cabinet_single_door_shelves: { component: WallSingleDoor },
  wall_cabinet_doors_prepped_glass: { component: WallDoubleDoor, props: { doorStyle: 'glass' } },
};
import { getItemSceneDimensions } from '../lib/items/dimensions';
import { sceneUnitsToInches } from '../lib/units';

import { GLBModel } from './GLBModel';
import { resolveCatalogForObject } from '../../catalogData';
import {
  computeSpacingAdjustments,
  ItemMetrics,
  ItemMetricsMap,
} from '../lib/layout/spacingSolver';
import type { CabinetOptions } from '../types/cabinet';

const SINGLE_BASE_CABINET_ID = 'base_single_door_24d';
const DOUBLE_BASE_CABINET_ID = 'base_double_door_two_drawer_24d';

const selectCatalogIdForItem = (item: SceneItem): string | undefined => {
  if (item.catalogId) return item.catalogId;
  if (item.type === 'base_cabinet') {
    if (typeof item.widthInches === 'number') {
      return item.widthInches < 24 ? SINGLE_BASE_CABINET_ID : DOUBLE_BASE_CABINET_ID;
    }
  }
  return undefined;
};

interface ThreeCanvasProps {
  items: SceneItem[];
  selectedPosition: SelectedPosition | null;
  onSurfaceClick: (position: SelectedPosition) => void;
  drawingPoints: [number, number, number][];
  backsplashes: Backsplash[];
  textures: {
      floor: string;
      countertop: string;
      backsplash: string;
  };
  roomDimensions: RoomDimensions;
  cabinetOptions: CabinetOptions;
  onItemContextMenu?: (itemId: number, screenPosition: { x: number; y: number }) => void;
  onItemsBatchChange?: (
    updates: Array<{
      id: number;
      position?: [number, number, number];
      rotation?: [number, number, number];
    }>
  ) => void;
}
function SelectionBox({ target }: { target: THREE.Object3D | null }) {
  const helper = useMemo(() => new THREE.Box3Helper(new THREE.Box3(), 0x00ff00), []);
  useEffect(() => { helper.visible = !!target; }, [target, helper]);
  useFrame(() => { if (!target) return; (helper.box as THREE.Box3).setFromObject(target); helper.visible = true; });
  return <primitive object={helper} />;
}

const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  items,
  selectedPosition,
  onSurfaceClick,
  drawingPoints,
  backsplashes,
  textures,
  roomDimensions,
  cabinetOptions,
  onItemContextMenu,
  onItemsBatchChange,
}) => {
  // Ref = a box that holds an object instance. Here it will hold OrbitControls.
  const controls = useRef<any>(null);
  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null);
  const itemMetricsRef = useRef<ItemMetricsMap>(new Map<number, ItemMetrics>());
  const groupRefs = useRef<Map<number, THREE.Group>>(new Map());

  useEffect(() => {
    if ((window as any).Playwright) {
      (window as any).threeJsGroupRefs = groupRefs.current;
    }
  }, []);
  
  const boxHelper = useMemo(() => new THREE.Box3Helper(new THREE.Box3(), 0x00ff00), []);
  useEffect(() => { boxHelper.visible = !!selectedObj; }, [selectedObj, boxHelper]); 
  
  const planeHit = useRef(new THREE.Vector3()).current;
  const drag = useRef<{ plane: THREE.Plane; offset: THREE.Vector3; obj: THREE.Object3D } | null>(null);
  const ignoreFloorUntil = useRef(0);
  const SNAP = 0.25; // meters; raise if your scene units are larger
  const GRID_SNAP = 0.5;
  const tmpBox = new THREE.Box3();
  const tmpSize = new THREE.Vector3();

  useEffect(() => {
    const activeIds = new Set(items.map(item => item.id));
    const metrics = itemMetricsRef.current;
    metrics.forEach((_, key) => {
      if (!activeIds.has(key)) metrics.delete(key);
    });
    const groups = groupRefs.current;
    groups.forEach((_, key) => {
      if (!activeIds.has(key)) groups.delete(key);
    });
  }, [items]);

  const snapPosition = (
    item: SceneItem,
    proposed: [number, number, number],
    grid = GRID_SNAP
  ): [number, number, number] => {
    const [x, y, z] = proposed;
    const isCorner = item.type === 'corner_cabinet_lower' || item.category === 'base_corner';

    if (isCorner && item.meta?.cornerLock) {
      const { x: lockX, z: lockZ } = item.meta.cornerLock;
      const ySnap = Math.round(y / grid) * grid;
      const snapped: [number, number, number] = [lockX, ySnap, lockZ];
      console.debug('[snap]', { proposed, snapped });
      return snapped;
    }

    const snapped: [number, number, number] = [
      Math.round(x / grid) * grid,
      Math.round(y / grid) * grid,
      Math.round(z / grid) * grid,
    ];
    console.debug('[snap]', { proposed, snapped });
    return snapped;
  };

  const applySpacingAndSync = useCallback(
    (itemId: number, proposedPosition: [number, number, number]) => {
      const adjustments = computeSpacingAdjustments({
        movedItemId: itemId,
        proposedPosition,
        items,
        metricsById: itemMetricsRef.current,
        roomDimensions,
      });

      if (adjustments.length === 0) {
        return;
      }

      for (const { id, position } of adjustments) {
        const group = groupRefs.current.get(id);
        if (group) {
          group.position.set(position[0], position[1], position[2]);
          group.updateMatrixWorld();
        }
      }

      if (!onItemsBatchChange) {
        return;
      }

      const payload = adjustments
        .filter(({ id }) => id !== itemId)
        .map(({ id, position }) => ({
          id,
          position,
        }));

      if (payload.length) {
        onItemsBatchChange(payload);
      }
    },
    [items, onItemsBatchChange, roomDimensions]
  );
  const commitPosition = useCallback(
    (itemId: number, snappedPosition: [number, number, number], rotation: [number, number, number]) => {
      if (!onItemsBatchChange) {
        return;
      }
      onItemsBatchChange([
        {
          id: itemId,
          position: snappedPosition,
          rotation,
        },
      ]);
    },
    [onItemsBatchChange]
  );
  const snapToRoomWalls = (item: SceneItem | undefined, obj: THREE.Object3D) => {
    if (!item) {
      debugThreeCanvas('snap.skip', {
        reason: 'missing-item',
        itemId: item?.id,
        itemType: item?.type,
      });
      return;
    }

    if (isCornerItemType(item.type)) {
      const lock = item.meta?.cornerLock;
      if (lock) {
        obj.position.x = lock.x;
        obj.position.z = lock.z;
        obj.updateMatrixWorld();
        debugThreeCanvas('snap.lock', {
          itemId: item.id,
          itemType: item.type,
          lock,
        });
      }
      return;
    }

    const halfW = roomDimensions.width / 2;
    const halfD = roomDimensions.depth / 2;

    obj.updateWorldMatrix(true, true);
    tmpBox.setFromObject(obj);
    tmpBox.getSize(tmpSize);

    const tolerance = Math.max(SNAP, Math.min(Math.max(tmpSize.x, tmpSize.z) * 0.25, 1));
    const rotationBefore = [obj.rotation.x, obj.rotation.y, obj.rotation.z] as [number, number, number];
    const positionBefore = [obj.position.x, obj.position.y, obj.position.z] as [number, number, number];

    const candidates = [
      { wall: '+x' as const, delta: halfW - tmpBox.max.x },
      { wall: '-x' as const, delta: -halfW - tmpBox.min.x },
      { wall: '+z' as const, delta: halfD - tmpBox.max.z },
      { wall: '-z' as const, delta: -halfD - tmpBox.min.z },
    ];

    const nearest = candidates.reduce((a, b) =>
      Math.abs(a.delta) < Math.abs(b.delta) ? a : b
    );
    if (Math.abs(nearest.delta) > tolerance) {
      debugThreeCanvas('snap.abort', {
        itemId: item.id,
        itemType: item.type,
        nearest: nearest.wall,
        delta: nearest.delta,
        tolerance,
      });
      return;
    }

    const yawByWall: Record<typeof nearest.wall, number> = {
      '+x': -Math.PI / 2,
      '-x': Math.PI / 2,
      '+z': Math.PI,
      '-z': 0,
    };
    obj.rotation.set(0, yawByWall[nearest.wall], 0);

    obj.updateWorldMatrix(true, true);
    tmpBox.setFromObject(obj);

    switch (nearest.wall) {
      case '+x': {
        const delta = halfW - tmpBox.max.x;
        obj.position.x += delta;
        break;
      }
      case '-x': {
        const delta = -halfW - tmpBox.min.x;
        obj.position.x += delta;
        break;
      }
      case '+z': {
        const delta = halfD - tmpBox.max.z;
        obj.position.z += delta;
        break;
      }
      case '-z': {
        const delta = -halfD - tmpBox.min.z;
        obj.position.z += delta;
        break;
      }
    }

    debugThreeCanvas('snap.applied', {
      itemId: item.id,
      itemType: item.type,
      snappedWall: nearest.wall,
      tolerance,
      distanceDelta: nearest.delta,
      rotationBefore,
      rotationAfter: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      positionBefore,
      positionAfter: [obj.position.x, obj.position.y, obj.position.z],
    });
  };

  const onItemPointerDown = (e: ThreeEvent<PointerEvent>, id: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const group = groupRefs.current.get(id) ?? ((e as any).eventObject as THREE.Object3D) ?? (e.object as THREE.Object3D);
    if (!group) return;
    const itemMeta = items.find(entry => entry.id === id);
    debugThreeCanvas('pointer.down', {
      itemId: id,
      itemType: itemMeta?.type,
      pointer: { x: e.point.x, y: e.point.y, z: e.point.z },
      rotation: [group.rotation.x, group.rotation.y, group.rotation.z],
      position: [group.position.x, group.position.y, group.position.z],
    });
    setSelectedObj(group);
    ignoreFloorUntil.current = performance.now() + 150;

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -e.point.y);
    if (e.ray.intersectPlane(plane, planeHit)) {
      const offset = new THREE.Vector3().subVectors(group.position, planeHit);
      drag.current = { plane, offset, obj: group };
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (controls.current) controls.current.enabled = false;
  };
  const onItemPointerUp = (e: ThreeEvent<PointerEvent>, id: number) => {
    e.stopPropagation();
    const dragState = drag.current;
    const group = groupRefs.current.get(id) ?? dragState?.obj ?? null;
    const itemMeta = items.find(entry => entry.id === id);
    const rotationBeforeSnap = group ? [group.rotation.x, group.rotation.y, group.rotation.z] : null;
    const positionBeforeSnap = group ? [group.position.x, group.position.y, group.position.z] : null;
    if (dragState && group) {
      snapToRoomWalls(itemMeta, group);
    }
    drag.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    if (controls.current) controls.current.enabled = true;
    if (!group || !itemMeta) return;

    const proposedPosition: [number, number, number] = [
      group.position.x,
      group.position.y,
      group.position.z,
    ];
    const snappedPosition = snapPosition(itemMeta, proposedPosition);
    if (
      snappedPosition[0] !== proposedPosition[0] ||
      snappedPosition[1] !== proposedPosition[1] ||
      snappedPosition[2] !== proposedPosition[2]
    ) {
      group.position.set(snappedPosition[0], snappedPosition[1], snappedPosition[2]);
      group.updateMatrixWorld();
    }

    const finalRotation: [number, number, number] = [group.rotation.x, group.rotation.y, group.rotation.z];
    debugThreeCanvas('pointer.up', {
      itemId: id,
      itemType: itemMeta?.type,
      rotationBeforeSnap,
      rotationAfterSnap: finalRotation,
      positionBeforeSnap,
      positionAfterSnap: snappedPosition,
      appliedSpacing: !!onItemsBatchChange,
    });
    commitPosition(id, snappedPosition, finalRotation);
    applySpacingAndSync(id, snappedPosition);
  };
  const onItemPointerMove = (e: ThreeEvent<PointerEvent>) => {
  if (!drag.current) return;          // exit if not dragging
  e.stopPropagation();
  const { plane, offset, obj } = drag.current;
  if (e.ray.intersectPlane(plane, planeHit)) {
    planeHit.add(offset);
    obj.position.copy(planeHit);
  }
};


  // Map texture IDs to their actual sources
  const getTextureSrc = (surfaceType: SurfaceType, textureId: string) => {
    const surfaceTextures = textureLibrary[surfaceType];
    const texture = surfaceTextures.find(t => t.id === textureId);
    return texture ? texture.src : '';
  };

  const handleCanvasClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (performance.now() < ignoreFloorUntil.current) return;
    setSelectedObj(null);
    if (event.point && event.face) {
      const point: [number, number, number] = [event.point.x, event.point.y, event.point.z];
      const normal: [number, number, number] = [event.face.normal.x, event.face.normal.y, event.face.normal.z];
      const surfaceType = event.object.userData.type as SurfaceType | undefined;
      onSurfaceClick({ point, normal, surfaceType });
    }
  };

  const handleItemContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>, itemId: number) => {
      if (!onItemContextMenu) {
        return;
      }

      event.stopPropagation();
      event.nativeEvent.preventDefault();

      onItemContextMenu(itemId, {
        x: event.nativeEvent.clientX,
        y: event.nativeEvent.clientY,
      });
    },
    [onItemContextMenu]
  );

  return (
    <Canvas shadows camera={{ position: [0, 5, 12], fov: 50 }} >
      <ambientLight intensity={0.7} />
      <directionalLight
        castShadow
        position={[10, 20, 5]}
        intensity={1.5}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        minDistance={0.5}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
       />

      <SelectionBox target={selectedObj} />

      <Room
        onSurfaceClick={handleCanvasClick}
        textureSrc={getTextureSrc('floor', textures.floor)}
        width={roomDimensions.width}
        depth={roomDimensions.depth}
      />

      {selectedPosition && <SelectionMarker position={selectedPosition.point} normal={selectedPosition.normal} />}

      {/* Render current drawing in progress */}
      {drawingPoints.length > 0 && (
        <>
          <Line points={drawingPoints} color="cyan" lineWidth={3} />
          {drawingPoints.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshBasicMaterial color="cyan" />
            </mesh>
          ))}
        </>
      )}

      {/* Render completed backsplashes */}
      {backsplashes.map(bs => (
        <BacksplashMesh key={bs.id} points={bs.points} normal={bs.normal} textureSrc={getTextureSrc('backsplash', textures.backsplash)} onSurfaceClick={handleCanvasClick} />
      ))}

      <Suspense fallback={null}>
        {items.map((item) => {
          const isCornerItem = isCornerItemType(item.type);

          const groupProps = {
            ref: (node: THREE.Group | null) => {
              if (node) {
                groupRefs.current.set(item.id, node);
              } else {
                groupRefs.current.delete(item.id);
              }
            },
            position: item.position,
            // leave wrapper unrotated for corner cabinets so the component can pivot itself
            rotation: (isCornerItem ? [0, 0, 0] : (item.rotation as any)) as any,
            scale: item.scale,
            userData: { isSelectableRoot: true },
            onPointerDown: (e: ThreeEvent<PointerEvent>) => onItemPointerDown(e, item.id),
            onPointerMove: onItemPointerMove,
            onPointerUp: (e: ThreeEvent<PointerEvent>) => onItemPointerUp(e, item.id),
            onContextMenu: (event: ThreeEvent<MouseEvent>) => handleItemContextMenu(event, item.id),
          };

          if (process.env.NODE_ENV !== "production" && isCornerItem) {
            console.debug("[three-canvas][apps/frontend/src/components/ThreeCanvas.tsx][corner-item]", {
              id: item.id,
              type: item.type,
              position: item.position,
              wrapperRotation: groupProps.rotation,
              forwardedRotation: item.rotation,
              scale: item.scale,
            });
          }

          const cabinetKey = item.openingPattern ? `${item.type}_${item.openingPattern}` : item.type;
          const CabinetComponent =
            CABINET_COMPONENTS[cabinetKey] ?? CABINET_COMPONENTS[item.type];

          const baseDimensions = getItemSceneDimensions(item.type);
          const fallbackWidthInches = sceneUnitsToInches(baseDimensions.width);
          const fallbackHeightInches = sceneUnitsToInches(baseDimensions.height);
          const fallbackDepthInches = sceneUnitsToInches(baseDimensions.depth);
          const widthInches = item.widthInches ?? fallbackWidthInches;
          const heightInches = item.heightInches ?? fallbackHeightInches;
          const depthInches = item.depthInches ?? fallbackDepthInches;
          const appliedDoorStyle = item.doorStyle ?? cabinetOptions.doorStyle;
          const appliedFrameSystem = cabinetOptions.frameSystem;
          const appliedDoorColor = cabinetOptions.doorColor;
          const appliedFrameColor = cabinetOptions.frameColor;

          try {
            if (CabinetComponent) {
          const roomProps =
            item.type === 'corner_cabinet_lower'
              ? {
                  roomHalfW: roomDimensions.width / 2,
                  roomHalfD: roomDimensions.depth / 2,
                  wallThickness: 0.1,
                }
              : {};

          return (
            <group key={item.id} {...groupProps}>
              <CabinetComponent
                width={widthInches}
                height={heightInches}
                depth={depthInches}
                frameSystem={appliedFrameSystem}
                doorStyle={appliedDoorStyle}
                doorColor={appliedDoorColor}
                frameColor={appliedFrameColor}
                {...roomProps}
                // pass the yaw into the component only for corner cabinets
                {...(isCornerItem ? { rotation: item.rotation as any } : {})}
              />
            </group>
          );
            }

            const preferredCatalogId = selectCatalogIdForItem(item);
            let catalogItem =
              (preferredCatalogId ? resolveCatalogForObject({ id: preferredCatalogId }) : null) ??
              resolveCatalogForObject({ id: item.type }) ??
              resolveCatalogForObject({ name: item.type }) ??
              resolveCatalogForObject({ type: item.type });

            if (!catalogItem) {
              console.warn(`No catalog item found for type: ${item.type}`);
              return null;
            }

            const catalogEntry = CATALOG_COMPONENTS[catalogItem.id];
            if (catalogEntry) {
              const { component: CatalogComponent, props: extraProps = {} } = catalogEntry;
              const widthForComponent =
                item.widthInches ?? catalogItem.width_in ?? widthInches;
              const heightForComponent =
                item.heightInches ?? catalogItem.height_in ?? heightInches;
              const depthForComponent =
                item.depthInches ?? catalogItem.depth_in ?? depthInches;

              const {
                doorStyle: overrideDoorStyle,
                doorColor: overrideDoorColor,
                frameColor: overrideFrameColor,
                frameSystem: overrideFrameSystem,
                ...restExtraProps
              } = extraProps;

              return (
                <group key={item.id} {...groupProps}>
                  <CatalogComponent
                    width={(widthForComponent ?? widthInches) ?? 24}
                    height={(heightForComponent ?? heightInches) ?? 34.5}
                    depth={(depthForComponent ?? depthInches) ?? 24}
                    frameSystem={overrideFrameSystem ?? appliedFrameSystem}
                    doorStyle={overrideDoorStyle ?? appliedDoorStyle}
                    doorColor={overrideDoorColor ?? appliedDoorColor}
                    frameColor={overrideFrameColor ?? appliedFrameColor}
                    {...restExtraProps}
                  />
                </group>
              );
            }

            return (
              <group key={item.id} {...groupProps}>
                <GLBModel
                  modelPath={catalogItem.modelPath}
                  position={[0, 0, 0]}
                  rotation={[0, 0, 0]}
                  scale={[1, 1, 1]}
                  itemType={item.type}
                  catalogItem={{
                    id: catalogItem.id,
                    name: catalogItem.name,
                    category: catalogItem.category,
                    width_in: catalogItem.width_in,
                    height_in: catalogItem.height_in,
                    depth_in: catalogItem.depth_in,
                    scale: catalogItem.scale,
                  }}
                  countertopTextureSrc={getTextureSrc('countertop', textures.countertop)}
                  interactive
                  onLoad={() => console.log(`Model loaded: ${catalogItem.name}`)}
                  onError={(error) => console.error(`Failed to load model ${catalogItem.name}:`, error)}
                />
              </group>
            );
          } catch (error) {
            console.error('Error rendering item:', item, error);
            return null;
          }
        })}
      </Suspense>

    </Canvas>
  );
};

export default ThreeCanvas;
