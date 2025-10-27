import React from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface RoomProps {
  onSurfaceClick: (event: ThreeEvent<MouseEvent>) => void;
  textureSrc: string;
  width: number;
  depth: number;
}

const Room: React.FC<RoomProps> = ({ onSurfaceClick, textureSrc, width, depth }) => {
  const floorTexture = useTexture(textureSrc);
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(Math.max(width / 2, 1), Math.max(depth / 2, 1));

  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const wallHeight = 5;
  const wallThickness = 0.1;

  return (
    <group>
      {/* Floor */}
      <mesh receiveShadow position={[0, -0.005, 0]} onClick={onSurfaceClick} userData={{ type: 'floor' }}>
        <boxGeometry args={[width, 0.01, depth]} />
        <meshStandardMaterial map={floorTexture} />
      </mesh>
      {/* Back Wall */}
      <mesh
        receiveShadow
        position={[0, wallHeight / 2, -halfDepth]}
        onClick={onSurfaceClick}
        userData={{ type: 'backsplash' }}
      >
        <boxGeometry args={[width, wallHeight, wallThickness]} />
        <meshStandardMaterial color="#3a475a" />
      </mesh>
       {/* Left Wall */}
      <mesh
        receiveShadow
        position={[-halfWidth, wallHeight / 2, 0]}
        onClick={onSurfaceClick}
        userData={{ type: 'backsplash' }}
      >
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color="#3a475a" />
      </mesh>
      {/* Right Wall */}
      <mesh
        receiveShadow
        position={[halfWidth, wallHeight / 2, 0]}
        onClick={onSurfaceClick}
        userData={{ type: 'backsplash' }}
      >
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color="#3a475a" />
      </mesh>
      {/* Front Wall (semi-transparent) */}
      <mesh
        receiveShadow
        position={[0, wallHeight / 4, halfDepth]}
        onClick={onSurfaceClick}
        userData={{ type: 'backsplash' }}
      >
        <boxGeometry args={[width, wallHeight / 2, wallThickness]} />
        <meshStandardMaterial color="#3a475a" transparent opacity={0.3} />
      </mesh>
    </group>
  );
};

export default Room;
