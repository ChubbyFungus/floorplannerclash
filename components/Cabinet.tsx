import React, { memo, useMemo, useLayoutEffect, useRef } from "react";
import { type ThreeElements } from "@react-three/fiber";

import * as THREE from "three";

const isCabinetDebugEnabled = process.env.NODE_ENV !== "production";
const debugCabinet = (label: string, payload: Record<string, unknown>) => {
  if (!isCabinetDebugEnabled) return;
  let formatted: unknown = payload;
  try {
    formatted = JSON.stringify(payload, null, 2);
  } catch {
    // fallback to raw payload
  }
  console.debug(`[cabinet][apps/frontend/src/components/Cabinet.tsx] ${label}`, formatted);
};

const summarizeVector = (value: unknown) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === "number" ? Number(entry.toFixed(4)) : entry));
  }
  if (typeof value === "object") {
    const maybe = value as { x?: number; y?: number; z?: number };
    if (
      typeof maybe?.x === "number" ||
      typeof maybe?.y === "number" ||
      typeof maybe?.z === "number"
    ) {
      return {
        x: typeof maybe.x === "number" ? Number(maybe.x.toFixed(4)) : maybe.x,
        y: typeof maybe.y === "number" ? Number(maybe.y.toFixed(4)) : maybe.y,
        z: typeof maybe.z === "number" ? Number(maybe.z.toFixed(4)) : maybe.z,
      };
    }
  }
  return value;
};
const summarizeEuler = (value: THREE.Euler | null | undefined) =>
  value ? { x: Number(value.x.toFixed(4)), y: Number(value.y.toFixed(4)), z: Number(value.z.toFixed(4)) } : null;
const toVectorComponents = (value: unknown): { x: number; y: number; z: number } | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    const [x = 0, y = 0, z = 0] = value as number[];
    return { x, y, z };
  }
  if (typeof value === 'object') {
    const vec = value as { x?: number; y?: number; z?: number };
    if (
      typeof vec.x === 'number' ||
      typeof vec.y === 'number' ||
      typeof vec.z === 'number'
    ) {
      return {
        x: typeof vec.x === 'number' ? vec.x : 0,
        y: typeof vec.y === 'number' ? vec.y : 0,
        z: typeof vec.z === 'number' ? vec.z : 0,
      };
    }
  }
  return null;
};

/** ===== Units & materials ===== */
const INCH = 0.0254; // set to 1 if your scene units are inches
const wood = new THREE.MeshStandardMaterial({ color: "#b78e65", metalness: 0, roughness: 0.6 });
const beadShadow = new THREE.MeshStandardMaterial({ color: "#5c4733", metalness: 0, roughness: 0.8 });
const glassMat = new THREE.MeshPhysicalMaterial({
  color: "#ffffff",
  transmission: 0.98,
  thickness: 0.2,
  roughness: 0.02,
  metalness: 0,
  transparent: true,
  opacity: 0.5,
  ior: 1.5,
});

const DOOR_SIDE_GAP = 0.0625;
const DOOR_TOP_GAP = 0.0625;
const DOOR_BOTTOM_GAP = 0.0625;

const doorMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
function getDoorMaterial(color: string) {
  const key = color.toLowerCase();
  let mat = doorMaterialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.45 });
    doorMaterialCache.set(key, mat);
  }
  return mat;
}

export const DEFAULT_DOOR_COLOR = "#b78e65";
const front = getDoorMaterial(DEFAULT_DOOR_COLOR);

/** ===== Types ===== */
export type FrameSystem = "frameless" | "fullOverlay" | "standardOverlay" | "inset";
export type OpeningPattern =
  | "singleDoor"
  | "doubleDoor"
  | "drawerOverDoors"
  | "threeDrawer"
  | "sinkBase"
  | "singlePantry"
  | "doublePantry"
  | "ovenTall"
  | "singleWallDoor"
  | "doubleWallDoor";

export type DoorStyle =
  | "slab"
  | "shaker"
  | "raised"
  | "beadboard"
  | "louvered"
  | "glass"
  | "none";

export type CabinetProps = ThreeElements['group'] & {
  frameSystem?: FrameSystem;
  width: number; // inches
  height: number; // inches
  depth: number; // inches
  toeKick?: number; // inches, base only
  rail?: number; // face-frame rail width
  stile?: number; // face-frame stile width
  doorGap?: number; // between leaves
  overlay?: number; // overlay for framed
  insetClearance?: number; // inset reveal
  doorThickness?: number; // front thickness
  faceFrameThickness?: number;
  carcassThickness?: number; // visual only
  openingPattern: OpeningPattern;
  hingeLeft?: boolean; // single-door
  drawerHeights?: number[]; // threeDrawer / drawerOverDoors
  applianceOpening?: { width: number; height: number; bottomFromFloor: number }; // ovenTall
  doorStyle?: DoorStyle;
  doorFrameWidth?: number; // for shaker/raised/glass frames
  doorColor?: string;
  frameColor?: string;
  roomHalfW?: number;
  roomHalfD?: number;
  wallThickness?: number;
};

interface RequiredCabinetProps extends CabinetProps {
    frameSystem: FrameSystem;
    toeKick: number;
    rail: number;
    stile: number;
    doorGap: number;
    overlay: number;
    insetClearance: number;
    doorThickness: number;
    faceFrameThickness: number;
    carcassThickness: number;
    hingeLeft: boolean;
    drawerHeights: number[];
    applianceOpening: { width: number; height: number; bottomFromFloor: number };
    doorStyle: DoorStyle;
    doorFrameWidth: number;
    doorColor: string;
    frameColor: string;
  }

