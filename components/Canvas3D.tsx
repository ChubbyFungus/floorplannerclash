import React, { Suspense, useRef, useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, extend } from '@react-three/fiber';
import { OrbitControls, TransformControls, Box, Plane, Cylinder, Html, Text, useTexture, Line } from '@react-three/drei';
import type { Floorplan, FloorplanObject, Choice, RoomState, ObjectType } from '../types';
import './models';

// Temporary conversion function until all components use RoomState directly
const convertRoomStateToFloorplan = (roomState: RoomState | null): Floorplan | null => {
  if (!roomState) return null;

  const inchToFeet = (val: number) => val / 12;

  const floorplanObjects: FloorplanObject[] = roomState.items.map(item => ({
    id: item.id,
    type: item.sku as ObjectType, // This is a simplification
    position: new THREE.Vector3(inchToFeet(item.x), inchToFeet(item.y), 0), // Z is missing
    rotation: new THREE.Vector3(0, item.rotDeg * (Math.PI / 180), 0),
    dimensions: { width: 3, height: 3, depth: 2 }, // Placeholder
    color: '#ffffff',
    material: 'white_laminate',
  }));

  return {
    room: {
      type: roomState.params.roomType as 'kitchen' | 'bathroom' || 'kitchen',
      dimensions: {
        width: inchToFeet(roomState.room.widthIn),
        depth: inchToFeet(roomState.room.depthIn),
      },
      floorMaterial: 'light_wood_plank',
    },
    objects: floorplanObjects,
  };
};


type AppState = 'INITIAL' | 'AWAITING_STYLE_CHOICE' | 'GATHERING_INFO' | 'GENERATING' | 'DISPLAYING';

interface Canvas3DProps {
  roomState: RoomState | null;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onObjectChange: (updatedObject: FloorplanObject) => void;
  appState: AppState;
  choices: Choice[] | null;
  onChoiceMade: (choice: Choice) => void;
  isGeneratingImages?: boolean;
  showWorkTriangle: boolean;
}

const textureCache: { [key: string]: THREE.CanvasTexture } = {};

const generateProceduralTexture = (material: string, color: string, width = 256, height = 256): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    switch (material) {
        case 'light_wood':
        case 'dark_wood':
        case 'light_wood_plank':
        case 'panel_ready':
            ctx.strokeStyle = material === 'light_wood' || material === 'light_wood_plank' || material === 'panel_ready' ? '#8c6b4f' : '#3d2b1f';
            ctx.lineWidth = 2;
            for (let i = 0; i < width; i += Math.random() * 10 + 5) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.bezierCurveTo(i + (Math.random() * 10 - 5), height / 3, i + (Math.random() * 10 - 5), (2 * height) / 3, i, height);
                ctx.stroke();
            }
            if (material === 'light_wood_plank') {
                ctx.strokeStyle = '#5a4430';
                ctx.lineWidth = 1;
                for (let j = 0; j < height; j += height / 4) {
                    ctx.beginPath();
                    ctx.moveTo(0, j);
                    ctx.lineTo(width, j);
                    ctx.stroke();
                }
            }
            break;

        case 'stainless_steel':
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, '#aaa');
            gradient.addColorStop(0.5, '#eee');
            gradient.addColorStop(1, '#aaa');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            for (let i = 0; i < 1000; i++) {
                ctx.fillRect(Math.random() * width, Math.random() * height, 2, 1);
            }
            break;

        case 'white_marble':
        case 'white-marble':
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
            ctx.lineWidth = 3;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(Math.random() * width, Math.random() * height);
                ctx.bezierCurveTo(Math.random() * width, Math.random() * height, Math.random() * width, Math.random() * height, Math.random() * width, Math.random() * height);
                ctx.stroke();
            }
            break;

        case 'black_granite':
        case 'black-granite':
            ctx.fillStyle = '#282828';
            ctx.fillRect(0, 0, width, height);
            for (let i = 0; i < 2000; i++) {
                const shade = Math.floor(Math.random() * 100 + 100);
                ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
                ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
            }
            break;

        case 'gray_tile':
        case 'white_porcelain':
            ctx.fillStyle = material === 'gray_tile' ? '#bbbbbb' : '#f0f0f0';
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = material === 'gray_tile' ? '#999999' : '#dddddd';
            ctx.lineWidth = 2;
            for (let i = 0; i < width; i += width / 4) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, height);
                ctx.stroke();
            }
            for (let j = 0; j < height; j += height / 4) {
                ctx.beginPath();
                ctx.moveTo(0, j);
                ctx.lineTo(width, j);
                ctx.stroke();
            }
            break;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const MaterialComponent: React.FC<{ materialName: string; color: string; repeat?: [number, number]; isSelected?: boolean; colorOverride?: string; }> = ({ materialName, color, repeat = [1, 1], isSelected, colorOverride }) => {
    if (isSelected) {
        return <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.2} />;
    }

    if (colorOverride) {
        return <meshStandardMaterial color={colorOverride} />;
    }

    const texture = useMemo(() => {
        const key = `${materialName}_${color}`;
        if (!textureCache[key]) {
            textureCache[key] = generateProceduralTexture(materialName, color);
        }
        const cachedTexture = textureCache[key].clone();
        cachedTexture.wrapS = cachedTexture.wrapT = THREE.RepeatWrapping;
        cachedTexture.repeat.set(repeat[0], repeat[1]);
        cachedTexture.anisotropy = 16;
        cachedTexture.needsUpdate = true;
        return cachedTexture;
    }, [materialName, color, repeat]);

    if (!materialName || materialName === 'white_laminate') {
        return <meshStandardMaterial color={color} />;
    }
    
    return <meshStandardMaterial map={texture} />;
};

const BarHandle: React.FC<{length: number, isVertical: boolean}> = ({ length, isVertical }) => {
    const handleColor = '#555555';
    const handleRadius = 0.02;
    const handlePostLength = 0.04;
    const handlePostRadius = 0.03;
    return (
        <group rotation={isVertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
            <Cylinder args={[handleRadius, handleRadius, length]}><meshStandardMaterial color={handleColor} metalness={0.8} roughness={0.3} /></Cylinder>
            <Cylinder args={[handlePostRadius, handlePostRadius, handlePostLength]} rotation={[Math.PI / 2, 0, 0]} position={[0, length/2 * 0.8, -handlePostLength/2]}><meshStandardMaterial color={handleColor} metalness={0.8} roughness={0.3} /></Cylinder>
            <Cylinder args={[handlePostRadius, handlePostRadius, handlePostLength]} rotation={[Math.PI / 2, 0, 0]} position={[0, -length/2 * 0.8, -handlePostLength/2]}><meshStandardMaterial color={handleColor} metalness={0.8} roughness={0.3} /></Cylinder>
        </group>
    );
};

// Custom TSX Components for each object type
const Refrigerator: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, height, depth } = object.dimensions;
    const freezerDoorHeight = height * 0.3;
    const fridgeDoorHeight = height * 0.7;
    const freezerTopY = -height / 2 + freezerDoorHeight;

    const mainMaterialProps = { materialName: object.material, color: object.color, isSelected };

    return (
        <group>
            {/* Main body */}
            <Box args={[width, height, depth]}>
                <MaterialComponent {...mainMaterialProps} />
            </Box>
            
            {/* Divider lines */}
            {/* Horizontal (between fridge and freezer) */}
            <Box args={[width * 1.01, 0.02, depth * 1.01]} position={[0, freezerTopY, 0]}>
                <meshStandardMaterial color="#333" />
            </Box>
             {/* Vertical (for French doors) */}
            <Box args={[0.02, fridgeDoorHeight, depth * 1.01]} position={[0, freezerTopY + fridgeDoorHeight/2, 0]}>
                <meshStandardMaterial color="#333" />
            </Box>

            {/* Handles */}
            <group position={[0, 0, depth / 2 + 0.04]}>
                {/* Left Fridge Handle */}
                <group position={[-width/4, freezerTopY + fridgeDoorHeight/2, 0]}>
                    <BarHandle length={fridgeDoorHeight * 0.6} isVertical={true} />
                </group>
                {/* Right Fridge Handle */}
                <group position={[width/4, freezerTopY + fridgeDoorHeight/2, 0]}>
                    <BarHandle length={fridgeDoorHeight * 0.6} isVertical={true} />
                </group>
                {/* Freezer Handle */}
                <group position={[0, -height/2 + freezerDoorHeight/2, 0]}>
                    <BarHandle length={width * 0.5} isVertical={false} />
                </group>
            </group>
        </group>
    );
};

