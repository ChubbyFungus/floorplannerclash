import React, { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BlindCornerBase } from './Cabinet';
import * as THREE from 'three';

interface CornerCabinetTestHarnessProps {
  width: number;
  depth: number;
  height: number;
  blindInset: number;
  rotationY: number;
  itemId: number;
}

const CornerCabinetTestHarness: React.FC<CornerCabinetTestHarnessProps> = ({
  width,
  depth,
  height,
  blindInset,
  rotationY,
  itemId,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if ((window as any).Playwright && groupRef.current) {
      // Expose the specific item's group to the global object for Playwright to access
      if (!(window as any).threeJsGroupRefs) {
        (window as any).threeJsGroupRefs = new Map();
      }
      (window as any).threeJsGroupRefs.set(itemId, groupRef.current);
    }
  }, [itemId]);

  return (
    <Canvas shadows camera={{ position: [0, 5, 12], fov: 50 }}>
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
      <OrbitControls makeDefault />
      <group ref={groupRef} position={[0, 0, 0]} rotation={[0, rotationY, 0]}>
        <BlindCornerBase
          width={width}
          depth={depth}
          height={height}
          blindInset={blindInset}
        />
      </group>
    </Canvas>
  );
};

export default CornerCabinetTestHarness;
