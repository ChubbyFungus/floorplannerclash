import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Vector3, Euler } from '@react-three/fiber';
import * as THREE from 'three';
import type { ItemType } from '../types';

const INCHES_PER_SCENE_UNIT = 24;
const inchesToSceneUnits = (value: number | undefined) =>
  typeof value === 'number' ? value / INCHES_PER_SCENE_UNIT : undefined;

type ScaleInput = Vector3 | [number, number, number];

type CornerPivot = { x: number; z: number };

const pickCornerPivot = (box: THREE.Box3): CornerPivot => {
  const candidates: CornerPivot[] = [
    { x: box.min.x, z: box.min.z },
    { x: box.min.x, z: box.max.z },
    { x: box.max.x, z: box.min.z },
    { x: box.max.x, z: box.max.z }
  ];

  let best = candidates[0];
  let bestScore = Infinity;

  for (const candidate of candidates) {
    const shiftedMinX = box.min.x - candidate.x;
    const shiftedMinZ = box.min.z - candidate.z;
    const shiftedMaxX = box.max.x - candidate.x;
    const shiftedMaxZ = box.max.z - candidate.z;

    const minScore = Math.abs(shiftedMinX) + Math.abs(shiftedMinZ);
    const negativePenalty =
      (shiftedMaxX < 0 ? Math.abs(shiftedMaxX) : 0) +
      (shiftedMaxZ < 0 ? Math.abs(shiftedMaxZ) : 0);

    const score = minScore + negativePenalty * 10;

    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
};

interface GLBModelProps {
  modelPath: string;
  position: Vector3;
  rotation: Euler;
  scale: ScaleInput;
  itemType?: ItemType;
  catalogItem?: {
    id?: string;
    name?: string;
    category?: string;
    width_in?: number;
    height_in?: number;
    depth_in?: number;
    scale?: number;
  };
  countertopTextureSrc?: string;
  onLoad?(): void;
  onError?(_error: Error): void;
  onSurfaceClick?(_event: ThreeEvent<MouseEvent>): void;
  interactive?: boolean;
  onContextMenu?(_event: ThreeEvent<MouseEvent>): void;
}


type Vec3Arr = readonly [number, number, number];
type Vec3Obj = { x: number; y: number; z: number };
type Vec3Input = number | Vec3Arr | Vec3Obj | THREE.Vector3;

const isVec3Arr = (v: unknown): v is Vec3Arr =>
  Array.isArray(v) && v.length === 3;

const isVec3Obj = (v: unknown): v is Vec3Obj =>
  v != null && typeof v === 'object' && 'x' in v && 'y' in v && 'z' in v;

const toXYZ = (v: Vec3Input): [number, number, number] => {
  if (typeof v === 'number') return [v, v, v];
  if (isVec3Arr(v)) return [v[0], v[1], v[2]];
  if (v instanceof THREE.Vector3) return [v.x, v.y, v.z];
  if (isVec3Obj(v)) return [v.x, v.y, v.z];
  return [1, 1, 1];
};


export const GLBModel: React.FC<GLBModelProps> = ({
  modelPath,
  position,
  rotation,
  scale,
  itemType,
  catalogItem,
  countertopTextureSrc,
  onLoad,
  onError,
  onSurfaceClick,
  interactive = false,
  onContextMenu,
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scaleX, scaleY, scaleZ] = useMemo<[number, number, number]>(() => {
  const [x, y, z] = toXYZ(scale as unknown as Vec3Input);
  return [x ?? 1, y ?? 1, z ?? 1];
}, [scale]);



  // Normalize model to expected coordinate system and apply proper scaling
  const normalizedModel = useMemo(() => {
    if (!model) return null;

    // Clone the model to avoid modifying the original
    const clonedModel = model.clone(true);

    clonedModel.updateMatrixWorld(true);

    // Calculate bounding box to center and scale the model
    const initialBox = new THREE.Box3().setFromObject(clonedModel);
    const initialSize = initialBox.getSize(new THREE.Vector3());

    const normalize = (value?: string) => value?.toString().toLowerCase() ?? '';
    const looksCornerLike = (value?: string) => {
      const normalized = normalize(value);
      return (
        normalized.includes('corner') ||
        normalized.includes('super_susan') ||
        normalized.includes('super-susan') ||
        normalized.includes('super susan')
      );
    };

    const isCornerItem =
      itemType === 'corner_cabinet_lower' ||
      itemType === 'corner_cabinet_upper' ||
      looksCornerLike(itemType) ||
      looksCornerLike(catalogItem?.id) ||
      looksCornerLike(catalogItem?.name) ||
      looksCornerLike(modelPath);

    console.debug('[GLBModel] corner detection', {
      modelPath,
      itemType,
      catalogId: catalogItem?.id,
      name: catalogItem?.name,
      isCornerItem,
    });

    // Derive scale factors from catalog dimensions when available
    const targetWidth = inchesToSceneUnits(catalogItem?.width_in);
    const targetHeight = inchesToSceneUnits(catalogItem?.height_in);
    const targetDepth = inchesToSceneUnits(catalogItem?.depth_in);

    const baseScale = new THREE.Vector3(1, 1, 1);
    const safeWidth = initialSize.x || 1;
    const safeHeight = initialSize.y || 1;
    const safeDepth = initialSize.z || 1;

    if (targetWidth) {
      baseScale.x = targetWidth / safeWidth;
    }
    if (targetHeight) {
      baseScale.y = targetHeight / safeHeight;
    }
    if (targetDepth) {
      baseScale.z = targetDepth / safeDepth;
    }

    // Apply final scale by combining catalog-derived scale with provided scale multipliers
    clonedModel.scale.set(
      baseScale.x * scaleX,
      baseScale.y * scaleY,
      baseScale.z * scaleZ
    );

    clonedModel.updateMatrixWorld(true);

    // After scaling, compute bounding to reposition origin
    const scaledBox = new THREE.Box3().setFromObject(clonedModel);
    const scaledCenterX = (scaledBox.min.x + scaledBox.max.x) / 2;
    const scaledCenterZ = (scaledBox.min.z + scaledBox.max.z) / 2;
    const bottomY = scaledBox.min.y;

    const cornerPivot = isCornerItem
      ? pickCornerPivot(scaledBox)
      : { x: scaledCenterX, z: scaledCenterZ };

    const pivotX = cornerPivot.x;
    const pivotZ = cornerPivot.z;

    clonedModel.position.set(
      clonedModel.position.x - pivotX,
      clonedModel.position.y - bottomY,
      clonedModel.position.z - pivotZ
    );

    clonedModel.updateMatrixWorld(true);

    const finalBox = new THREE.Box3().setFromObject(clonedModel);
    const finalSize = finalBox.getSize(new THREE.Vector3());

    clonedModel.userData.sceneDimensions = {
      width: finalSize.x,
      height: finalSize.y,
      depth: finalSize.z,
    };
    clonedModel.userData.pivot = isCornerItem ? 'corner' : 'center';
    if (isCornerItem) {
      clonedModel.userData.cornerPivot = cornerPivot;
    }

    return clonedModel;
  }, [model, catalogItem, scaleX, scaleY, scaleZ, itemType, modelPath]);

  useEffect(() => {
    const loader = new GLTFLoader();

    loader.load(
      modelPath,
      (gltf) => {
        const scene = gltf.scene.clone();

        // Apply countertop texture if provided
        if (countertopTextureSrc) {
          applyCountertopTexture(scene, countertopTextureSrc);
        }

        // Add interactive features if needed
        if (interactive && onSurfaceClick) {
          addInteractiveFeatures(scene);
        }

        setModel(scene);
        setLoading(false);
        onLoad?.();
      },
      (progress) => {
        // Optional: handle loading progress
        console.log(`Loading model ${modelPath}: ${(progress.loaded / progress.total * 100)}%`);
      },
      (error: unknown) => {
  const err =
    error instanceof Error
      ? error
      : (typeof error === 'object' && error !== null && 'message' in error)
        ? new Error(String((error as any).message))
        : new Error(String(error));

  console.error(`Failed to load model ${modelPath}:`, err);
  setError(err.message);
  setLoading(false);
  onError?.(err);
}

    );

    return () => {
      // Cleanup on unmount
      if (meshRef.current) {
        // Dispose of geometries and materials
        meshRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    };
  }, [modelPath, countertopTextureSrc, onLoad, onError, interactive, onSurfaceClick]);

  // Apply countertop texture to appropriate materials
  const applyCountertopTexture = (scene: THREE.Group, textureSrc: string) => {
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(
      textureSrc,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        scene.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData?.type === 'countertop') {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => {
                material.map = texture;
                material.needsUpdate = true;
              });
            } else {
              child.material.map = texture;
              child.material.needsUpdate = true;
            }
          }
        });
      },
      undefined,
      (error) => {
        console.error('Failed to load countertop texture:', error);
      }
    );
  };

  // Add interactive features to countertop surfaces
  const addInteractiveFeatures = (scene: THREE.Group) => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData?.type === 'countertop') {
        child.userData.interactive = true;
      }
    });
  };

  if (loading) {
    return (
      <mesh position={position} rotation={rotation} scale={[scaleX, scaleY, scaleZ]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial color="gray" wireframe />
      </mesh>
    );
  }

  if (error) {
    return (
      <mesh position={position} rotation={rotation} scale={[scaleX, scaleY, scaleZ]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial color="red" />
      </mesh>
    );
  }

  if (!normalizedModel) return null;

  // Handle clicks on interactive surfaces
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (interactive && onSurfaceClick) {
      // Check if the clicked object is interactive
      if (event.object.userData?.interactive) {
        onSurfaceClick(event);
      }
    }
  };

  const handleContextMenu = (event: ThreeEvent<MouseEvent>) => {
    if (!onContextMenu) {
      return;
    }

    event.stopPropagation();
    event.nativeEvent.preventDefault();
    onContextMenu(event);
  };

  return (
    <group position={position} rotation={rotation}>
      <primitive
        ref={meshRef}
        object={normalizedModel}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
    </group>
  );
};