const OvenAppliance: React.FC<{width: number, height: number, isSelected: boolean}> = ({width, height, isSelected}) => {
    const doorHeight = height * 0.7;
    const controlPanelHeight = height * 0.3;

    return (
        <group>
            {/* Main oven body */}
            <Box args={[width, height, 0.2]}>
                 <MaterialComponent materialName="stainless_steel" color="#aaa" isSelected={isSelected} />
            </Box>
            {/* Control Panel */}
            <Box args={[width, controlPanelHeight, 0.05]} position={[0, height/2 - controlPanelHeight/2, 0.11]}>
                <meshStandardMaterial color="#111" roughness={0.2} metalness={0.1} />
            </Box>
            {/* Door */}
            <group position={[0, -controlPanelHeight/2, 0]}>
                {/* Glass */}
                <Box args={[width * 0.8, doorHeight * 0.8, 0.05]} position={[0, 0, 0.11]}>
                    <meshStandardMaterial color="#111" roughness={0.1} metalness={0.2} transparent opacity={0.8} />
                </Box>
                 {/* Handle */}
                <group position={[0, doorHeight/2 - 0.2, 0.13]}>
                    <BarHandle length={width * 0.7} isVertical={false} />
                </group>
            </group>
        </group>
    )
}

const Oven: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, height, depth } = object.dimensions;
    const applianceWidth = width - 0.2; // Inset appliance slightly to show cabinet frame
    
    // Heuristic: Taller cabinets can house a double oven. Standard tall cabinets are ~7ft (84in).
    // A double oven appliance is ~4.25ft (51in).
    const isDoubleOven = height > 5;
    
    const singleOvenHeight = 2.5; // ~30 inches
    
    return (
        <group>
            {/* Cabinet Carcass */}
            <Box args={[width, height, depth]}>
                <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
            
            {isDoubleOven ? (
                (() => {
                    const doubleOvenHeight = 4.25; // ~51 inches
                    const upperOvenY = doubleOvenHeight / 4;
                    const lowerOvenY = -doubleOvenHeight / 4;
                    const ovenUnitHeight = doubleOvenHeight / 2 - 0.1;

                    const spaceAbove = height / 2 - doubleOvenHeight / 2;
                    const spaceBelow = height / 2 - doubleOvenHeight / 2;

                    return (
                         <>
                            {/* Ovens */}
                            <group position={[0, upperOvenY, depth / 2]}>
                                <OvenAppliance width={applianceWidth} height={ovenUnitHeight} isSelected={isSelected} />
                            </group>
                            <group position={[0, lowerOvenY, depth / 2]}>
                                <OvenAppliance width={applianceWidth} height={ovenUnitHeight} isSelected={isSelected} />
                            </group>
                            
                            {/* Cabinet door above */}
                            {spaceAbove > 1 && (
                                <group position={[0, doubleOvenHeight/2 + spaceAbove/2, depth/2]}>
                                    <ShakerDoor 
                                        width={width-0.04} 
                                        height={spaceAbove - 0.1} 
                                        materialName={object.material} 
                                        color={object.color} 
                                        isSelected={isSelected} 
                                    />
                                </group>
                            )}
                            
                            {/* Drawer/door below */}
                            {spaceBelow > 1 && (
                                <group position={[0, -doubleOvenHeight/2 - spaceBelow/2, depth/2]}>
                                    <ShakerDoor 
                                        width={width-0.04} 
                                        height={spaceBelow - 0.1} 
                                        materialName={object.material} 
                                        color={object.color} 
                                        isSelected={isSelected} 
                                    />
                                </group>
                            )}
                        </>
                    );
                })()
            ) : (
                (() => {
                    const ovenY = 1; // Position single oven higher for ergonomics
                    const ovenTop = ovenY + singleOvenHeight / 2;
                    const ovenBottom = ovenY - singleOvenHeight / 2;
                    
                    const spaceAbove = height / 2 - ovenTop;
                    const spaceBelow = ovenBottom - (-height / 2);

                    return (
                        <>
                            {/* Single oven appliance */}
                            <group position={[0, ovenY, depth/2]}>
                                <OvenAppliance width={applianceWidth} height={singleOvenHeight} isSelected={isSelected} />
                            </group>
    
                            {/* Cabinet door above oven */}
                            {spaceAbove > 1 && (
                                <group position={[0, ovenTop + spaceAbove/2, depth/2]}>
                                    <ShakerDoor width={width-0.04} height={spaceAbove - 0.1} materialName={object.material} color={object.color} isSelected={isSelected} />
                                </group>
                            )}
    
                            {/* Cabinet doors below oven */}
                            {spaceBelow > 1 && (
                                 <group position={[0, ovenBottom - spaceBelow/2, depth/2]}>
                                    <ShakerDoor width={width-0.04} height={spaceBelow - 0.1} materialName={object.material} color={object.color} isSelected={isSelected} />
                                </group>
                            )}
                        </>
                    );
                })()
            )}
        </group>
    );
};


