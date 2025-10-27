import React, { useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';

interface SelectionMarkerProps {
  position: [number, number, number];
  normal: [number, number, number];
}

const SelectionMarker: React.FC<SelectionMarkerProps> = ({ position, normal }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const vecPosition = new THREE.Vector3().fromArray(position);
  const vecNormal = new THREE.Vector3().fromArray(normal);

  useLayoutEffect(() => {
    if (meshRef.current) {
      // Move the marker slightly off the surface to avoid z-fighting
      meshRef.current.position.copy(vecPosition).add(vecNormal.clone().multiplyScalar(0.02));
      
      // Orient the marker to be parallel to the surface by looking at a point along the normal
      meshRef.current.lookAt(vecPosition.clone().add(vecNormal));
    }
  }, [position, normal, vecPosition, vecNormal]);

  return (
    <mesh ref={meshRef}>
      <circleGeometry args={[0.4, 32]} />
      <meshBasicMaterial color="#00ffff" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
};

export default SelectionMarker;
