import { Vector3 } from 'three';

// --- Canonical Schemas (Artifact #1) ---

export interface Frame {
  roomType: 'kitchen' | 'bathroom';
  style: string;
  layout: string;
  dimensions: {
    width: number;
    depth: number;
    height?: number;
  };
  appliances: any;
  cabinets: any;
  countertops: any;
  floorMaterial: string;
}

export type ID = string;

export interface Question {
  id: string;
  prompt: string;
  type: 'enum' | 'string' | 'number' | 'bool';
  choices?: string[];
  next?: (ans: unknown) => string; // Defines branching logic
}

export interface StyleTemplate {
  id: ID;
  version: string;
  roomType: 'kitchen' | 'bath';
  questions: Question[];
  defaults: Record<string, unknown>;
}

export interface RoomState {
  id: ID;
  version: string;
  styleTemplateId: ID;
  params: Record<string, unknown>;
  room: {
    widthIn: number;
    depthIn: number;
    heightIn: number;
    wallThicknessIn: number;
    openings: Opening[];
  };
  items: Item[];
  seed: string;
}

export interface Opening {
  id: ID;
  kind: 'door' | 'window';
  x: number; // Position along the wall in inches
  y: number; // Elevation from floor to center in inches
  wallId: ID; // e.g., 'W0', 'W1', 'W2', 'W3'
  widthIn: number;
  heightIn: number;
  sillIn?: number;
  swing?: 'L' | 'R' | 'SL' | 'SR';
}

export interface Item {
  id: ID;
  sku: string;
  anchor: 'wall' | 'floor';
  x: number; // Position in inches
  y: number; // Position in inches
  rotDeg: number;
  meta: Record<string, unknown>;
}

// --- Command Set (Artifact #2) ---

export type Cmd =
 | {
     t: 'set_param';
     k: string;
     v: unknown;
   }
 | {
     t: 'add_item';
     sku: string;
     at: { x: number; y: number };
     rotDeg?: number;
   }
 | {
     t: 'move_item';
     id: string;
     to: { x: number; y: number };
   }
 | {
     t: 'rotate_item';
     id: string;
     rotDeg: number;
   }
 | {
     t: 'delete_item';
     id: string;
   }
 | {
     t: 'set_opening';
     opening: Opening;
   };


// --- Legacy & UI-Specific Types ---
// These types are used by the current UI and will be phased out or adapted.

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export type ObjectType = 'cabinet_base' | 'cabinet_wall' | 'refrigerator' | 'oven' | 'sink' | 'island' | 'toilet' | 'shower' | 'vanity' | 'window' | 'bathtub' | 'opening' | 'vent_hood' | 'dishwasher' | 'cooktop';

export interface FloorplanObject {
  id: string;
  type: ObjectType;
  position: Vector3;
  rotation: Vector3;
  dimensions: Dimensions;
  color: string;
  material: string;
  countertopMaterial?: string;
  countertopColor?: string;
}

export interface Room {
  type: 'kitchen' | 'bathroom';
  dimensions: {
    width: number;
    depth: number;
  };
  floorMaterial: string;
}

export interface Floorplan {
  room: Room;
  objects: FloorplanObject[];
}

export interface Choice {
  name: string;
  description: string;
  material: string;
  imageUrl?: string;
}

export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
  choices?: Choice[];
  expectsFreeFormInput?: boolean;
}