const ShakerDoor: React.FC<{ width: number, height: number, materialName: string, color: string, isSelected: boolean, colorOverride?: string }> = ({ width, height, materialName, color, isSelected, colorOverride }) => {
    const frameWidth = 0.2;
    const frameThickness = 0.06;
    const panelThickness = 0.02;
    // FIX: Ensure stile height is never negative to prevent renderer crash.
    const stileHeight = Math.max(0, height - (frameWidth * 2));

    return (
        <group>
            {/* Center Panel */}
            <Box args={[width, height, panelThickness]}>
                <MaterialComponent materialName={materialName} color={color} isSelected={isSelected} colorOverride={colorOverride} />
            </Box>
            {/* Top Rail */}
            <Box args={[width, frameWidth, frameThickness]} position={[0, height / 2 - frameWidth / 2, (frameThickness - panelThickness) / 2]}>
                <MaterialComponent materialName={materialName} color={color} isSelected={isSelected} colorOverride={colorOverride} />
            </Box>
            {/* Bottom Rail */}
            <Box args={[width, frameWidth, frameThickness]} position={[0, -height / 2 + frameWidth / 2, (frameThickness - panelThickness) / 2]}>
                <MaterialComponent materialName={materialName} color={color} isSelected={isSelected} colorOverride={colorOverride} />
            </Box>
            {/* Left Stile */}
            <Box args={[frameWidth, stileHeight, frameThickness]} position={[-width / 2 + frameWidth / 2, 0, (frameThickness - panelThickness) / 2]}>
                <MaterialComponent materialName={materialName} color={color} isSelected={isSelected} colorOverride={colorOverride} />
            </Box>
            {/* Right Stile */}
            <Box args={[frameWidth, stileHeight, frameThickness]} position={[width / 2 - frameWidth / 2, 0, (frameThickness - panelThickness) / 2]}>
                <MaterialComponent materialName={materialName} color={color} isSelected={isSelected} colorOverride={colorOverride} />
            </Box>
        </group>
    )
}

const CountertopWithCutout: React.FC<{
    island: FloorplanObject;
    cutout: FloorplanObject;
    countertopHeight: number;
    countertopOverhang: number;
}> = ({ island, cutout, countertopHeight, countertopOverhang }) => {
    const materialName = island.countertopMaterial || 'white_marble';
    const color = island.countertopColor || "#eee";

    // Island dimensions
    const iw = island.dimensions.width;
    const id = island.dimensions.depth;

    // Cutout dimensions and its position relative to the island's center
    const cw = cutout.dimensions.width;
    const cd = cutout.dimensions.depth;
    const relX = cutout.position.x - island.position.x;
    const relZ = cutout.position.z - island.position.z;

    // The countertop is shifted forward for the overhang. The back is at -id/2, the front is at id/2 + overhang.
    const iLeft = -iw / 2;
    const iRight = iw / 2;
    const iBack = -id / 2;
    const iFront = id / 2 + countertopOverhang;

    // Calculate cutout boundaries in the same coordinate system as the countertop
    const cLeft = relX - cw / 2;
    const cRight = relX + cw / 2;
    const cBack = relZ - cd / 2;
    const cFront = relZ + cd / 2;

    const segments = [
        // Back segment (full width, from island back to cutout back)
        { w: iw, d: cBack - iBack, x: 0, z: iBack + (cBack - iBack) / 2 },
        // Front segment (full width, from cutout front to island front)
        { w: iw, d: iFront - cFront, x: 0, z: cFront + (iFront - cFront) / 2 },
        // Left segment (fills the space left of the cutout)
        { w: cLeft - iLeft, d: cFront - cBack, x: iLeft + (cLeft - iLeft) / 2, z: relZ },
        // Right segment (fills the space right of the cutout)
        { w: iRight - cRight, d: cFront - cBack, x: cRight + (iRight - cRight) / 2, z: relZ },
    ];

    return (
        <group>
            {segments.map((seg, i) =>
                // Only render segments that have a positive area
                seg.w > 0.01 && seg.d > 0.01 && (
                    <Box key={i} args={[seg.w, countertopHeight, seg.d]} position={[seg.x, 0, seg.z]}>
                        <MaterialComponent materialName={materialName} color={color} />
                    </Box>
                )
            )}
        </group>
    );
};


const Cabinet: React.FC<{ object: FloorplanObject, isSelected: boolean, allObjects?: FloorplanObject[] }> = ({ object, isSelected, allObjects }) => {
    const { width, height, depth } = object.dimensions;
    const isBase = object.type === 'cabinet_base' || object.type === 'island';

    const countertopHeight = isBase ? 0.1 : 0;
    const cabinetBodyHeight = height - countertopHeight;
    const countertopOverhang = 0.05;

    const toeKickHeight = 0.3;
    const toeKickDepth = 0.2;

    const doorHeight = Math.max(0, cabinetBodyHeight - (isBase ? toeKickHeight : 0));
    const doorOffsetY = isBase ? (cabinetBodyHeight / 2 - toeKickHeight) - (doorHeight / 2) : 0;

    const cooktopOnIsland = useMemo(() => {
        if (object.type !== 'island' || !allObjects) return null;

        return allObjects.find(other => {
            if (other.type !== 'cooktop') return false;

            const islandTopY = object.position.y + object.dimensions.height / 2;
            const cooktopBottomY = other.position.y - other.dimensions.height / 2;
            if (Math.abs(islandTopY - cooktopBottomY) > 0.1) return false;

            const islandHalfWidth = object.dimensions.width / 2;
            const islandHalfDepth = object.dimensions.depth / 2;
            const otherHalfWidth = other.dimensions.width / 2;
            const otherHalfDepth = other.dimensions.depth / 2;

            const isWithinX = other.position.x - otherHalfWidth >= object.position.x - islandHalfWidth &&
                              other.position.x + otherHalfWidth <= object.position.x + islandHalfWidth;
            
            const isWithinZ = other.position.z - otherHalfDepth >= object.position.z - islandHalfDepth &&
                              other.position.z + otherHalfDepth <= object.position.z + islandHalfDepth;

            return isWithinX && isWithinZ;
        });
    }, [object, allObjects]);

    return (
        <group>
            {/* Cabinet Carcass */}
            <Box args={[width, cabinetBodyHeight, depth]} position={[0, -countertopHeight / 2, 0]}>
                <meshStandardMaterial color="#fdfdfd" />
            </Box>

            {/* Countertop */}
            {isBase && (
                <group position={[0, (cabinetBodyHeight / 2) - (countertopHeight / 2), 0]}>
                    {cooktopOnIsland ? (
                        <group position={[0, 0, countertopOverhang / 2]}>
                            <CountertopWithCutout
                                island={object}
                                cutout={cooktopOnIsland}
                                countertopHeight={countertopHeight}
                                countertopOverhang={countertopOverhang}
                            />
                        </group>
                    ) : (
                        <Box
                            args={[width, countertopHeight, depth + countertopOverhang]}
                            position={[0, 0, countertopOverhang / 2]}
                        >
                            <MaterialComponent materialName={object.countertopMaterial || 'white_marble'} color={object.countertopColor || "#eee"} />
                        </Box>
                    )}
                </group>
            )}

            {/* Toe Kick */}
            {isBase && (
                <Box
                    args={[width, toeKickHeight, depth - toeKickDepth]}
                    position={[0, (-cabinetBodyHeight / 2) + (toeKickHeight / 2), (depth / 2) - ((depth - toeKickDepth) / 2)]}
                >
                    <meshStandardMaterial color="#222" />
                </Box>
            )}

            {/* Doors & Handles */}
            <group position={[0, doorOffsetY, depth / 2 + 0.02]}>
                {width > 2.5 ? ( // Two doors
                    <>
                        <group position={[-width / 4, 0, 0]}>
                            <ShakerDoor width={width / 2 - 0.02} height={doorHeight} materialName={object.material} color={object.color} isSelected={isSelected} />
                            <Cylinder args={[0.02, 0.02, 0.4]} rotation={[Math.PI / 2, 0, 0]} position={[width/4 - 0.1, doorHeight/2 - 0.2, 0.05]}>
                                <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
                            </Cylinder>
                        </group>
                        <group position={[width / 4, 0, 0]}>
                            <ShakerDoor width={width / 2 - 0.02} height={doorHeight} materialName={object.material} color={object.color} isSelected={isSelected} />
                            <Cylinder args={[0.02, 0.02, 0.4]} rotation={[Math.PI / 2, 0, 0]} position={[-width/4 + 0.1, doorHeight/2 - 0.2, 0.05]}>
                                 <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
                            </Cylinder>
                        </group>
                    </>
                ) : ( // Single door
                    <>
                        <ShakerDoor width={width - 0.04} height={doorHeight} materialName={object.material} color={object.color} isSelected={isSelected} />
                        <Cylinder args={[0.02, 0.02, 0.4]} rotation={[Math.PI / 2, 0, 0]} position={[width/2 - 0.15, doorHeight/2 - 0.2, 0.05]}>
                            <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
                        </Cylinder>
                    </>
                )}
            </group>
        </group>
    );
};


