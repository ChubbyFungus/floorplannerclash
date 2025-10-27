import type { ThreeElements } from '@react-three/fiber';

// FIX: Restored type definitions for react-three-fiber to fix JSX intrinsic element errors.
// By placing these in a separate file and importing it, we ensure TypeScript's module
// augmentation correctly extends the JSX namespace for 3D components.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: ThreeElements['group'];
      mesh: ThreeElements['mesh'];
      object3D: ThreeElements['object3D'];
      primitive: ThreeElements['primitive'];
      boxGeometry: ThreeElements['boxGeometry'];
      cylinderGeometry: ThreeElements['cylinderGeometry'];
      planeGeometry: ThreeElements['planeGeometry'];
      // FIX: Added torusGeometry for use in the Faucet component.
      torusGeometry: ThreeElements['torusGeometry'];
      meshStandardMaterial: ThreeElements['meshStandardMaterial'];
      ambientLight: ThreeElements['ambientLight'];
      hemisphereLight: ThreeElements['hemisphereLight'];
      directionalLight: ThreeElements['directionalLight'];
      gridHelper: ThreeElements['gridHelper'];
    }
  }
}
