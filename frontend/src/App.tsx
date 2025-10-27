import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RoomType, SceneItem, SelectedPosition, ItemType, Backsplash, SurfaceType, RoomDimensions } from './types';
import Controls from './components/Controls';
import ThreeCanvas from './components/ThreeCanvas';
import { processCommand } from './services/geminiService';
import ModeToggle, { Mode } from './components/ModeToggle';
import TextureSelector from './components/TextureSelector';
import ContextMenu, { ContextMenuAction } from './components/ContextMenu';
import { textureLibrary } from './components/textures/textureLibrary';
import { inchesToSceneUnits } from './lib/units';
import { getItemSceneDimensions, scaleDimensions } from './lib/items/dimensions';
import { computeSpacingAdjustments } from './lib/layout/spacingSolver';
import CabinetConfigurator from './components/CabinetConfigurator';
import { DEFAULT_DOOR_COLOR, type OpeningPattern, type DoorStyle } from './components/Cabinet';
import type { CabinetOptions } from './types/cabinet';
import CornerCabinetTestHarness from './components/CornerCabinetTestHarness';

const floorItemTypes: ItemType[] = [
    'base_cabinet', 'pantryTall', 'kitchen_island', 'sink', 'toilet', 'bathtub', 'fridge', 'range', 'dishwasher', 'corner_cabinet_lower'
];
const wallItemTypes: ItemType[] = ['upper_cabinet', 'vent_hood', 'corner_cabinet_upper', 'microwave_wall'];
const wallSnapItemTypes: ItemType[] = [
  'base_cabinet',
  'pantryTall',
  'upper_cabinet',
  'vent_hood',
  'fridge',
  'range',
  'toilet',
  'bathtub',
  'sink',
  'dishwasher',
  'microwave_wall',
];
const cornerItemTypes: ItemType[] = ['corner_cabinet_lower', 'corner_cabinet_upper'];
const isCorner = (t: ItemType) => cornerItemTypes.includes(t);

// Define standard placement heights for wall-mounted items (in scene units)
const standardWallItemBottomHeight: { [key: string]: number } = {
    upper_cabinet: 2.25, // 54 inches (assuming 1 unit = 24 inches)
    vent_hood: 2.625,   // 63 inches (standard clearance over a 36" range)
    corner_cabinet_upper: 2.25,
    microwave_wall: 2.5,
};

const MIN_ROOM_DIMENSION_UNITS = inchesToSceneUnits(60); // 5 feet minimum to avoid collapsing geometry
const DEFAULT_ROOM_DIMENSIONS: RoomDimensions = {
  width: inchesToSceneUnits(144), // 12 ft
  depth: inchesToSceneUnits(180), // 15 ft
};

