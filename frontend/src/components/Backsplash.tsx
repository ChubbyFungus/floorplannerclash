import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';

interface BacksplashMeshProps {
  points: [number, number, number][];
  normal: [number, number, number];
  textureSrc: string;
  onSurfaceClick: (event: ThreeEvent<MouseEvent>) => void;
}

const BACKSPLASH_THICKNESS = 0.04;
const TILE_SCALE = 4; // How many tiles per scene unit

const BacksplashMesh: React.FC<BacksplashMeshProps> = ({ points, normal, textureSrc, onSurfaceClick }) => {
  const texture = useTexture(textureSrc);

  const [geometry, position, quaternion, textureRepeat] = useMemo(() => {
    if (points.length < 3) return [null, null, null, null];

    const normalVec = new THREE.Vector3(...normal);
    // FIX: Define the plane using a point on the wall, not the origin.
    const pointOnPlane = new THREE.Vector3(...points[0]);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normalVec, pointOnPlane);
    
    let centroid = new THREE.Vector3();
    // Project points onto the correct plane to ensure accuracy and calculate centroid.
    const projectedPoints = points.map(p => {
        const pointVec = new THREE.Vector3(...p);
        const projected = plane.projectPoint(pointVec, new THREE.Vector3());
        centroid.add(projected);
        return projected;
    });
    centroid.divideScalar(points.length);
    
    // Create a robust coordinate system on the plane
    const up = new THREE.Vector3(0, 1, 0);
    let right: THREE.Vector3;
    if (Math.abs(normalVec.dot(up)) > 0.99) { // Normal is vertical or near-vertical
        right = new THREE.Vector3(1, 0, 0);
    } else {
        right = new THREE.Vector3().crossVectors(normalVec, up).normalize();
    }
    const forward = new THREE.Vector3().crossVectors(right, normalVec).normalize();

    const shapePoints2D = projectedPoints.map(p => {
        const relVec = new THREE.Vector3().subVectors(p, centroid);
        return new THREE.Vector2(relVec.dot(right), relVec.dot(forward));
    });

    const shape = new THREE.Shape(shapePoints2D);
    const extrudeSettings = {
      steps: 1,
      depth: BACKSPLASH_THICKNESS,
      bevelEnabled: false,
    };
    
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Position the mesh so its back is flush with the wall.
    const pos = centroid.clone().add(normalVec.clone().multiplyScalar(BACKSPLASH_THICKNESS / 2));
    
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalVec);

    // Calculate texture repeat based on the 2D shape's bounding box
    const box = new THREE.Box2().setFromPoints(shapePoints2D);
    const size = new THREE.Vector2();
    box.getSize(size);
    const repeat = new THREE.Vector2(size.x * TILE_SCALE, size.y * TILE_SCALE);
    
    return [geom, pos, quat, repeat];
  }, [points, normal]);

  // Configure the texture properties once it's loaded and the repeat values are calculated
  useMemo(() => {
    if (textureRepeat) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.copy(textureRepeat);
      texture.magFilter = THREE.NearestFilter; // For a crisp, pixelated look
      texture.minFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
    }
  }, [texture, textureRepeat]);


  if (!geometry || !position || !quaternion) return null;

  return (
    <mesh
      castShadow
      receiveShadow
      geometry={geometry}
      position={position}
      quaternion={quaternion}
      userData={{ type: 'backsplash' }}
      onClick={onSurfaceClick}
    >
      <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
};

export default BacksplashMesh;