/** ===== Defaults ===== */
const defaults = {
  toeKick: 4,
  rail: 1.5,
  stile: 1.5,
  doorGap: 0.125,
  overlay: 0.625, // typical full overlay
  insetClearance: 0.0625,
  doorThickness: 0.75,
  faceFrameThickness: 0.75,
  carcassThickness: 0.75,
  doorStyle: "shaker" as DoorStyle,
  doorFrameWidth: 2.25,
  doorColor: DEFAULT_DOOR_COLOR,
  frameColor: DEFAULT_DOOR_COLOR,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function useCornerPivot(
  pivotRef: React.RefObject<THREE.Group | null>,
  contentRef: React.RefObject<THREE.Group | null>,
  deps: React.DependencyList,
  options?: { rotationOffset?: number }
) {
  const appliedRef = useRef(false);

  useLayoutEffect(() => {
    if (appliedRef.current) return;
    const pivot = pivotRef.current;
    const content = contentRef.current;
    if (!pivot || !content) return;

    const originalRotation = pivot.rotation.clone();
    const originalScale = pivot.scale.clone();
    const rotationOffset = options?.rotationOffset ?? 0;
    const parent = pivot.parent;
    const parentYaw =
      (parent && 'rotation' in parent && parent.rotation instanceof THREE.Euler
        ? parent.rotation.y
        : originalRotation.y) ?? 0;
    const adjustedYaw = parentYaw + rotationOffset;
    const quarterTurns = ((Math.round(adjustedYaw / (Math.PI / 2)) % 4) + 4) % 4;

    pivot.position.set(0, 0, 0);
    pivot.rotation.set(0, 0, 0);
    pivot.scale.set(1, 1, 1);
    pivot.updateMatrixWorld(true);

    parent?.updateWorldMatrix?.(true, false);
    const parentInverse = parent ? new THREE.Matrix4().copy(parent.matrixWorld).invert() : null;

    const box = new THREE.Box3().setFromObject(content);
    if (parentInverse) {
      box.applyMatrix4(parentInverse);
    }
    if (!Number.isFinite(box.min.x)) {
      pivot.rotation.copy(originalRotation);
      pivot.scale.copy(originalScale);
      pivot.updateMatrixWorld(true);
      return;
    }

    const px = quarterTurns === 2 ? box.max.x : quarterTurns === 3 ? box.max.x : box.min.x;
    const pz = quarterTurns === 1 ? box.max.z : quarterTurns === 2 ? box.max.z : box.min.z;

    const py = box.min.y;

    pivot.position.set(-px, -py, -pz);

    pivot.rotation.copy(originalRotation);
    pivot.scale.copy(originalScale);
    pivot.updateMatrixWorld(true);
    appliedRef.current = true;

    if (process.env.NODE_ENV !== 'production') {
      const pivotLocalEuler = pivot.rotation.clone();
      const pivotWorldQuat = new THREE.Quaternion();
      const pivotWorldEuler = new THREE.Euler();
      pivot.getWorldQuaternion(pivotWorldQuat);
      pivotWorldEuler.setFromQuaternion(pivotWorldQuat, 'XYZ');
      const contentLocalEuler = (content.rotation?.clone?.() ??
        new THREE.Euler()) as THREE.Euler;
      const contentWorldQuat = new THREE.Quaternion();
      const contentWorldEuler = new THREE.Euler();
      content.getWorldQuaternion(contentWorldQuat);
      contentWorldEuler.setFromQuaternion(contentWorldQuat, 'XYZ');
      const pivotWorldPosition = new THREE.Vector3();
      pivot.getWorldPosition(pivotWorldPosition);
      const contentWorldPosition = new THREE.Vector3();
      content.getWorldPosition(contentWorldPosition);
      const depsSnapshot = deps.map((dep) => {
        if (dep == null) return dep;
        if (typeof dep === 'number') return Number(dep.toFixed(4));
        if (typeof dep === 'object') return summarizeVector(dep);
        if (typeof dep === 'function') return dep.name || 'anonymous';
        return dep;
      });

      console.debug('[corner-pivot][apps/frontend/src/components/Cabinet.tsx]', {
        quarterTurns,
        parentYaw,
        rotationOffset,
        adjustedYaw,
        pivotPosition: { x: pivot.position.x, y: pivot.position.y, z: pivot.position.z },
        pivotWorldPosition: summarizeVector(pivotWorldPosition),
        contentWorldPosition: summarizeVector(contentWorldPosition),
        pivotLocalEuler: summarizeEuler(pivotLocalEuler),
        pivotWorldEuler: summarizeEuler(pivotWorldEuler),
        contentLocalEuler: summarizeEuler(contentLocalEuler),
        contentWorldEuler: summarizeEuler(contentWorldEuler),
        bbox: {
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
        },
        depsSnapshot,
      });
    }
  }, deps);
}

function useCornerContentOrigin(
  pivotRef: React.RefObject<THREE.Group | null>,
  contentRef: React.RefObject<THREE.Group | null>,
  deps: React.DependencyList
) {
  const bakedRef = useRef(false);

  useLayoutEffect(() => {
    if (bakedRef.current) return;
    const pivot = pivotRef.current;
    const content = contentRef.current;
    if (!pivot || !content) return;

    content.rotation.set(0, 0, 0);
    content.position.set(0, 0, 0);
    content.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(content);
    if (!Number.isFinite(box.min.x)) {
      return;
    }

    content.position.set(-box.min.x, -box.min.y, -box.min.z);
    content.updateMatrixWorld(true);
    bakedRef.current = true;

    if (process.env.NODE_ENV !== 'production') {
      const pivotWorldPosition = new THREE.Vector3();
      pivot.getWorldPosition(pivotWorldPosition);
      console.debug('[corner-origin][apps/frontend/src/components/Cabinet.tsx]', {
        bbox: {
          min: summarizeVector(box.min),
          max: summarizeVector(box.max),
        },
        pivotWorldPosition: summarizeVector(pivotWorldPosition),
      });
    }
  }, deps);
}

type CornerFootprintOptions =
  | { type: 'diagonal'; inset: number }
  | { type: 'l'; notchX: number; notchZ: number };

function createDiagonalCornerFootprint(width: number, depth: number, diagonalInset: number) {
  const w = inches(width);
  const d = inches(depth);
  const inset = inches(diagonalInset);

  const shape = new THREE.Shape();
  shape.moveTo(0, d);
  shape.lineTo(w, d);
  shape.lineTo(w, inset);
  shape.lineTo(w - inset, 0);
  shape.lineTo(0, 0);
  shape.closePath();
  return shape;
}

function createLCornerFootprint(width: number, depth: number, notchX: number, notchZ: number) {
  const w = inches(width);
  const d = inches(depth);
  const nx = inches(Math.min(Math.max(notchX, 0), width));
  const nz = inches(Math.min(Math.max(notchZ, 0), depth));

  const shape = new THREE.Shape();
  shape.moveTo(0, nz);
  shape.lineTo(0, d);
  shape.lineTo(w, d);
  shape.lineTo(w, 0);
  shape.lineTo(nx, 0);
  shape.lineTo(nx, nz);
  shape.lineTo(0, nz);
  shape.closePath();
  return shape;
}

function createCornerExtrudeGeometry(
  width: number,
  depth: number,
  verticalHeight: number,
  options: CornerFootprintOptions
) {
  const safeHeight = Math.max(verticalHeight, 0);
  if (safeHeight <= 0) {
    return null;
  }

  let footprint: THREE.Shape;
  if (options.type === 'diagonal') {
    footprint = createDiagonalCornerFootprint(width, depth, options.inset);
  } else {
    footprint = createLCornerFootprint(width, depth, options.notchX, options.notchZ);
  }

  const geometry = new THREE.ExtrudeGeometry(footprint, {
    depth: inches(safeHeight),
    bevelEnabled: false,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, inches(depth));
  return geometry;
}

type CornerCabinetProps = ThreeElements['group'] & {
  width: number;
  depth?: number;
  height?: number;
  blindInset?: number;
  toeKick?: number;
  frameSystem?: FrameSystem;
  doorStyle?: DoorStyle;
  doorFrameWidth?: number;
  doorColor?: string;
  frameColor?: string;
  doorThickness?: number;
  carcassThickness?: number;
  faceFrameThickness?: number;
  shelfCount?: number;
  roomHalfW?: number;
  roomHalfD?: number;
  wallThickness?: number;
};
function inches(n: number) {
  return n * INCH;
}

/** ===== Face frame (framed systems) ===== */
function FaceFrame({
  w,
  h,
  t,
  rail,
  stile,
  bottom,
  material = front,
}: {
  w: number;
  h: number;
  t: number;
  rail: number;
  stile: number;
  bottom: number;
  material?: THREE.Material;
}) {
  const parts: React.ReactNode[] = [];
  const railHalf = rail / 2;
  const stileHalf = stile / 2;
  const frameCenterY = bottom + h / 2;
  const frontZ = -t / 2;

  parts.push(
    <mesh
      key="top"
      position={[0, inches(bottom + h - railHalf), inches(frontZ)]}
      geometry={new THREE.BoxGeometry(inches(w), inches(rail), inches(t))}
      material={material}
      castShadow
      receiveShadow
    />
  );
  parts.push(
    <mesh
      key="bot"
      position={[0, inches(bottom + railHalf), inches(frontZ)]}
      geometry={new THREE.BoxGeometry(inches(w), inches(rail), inches(t))}
      material={material}
      castShadow
      receiveShadow
    />
  );
  parts.push(
    <mesh
      key="left"
      position={[
        -inches(w / 2 - stileHalf),
        inches(frameCenterY),
        inches(frontZ),
      ]}
      geometry={new THREE.BoxGeometry(
        inches(stile),
        inches(Math.max(h - 2 * rail, 0)),
        inches(t)
      )}
      material={material}
      castShadow
      receiveShadow
    />
  );
  parts.push(
    <mesh
      key="right"
      position={[
        inches(w / 2 - stileHalf),
        inches(frameCenterY),
        inches(frontZ),
      ]}
      geometry={new THREE.BoxGeometry(
        inches(stile),
        inches(Math.max(h - 2 * rail, 0)),
        inches(t)
      )}
      material={material}
      castShadow
      receiveShadow
    />
  );
  return <group>{parts}</group>;
}

/** ===== Door leaf sizing ===== */
type LeafBase = { w: number; h: number; x: number };
type DoorLeaf = LeafBase & { centerY: number };

function computeLeaves(p: RequiredCabinetProps) {
  const {
    frameSystem,
    width,
    height,
    rail,
    stile,
    doorGap,
    overlay,
    insetClearance,
    openingPattern,
  } = p;

  const openingW = frameSystem === "frameless" ? width : width - 2 * stile;
  const openingH = frameSystem === "frameless" ? height : height - 2 * rail;

  function leafWH() {
    let w = openingW;
    let h = openingH;
    if (frameSystem === "inset") {
      w -= 2 * insetClearance;
      h -= 2 * insetClearance;
    } else {
      w += 2 * overlay;
      h += 2 * overlay;
    }
    w -= 2 * DOOR_SIDE_GAP;
    h -= DOOR_TOP_GAP + DOOR_BOTTOM_GAP;
    return { w, h };
  }

  function asDouble() {
    const { w, h } = leafWH();
    const each = (w - doorGap) / 2;
    return [
      { w: each, h, x: -(each + doorGap) / 2 },
      { w: each, h, x: +(each + doorGap) / 2 },
    ];
  }

  switch (openingPattern) {
    case "singleDoor":
    case "singleWallDoor":
    case "singlePantry": {
      const { w, h } = leafWH();
      return [{ w, h, x: 0 }];
    }
    case "doubleDoor":
    case "doubleWallDoor":
    case "doublePantry":
    case "drawerOverDoors":
    case "sinkBase":
      return asDouble();
    case "threeDrawer":
    case "ovenTall":
      return []; // handled elsewhere
    default:
      return [];
  }
}

function computeDoorVerticalSpan(p: RequiredCabinetProps) {
  const baseBottom = p.toeKick + (p.frameSystem === "frameless" ? 0 : p.rail);
  const baseTop = p.height - (p.frameSystem === "frameless" ? 0 : p.rail);

  if (p.frameSystem === "inset") {
    const bottom = Math.max(p.toeKick, baseBottom + p.insetClearance);
    const top = Math.min(p.height, baseTop - p.insetClearance);
    return { bottom, top };
  }

  const overlayAmount = p.frameSystem === "frameless" ? 0 : p.overlay;
  const bottom = Math.max(p.toeKick, baseBottom - overlayAmount);
  const top = Math.min(p.height, baseTop + overlayAmount);
  return { bottom, top };
}

/** ===== Door/Drawer face generators (panel geometry) ===== */
function DoorFace({
  w,
  h,
  style,
  thickness,
  frameW,
  material = front,
}: {
  w: number;
  h: number;
  style: DoorStyle;
  thickness: number;
  frameW: number;
  material?: THREE.MeshStandardMaterial;
}) {
  if (style === "none") return null;

  const t = thickness;
  const group: React.ReactNode[] = [];

  const addBox = (
    key: string,
    sx: number,
    sy: number,
    sz: number,
    px: number,
    py: number,
    pz: number,
    mat = material
  ) =>
    group.push(
      <mesh key={key} position={[inches(px), inches(py), inches(pz)]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[inches(sx), inches(sy), inches(sz)]} />
      </mesh>
    );

  switch (style) {
    case "slab": {
      addBox("slab", w, h, t, 0, 0, 0, material);
      break;
    }
    case "shaker": {
      // outer frame rails/stiles
      addBox("top", w, frameW, t, 0, h / 2 - frameW / 2, 0);
      addBox("bot", w, frameW, t, 0, -h / 2 + frameW / 2, 0);
      addBox("left", frameW, h - 2 * frameW, t, -w / 2 + frameW / 2, 0, 0);
      addBox("right", frameW, h - 2 * frameW, t, w / 2 - frameW / 2, 0, 0);
      // recessed panel set back a little in Y
      const pw = w - 2 * frameW;
      const ph = h - 2 * frameW;
      addBox("panel", pw, ph, Math.max(0.375, t * 0.6), 0, 0, -0.125, beadShadow);
      break;
    }
    case "raised": {
      // frame
      addBox("top", w, frameW, t, 0, h / 2 - frameW / 2, 0);
      addBox("bot", w, frameW, t, 0, -h / 2 + frameW / 2, 0);
      addBox("left", frameW, h - 2 * frameW, t, -w / 2 + frameW / 2, 0, 0);
      addBox("right", frameW, h - 2 * frameW, t, w / 2 - frameW / 2, 0, 0);
      // raised center panel: two-step stack for a faux bevel
      const pw = w - 2 * frameW;
      const ph = h - 2 * frameW;
      addBox("panel1", pw, ph, Math.max(0.5, t * 0.7), 0, 0, 0.05, material);
      addBox("panel2", pw - 2, ph - 2, Math.max(0.5, t * 0.85), 0, 0, 0.12, material);
      break;
    }
    case "beadboard": {
      // base slab
      addBox("base", w, h, t * 0.7, 0, 0, -0.05, material);
      // vertical grooves in a shallow recess
      const grooveW = 0.125;
      const innerW = w - grooveW; // avoid exact edge
      const spacing = 1.5;
      const count = Math.max(1, Math.floor(innerW / spacing));
      const usable = innerW - grooveW;
      for (let i = 0; i <= count; i++) {
        const x = -usable / 2 + (usable * i) / count;
        addBox(`groove-${i}`, grooveW, h - 0.5, t * 0.9, x, 0, -0.1, beadShadow);
      }
      break;
    }
    case "louvered": {
      // perimeter frame for strength
      addBox("left", 1.25, h, t, -w / 2 + 0.625, 0, 0, material);
      addBox("right", 1.25, h, t, w / 2 - 0.625, 0, 0, material);
      addBox("top", w - 2 * 1.25, 1.25, t, 0, h / 2 - 0.625, 0, material);
      addBox("bot", w - 2 * 1.25, 1.25, t, 0, -h / 2 + 0.625, 0, material);
      // slats
      const innerH = h - 2 * 1.25;
      const slatT = 0.3;
      const slatH = 1.0;
      const gap = 0.5;
      const pitchDeg = 20;
      const pitch = (pitchDeg * Math.PI) / 180;
      const count = Math.max(2, Math.floor(innerH / (slatH + gap)));
      for (let i = 0; i < count; i++) {
        const yPos = -innerH / 2 + (i + 0.5) * (slatH + gap);
        group.push(
          <mesh
            key={`slat-${i}`}
            position={[0, inches(yPos), 0]}
            rotation={[pitch, 0, 0]}
            castShadow
            receiveShadow
            material={front}
          >
            <boxGeometry
              args={[
                inches(w - 2 * 1.25 - 0.5),
                inches(slatH),
                inches(slatT),
              ]}
            />
          </mesh>
        );
      }
      break;
    }
    case "glass": {
      // frame only plus glass pane set back slightly
      addBox("top", w, frameW, t, 0, h / 2 - frameW / 2, 0);
      addBox("bot", w, frameW, t, 0, -h / 2 + frameW / 2, 0);
      addBox("left", frameW, h - 2 * frameW, t, -w / 2 + frameW / 2, 0, 0);
      addBox("right", frameW, h - 2 * frameW, t, w / 2 - frameW / 2, 0, 0);
      const pw = w - 2 * frameW - 0.25;
      const ph = h - 2 * frameW - 0.25;
      group.push(
        <mesh
          key="glass"
          position={[0, 0, inches(-0.1)]}
          castShadow={false}
          receiveShadow={false}
          material={glassMat}
        >
          <boxGeometry
            args={[
              inches(pw),
              inches(ph),
              inches(Math.max(0.25, t * 0.3)),
            ]}
          />
        </mesh>
      );
      break;
    }
  }
  return <group>{group}</group>;
}

function DrawerFace({
  w,
  h,
  style,
  thickness,
  frameW,
  material,
}: {
  w: number;
  h: number;
  style: DoorStyle;
  thickness: number;
  frameW: number;
  material: THREE.MeshStandardMaterial;
}) {
  // Glass/louvered drawers are rare; treat as slab fallback.
  const safeStyle: DoorStyle =
    style === "glass" || style === "louvered" ? "slab" : style;
  return (
    <DoorFace
      w={w}
      h={h}
      style={safeStyle}
      thickness={thickness}
      frameW={frameW}
      material={material}
    />
  );
}

/** ===== Cabinet (rectangular) ===== */
export const RectCabinet = memo(function RectCabinet(raw: CabinetProps) {
  const { roomHalfW: _roomHalfW, roomHalfD: _roomHalfD, wallThickness: _wallThickness, ...cabinetProps } = raw;

  const p: RequiredCabinetProps = {
    frameSystem: "fullOverlay",
    toeKick: defaults.toeKick,
    rail: defaults.rail,
    stile: defaults.stile,
    doorGap: defaults.doorGap,
    overlay: defaults.overlay,
    insetClearance: defaults.insetClearance,
    doorThickness: defaults.doorThickness,
  faceFrameThickness: defaults.faceFrameThickness,
  carcassThickness: defaults.carcassThickness,
  hingeLeft: true,
  drawerHeights: [6, 9, 9],
  applianceOpening: { width: 30, height: 30, bottomFromFloor: 30 },
  doorStyle: defaults.doorStyle,
  doorFrameWidth: defaults.doorFrameWidth,
  doorColor: defaults.doorColor,
  frameColor: defaults.frameColor,
  ...cabinetProps,
};

  const isWallCabinetPattern =
    p.openingPattern === "singleWallDoor" ||
    p.openingPattern === "doubleWallDoor";

  if ((cabinetProps as Partial<CabinetProps>).toeKick === undefined && isWallCabinetPattern) {
    p.toeKick = 0;
  }

  const {
    width,
    height,
    depth,
    toeKick,
    frameSystem,
    rail,
    stile,
    faceFrameThickness,
    openingPattern,
    doorThickness,
    drawerHeights,
    doorStyle,
    doorFrameWidth,
    doorColor,
    carcassThickness,
    frameColor,
  } = p;

  const overlayForSystem = frameSystem === "frameless" ? 0 : p.overlay;
  const insetForSystem = frameSystem === "inset" ? p.insetClearance : defaults.insetClearance;
  p.overlay = overlayForSystem;
  p.insetClearance = insetForSystem;

  const doorMaterial = getDoorMaterial(doorColor);
  const frameMaterial = getDoorMaterial(frameColor ?? doorColor);

  debugCabinet("rect.render", {
    openingPattern,
    frameSystem,
    width,
    height,
    depth,
    doorStyle,
    doorColor,
    frameColor,
    overlay: overlayForSystem,
    insetClearance: insetForSystem,
    groupPosition: summarizeVector(cabinetProps.position),
    groupRotation: summarizeVector(cabinetProps.rotation),
    groupScale: summarizeVector(cabinetProps.scale),
  });

  // carcass
  const buildCarcass = (carcassThicknessValue: number) => {
    const t = carcassThicknessValue;
    const w = width;
    const h = height - toeKick;
    const d = depth;

    const w_inner = w - 2 * t;
    const h_inner = h - 2 * t;
    
    let shelfCount = 0;
    const pattern = p.openingPattern;

    if (pattern.includes('Drawer') && !pattern.includes('Over')) {
        shelfCount = 0;
    } else if (pattern === 'sinkBase' || pattern === 'ovenTall') {
        shelfCount = 0;
    } else if (pattern.includes('Wall')) {
        shelfCount = 2;
    } else if (pattern.includes('Pantry')) {
        shelfCount = 4;
    } else { // Base cabinets
        shelfCount = 1;
    }

    const panels = [];
    const frameRecess = frameSystem === "frameless" ? 0 : faceFrameThickness;

    // Bottom
    panels.push(<mesh key="bottom" position={[0, inches(t / 2), -inches(d / 2)]} material={wood} castShadow receiveShadow><boxGeometry args={[inches(w), inches(t), inches(d)]} /></mesh>);
    // Top
    panels.push(<mesh key="top" position={[0, inches(h - t / 2), -inches(d / 2)]} material={wood} castShadow receiveShadow><boxGeometry args={[inches(w), inches(t), inches(d)]} /></mesh>);
    // Left
    panels.push(<mesh key="left" position={[-inches(w/2 - t/2), inches(h/2), -inches(d/2)]} material={wood} castShadow receiveShadow><boxGeometry args={[inches(t), inches(h_inner), inches(d)]} /></mesh>);
    // Right
    panels.push(<mesh key="right" position={[inches(w/2 - t/2), inches(h/2), -inches(d/2)]} material={wood} castShadow receiveShadow><boxGeometry args={[inches(t), inches(h_inner), inches(d)]} /></mesh>);
    // Back
    panels.push(<mesh key="back" position={[0, inches(h/2), -inches(d - t/2)]} material={wood} castShadow receiveShadow><boxGeometry args={[inches(w_inner), inches(h_inner), inches(t)]} /></mesh>);

    // Shelves
    if (shelfCount > 0) {
        const shelfAreaH = h - 2 * t;
        const shelfSpacing = shelfAreaH / (shelfCount + 1);
        for (let i = 1; i <= shelfCount; i++) {
            const shelfY = t + i * shelfSpacing;
            const shelfDepth = Math.max(0.1, d - t - frameRecess);
            const shelfCenterZ = -(frameRecess + shelfDepth / 2);
            panels.push(
              <mesh
                key={`shelf-${i}`}
                position={[0, inches(shelfY), inches(shelfCenterZ)]}
                material={wood}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[inches(w_inner), inches(t), inches(shelfDepth)]} />
              </mesh>
            );
        }
    }

    return <group position={[0, inches(toeKick), 0]}>{panels}</group>;
  };
  const carcass = buildCarcass(carcassThickness);

  const toe =
    toeKick > 0 && (
      <mesh receiveShadow position={[0, inches(toeKick / 2), -inches(depth / 2)]}>
        <boxGeometry args={[inches(width), inches(toeKick), inches(depth)]} />
        <meshStandardMaterial color="#444" roughness={0.9} />
      </mesh>
    );

  const frame =
    frameSystem === "frameless" ? null : (
      <FaceFrame
        w={width}
        h={height - toeKick}
        t={faceFrameThickness}
        rail={rail}
        stile={stile}
        bottom={toeKick}
        material={frameMaterial}
      />
  );

  // front plane
  const frontZ =
    frameSystem === "inset"
      ? -doorThickness / 2 + 0.001
      : doorThickness / 2 - 0.001;

  // Doors/Drawers
  const rawLeaves = computeLeaves(p) as LeafBase[];
  const span = computeDoorVerticalSpan(p);
  const doorHeightLimit = Math.max(0, span.top - span.bottom - (DOOR_TOP_GAP + DOOR_BOTTOM_GAP));
  const leaves: DoorLeaf[] = rawLeaves.map((leaf) => {
    const h = Math.min(leaf.h, doorHeightLimit);
    const centerY = span.bottom + DOOR_BOTTOM_GAP + h / 2;
    return { ...leaf, h, centerY };
  });

  const fronts: React.ReactNode[] = [];

  const placeDoor = (key: string, w: number, h: number, x: number, y: number) => (
    <group key={key} position={[inches(x), inches(y), inches(frontZ)]}>
      <DoorFace
        w={w}
        h={h}
        style={doorStyle}
        thickness={doorThickness}
        frameW={doorFrameWidth}
        material={doorMaterial}
      />
    </group>
  );

  const placeDrawer = (key: string, w: number, h: number, x: number, y: number) => (
    <group key={key} position={[inches(x), inches(y), inches(frontZ)]}>
      <DrawerFace
        w={w}
        h={h}
        style={doorStyle}
        thickness={doorThickness}
        frameW={doorFrameWidth}
        material={doorMaterial}
      />
    </group>
  );

  if (openingPattern === "threeDrawer") {
    const clearTop = frameSystem === "frameless" ? 0 : rail;
    const clearBot = frameSystem === "frameless" ? 0 : rail;
    const usableH = height - toeKick - clearTop - clearBot;
    const total = drawerHeights.reduce((a, b) => a + b, 0);
    const scale = usableH / total;
    let acc = toeKick + clearBot;
    const openingW = width - (frameSystem === "frameless" ? 0 : 2 * stile);
    const drawerFaceWidth = openingW + 2 * p.overlay - 2 * DOOR_SIDE_GAP;
    drawerHeights.forEach((h, i) => {
      const hh = h * scale;
      fronts.push(
        placeDrawer(
          `dr-${i}`,
          drawerFaceWidth,
          hh - 0.125,
          0,
          acc + hh / 2
        )
      );
      acc += hh;
    });
  } else if (openingPattern === "drawerOverDoors" || openingPattern === "sinkBase") {
    const drawerH = openingPattern === "sinkBase" ? 6 : 6.5;
    const openingW = width - (frameSystem === "frameless" ? 0 : 2 * stile);
    const drawerFaceWidth = openingW + 2 * p.overlay - 2 * DOOR_SIDE_GAP;
    fronts.push(
      placeDrawer(
        "topdr",
        drawerFaceWidth,
        drawerH - 0.125,
        0,
        toeKick + (frameSystem === "frameless" ? 0 : rail) + drawerH / 2
      )
    );
    // doors below
    const leavesBelow = computeLeaves({
      ...p,
      height:
        height - toeKick - drawerH - (frameSystem === "frameless" ? 0 : rail),
    });
    (leavesBelow as any[]).forEach((d: any, i: number) => {
      fronts.push(placeDoor(`door${i}`, d.w, d.h, d.x, toeKick + drawerH + (frameSystem === "frameless" ? 0 : rail) + d.h / 2));
    });
  } else if (
    openingPattern === "singleDoor" ||
    openingPattern === "doubleDoor" ||
    openingPattern === "singleWallDoor" ||
    openingPattern === "doubleWallDoor" ||
    openingPattern === "singlePantry" ||
    openingPattern === "doublePantry"
  ) {
    leaves.forEach((leaf, i) => {
      fronts.push(placeDoor(`leaf-${i}`, leaf.w, leaf.h, leaf.x, leaf.centerY));
    });
  } else if (openingPattern === "ovenTall") {
    const open = p.applianceOpening;
    const bottomH =
      open.bottomFromFloor -
      p.toeKick -
      (p.frameSystem === "frameless" ? 0 : p.rail);
    const topH =
      height -
      open.bottomFromFloor -
      open.height -
      (p.frameSystem === "frameless" ? 0 : p.rail);

    // appliance aperture (visual)
    fronts.push(
      <mesh
        key="aperture"
        position={[0, inches(open.bottomFromFloor + open.height / 2), -inches(depth / 2 - 0.5)]}
      >
        <boxGeometry args={[inches(open.width), inches(1), inches(open.height)]} />
        <meshStandardMaterial color="#222" roughness={0.9} />
      </mesh>
    );

    // doors below and above
    const bLeaves = computeLeaves({ ...p, height: bottomH });
    const tLeaves = computeLeaves({ ...p, height: topH });

    (bLeaves as any).forEach((d: any, i: number) => {
      fronts.push(placeDoor(`b-${i}`, d.w, d.h, d.x, p.toeKick + d.h / 2 + (p.frameSystem === "frameless" ? 0 : p.rail)));
    });
    (tLeaves as any).forEach((d: any, i: number) => {
      fronts.push(
        placeDoor(
          `t-${i}`,
          d.w,
          d.h,
          d.x,
          open.bottomFromFloor + open.height + d.h / 2
        )
      );
    });
  }

  return (
    <group {...(cabinetProps as ThreeElements['group'])}>
      <group position={[0, 0, inches(depth / 2)]}>
        {carcass}
        {toe}
        <group>{frame}</group>
        <group>{fronts}</group>
      </group>
    </group>
  );
});

/** ===== Archetype wrappers (rectangular) ===== */
// BASE
export const BaseSingleDoor = (p: Omit<CabinetProps, "openingPattern" | "height" | "depth"> & { height?: number; depth?: number }) => (
  <RectCabinet {...p} openingPattern="singleDoor" height={p.height ?? 34.5} depth={p.depth ?? 24} />
);
export const BaseDoubleDoor = (p: Omit<CabinetProps, "openingPattern" | "height" | "depth"> & { height?: number; depth?: number }) => (
  <RectCabinet {...p} openingPattern="doubleDoor" height={p.height ?? 34.5} depth={p.depth ?? 24} />
);
export const BaseThreeDrawer = (p: Omit<CabinetProps, "openingPattern" | "height" | "depth"> & { height?: number; depth?: number }) => (
  <RectCabinet {...p} openingPattern="threeDrawer" height={p.height ?? 34.5} depth={p.depth ?? 24} />
);
export const BaseDrawerOverDoors = (p: Omit<CabinetProps, "openingPattern" | "height" | "depth"> & { height?: number; depth?: number }) => (
  <RectCabinet {...p} openingPattern="drawerOverDoors" height={p.height ?? 34.5} depth={p.depth ?? 24} />
);
export const SinkBase = (p: Omit<CabinetProps, "openingPattern" | "height" | "depth"> & { height?: number; depth?: number }) => (
  <RectCabinet {...p} openingPattern="sinkBase" height={p.height ?? 34.5} depth={p.depth ?? 24} />
);

// WALL
export const WallSingleDoor = (p: Omit<CabinetProps, "openingPattern" | "depth"> & { depth?: number }) => (
  <RectCabinet {...p} openingPattern="singleWallDoor" depth={p.depth ?? 12} />
);
export const WallDoubleDoor = (p: Omit<CabinetProps, "openingPattern" | "depth"> & { depth?: number }) => (
  <RectCabinet {...p} openingPattern="doubleWallDoor" depth={p.depth ?? 12} />
);

// TALL
export const PantrySingleDoor = (p: Omit<CabinetProps, "openingPattern" | "depth" | "height"> & { depth?: number; height?: number }) => (
  <RectCabinet {...p} openingPattern="singlePantry" depth={p.depth ?? 24} height={p.height ?? 84} />
);
export const PantryDoubleDoor = (p: Omit<CabinetProps, "openingPattern" | "depth" | "height"> & { depth?: number; height?: number }) => (
  <RectCabinet {...p} openingPattern="doublePantry" depth={p.depth ?? 24} height={p.height ?? 84} />
);
export const OvenTall = (p: Omit<CabinetProps, "openingPattern" | "depth" | "height"> & { depth?: number; height?: number }) => (
  <RectCabinet {...p} openingPattern="ovenTall" depth={p.depth ?? 24} height={p.height ?? 90} />
);

/** ===== Corner cabinets ===== */
export const BlindCornerBase = memo(function BlindCornerBase(rawProps: CornerCabinetProps & { blindInset?: number }) {
  const {
    rotation: rawRotation,
    roomHalfW = 0,
    roomHalfD = 0,
    wallThickness = 0.1,
    ...groupRest
  } = rawProps;
  const {
    width,
    depth = width,
    height = 34.5,
    blindInset = 12,
    toeKick = defaults.toeKick,
    frameSystem = "fullOverlay",
    doorStyle = defaults.doorStyle,
    doorFrameWidth = defaults.doorFrameWidth,
    doorColor = DEFAULT_DOOR_COLOR,
    frameColor = DEFAULT_DOOR_COLOR,
    doorThickness = defaults.doorThickness,
    ...rest
  } = groupRest;

  const inset = clamp(blindInset, 4, Math.min(width, depth) - 1);
  const carcassHeight = Math.max(height - toeKick, 0);

  debugCabinet("corner.render", {
    variant: "blind-corner-base",
    width,
    depth,
    height,
    blindInset: inset,
    frameSystem,
    doorStyle,
    groupPosition: summarizeVector(groupRest.position),
    requestedRotation: summarizeVector(rawRotation),
    appliedRotation: summarizeVector(rawRotation),
  });

  const carcassGeometry = useMemo(
    () =>
      createCornerExtrudeGeometry(width, depth, carcassHeight, {
        type: "l",
        notchX: inset,
        notchZ: inset,
      }),
    [width, depth, inset, carcassHeight]
  );
  const toeGeometry = useMemo(
    () =>
      toeKick > 0
        ? createCornerExtrudeGeometry(width, depth, toeKick, {
            type: "l",
            notchX: inset,
            notchZ: inset,
          })
        : null,
    [width, depth, inset, toeKick]
  );

  const doorMaterial = getDoorMaterial(doorColor);
  const frameMaterial = getDoorMaterial(frameColor);
  const toeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#444", roughness: 0.9 }),
    []
  );

  const doorClearBottom = toeKick + (frameSystem === "frameless" ? 0 : defaults.rail);
  const doorHeight = Math.max(0, height - doorClearBottom - DOOR_TOP_GAP - DOOR_BOTTOM_GAP);
  const doorCenterY = doorClearBottom + DOOR_BOTTOM_GAP + doorHeight / 2;
  const frontSpan = Math.max(width - inset, 0);
  const doorWidth = Math.max(0, frontSpan - DOOR_SIDE_GAP * 2);

  const rotationY = 0;
  const insetOffset = frameSystem === "inset" ? defaults.insetClearance : 0;
  const doorPosX = inches(inset + frontSpan / 2);
  const doorPosY = inches(doorCenterY);
  const doorPosZ = inches(depth - doorThickness / 2 - insetOffset);

  const hx = inches(width) / 2;
  const hz = inches(depth) / 2;

  const pivotRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  const wallSnapTokenRef = useRef<string | null>(null);
  const baseCornerDeps: React.DependencyList = [
    width,
    depth,
    height,
    inset,
    toeKick,
    frameSystem,
    doorStyle,
    doorFrameWidth,
    doorColor,
    frameColor,
    doorThickness,
    rawRotation,
    rest.scale,
  ];
  useCornerContentOrigin(pivotRef, contentRef, baseCornerDeps);
  useCornerPivot(pivotRef, contentRef, baseCornerDeps);

  useLayoutEffect(() => {
    const pivot = pivotRef.current;
    const content = contentRef.current;
    if (!pivot || !content) return;
    if (!Number.isFinite(roomHalfW) || !Number.isFinite(roomHalfD) || !Number.isFinite(wallThickness)) return;
    const worldPosition = toVectorComponents(groupRest.position);
    const isBackRight = worldPosition ? worldPosition.x >= 0 && worldPosition.z <= 0 : false;
    if (!isBackRight) return;

    pivot.updateMatrixWorld(true);
    content.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(content);
    if (!Number.isFinite(bbox.max.x) || !Number.isFinite(bbox.min.z)) return;

    const xTarget = roomHalfW - wallThickness;
    const zTarget = -(roomHalfD - wallThickness);
    const dx = xTarget - bbox.max.x;
    const dz = zTarget - bbox.min.z;

    const token = `${xTarget.toFixed(4)}|${zTarget.toFixed(4)}|${bbox.max.x.toFixed(4)}|${bbox.min.z.toFixed(4)}`;
    if (wallSnapTokenRef.current === token) return;

    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) {
      wallSnapTokenRef.current = token;
      return;
    }

    const nextX = content.position.x + dx;
    const nextZ = content.position.z + dz;
    content.position.set(nextX, content.position.y, nextZ);
    content.updateMatrixWorld(true);
    wallSnapTokenRef.current = token;

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[corner-wall-align][BlindCornerBase]', {
        target: { x: xTarget, z: zTarget },
        bbox: {
          min: summarizeVector(bbox.min),
          max: summarizeVector(bbox.max),
        },
        appliedDelta: { dx, dz },
      });
    }
  }, [
    roomHalfW,
    roomHalfD,
    wallThickness,
    width,
    depth,
    rawRotation,
    groupRest.position,
  ]);

  return (
    <group {...rest} rotation={rawRotation as any}>
      <group ref={pivotRef}>
        <group ref={contentRef}>
          <group position={[-hx, 0, -hz]}>
            {toeGeometry && (
              <mesh geometry={toeGeometry} receiveShadow material={toeMaterial} />
            )}
            <group position={[0, inches(toeKick), 0]}>
              {carcassGeometry && <mesh geometry={carcassGeometry} material={frameMaterial} castShadow receiveShadow />}
            </group>
            {doorWidth > 0 && doorHeight > 0 && (
              <group position={[doorPosX, doorPosY, doorPosZ]} rotation={[0, rotationY, 0]}>
                <DoorFace
                  w={doorWidth}
                  h={doorHeight}
                  style={doorStyle}
                  thickness={doorThickness}
                  frameW={doorFrameWidth}
                  material={doorMaterial}
                />
              </group>
            )}
          </group>
        </group>
      </group>
    </group>
  );
});