const ITEM_CONTEXT_MENU_ACTIONS: ContextMenuAction[] = [
  { id: 'rotate_cw', label: 'Rotate 90 deg clockwise', shortcut: 'R' },
  { id: 'rotate_ccw', label: 'Rotate 90 deg counter-clockwise', shortcut: 'Shift+R' },
  { id: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D' },
  { id: 'delete', label: 'Delete', shortcut: 'Del', variant: 'danger' },
];

const App: React.FC = () => {
  const [roomType, setRoomType] = useState<RoomType>(RoomType.Kitchen);
  const [items, setItems] = useState<SceneItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<SelectedPosition | null>(null);
  const [mode, setMode] = useState<Mode>('placement');
  const [drawingPoints, setDrawingPoints] = useState<[number, number, number][]>([]);
  const [drawingNormal, setDrawingNormal] = useState<[number, number, number] | null>(null);
  const [backsplashes, setBacksplashes] = useState<Backsplash[]>([]);
  const [roomDimensions, setRoomDimensions] = useState<RoomDimensions>(DEFAULT_ROOM_DIMENSIONS);
  const [cabinetOptions, setCabinetOptions] = useState<CabinetOptions>({
    doorStyle: 'shaker',
    frameSystem: 'fullOverlay',
    doorColor: DEFAULT_DOOR_COLOR,
    frameColor: DEFAULT_DOOR_COLOR,
  });
  const [testMode, setTestMode] = useState<string | null>(null);

  const [surfaceTextures, setSurfaceTextures] = useState<{ [key in SurfaceType]: string }>({
    floor: 'wood_light',
    countertop: 'marble_white',
    backsplash: 'subway_tile',
  });
  const [editingSurface, setEditingSurface] = useState<SurfaceType | null>(null);
  const nextContextMenuRequestId = useRef(0);
  const [itemContextMenu, setItemContextMenu] = useState<
    { x: number; y: number; itemId: number; requestId: number } | null
  >(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testParam = params.get('test');
    if (testParam) {
      setTestMode(testParam);
    }
    // Set a global flag for Playwright to detect test environment
    (window as any).Playwright = !!testParam;
  }, []);

  useEffect(() => {
    setItemContextMenu(null);
    if (mode !== 'drawing') {
      setDrawingPoints([]);
      setDrawingNormal(null);
    }
    if (mode !== 'placement') {
      setSelectedPosition(null);
    }
    if (mode !== 'texturing') {
      setEditingSurface(null);
    }
  }, [mode]);

  const closeItemContextMenu = useCallback(() => {
    setItemContextMenu(null);
  }, []);

  const handleItemContextMenu = useCallback((itemId: number, position: { x: number; y: number }) => {
    nextContextMenuRequestId.current += 1;
    setItemContextMenu({
      itemId,
      x: position.x,
      y: position.y,
      requestId: nextContextMenuRequestId.current,
    });
    setSelectedPosition(null);
  }, []);

  const handleCabinetOptionsChange = useCallback((patch: Partial<CabinetOptions>) => {
    setCabinetOptions(prev => ({ ...prev, ...patch }));
  }, []);

  const rotateItem = useCallback((itemId: number, direction: 1 | -1) => {
    const angleStep = (Math.PI / 2) * direction;
    const snap90 = (y: number) => Math.round(y / (Math.PI / 2)) * (Math.PI / 2);
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? {
              ...item,
              rotation: [
                item.rotation[0],
                snap90(item.rotation[1] + angleStep),
                item.rotation[2],
              ],
            }
          : item
      )
    );
  }, []);


  const duplicateItem = useCallback((itemId: number) => {
    setItems(prevItems => {
      const original = prevItems.find(item => item.id === itemId);
      if (!original) {
        return prevItems;
      }

      const offset = 0.5;
      const duplicated: SceneItem = {
        ...original,
        id: Date.now() + Math.floor(Math.random() * 1000),
        position: [
          original.position[0] + offset,
          original.position[1],
          original.position[2] + offset,
        ],
      };

      return [...prevItems, duplicated];
    });
  }, []);

  const removeItem = useCallback((itemId: number) => {
    setItems(prevItems => prevItems.filter(item => item.id !== itemId));
  }, []);

  const handleItemsBatchChange = useCallback(
    (updates: Array<{ id: number; position?: [number, number, number]; rotation?: [number, number, number] }>) => {
      if (updates.length === 0) return;

      setItems(prevItems => {
        const updateMap = new Map(updates.map(update => [update.id, update]));
        let changed = false;
        const nextItems = prevItems.map(item => {
          const update = updateMap.get(item.id);
          if (!update) return item;

          const nextPosition = update.position ?? item.position;
          const nextRotation = update.rotation ?? item.rotation;

          const samePosition =
            nextPosition === item.position ||
            (nextPosition.length === item.position.length &&
              nextPosition.every((value, idx) => value === item.position[idx]));
          const sameRotation =
            nextRotation === item.rotation ||
            (nextRotation.length === item.rotation.length &&
              nextRotation.every((value, idx) => value === item.rotation[idx]));

          if (samePosition && sameRotation) {
            return item;
          }

          changed = true;
          return {
            ...item,
            position: nextPosition,
            rotation: nextRotation,
          };
        });

        return changed ? nextItems : prevItems;
      });
    },
    []
  );

  const handleItemContextMenuAction = useCallback(
    (actionId: string, itemId: number) => {
      switch (actionId) {
        case 'rotate_cw':
          rotateItem(itemId, 1);
          break;
        case 'rotate_ccw':
          rotateItem(itemId, -1);
          break;
        case 'duplicate':
          duplicateItem(itemId);
          break;
        case 'delete':
          removeItem(itemId);
          break;
        default:
          break;
      }

      closeItemContextMenu();
    },
    [rotateItem, duplicateItem, removeItem, closeItemContextMenu]
  );

  const handleFinishDrawing = useCallback(() => {
    if (drawingPoints.length > 2 && drawingNormal) {
      setBacksplashes(prev => [...prev, {
        id: Date.now(),
        points: drawingPoints,
        normal: drawingNormal,
      }]);
    }
    setDrawingPoints([]);
    setDrawingNormal(null);
  }, [drawingPoints, drawingNormal]);

  const handleCancelDrawing = useCallback(() => {
    setDrawingPoints([]);
    setDrawingNormal(null);
  }, []);

  const handleUndoPoint = useCallback(() => {
    setDrawingPoints(prev => {
      const newPoints = prev.slice(0, -1);
      if (newPoints.length === 0) {
        setDrawingNormal(null);
      }
      return newPoints;
    });
  }, []);

  const handleSurfaceClick = useCallback((position: SelectedPosition) => {
    setItemContextMenu(null);
    const { surfaceType, point, normal } = position;

    if (mode === 'drawing') {
      if (surfaceType !== 'backsplash') {
        console.warn('[Backsplash] Select a wall surface to add backsplash points.');
        return;
      }

      if (!drawingNormal) {
        setDrawingNormal(normal);
      } else {
        const lenA = Math.hypot(drawingNormal[0], drawingNormal[1], drawingNormal[2]) || 1;
        const lenB = Math.hypot(normal[0], normal[1], normal[2]) || 1;
        const dot =
          (drawingNormal[0] / lenA) * (normal[0] / lenB) +
          (drawingNormal[1] / lenA) * (normal[1] / lenB) +
          (drawingNormal[2] / lenA) * (normal[2] / lenB);

        if (dot < 0.85) {
          console.warn('[Backsplash] Point is not coplanar with the current backsplash; ignoring.');
          return;
        }
      }

      setDrawingPoints(prev => [...prev, point]);
      setSelectedPosition(position);
      return;
    }

    if (mode === 'texturing') {
      if (surfaceType) {
        setEditingSurface(surfaceType);
      }
      setSelectedPosition(null);
      return;
    }

    setSelectedPosition(position);
    setEditingSurface(null);
  }, [mode, drawingNormal]);

  const isDebugEnabled = process.env.NODE_ENV !== 'production';
  const debugPlacement = useCallback(
    (label: string, payload: Record<string, unknown>) => {
      if (!isDebugEnabled) return;
      let formatted: unknown = payload;
      try {
        formatted = JSON.stringify(payload, null, 2);
      } catch {
        // keep raw payload on failure
      }
      console.debug(`[placement][apps/frontend/src/App.tsx] ${label}`, formatted);
    },
    [isDebugEnabled]
  );

  const getFinalPlacement = useCallback((
    itemType: ItemType,
    targetPosition: { x: number; y: number; z: number; },
    currentScale: [number, number, number],
    currentRotation: [number, number, number],
    allItems: SceneItem[], // eslint-disable-line @typescript-eslint/no-unused-vars
    _currentItemId?: number | null
  ): { position: [number, number, number], rotation: [number, number, number] } => {

    let finalPosition: [number, number, number] = [targetPosition.x, targetPosition.y, targetPosition.z];
    let finalRotation = [...currentRotation] as [number, number, number];

    debugPlacement('input', {
      itemType,
      targetPosition: { ...targetPosition },
      currentScale: [...currentScale],
      currentRotation: [...currentRotation],
    });

    const baseDimensions = getItemSceneDimensions(itemType);
    const scaledDimensions = scaleDimensions(baseDimensions, currentScale);

    // --- Floor Snap Logic ---
    if (floorItemTypes.includes(itemType)) {
        // Pivot is aligned to the base of the model, so keep it on the floor.
        finalPosition[1] = 0;
    }

    // --- Wall Item Default Height Logic ---
    if (wallItemTypes.includes(itemType)) {
        const bottomHeight = standardWallItemBottomHeight[itemType];
        finalPosition[1] = bottomHeight;
    }

    const roomHalfWidth = roomDimensions.width / 2;
    const roomHalfDepth = roomDimensions.depth / 2;
    const originalXRotation = finalRotation[0];
    const originalZRotation = finalRotation[2];

    let snappedWall: 'front' | 'back' | 'left' | 'right' | null = null;

    // --- Corner Snap Logic ---
    // Corner cabinets: the model handles its own internal offset.
    // Use only the corner yaw here.
    if (isCorner(itemType)) {
      const [x, , z] = finalPosition;
      const distToLeft = Math.abs(x - (-roomHalfWidth));
      const distToRight = Math.abs(x - roomHalfWidth);
      const distToBack = Math.abs(z - (-roomHalfDepth));
      const distToFront = Math.abs(z - roomHalfDepth);

      const TH = 2.5;
      let targetCorner: 'back-left' | 'back-right' | 'front-left' | 'front-right' | null = null;

      if (distToBack < TH && distToLeft < TH) targetCorner = 'back-left';
      else if (distToBack < TH && distToRight < TH) targetCorner = 'back-right';
      else if (distToFront < TH && distToLeft < TH) targetCorner = 'front-left';
      else if (distToFront < TH && distToRight < TH) targetCorner = 'front-right';

      if (targetCorner) {
        const wallInset = 0.001;
        const before = { position: [...finalPosition], rotation: finalRotation[1] };

        if (targetCorner === 'back-left') {
          finalPosition[0] = -roomHalfWidth + wallInset;
          finalPosition[2] = -roomHalfDepth + wallInset;
        } else if (targetCorner === 'back-right') {
          finalPosition[0] = roomHalfWidth - wallInset;
          finalPosition[2] = -roomHalfDepth + wallInset;
        } else if (targetCorner === 'front-left') {
          finalPosition[0] = -roomHalfWidth + wallInset;
          finalPosition[2] = roomHalfDepth - wallInset;
        } else {
          finalPosition[0] = roomHalfWidth - wallInset;
          finalPosition[2] = roomHalfDepth - wallInset;
        }

        const yawByCorner: Record<'back-left' | 'back-right' | 'front-left' | 'front-right', number> = {
          'back-left': 0,
          'back-right': -Math.PI / 2,
          'front-left': Math.PI / 2,
          'front-right': Math.PI,
        };
        finalRotation[1] = yawByCorner[targetCorner];

        snappedWall = null;

        debugPlacement('corner-snap', {
          itemType,
          rawPosition: before.position,
          distances: { distToLeft, distToRight, distToBack, distToFront },
          target: targetCorner,
          finalPosition: [...finalPosition],
          finalYawRadians: finalRotation[1],
        });
      }
    }

    // normalize yaw to nearest 90 degrees
    finalRotation[1] = Math.round(finalRotation[1] / (Math.PI / 2)) * (Math.PI / 2);

    // --- Wall Snap Logic ---
    if (wallSnapItemTypes.includes(itemType)) {
        const WALL_SNAP_THRESHOLD = 1.25;
        const itemHalfWidth = (scaledDimensions.width || 1) / 2;
        const itemHalfDepth = (scaledDimensions.depth || scaledDimensions.width || 1) / 2;

        const distances = [
            {
                wall: 'back' as const,
                distance: Math.abs(targetPosition.z - (-roomHalfDepth)),
                snap: () => {
                    finalPosition[2] = -roomHalfDepth + itemHalfDepth;
                    finalRotation[1] = -Math.PI / 2;
                },
            },
            {
                wall: 'front' as const,
                distance: Math.abs(targetPosition.z - roomHalfDepth),
                snap: () => {
                    finalPosition[2] = roomHalfDepth - itemHalfDepth;
                    finalRotation[1] = Math.PI / 2;
                },
            },
            {
                wall: 'left' as const,
                distance: Math.abs(targetPosition.x - (-roomHalfWidth)),
                snap: () => {
                    finalPosition[0] = -roomHalfWidth + itemHalfWidth;
                    finalRotation[1] = -Math.PI / 2;
                },
            },
            {
                wall: 'right' as const,
                distance: Math.abs(targetPosition.x - roomHalfWidth),
                snap: () => {
                    finalPosition[0] = roomHalfWidth - itemHalfWidth;
                    finalRotation[1] = -Math.PI / 2;
                },
            },
        ];

        const closest = distances.reduce((prev, curr) => (curr.distance < prev.distance ? curr : prev));

        if (closest.distance <= WALL_SNAP_THRESHOLD) {
            closest.snap();
            snappedWall = closest.wall;
            finalRotation[0] = originalXRotation;
            finalRotation[2] = originalZRotation;
            debugPlacement('wall-snap', {
              itemType,
              snappedWall,
              snapDistance: closest.distance,
              positionAfterSnap: [...finalPosition],
              yawAfterSnap: finalRotation[1],
            });
        }
    }

    // --- Additional yaw rotation for wall objects except corner cabinets ---
    if (!isCorner(itemType)) {
        if (snappedWall === 'front' || snappedWall === 'back') {
            finalRotation[1] += Math.PI / 2;
        } else if (snappedWall === 'left') {
            finalRotation[1] += Math.PI;
        }
    }

    const finalResult = { position: finalPosition, rotation: finalRotation };
    debugPlacement('result', {
      itemType,
      result: finalResult,
      snappedWall,
      isCorner: isCorner(itemType),
    });
    return finalResult;
  }, [roomDimensions, debugPlacement]);

   const handleCommand = useCallback(async (command: string) => {
     console.log('handleCommand executed');
     setLoading(true);
     setError(null);
     try {
       const functionCalls = await processCommand(command, roomType, items, selectedPosition?.point || null, roomDimensions);
       for (const call of functionCalls || []) {
         if (call.name === 'setRoomDimensions') {
           const args = call.args as { width?: number; depth?: number };
           setRoomDimensions(prev => ({
             width: Math.max(MIN_ROOM_DIMENSION_UNITS, args.width ?? prev.width),
             depth: Math.max(MIN_ROOM_DIMENSION_UNITS, args.depth ?? prev.depth),
           }));
           continue;
         }

        if (call.name === 'addItem') {
          const args = call.args as {
            type: string;
            position: { x: number; y: number; z: number };
            rotation?: { x: number; y: number; z: number };
            scale?: { x: number; y: number; z: number };
            catalogId?: string;
            widthInches?: number;
            heightInches?: number;
            depthInches?: number;
            openingPattern?: OpeningPattern;
            doorStyle?: DoorStyle;
            category?: string;
          };
          const {
            type,
            position,
            rotation = { x: 0, y: 0, z: 0 },
            scale = { x: 1, y: 1, z: 1 },
            catalogId,
            widthInches,
            heightInches,
            depthInches,
            openingPattern,
            doorStyle,
            category,
          } = args;

           setItems(prev => {
             const finalPlacement = getFinalPlacement(
               type as ItemType,
               position,
               [scale.x, scale.y, scale.z],
               [rotation.x, rotation.y, rotation.z],
               prev,
             );

             console.debug('[App] addItem resolved placement', {
               requestedType: type,
               finalType: type,
               finalPosition: finalPlacement.position,
               finalRotation: finalPlacement.rotation,
             });

             const newId = Date.now() + Math.floor(Math.random() * 1000);
            const proposedItem: SceneItem = {
              id: newId,
              type: type as ItemType,
              position: finalPlacement.position,
              rotation: finalPlacement.rotation,
              scale: [scale.x, scale.y, scale.z],
              catalogId,
              widthInches,
              heightInches,
              depthInches,
              openingPattern: openingPattern as OpeningPattern | undefined,
              doorStyle: doorStyle as DoorStyle | undefined,
              category: category as SceneItem['category'],
            };

            const itemsWithNew = [...prev, proposedItem];
            const adjustments = computeSpacingAdjustments({
              movedItemId: newId,
              proposedPosition: proposedItem.position,
              items: itemsWithNew,
              roomDimensions,
            });

            if (!adjustments.length) {
              return itemsWithNew;
            }

            const updatedPositions = new Map<number, [number, number, number]>();
            for (const adjustment of adjustments) {
              updatedPositions.set(adjustment.id, adjustment.position);
            }

             return itemsWithNew.map(item => {
               const updated = updatedPositions.get(item.id);
               if (!updated) return item;
               return { ...item, position: updated };
             });
           });
         } else if (call.name === 'moveItem') {
           type MoveArgs =
            | { id: number; newPosition: { x: number; y: number; z: number } }
            | { id: number; position: { x: number; y: number; z: number } };

           const a = call.args as MoveArgs;
           const id = (a as any).id;
           const p = ('newPosition' in a ? (a as any).newPosition : (a as any).position);
           if (!p) return;

           setItems(prev =>
            prev.map(it =>
              it.id === id ? { ...it, position: [p.x, p.y, p.z] } : it
            )
          );
         } else if (call.name === 'removeItem') {
           const args = call.args as { id: number };
           const { id } = args;
           setItems(prev => prev.filter(item => item.id !== id));
         } else if (call.name === 'updateItem') {
           const args = call.args as { id: number; properties: any };
           const { id, properties } = args;
           const updatedProperties: Partial<SceneItem> = {};
           if (properties.position) {
             if (Array.isArray(properties.position)) {
               updatedProperties.position = properties.position;
             } else if (typeof properties.position === 'object') {
               const pos = properties.position as unknown as { x: number; y: number; z: number };
               updatedProperties.position = [pos.x, pos.y, pos.z];
             }
           }
           if (properties.rotation) {
             if (Array.isArray(properties.rotation)) {
               updatedProperties.rotation = properties.rotation;
             } else if (typeof properties.rotation === 'object') {
               const rot = properties.rotation as unknown as { x: number; y: number; z: number };
               updatedProperties.rotation = [rot.x, rot.y, rot.z];
             }
           }
           if (properties.scale) {
             if (Array.isArray(properties.scale)) {
               updatedProperties.scale = properties.scale;
             } else if (typeof properties.scale === 'object') {
               const scl = properties.scale as unknown as { x: number; y: number; z: number };
               updatedProperties.scale = [scl.x, scl.y, scl.z];
             }
           }
           if (properties.type) {
             updatedProperties.type = properties.type as ItemType;
           }
           setItems(prev => prev.map(item =>
             item.id === id ? { ...item, ...updatedProperties } : item
           ));
         }
       }
     } catch (e: any) {
     setError(e.message || 'An error occurred processing the command');
    } finally {
      setLoading(false);
    }
   }, [roomType, items, selectedPosition, getFinalPlacement, roomDimensions]);


  if (testMode === 'cornerCabinet') {
    const params = new URLSearchParams(window.location.search);
    const width = parseFloat(params.get('width') || '24');
    const depth = parseFloat(params.get('depth') || '24');
    const height = parseFloat(params.get('height') || '34.5');
    const blindInset = parseFloat(params.get('blindInset') || '12');
    const rotationY = parseFloat(params.get('rotationY') || '0');
    const itemId = parseInt(params.get('itemId') || '1');

    return (
      <CornerCabinetTestHarness
        width={width}
        depth={depth}
        height={height}
        blindInset={blindInset}
        rotationY={rotationY}
        itemId={itemId}
      />
    );
  }

  return (

    <div className="h-screen w-screen bg-gray-900 text-white relative">

      <ThreeCanvas
        items={items}
        selectedPosition={selectedPosition}
        onSurfaceClick={handleSurfaceClick}
        drawingPoints={drawingPoints}
        backsplashes={backsplashes}
        textures={surfaceTextures}
        roomDimensions={roomDimensions}
        cabinetOptions={cabinetOptions}
        onItemContextMenu={handleItemContextMenu}
        onItemsBatchChange={handleItemsBatchChange}
      />

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <Controls

          onCommand={handleCommand}

          loading={loading}

          roomType={roomType}

          onRoomChange={setRoomType}

          disabled={mode !== 'placement'}

        />
      </div>

      <ModeToggle
        mode={mode}
        setMode={setMode}
        onFinishDrawing={handleFinishDrawing}
        onCancelDrawing={handleCancelDrawing}
        onUndoPoint={handleUndoPoint}
        isDrawing={drawingPoints.length > 0}
      />

      <CabinetConfigurator
        isOpen={mode === 'cabinetry'}
        options={cabinetOptions}
        onChange={handleCabinetOptionsChange}
      />

      <TextureSelector

        editingSurface={editingSurface}

        textureLibrary={textureLibrary}

        currentTextures={surfaceTextures}

        onSelect={(surface, textureId) => setSurfaceTextures(prev => ({ ...prev, [surface]: textureId }))}

        onClose={() => setEditingSurface(null)}

      />

      {itemContextMenu && (
        <div
          className="fixed inset-0 z-20"
          onClick={closeItemContextMenu}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            closeItemContextMenu();
          }}
        >
          <ContextMenu
            key={itemContextMenu.requestId}
            x={itemContextMenu.x}
            y={itemContextMenu.y}
            actions={ITEM_CONTEXT_MENU_ACTIONS}
            onAction={(actionId) => handleItemContextMenuAction(actionId, itemContextMenu.itemId)}
            onClose={closeItemContextMenu}
          />
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white p-2 rounded-md shadow-lg z-50">
          {error}
        </div>
      )}

    </div>
  );
};

export default App;