const Sink: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, height, depth } = object.dimensions;
    const basinHeight = 1;
    const basinCenterY = height / 2 - 0.55;

    const Faucet = () => {
        const faucetMaterial = <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />;
        return (
            <group position={[0, height / 2, -depth / 2 + 0.3]}>
                {/* Base */}
                <Cylinder args={[0.08, 0.1, 0.05]} position={[0, 0.025, 0]}>{faucetMaterial}</Cylinder>
                {/* Stem */}
                <Cylinder args={[0.04, 0.04, 0.3]} position={[0, 0.15, 0]}>{faucetMaterial}</Cylinder>
                {/* Gooseneck Spout */}
                <mesh position={[0, 0.3, 0]} rotation={[0, 0, -Math.PI / 8]}>
                    <torusGeometry args={[0.3, 0.04, 8, 24, Math.PI * 0.6]} />
                    {faucetMaterial}
                </mesh>
                 {/* Handle */}
                <Box args={[0.2, 0.04, 0.06]} position={[0.2, 0.1, 0]} rotation={[0, 0, -Math.PI/12]}>{faucetMaterial}</Box>
            </group>
        );
    };

    return (
        <group>
            {/* Cabinet Base */}
            <Cabinet object={{...object, type: 'cabinet_base'}} isSelected={isSelected} />
            {/* Sink Basin (recessed) */}
            <Box args={[width * 0.8, basinHeight, depth * 0.8]} position={[0, basinCenterY, 0.05]}>
                <meshStandardMaterial color="#f0f0f0" metalness={0.1} roughness={0.2} />
            </Box>
            {/* Drain */}
            <Cylinder args={[0.1, 0.1, 0.02]} position={[0, basinCenterY - basinHeight/2 + 0.01, 0]} rotation={[Math.PI/2, 0, 0]}>
                <meshStandardMaterial color="#bbb" metalness={0.6}/>
            </Cylinder>
            <Faucet />
        </group>
    );
}

const Dishwasher: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, height, depth } = object.dimensions;
    const controlPanelHeight = 0.2;
    const panelY = height / 2 - controlPanelHeight / 2;

    return (
        <group>
            {/* Main body */}
            <Box args={[width, height, depth]}>
                <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
             {/* Control Panel */}
            <Box args={[width * 1.01, controlPanelHeight, depth * 1.01]} position={[0, panelY, 0]}>
                <meshStandardMaterial color="#222" metalness={0.2} roughness={0.8} />
            </Box>
            {/* Status Light */}
            <Box args={[0.05, 0.05, 0.02]} position={[width/2 - 0.15, panelY, depth/2 + 0.01]}>
                <meshStandardMaterial color="green" emissive="green" emissiveIntensity={2} />
            </Box>
            {/* Handle */}
            <group position={[0, panelY - controlPanelHeight, depth / 2 + 0.04]}>
                 <BarHandle length={width * 0.5} isVertical={false} />
            </group>
        </group>
    );
};


const Toilet: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, height, depth } = object.dimensions;
    return (
        <group>
            {/* Base */}
            <Box args={[width * 0.8, height * 0.1, depth * 0.9]} position={[0, (-height/2) + height*0.05, 0]}>
                 <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
            {/* Bowl */}
             <Box args={[width * 0.9, height * 0.4, depth]} position={[0, (-height/2) + height*0.3, 0]}>
                 <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
            {/* Tank */}
            <Box args={[width, height * 0.5, depth * 0.4]} position={[0, height * 0.2, -depth * 0.3]}>
                <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
            {/* Lid */}
             <Box args={[width * 0.95, 0.1, depth * 0.95]} position={[0, -0.1, 0]}>
                 <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
        </group>
    );
}

const Vanity: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, height, depth } = object.dimensions;
    return (
        <group>
            {/* Cabinet Base */}
            <Cabinet object={{...object, type: 'cabinet_base'}} isSelected={isSelected} />
            {/* Sink Basin (recessed) */}
            <Box args={[width * 0.7, 0.4, depth * 0.8]} position={[0, height/2 - 0.25, 0.05]}>
                <meshStandardMaterial color="#eaf0f2" metalness={0.1} roughness={0.1} />
            </Box>
             {/* Faucet */}
            <group position={[0, height / 2 + 0.05, -depth / 2 + 0.3]}>
                {/* Body */}
                <Cylinder args={[0.04, 0.04, 0.4]} position={[0, 0.2, 0]}>
                    <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
                </Cylinder>
                {/* Handle */}
                <Box args={[0.04, 0.15, 0.1]} position={[0, 0.35, 0.05]}>
                    <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
                </Box>
            </group>
        </group>
    );
}

const Shower: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, height, depth } = object.dimensions;
    return (
        <group>
            {/* Base Pan */}
            <Box args={[width, 0.3, depth]} position={[0, -height/2 + 0.15, 0]}>
                 <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
             {/* Back Wall */}
            <Box args={[width, height - 0.3, 0.1]} position={[0, 0.15, -depth/2 + 0.05]}>
                 <MaterialComponent materialName="gray_tile" color="#ccc" isSelected={isSelected} />
            </Box>
            {/* Glass Walls */}
            <Box args={[0.1, height-0.3, depth]} position={[-width/2+0.05, 0.15, 0]}>
                <meshStandardMaterial color="#aaccff" transparent opacity={0.3} />
            </Box>
             <Box args={[width, height-0.3, 0.1]} position={[0, 0.15, depth/2 - 0.05]}>
                <meshStandardMaterial color="#aaccff" transparent opacity={0.3} />
            </Box>
             {/* Shower Head */}
            <group position={[-width/2 + 0.2, height/2 - 0.5, -depth/2 + 0.2]}>
                <Cylinder args={[0.03, 0.03, 0.5]} rotation={[0,0, -Math.PI/4]}>
                    <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
                </Cylinder>
                 <Cylinder args={[0.1, 0.1, 0.05]} position={[0.15, 0.15, 0]} rotation={[Math.PI/2, 0, 0]}>
                    <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
                </Cylinder>
            </group>
        </group>
    );
}