export const BlindCornerWall = memo(function BlindCornerWall(rawProps: CornerCabinetProps & { blindInset?: number }) {
  const {
    roomHalfW: _roomHalfW,
    roomHalfD: _roomHalfD,
    wallThickness: _wallThickness,
    ...groupRest
  } = rawProps;
  const {
    width,
    depth = width,
    height = 36,
    blindInset = 8,
    frameSystem = "fullOverlay",
    doorStyle = defaults.doorStyle,
    doorFrameWidth = defaults.doorFrameWidth,
    doorColor = DEFAULT_DOOR_COLOR,
    frameColor = DEFAULT_DOOR_COLOR,
    doorThickness = defaults.doorThickness,
    shelfCount = 2,
    ...rest
  } = groupRest;

  const inset = clamp(blindInset, 3, Math.min(width, depth) - 1);
  debugCabinet("corner.render", {
    variant: "blind-corner-wall",
    width,
    depth,
    height,
    blindInset: inset,
    frameSystem,
    doorStyle,
    shelfCount,
    groupPosition: summarizeVector(rest.position),
    groupRotation: summarizeVector(rest.rotation),
  });
  const carcassGeometry = useMemo(
    () =>
      createCornerExtrudeGeometry(width, depth, height, {
        type: "diagonal",
        inset,
      }),
    [width, depth, inset, height]
  );

  const shelfThickness = 0.75;
  const shelfInset = clamp(inset - 0.75, 2, Math.min(width, depth) - 1.5);
  const shelfGeometry = useMemo(
    () =>
      createCornerExtrudeGeometry(
        Math.max(width - 0.75, 1),
        Math.max(depth - 0.75, 1),
        shelfThickness,
        {
          type: "diagonal",
          inset: shelfInset,
        }
      ),
    [width, depth, shelfInset, shelfThickness]
  );
  const shelfPositions = useMemo(() => {
    if (shelfCount <= 0) return [];
    const usableHeight = height - shelfThickness;
    const step = usableHeight / (shelfCount + 1);
    return Array.from({ length: shelfCount }, (_, idx) => (idx + 1) * step);
  }, [height, shelfCount, shelfThickness]);

  const doorMaterial = getDoorMaterial(doorColor);
  const frameMaterial = getDoorMaterial(frameColor);

  const doorClearBottom = frameSystem === "frameless" ? 0 : defaults.rail;
  const doorHeight = Math.max(0, height - doorClearBottom - DOOR_TOP_GAP - DOOR_BOTTOM_GAP);
  const doorCenterY = doorClearBottom + DOOR_BOTTOM_GAP + doorHeight / 2;
  const diagonalClear = Math.max(inset - DOOR_SIDE_GAP * 2, 3);
  const doorWidth = Math.max(0, diagonalClear * Math.SQRT2);

  const diagonalMidX = width - inset / 2;
  const diagonalMidZ = depth - inset / 2;
  const rotationY = -Math.PI * 3 / 4;
  const unitNormal = Math.SQRT1_2;
  const outwardNormalX = -unitNormal;
  const outwardNormalZ = -unitNormal;
  const doorFrontOffset = frameSystem === "inset" ? -doorThickness / 2 + 0.001 : doorThickness / 2 - 0.001;
  const doorPosX = inches(diagonalMidX + doorFrontOffset * outwardNormalX);
  const doorPosY = inches(doorCenterY);
  const doorPosZ = inches(diagonalMidZ + doorFrontOffset * outwardNormalZ);

  const pivotRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  const cornerDeps: React.DependencyList = [
    width,
    depth,
    height,
    inset,
    frameSystem,
    doorStyle,
    doorFrameWidth,
    doorColor,
    frameColor,
    doorThickness,
    shelfCount,
    rest.rotation,
    rest.scale,
  ];
  useCornerContentOrigin(pivotRef, contentRef, cornerDeps);
  useCornerPivot(pivotRef, contentRef, cornerDeps);

  return (
    <group {...rest}>
      <group ref={pivotRef}>
        <group ref={contentRef}>
          {carcassGeometry && <mesh geometry={carcassGeometry} material={frameMaterial} castShadow receiveShadow />}
          {shelfGeometry &&
            shelfPositions.map((pos, idx) => (
              <mesh
                key={idx}
                geometry={shelfGeometry}
                material={wood}
                position={[0, inches(pos - shelfThickness / 2), 0]}
                receiveShadow
              />
            ))}
          {doorWidth > 0 && doorHeight > 0 && (
            <group position={[doorPosX, doorPosY, doorPosZ]} rotation={[0, rotationY, 0]}>
              <DoorFace
                w={doorWidth}
                h={doorHeight}
                style={doorStyle}
                thickness={doorThickness}
                frameW={doorFrameWidth}
                material={doorMaterial}
              />
            </group>
          )}
        </group>
      </group>
    </group>
  );
});