const Bathtub: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, height, depth } = object.dimensions;
    const wallThickness = 0.2;
    return (
        <group>
            {/* Outer shell */}
            <Box args={[width, height, depth]}>
                 <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
             {/* Inner hollow part */}
            <Box 
                args={[width - wallThickness*2, height - wallThickness, depth - wallThickness*2]} 
                position={[0, -(wallThickness/2) + 0.04, 0]}
            >
                 <meshStandardMaterial color="#333" />
            </Box>
        </group>
    );
}

const VentHood: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, height, depth } = object.dimensions;
    const chimneyHeight = height * 0.6;
    const hoodHeight = height * 0.4;
    const hoodY = -height / 2 + hoodHeight / 2;

    return (
        <group>
            {/* Hood part */}
            <Box args={[width, hoodHeight, depth]} position={[0, hoodY, 0]}>
                <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
            {/* Filter Grille (underside) */}
            <Box args={[width * 0.8, 0.05, depth * 0.8]} position={[0, hoodY - hoodHeight/2, 0]}>
                <meshStandardMaterial color="#555" metalness={0.5} roughness={0.6} />
            </Box>
            {/* Control Buttons */}
            <group position={[0, hoodY + hoodHeight/2, depth/2]}>
                <Box args={[0.1, 0.05, 0.02]} position={[-0.3, 0, 0]}><meshStandardMaterial color="#222"/></Box>
                <Box args={[0.1, 0.05, 0.02]} position={[-0.1, 0, 0]}><meshStandardMaterial color="#222"/></Box>
                <Box args={[0.1, 0.05, 0.02]} position={[0.1, 0, 0]}><meshStandardMaterial color="#222"/></Box>
                <Box args={[0.1, 0.05, 0.02]} position={[0.3, 0, 0]}><meshStandardMaterial color="#222"/></Box>
            </group>
            {/* Chimney part */}
            <Box args={[width * 0.4, chimneyHeight, depth * 0.6]} position={[0, hoodY + hoodHeight/2 + chimneyHeight/2, 0]}>
                 <MaterialComponent materialName={object.material} color={object.color} isSelected={isSelected} />
            </Box>
        </group>
    );
};

const Cooktop: React.FC<{ object: FloorplanObject, isSelected: boolean }> = ({ object, isSelected }) => {
    const { width, depth } = object.dimensions;
    const height = 0.1; // Cooktops are very thin
    const burnerRadius = Math.min(width, depth) * 0.15;

    return (
        <group>
            {/* Main glass surface */}
            <Box args={[width, height, depth]}>
                <meshStandardMaterial color={isSelected ? '#3b82f6' : '#111111'} metalness={0.4} roughness={0.3} />
            </Box>
            {/* Burner markings */}
            <group position={[0, height / 2 + 0.01, 0]}>
                <Cylinder args={[burnerRadius, burnerRadius, 0.01]} position={[-width/4, 0, -depth/4]}>
                    <meshStandardMaterial color="#555" emissive="#333" emissiveIntensity={0.5}/>
                </Cylinder>
                <Cylinder args={[burnerRadius * 1.2, burnerRadius * 1.2, 0.01]} position={[width/4, 0, -depth/4]}>
                    <meshStandardMaterial color="#555" emissive="#333" emissiveIntensity={0.5}/>
                </Cylinder>
                <Cylinder args={[burnerRadius * 0.8, burnerRadius * 0.8, 0.01]} position={[-width/4, 0, depth/4]}>
                    <meshStandardMaterial color="#555" emissive="#333" emissiveIntensity={0.5}/>
                </Cylinder>
                <Cylinder args={[burnerRadius, burnerRadius, 0.01]} position={[width/4, 0, depth/4]}>
                    <meshStandardMaterial color="#555" emissive="#333" emissiveIntensity={0.5}/>
                </Cylinder>
            </group>
        </group>
    );
};