export const LCornerBase = memo(function LCornerBase({
  legA,
  legB,
  height = 34.5,
  depth = 24,
  frameColor = DEFAULT_DOOR_COLOR,
  doorColor = DEFAULT_DOOR_COLOR,
  ...rest
}: ThreeElements['group'] & {
  legA: number;
  legB: number;
  height?: number;
  depth?: number;
  frameColor?: string;
  doorColor?: string;
  frameSystem?: FrameSystem;
  doorStyle?: DoorStyle;
}) {
  const frameMaterial = getDoorMaterial(frameColor);
  const doorMaterial = getDoorMaterial(doorColor);
  const pivotRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  useCornerPivot(pivotRef, contentRef, [
    legA,
    legB,
    height,
    depth,
    frameColor,
    doorColor,
    rest.rotation,
    rest.scale,
  ]);

  debugCabinet("corner.render", {
    variant: "l-corner-base",
    legA,
    legB,
    height,
    depth,
    frameColor,
    doorColor,
    groupPosition: summarizeVector(rest.position),
    groupRotation: summarizeVector(rest.rotation),
  });

  return (
    <group {...rest}>
      <group ref={pivotRef}>
        <group ref={contentRef}>
          <mesh castShadow receiveShadow position={[inches(legA / 2 - depth / 2), inches(height / 2), -inches(depth / 2)]} material={frameMaterial}>
            <boxGeometry args={[inches(legA - depth), inches(height), inches(depth)]} />
          </mesh>
          <mesh castShadow receiveShadow position={[inches(-depth / 2), inches(height / 2), -inches(legB / 2)]} material={frameMaterial}>
            <boxGeometry args={[inches(depth), inches(height), inches(legB - depth)]} />
          </mesh>
          <group rotation={[0, Math.PI / 4, 0]} position={[0, inches(6 + (height - 6) / 2), -inches(depth / 2)]}>
            <DoorFace
              w={24}
              h={height - 6}
              style="slab"
              thickness={0.75}
              frameW={defaults.doorFrameWidth}
              material={doorMaterial}
            />
          </group>
        </group>
      </group>
    </group>
  );
});