const EditableObject: React.FC<{
  objectData: FloorplanObject;
  isSelected: boolean;
  onSelect: () => void;
  onTransformEnd: (object: FloorplanObject) => void;
  allObjects: FloorplanObject[];
}> = ({ objectData, isSelected, onSelect, onTransformEnd, allObjects }) => {
  const objectRef = useRef<THREE.Group>(null!);

  const handleTransformEnd = useCallback(() => {
    if (objectRef.current) {
      onTransformEnd({
        ...objectData,
        // FIX: Use .clone() for position and create a new Vector3 from the Euler rotation
        // to match the expected `Vector3` type, instead of a plain object.
        position: objectRef.current.position.clone(),
        rotation: new THREE.Vector3(objectRef.current.rotation.x, objectRef.current.rotation.y, objectRef.current.rotation.z),
      });
    }
  }, [onTransformEnd, objectData]);

  const renderObject = () => {
    switch (objectData.type) {
        case 'refrigerator':
            return <Refrigerator object={objectData} isSelected={isSelected} />;
        case 'oven':
            return <Oven object={objectData} isSelected={isSelected} />;
        case 'cabinet_base':
        case 'cabinet_wall':
        case 'island':
            return <Cabinet object={objectData} isSelected={isSelected} allObjects={allObjects} />;
        case 'sink':
            return <Sink object={objectData} isSelected={isSelected} />;
        case 'dishwasher':
            return <Dishwasher object={objectData} isSelected={isSelected} />;
        case 'cooktop':
            return <Cooktop object={objectData} isSelected={isSelected} />;
        case 'toilet':
            return <Toilet object={objectData} isSelected={isSelected} />;
        case 'vanity':
             return <Vanity object={objectData} isSelected={isSelected} />;
        case 'shower':
             return <Shower object={objectData} isSelected={isSelected} />;
        case 'bathtub':
             return <Bathtub object={objectData} isSelected={isSelected} />;
        case 'vent_hood':
             return <VentHood object={objectData} isSelected={isSelected} />;
        case 'window':
            const frameThickness = 0.1;
            const { width, height, depth } = objectData.dimensions;
            return (
                <group>
                    {/* Glass Pane */}
                    <Box args={[width - frameThickness, height - frameThickness, 0.05]}>
                        <meshStandardMaterial color="#aaccff" transparent opacity={0.3} roughness={0.1} />
                    </Box>
                    {/* Top Frame */}
                    <Box args={[width, frameThickness, depth]} position={[0, height / 2 - frameThickness / 2, 0]}><meshStandardMaterial color="#ddd" /></Box>
                    {/* Bottom Frame */}
                    <Box args={[width, frameThickness, depth]} position={[0, -height / 2 + frameThickness / 2, 0]}><meshStandardMaterial color="#ddd" /></Box>
                    {/* Left Frame */}
                    <Box args={[frameThickness, height - frameThickness * 2, depth]} position={[-width / 2 + frameThickness / 2, 0, 0]}><meshStandardMaterial color="#ddd" /></Box>
                    {/* Right Frame */}
                    <Box args={[frameThickness, height - frameThickness * 2, depth]} position={[width / 2 - frameThickness / 2, 0, 0]}><meshStandardMaterial color="#ddd" /></Box>
                </group>
            );
        case 'opening':
            return null; // Render nothing, it's a marker for wall cutting
        default:
            return (
                <Box args={[objectData.dimensions.width, objectData.dimensions.height, objectData.dimensions.depth]}>
                    <MaterialComponent materialName={objectData.material} color={objectData.color} isSelected={isSelected} />
                </Box>
            );
    }
  }

  return (
    <>
      <group
        ref={objectRef}
        position={[objectData.position.x, objectData.position.y, objectData.position.z]}
        rotation={[objectData.rotation.x, objectData.rotation.y, objectData.rotation.z]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        {renderObject()}
      </group>
      {isSelected && (
        <TransformControls
          object={objectRef}
          mode="translate"
          showY={true}
          onMouseUp={handleTransformEnd}
          onObjectChange={() => {
            if (objectRef.current) {
              const yPos = objectRef.current.position.y;
              // Prevent object from going through the floor, assuming position is center
              const halfHeight = objectData.dimensions.height / 2;
              if (yPos < halfHeight) objectRef.current.position.y = halfHeight;
            }
          }}
        />
      )}
    </>
  );
};

const DynamicWalls: React.FC<{ width: number, depth: number, height: number, objects: FloorplanObject[] }> = ({ width, depth, height, objects }) => {
    const wallThickness = 0.2;
    const wallOpenings = objects.filter(o => o.type === 'window' || o.type === 'opening');

    const walls = [
        { name: 'back', axis: 'z', pos: -depth / 2, len: width },
        { name: 'front', axis: 'z', pos: depth / 2, len: width },
        { name: 'left', axis: 'x', pos: -width / 2, len: depth },
        { name: 'right', axis: 'x', pos: width / 2, len: depth },
    ];

    return (
        <group>
            {walls.map(wall => {
                const openingsOnWall = wallOpenings
                    .filter(o => Math.abs(o.position[wall.axis] - wall.pos) < 0.1) // Find openings on this wall plane
                    .map(o => {
                        const parallelAxis = wall.axis === 'x' ? 'z' : 'x';
                        // The dimension of the opening along the wall is always its 'width' property.
                        const openingDim = o.dimensions.width;
                        return {
                            start: o.position[parallelAxis] - openingDim / 2,
                            end: o.position[parallelAxis] + openingDim / 2,
                            bottom: o.position.y - o.dimensions.height / 2,
                            top: o.position.y + o.dimensions.height / 2,
                        };
                    })
                    .sort((a, b) => a.start - b.start);

                const segments = [];
                let currentPos = -wall.len / 2;

                openingsOnWall.forEach(opening => {
                    // Segment before opening
                    if (opening.start > currentPos) {
                        segments.push({ start: currentPos, end: opening.start, top: height, bottom: 0 });
                    }
                    // Segment above opening
                    if (opening.top < height) {
                        segments.push({ start: opening.start, end: opening.end, top: height, bottom: opening.top });
                    }
                    // Segment below opening
                    if (opening.bottom > 0) {
                        segments.push({ start: opening.start, end: opening.end, top: opening.bottom, bottom: 0 });
                    }
                    currentPos = opening.end;
                });

                // Final segment
                if (currentPos < wall.len / 2) {
                    segments.push({ start: currentPos, end: wall.len / 2, top: height, bottom: 0 });
                }

                return segments.map((seg, index) => {
                    const segLength = seg.end - seg.start;
                    const segHeight = seg.top - seg.bottom;
                    const segCenter = seg.start + segLength / 2;
                    const segY = seg.bottom + segHeight / 2;
                    
                    const position = wall.axis === 'x' ? { x: wall.pos, y: segY, z: segCenter } : { x: segCenter, y: segY, z: wall.pos };
                    const args = wall.axis === 'x' ? [wallThickness, segHeight, segLength] : [segLength, segHeight, wallThickness];
                    
                    return (
                         <Box key={`${wall.name}-${index}`} args={args as [number, number, number]} position={[position.x, position.y, position.z]} receiveShadow>
                            <meshStandardMaterial color="#cccccc" />
                        </Box>
                    );
                });
            })}
        </group>
    );
};


const KitchenWorkTriangle: React.FC<{ floorplan: Floorplan }> = ({ floorplan }) => {
    const workTriangle = useMemo(() => {
        if (floorplan.room.type !== 'kitchen') return null;

        const sink = floorplan.objects.find(o => o.type === 'sink');
        const refrigerator = floorplan.objects.find(o => o.type === 'refrigerator');
        const cooktop = floorplan.objects.find(o => o.type === 'cooktop') || floorplan.objects.find(o => o.type === 'oven');

        if (!sink || !refrigerator || !cooktop) return null;

        // Use 3D points for drawing the line visuals
        const p1 = new THREE.Vector3(sink.position.x, sink.position.y, sink.position.z);
        const p2 = new THREE.Vector3(refrigerator.position.x, refrigerator.position.y, refrigerator.position.z);
        const p3 = new THREE.Vector3(cooktop.position.x, cooktop.position.y, cooktop.position.z);
        
        // Offset Y so the triangle is slightly above the floor/countertops for visibility
        p1.y = 3.2;
        p2.y = 3.2;
        p3.y = 3.2;
        
        // Use 2D points for accurate floor plan distance calculation
        const p1_2d = new THREE.Vector2(sink.position.x, sink.position.z);
        const p2_2d = new THREE.Vector2(refrigerator.position.x, refrigerator.position.z);
        const p3_2d = new THREE.Vector2(cooktop.position.x, cooktop.position.z);
        
        const distA = p1_2d.distanceTo(p2_2d);
        const distB = p2_2d.distanceTo(p3_2d);
        const distC = p3_2d.distanceTo(p1_2d);
        const total = distA + distB + distC;

        const isTotalValid = total > 0 && total <= 26;
        
        return { p1, p2, p3, isTotalValid };
    }, [floorplan]);

    if (!workTriangle) return null;
    
    const { p1, p2, p3, isTotalValid } = workTriangle;
    const lineColor = isTotalValid ? '#4ade80' : '#f87171';

    return (
        <group>
            <Line points={[p1, p2]} color={lineColor} lineWidth={3} dashed dashScale={1} gapSize={0.5} />
            <Line points={[p2, p3]} color={lineColor} lineWidth={3} dashed dashScale={1} gapSize={0.5} />
            <Line points={[p3, p1]} color={lineColor} lineWidth={3} dashed dashScale={1} gapSize={0.5} />
        </group>
    );
};

const FloorplanScene: React.FC<Omit<Canvas3DProps, 'appState' | 'choices' | 'onChoiceMade' | 'roomState'> & { floorplan: Floorplan | null }> = ({ floorplan, selectedObjectId, onSelectObject, onObjectChange, showWorkTriangle }) => {
  if (!floorplan) return null;

  const roomWidth = floorplan.room.dimensions.width;
  const roomDepth = floorplan.room.dimensions.depth;
  const roomHeight = 8; // Standard room height

  return (
    <>
      <ambientLight intensity={2.0} />
      {/* FIX: The `skyColor` prop does not exist on hemisphereLight. Use `color` instead. */}
      <hemisphereLight color="#ffffff" groundColor="#444444" intensity={1} />
      <directionalLight position={[10, 15, 5]} intensity={1.5} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      
      <Plane args={[roomWidth, roomDepth]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <MaterialComponent materialName={floorplan.room.floorMaterial} color="#888888" repeat={[roomWidth / 4, roomDepth / 4]} />
      </Plane>
      <group position={[0, -0.06, 0]}>
        <gridHelper args={[Math.max(roomWidth, roomDepth) + 2, Math.max(roomWidth, roomDepth) + 2, '#555', '#555']} />
      </group>

      <DynamicWalls width={roomWidth} depth={roomDepth} height={roomHeight} objects={floorplan.objects} />
      
      {showWorkTriangle && <KitchenWorkTriangle floorplan={floorplan} />}

      {floorplan.objects.map((obj) => (
        <EditableObject
          key={obj.id}
          objectData={obj}
          isSelected={selectedObjectId === obj.id}
          onSelect={() => onSelectObject(obj.id)}
          onTransformEnd={onObjectChange}
          allObjects={floorplan.objects}
        />
      ))}

      <OrbitControls makeDefault />
    </>
  );
};

const ChoicePreviewScene: React.FC<{ choices: Choice[]; onChoiceMade: (choice: Choice) => void; isGeneratingImages?: boolean; }> = ({ choices, onChoiceMade, isGeneratingImages }) => {
    const totalWidth = choices.length * 6;
    const startX = -totalWidth / 2 + 3;

    if (isGeneratingImages) {
        return (
            <>
                <ambientLight intensity={1.5} />
                <Text position={[0,0,0]} fontSize={0.5} color="white" anchorX="center" anchorY="middle">
                    Generating inspirational images...
                </Text>
            </>
        );
    }

    return (
        <>
            <ambientLight intensity={1.5} />
            {/* FIX: The `skyColor` prop does not exist on hemisphereLight. Use `color` instead. */}
            <hemisphereLight color="#ffffff" groundColor="#444444" intensity={1} />
            <directionalLight position={[0, 10, 5]} intensity={1.5} />

            {choices.map((choice, index) => (
                <group key={choice.name} position={[startX + index * 6, 0, 0]}>
                    <ChoiceObject choice={choice} onSelect={() => onChoiceMade(choice)} />
                </group>
            ))}

            <OrbitControls makeDefault autoRotate={false} />
        </>
    );
};

// --- START: Refrigerator Preview Models ---
const RefrigeratorFrenchDoor: React.FC<{material: string}> = ({ material }) => {
    const width = 2.8, height = 6, depth = 2.5;
    return <group position={[0, height/2, 0]}>
        <Box args={[width, height, depth]}>
            <MaterialComponent materialName={material} color="#aaa" />
        </Box>
        {/* Horizontal Divider */}
        <Box args={[width, 0.05, depth * 1.02]} position={[0, -height*0.2, 0]} ><meshStandardMaterial color="#333"/></Box>
        {/* Vertical Divider */}
        <Box args={[0.05, height*0.7, depth * 1.02]} position={[0, height*0.15, 0]} ><meshStandardMaterial color="#333"/></Box>
    </group>
}

const RefrigeratorSideBySide: React.FC<{material: string}> = ({ material }) => {
    const width = 2.8, height = 6, depth = 2.5;
    return <group position={[0, height/2, 0]}>
        <Box args={[width, height, depth]}>
            <MaterialComponent materialName={material} color="#aaa" />
        </Box>
        {/* Vertical Divider */}
        <Box args={[0.05, height, depth * 1.02]} position={[0, 0, 0]} ><meshStandardMaterial color="#333"/></Box>
    </group>
}

const RefrigeratorBottomFreezer: React.FC<{material: string}> = ({ material }) => {
    const width = 2.8, height = 6, depth = 2.5;
    const freezerHeight = height * 0.3;

    return <group position={[0, height/2, 0]}>
        <Box args={[width, height, depth]}>
            <MaterialComponent materialName={material} color="#aaa" />
        </Box>
        {/* Divider line */}
        <Box args={[width, 0.05, depth * 1.02]} position={[0, freezerHeight - height/2, 0]} ><meshStandardMaterial color="#333"/></Box>
    </group>
}

const RefrigeratorColumn: React.FC<{material: string}> = ({ material }) => {
    const width = 2.8, height = 6, depth = 2.5;
    const unitWidth = width / 2 - 0.05;

    return <group position={[0, height/2, 0]}>
        <Box args={[unitWidth, height, depth]} position={[-width/4, 0, 0]}><MaterialComponent materialName={material} color="#aaa" /></Box>
        <Box args={[unitWidth, height, depth]} position={[width/4, 0, 0]}><MaterialComponent materialName={material} color="#aaa" /></Box>
    </group>
}
// --- END: Refrigerator Preview Models ---

// --- START: Generic Preview Models ---
const PreviewCabinetShaker: React.FC<{material: string, colorOverride?: string}> = ({ material, colorOverride }) => {
    const height = 3;
    return <group position={[0, height/2, 0]}>
        <ShakerDoor width={2.5} height={height} materialName={material} color="#ccc" isSelected={false} colorOverride={colorOverride} />
    </group>
}

const PreviewCabinetFlatPanel: React.FC<{material: string}> = ({ material }) => {
    const height = 3;
    return <group position={[0, height/2, 0]}>
        <Box args={[2.5, height, 0.06]}><MaterialComponent materialName={material} color="#ccc" /></Box>
    </group>
}

const PreviewSinkSingleBasin: React.FC<{material: string}> = ({ material }) => {
    const width = 2.5, height = 1.5, depth = 1.8;
    return <group position={[0, height/2, 0]}>
        <Box args={[width, height, depth]}><MaterialComponent materialName={material} color="#ccc" /></Box>
        <Box args={[width*0.8, height, depth*0.8]} position={[0,0.1,0]}><meshStandardMaterial color="#333"/></Box>
    </group>
}

const PreviewSinkDoubleBasin: React.FC<{material: string}> = ({ material }) => {
    const width = 2.5, height = 1.5, depth = 1.8;
    return <group position={[0, height/2, 0]}>
        <Box args={[width, height, depth]}><MaterialComponent materialName={material} color="#ccc" /></Box>
        {/* Basins */}
        <Box args={[width*0.8, height, depth*0.38]} position={[0,0.1, -depth*0.22]}><meshStandardMaterial color="#333"/></Box>
        <Box args={[width*0.8, height, depth*0.38]} position={[0,0.1, depth*0.22]}><meshStandardMaterial color="#333"/></Box>
        {/* Divider */}
        <Box args={[width*0.8, height*0.8, depth*0.04]} position={[0, height*0.4, 0]}><MaterialComponent materialName={material} color="#ccc" /></Box>
    </group>
}

const PreviewOvenWall: React.FC<{material: string}> = ({ material }) => {
    const width=2.5, height=3, depth=2;
    return <group position={[0, height/2, 0]}>
        <Box args={[width, height, depth]}><MaterialComponent materialName={material} color="#ccc" /></Box>
        <Box args={[width, 0.2, depth*1.02]} position={[0, height/2 - 0.5, 0]}><meshStandardMaterial color="#222" /></Box>
        <Box args={[width*0.8, height*0.4, 0.1]} position={[0, 0, depth/2]}><meshStandardMaterial color="#111" /></Box>
    </group>
}

const PreviewOvenRange: React.FC<{material: string}> = ({ material }) => {
    const width=2.5, height=3.5, depth=2.5;
    return <group position={[0, height/2, 0]}>
        <Box args={[width, height, depth]}><MaterialComponent materialName={material} color="#ccc" /></Box>
        {/* Cooktop */}
        <Box args={[width, 0.1, depth]} position={[0, height/2, 0]}><meshStandardMaterial color="#222" /></Box>
        <Cylinder args={[0.2, 0.2, 0.05]} position={[-width/4, height/2+0.05, -depth/4]}><meshStandardMaterial color="#444"/></Cylinder>
        <Cylinder args={[0.2, 0.2, 0.05]} position={[width/4, height/2+0.05, -depth/4]}><meshStandardMaterial color="#444"/></Cylinder>
        <Cylinder args={[0.2, 0.2, 0.05]} position={[-width/4, height/2+0.05, depth/4]}><meshStandardMaterial color="#444"/></Cylinder>
        <Cylinder args={[0.2, 0.2, 0.05]} position={[width/4, height/2+0.05, depth/4]}><meshStandardMaterial color="#444"/></Cylinder>
        {/* Oven Door */}
        <Box args={[width*0.8, height*0.4, 0.1]} position={[0, -0.5, depth/2]}><meshStandardMaterial color="#111" /></Box>
    </group>
}

const PreviewCountertop: React.FC<{material: string}> = ({ material }) => {
    const height = 0.2;
    return <group position={[0, height/2, 0]}>
        <Box args={[4, height, 2]}>
            <MaterialComponent materialName={material} color="#ccc" />
        </Box>
    </group>
}
// --- END: Generic Preview Models ---

const StyleImage: React.FC<{ choice: Choice }> = ({ choice }) => {
    if (!choice.imageUrl) return null;
    const texture = useTexture(choice.imageUrl);
    const aspectRatio = texture.image.height / texture.image.width;
    return (
        <Plane args={[6, 6 * aspectRatio]}>
            <meshStandardMaterial map={texture} />
        </Plane>
    );
}

const ChoiceObject: React.FC<{ choice: Choice; onSelect: () => void }> = ({ choice, onSelect }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    const primaryType = choice.material.split('_')[0];
    const scale = isHovered ? 1.05 : 1;

    const renderChoice = () => {
        const parts = choice.material.split('_');
        
        const getTextureName = (defaultMaterial: string) => {
            // e.g. cabinet_style_shaker_light_wood -> light_wood
            if (parts.length > 3) return parts.slice(3).join('_');
            return defaultMaterial;
        }

        switch (primaryType) {
            case 'style':
                return <StyleImage choice={choice} />;
            
            case 'refrigerator':
                const fridgeMat = getTextureName('stainless_steel');
                if (choice.material.includes('_type_french-door')) return <RefrigeratorFrenchDoor material={fridgeMat} />;
                if (choice.material.includes('_type_side-by-side')) return <RefrigeratorSideBySide material={fridgeMat} />;
                if (choice.material.includes('_type_column')) return <RefrigeratorColumn material={fridgeMat} />;
                if (choice.material.includes('_type_bottom-freezer')) return <RefrigeratorBottomFreezer material={fridgeMat} />;
                return <RefrigeratorBottomFreezer material={fridgeMat} />;

            case 'cabinet':
                const cabMat = 'light_wood';
                if (choice.material.includes('_color_')) {
                    const colorMap: {[key: string]: string} = { 'white': '#F5F5F5', 'dark-gray': '#36454F', 'light-wood': '#D2B48C', 'dark-wood': '#654321' };
                    const colorKey = choice.material.split('_color_')[1];
                    const colorHex = colorMap[colorKey] || '#cccccc';
                    return <PreviewCabinetShaker material={cabMat} colorOverride={colorHex} />;
                }
                if (choice.material.includes('_style_shaker')) return <PreviewCabinetShaker material={cabMat} />;
                if (choice.material.includes('_style_flat-panel')) return <PreviewCabinetFlatPanel material={cabMat} />;
                return <PreviewCabinetShaker material={cabMat} />;

            case 'sink':
                const sinkMat = getTextureName('stainless_steel');
                if (choice.material.includes('_type_single-basin')) return <PreviewSinkSingleBasin material={sinkMat} />;
                if (choice.material.includes('_type_double-basin')) return <PreviewSinkDoubleBasin material={sinkMat} />;
                return <PreviewSinkSingleBasin material={sinkMat} />;
            
            case 'oven':
                const ovenMat = getTextureName('stainless_steel');
                if (choice.material.includes('_type_wall-oven')) return <PreviewOvenWall material={ovenMat} />;
                if (choice.material.includes('_type_range')) return <PreviewOvenRange material={ovenMat} />;
                return <PreviewOvenRange material={ovenMat} />;
            
            case 'countertop':
                const countertopMat = choice.material.split('_material_')[1] || 'white_marble';
                return <PreviewCountertop material={countertopMat} />;

            default:
                // Default to a textured cube for simple materials
                return (
                    <group position={[0,1,0]}>
                        <Box args={[2, 2, 2]}>
                            <MaterialComponent materialName={choice.material} color="#ccc" />
                        </Box>
                    </group>
                );
        }
    }

    return (
         <group
            onClick={onSelect}
            onPointerOver={() => {
                setIsHovered(true)
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
                setIsHovered(false)
                document.body.style.cursor = 'auto';
            }}
            scale={scale}
        >
            <Suspense fallback={<Box args={[3, 3, 0.1]}><meshStandardMaterial color="black" wireframe/></Box>}>
                {renderChoice()}
            </Suspense>
            <Html position={[0, -2.5, 0]} center>
                <div className="bg-gray-900 bg-opacity-70 text-white rounded-lg px-3 py-1 text-center pointer-events-none w-56">
                    <p className="font-bold text-base">{choice.name}</p>
                    <p className="text-xs">{choice.description}</p>
                </div>
            </Html>
        </group>
    )
}

const Canvas3D: React.FC<Canvas3DProps> = (props) => {
  const floorplan = useMemo(() => convertRoomStateToFloorplan(props.roomState), [props.roomState]);

  return (
    <div className="w-full h-full bg-gray-800 rounded-lg shadow-inner" onClick={() => props.onSelectObject(null)}>
      <Canvas shadows camera={{ position: [0, 5, 20], fov: 50 }}>
        <Suspense fallback={null}>
          {(props.appState === 'AWAITING_STYLE_CHOICE' || props.appState === 'GATHERING_INFO') && props.choices ? (
            <ChoicePreviewScene choices={props.choices} onChoiceMade={props.onChoiceMade} isGeneratingImages={props.isGeneratingImages} />
          ) : (
            <FloorplanScene 
              floorplan={floorplan}
              selectedObjectId={props.selectedObjectId}
              onSelectObject={props.onSelectObject}
              onObjectChange={props.onObjectChange}
              showWorkTriangle={props.showWorkTriangle}
            />
          )}
        </Suspense>
      </Canvas>
      {props.appState === 'INITIAL' && !floorplan && (
        <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
            <p className="text-gray-400 text-2xl font-semibold">Describe your room to get started</p>
        </div>
      )}
       {(props.appState === 'AWAITING_STYLE_CHOICE' || props.appState === 'GATHERING_INFO') && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 flex justify-center items-center pointer-events-none">
            <p className="text-gray-200 text-lg font-semibold bg-gray-900 bg-opacity-50 px-4 py-2 rounded-md">Select an option to continue</p>
        </div>
      )}
    </div>
  );
};

export default Canvas3D;
